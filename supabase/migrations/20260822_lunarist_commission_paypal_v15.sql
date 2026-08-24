-- Phase 2 payment completion: safe additive migration.
create unique index if not exists commissions_paypal_order_unique
  on public.commissions(paypal_order_id)
  where paypal_order_id is not null;
create index if not exists commissions_created_status_idx
  on public.commissions(created_at desc, status);
