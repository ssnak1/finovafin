-- ============================================================================
-- Cartão de crédito: fatura por competência, parcelamento, limite e pagamento.
-- Rode no SQL Editor do Supabase. É idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Campos do cartão (ficam nulos em contas que não são cartão)
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists credit_limit numeric(14, 2),
  add column if not exists closing_day  smallint,
  add column if not exists due_day      smallint;

do $$ begin
  alter table public.accounts
    add constraint accounts_closing_day_check check (closing_day between 1 and 31);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.accounts
    add constraint accounts_due_day_check check (due_day between 1 and 31);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Parcelamento: as parcelas de uma mesma compra compartilham o group_id.
-- Cada parcela é uma transação própria, com a data do mês em que cai — é isso
-- que faz ela aparecer na fatura certa sem nenhum cálculo extra.
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists installment_group  uuid,
  add column if not exists installment_number smallint,
  add column if not exists installment_total  smallint;

create index if not exists transactions_installment_group_idx
  on public.transactions (installment_group);

-- ---------------------------------------------------------------------------
-- Faturas pagas. `reference_month` é sempre o dia 1 do mês de competência.
-- Só existe linha para fatura paga: ausência = em aberto.
-- ---------------------------------------------------------------------------
create table if not exists public.card_statements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  account_id       uuid not null references public.accounts (id) on delete cascade,
  reference_month  date not null,
  paid_at          timestamptz not null default now(),
  payment_id       uuid references public.transactions (id) on delete set null,
  unique (account_id, reference_month)
);

create index if not exists card_statements_user_idx on public.card_statements (user_id);

alter table public.card_statements enable row level security;

drop policy if exists card_statements_all_own on public.card_statements;
create policy card_statements_all_own on public.card_statements
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- A view precisa expor os campos novos do cartão
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
  a.credit_limit,
  a.closing_day,
  a.due_day,
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
