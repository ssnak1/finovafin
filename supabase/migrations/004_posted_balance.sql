-- ============================================================================
-- Separa "saldo já realizado" de "saldo total".
--
-- Uma compra em 12x cria 12 lançamentos, e 11 têm data futura. Somando tudo
-- sem olhar a data, a parcela de dezembro virava dívida de hoje: a fatura em
-- aberto aparecia inflada e o limite disponível, menor do que é.
--
--   balance         -> tudo, inclusive o que ainda vai chegar.
--                      É o limite comprometido: a operadora reserva o valor
--                      total da compra parcelada na hora.
--   posted_balance  -> só o que já aconteceu até hoje.
--                      É "quanto tenho" e "quanto devo agora".
--
-- Rode no SQL Editor do Supabase. É idempotente.
-- ============================================================================

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
                   as balance,

  -- Mesma conta, restrita ao que já ocorreu. O fuso é fixado em São Paulo
  -- porque `current_date` sozinho usa UTC e viraria o dia cedo demais aqui.
  a.initial_balance
    + coalesce(sum(t.amount) filter (
        where t.type = 'income' and t.account_id = a.id
          and t.occurred_on <= (now() at time zone 'America/Sao_Paulo')::date), 0)
    - coalesce(sum(t.amount) filter (
        where t.type = 'expense' and t.account_id = a.id
          and t.occurred_on <= (now() at time zone 'America/Sao_Paulo')::date), 0)
    - coalesce(sum(t.amount) filter (
        where t.type = 'transfer' and t.account_id = a.id
          and t.occurred_on <= (now() at time zone 'America/Sao_Paulo')::date), 0)
    + coalesce(sum(t.amount) filter (
        where t.type = 'transfer' and t.to_account_id = a.id
          and t.occurred_on <= (now() at time zone 'America/Sao_Paulo')::date), 0)
                   as posted_balance

from public.accounts a
left join public.transactions t
  on t.account_id = a.id or t.to_account_id = a.id
group by a.id;
