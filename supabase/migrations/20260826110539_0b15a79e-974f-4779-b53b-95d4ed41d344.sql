-- Bank transfer payment method: customer submits proof, staff verifies, order is confirmed.

create table if not exists public.transfer_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  bank_reference text not null,
  sender_name text,
  proof_path text,
  status text not null default 'submitted',
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists transfer_payments_order_idx on public.transfer_payments(order_id);
create index if not exists transfer_payments_status_idx on public.transfer_payments(status, created_at desc);

grant select, insert on public.transfer_payments to authenticated;
grant all on public.transfer_payments to service_role;

alter table public.transfer_payments enable row level security;

create policy transfer_payments_read on public.transfer_payments
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff(auth.uid()));

create policy transfer_payments_own_insert on public.transfer_payments
  for insert to authenticated
  with check (customer_id = auth.uid());

-- Bank account details are edited by super admins and read through a definer function.
insert into public.platform_settings (key, value)
values ('bank_transfer_account', '{"bank_name": null, "account_name": null, "account_number": null, "instructions": null}'::jsonb)
on conflict (key) do nothing;

create or replace function public.bank_transfer_account()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value from public.platform_settings where key = 'bank_transfer_account'),
    '{}'::jsonb
  )
$$;

grant execute on function public.bank_transfer_account() to authenticated, anon;

-- Customer submits a transfer for an unpaid order.
create or replace function public.submit_transfer_payment(
  _order_id uuid,
  _bank_reference text,
  _sender_name text default null,
  _proof_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare _o public.orders; _acct jsonb; _id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if coalesce(btrim(_bank_reference), '') = '' then
    raise exception 'A transfer reference is required';
  end if;

  _acct := public.bank_transfer_account();
  if coalesce(_acct->>'account_number','') = '' then
    raise exception 'TRANSFER_UNAVAILABLE: Bank transfer details are not configured yet';
  end if;

  select * into _o from public.orders where id = _order_id;
  if _o.id is null then raise exception 'Order not found'; end if;
  if _o.customer_id <> auth.uid() then raise exception 'Not permitted'; end if;
  if _o.payment_status = 'paid' then raise exception 'This order is already paid'; end if;

  if exists (select 1 from public.transfer_payments
              where order_id = _order_id and status = 'submitted') then
    raise exception 'A transfer for this order is already awaiting review';
  end if;

  insert into public.transfer_payments (order_id, customer_id, amount, bank_reference,
    sender_name, proof_path)
  values (_order_id, auth.uid(), _o.total, btrim(_bank_reference),
    nullif(btrim(coalesce(_sender_name,'')),''), nullif(btrim(coalesce(_proof_path,'')),''))
  returning id into _id;

  update public.payments
     set provider = 'transfer', provider_reference = btrim(_bank_reference), status = 'pending'
   where order_id = _order_id;

  insert into public.notifications (user_id, title, body, link)
  select ur.user_id, 'Bank transfer to verify',
    'Order ' || _o.order_number || ' has a transfer awaiting confirmation.', '/admin/payments'
  from public.user_roles ur where ur.role in ('admin','super_admin');

  return jsonb_build_object('transfer_id', _id, 'status', 'submitted');
end $$;

grant execute on function public.submit_transfer_payment(uuid, text, text, text) to authenticated;

-- Staff approve or reject a submitted transfer.
create or replace function public.admin_review_transfer_payment(
  _transfer_id uuid,
  _approve boolean,
  _note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare _t public.transfer_payments; _o public.orders;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not permitted'; end if;

  select * into _t from public.transfer_payments where id = _transfer_id for update;
  if _t.id is null then raise exception 'Transfer not found'; end if;
  if _t.status <> 'submitted' then raise exception 'This transfer has already been reviewed'; end if;

  select * into _o from public.orders where id = _t.order_id;

  update public.transfer_payments
     set status = case when _approve then 'approved' else 'rejected' end,
         review_note = nullif(btrim(coalesce(_note,'')),''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = _transfer_id;

  if _approve then
    perform public.confirm_order_payment(_t.order_id, 'transfer', _t.bank_reference);
  else
    update public.payments set status = 'failed' where order_id = _t.order_id;
    insert into public.notifications (user_id, title, body, link)
    values (_t.customer_id, 'Transfer not confirmed',
      'We could not confirm your transfer for order ' || coalesce(_o.order_number,'') ||
      coalesce('. ' || nullif(btrim(coalesce(_note,'')),''), '') ||
      ' Please check the details and submit again.',
      '/orders/' || _t.order_id);
  end if;

  return jsonb_build_object('transfer_id', _transfer_id,
    'status', case when _approve then 'approved' else 'rejected' end);
end $$;

grant execute on function public.admin_review_transfer_payment(uuid, boolean, text) to authenticated;