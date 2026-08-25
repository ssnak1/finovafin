-- ============================================================================
-- Vincula o cartão de crédito à conta que paga a fatura.
-- Conta e cartão continuam registros separados de propósito: uma guarda saldo
-- (ativo), o outro guarda dívida (passivo). O vínculo é o que faltava.
-- Rode no SQL Editor do Supabase. É idempotente.
-- ============================================================================

alter table public.accounts
  add column if not exists linked_account_id uuid references public.accounts (id) on delete set null;

-- Uma conta não pode se vincular a si mesma
do $$ begin
  alter table public.accounts
    add constraint accounts_linked_not_self check (linked_account_id is null or linked_account_id <> id);
exception when duplicate_object then null; end $$;

create index if not exists accounts_linked_account_idx
  on public.accounts (linked_account_id);

-- A view precisa expor a coluna nova
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
  a.linked_account_id,
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
