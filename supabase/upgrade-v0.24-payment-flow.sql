-- Super 6 v0.24 — player payment pending + Monzo payment link
-- Run this ONCE in Supabase SQL Editor before using the new payment buttons.
-- Safe to re-run: column additions are IF NOT EXISTS and the function is replaced.

alter table super6.app_settings
  add column if not exists payment_url text;

alter table super6.payments
  add column if not exists player_claimed_paid boolean not null default false,
  add column if not exists claimed_at timestamptz;

create or replace function super6.mark_my_payment_pending(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cutoff timestamptz;
  v_grace_hours integer := 12;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select r.cutoff_at
    into v_cutoff
  from super6.rounds r
  where r.id = p_round_id;

  if v_cutoff is null then
    raise exception 'Round not found.';
  end if;

  if not exists (
    select 1
    from super6.entries e
    where e.round_id = p_round_id
      and e.player_id = v_user_id
  ) then
    raise exception 'Submit your predictions before marking payment as paid.';
  end if;

  select coalesce(s.payment_grace_hours, 12)
    into v_grace_hours
  from super6.app_settings s
  where s.id = 1;

  v_grace_hours := coalesce(v_grace_hours, 12);

  if now() >= v_cutoff + make_interval(hours => v_grace_hours) then
    raise exception 'The payment window has closed.';
  end if;

  -- If Admin has already confirmed payment, there is nothing else to do.
  if exists (
    select 1
    from super6.payments p
    where p.round_id = p_round_id
      and p.player_id = v_user_id
      and p.paid = true
  ) then
    return;
  end if;

  insert into super6.payments (
    round_id,
    player_id,
    paid,
    player_claimed_paid,
    claimed_at,
    updated_at,
    updated_by
  )
  values (
    p_round_id,
    v_user_id,
    false,
    true,
    now(),
    now(),
    v_user_id
  )
  on conflict (round_id, player_id)
  do update set
    player_claimed_paid = true,
    claimed_at = now(),
    updated_at = now(),
    updated_by = v_user_id;
end;
$$;

grant execute on function super6.mark_my_payment_pending(uuid) to authenticated;
grant execute on function super6.mark_my_payment_pending(uuid) to service_role;
