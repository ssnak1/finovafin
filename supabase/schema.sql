-- ============================================================================
-- Aureum — schema de gestão financeira pessoal
-- Rode este arquivo inteiro no SQL Editor do Supabase (Dashboard > SQL Editor).
-- É idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.account_type as enum ('checking', 'savings', 'credit_card', 'cash', 'investment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.category_kind as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_type as enum ('income', 'expense', 'transfer');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles — dados do usuário, 1:1 com auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- accounts — contas e carteiras (banco, cartão, dinheiro...)
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  type             public.account_type not null default 'checking',
  initial_balance  numeric(14, 2) not null default 0,
  color            text not null default '#8B7355',
  institution      text,
  archived         boolean not null default false,
  created_at       timestamptz not null default now()
);

-- Para bancos que já existiam antes da coluna ser criada
alter table public.accounts add column if not exists institution text;

create index if not exists accounts_user_id_idx on public.accounts (user_id);

-- ---------------------------------------------------------------------------
-- categories — categorias de receita e despesa
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  kind        public.category_kind not null,
  color       text not null default '#8B7355',
  created_at  timestamptz not null default now(),
  unique (user_id, name, kind)
);

create index if not exists categories_user_id_idx on public.categories (user_id);

-- ---------------------------------------------------------------------------
-- transactions — lançamentos (receita, despesa, transferência)
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  account_id     uuid not null references public.accounts (id) on delete cascade,
  to_account_id  uuid references public.accounts (id) on delete cascade,
  category_id    uuid references public.categories (id) on delete set null,
  type           public.transaction_type not null,
  amount         numeric(14, 2) not null check (amount > 0),
  description    text,
  occurred_on    date not null default current_date,
  created_at     timestamptz not null default now(),

  -- Transferência exige conta destino diferente da origem e não usa categoria.
  -- Receita e despesa nunca têm conta destino.
  constraint transactions_shape_check check (
    case type
      when 'transfer' then to_account_id is not null
                       and to_account_id <> account_id
                       and category_id is null
      else to_account_id is null
    end
  )
);

create index if not exists transactions_user_occurred_idx on public.transactions (user_id, occurred_on desc);
create index if not exists transactions_account_idx      on public.transactions (account_id);
create index if not exists transactions_to_account_idx   on public.transactions (to_account_id);
create index if not exists transactions_category_idx     on public.transactions (category_id);

-- ---------------------------------------------------------------------------
-- account_balances — saldo calculado por conta.
-- security_invoker faz a view respeitar o RLS de quem está consultando.
-- ---------------------------------------------------------------------------
drop view if exists public.account_balances;

create view public.account_balances
with (security_invoker = on) as
select
  a.id             as account_id,
  a.user_id,
  a.name,
  a.type,
  a.color,
  a.institution,
  a.archived,
  a.initial_balance,
  a.initial_balance
    + coalesce(sum(t.amount) filter (where t.type = 'income'   and t.account_id    = a.id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'expense'  and t.account_id    = a.id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'transfer' and t.account_id    = a.id), 0)
    + coalesce(sum(t.amount) filter (where t.type = 'transfer' and t.to_account_id = a.id), 0)
                   as balance
from public.accounts a
left join public.transactions t
  on t.account_id = a.id or t.to_account_id = a.id
group by a.id;

-- ---------------------------------------------------------------------------
-- Row Level Security — cada usuário só enxerga o que é dele
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.accounts     enable row level security;
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists accounts_all_own on public.accounts;
create policy accounts_all_own on public.accounts
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists categories_all_own on public.categories;
create policy categories_all_own on public.categories
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists transactions_all_own on public.transactions;
create policy transactions_all_own on public.transactions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Ao criar um usuário: cria o profile, uma carteira padrão e as categorias
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.accounts (user_id, name, type, color)
  values (new.id, 'Carteira', 'cash', '#8B7355');

  insert into public.categories (user_id, name, kind, color) values
    (new.id, 'Salário',         'income',  '#4C9A6A'),
    (new.id, 'Freelance',       'income',  '#6BA88A'),
    (new.id, 'Investimentos',   'income',  '#3E7F58'),
    (new.id, 'Outras receitas', 'income',  '#8FBFA3'),
    (new.id, 'Moradia',         'expense', '#8B7355'),
    (new.id, 'Alimentação',     'expense', '#C4703D'),
    (new.id, 'Transporte',      'expense', '#5B7C99'),
    (new.id, 'Saúde',           'expense', '#B8556B'),
    (new.id, 'Educação',        'expense', '#7A6BA8'),
    (new.id, 'Lazer',           'expense', '#D19A3C'),
    (new.id, 'Compras',         'expense', '#A8746B'),
    (new.id, 'Outras despesas', 'expense', '#8A8A8A')
  on conflict (user_id, name, kind) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
