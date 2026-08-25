-- ============================================================================
-- Adiciona a instituição financeira da conta (para exibir o logo do banco).
-- Rode no SQL Editor do Supabase. É idempotente.
-- ============================================================================

alter table public.accounts
  add column if not exists institution text;

-- A view precisa ser recriada para expor a coluna nova. `create or replace`
-- não aceita inserir coluna no meio da lista, então dropamos antes.
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
