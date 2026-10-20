-- Super 6 v0.34.6 — audited manual Admin-only weekly points overrides.
-- Prepared for review; never apply this migration without deployment/testing approval.
-- Preserves the original predictions, full scoring, payment eligibility and existing audit log.

begin;

create table if not exists super6.admin_points_overrides (
  round_id uuid not null references super6.rounds(id) on delete cascade,
  player_id uuid not null references super6.profiles(id) on delete cascade,
  points smallint not null check (points between 0 and 30),
  reason text not null check (length(btrim(reason)) between 8 and 500),
  updated_by uuid not null references super6.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id)
);
alter table super6.admin_points_overrides enable row level security;
revoke all on table super6.admin_points_overrides from public, anon, authenticated;
grant select on table super6.admin_points_overrides to authenticated;
drop policy if exists admin_select_points_overrides on super6.admin_points_overrides;
create policy admin_select_points_overrides on super6.admin_points_overrides
  for select to authenticated using (super6.is_admin());

-- Original recalculate_round() deletes/reinserts scored rows. Apply any override
-- as the effective points are inserted, without modifying the underlying guesses.
create or replace function super6._manual_points_on_score_insert()
returns trigger language plpgsql security definer
set search_path to 'super6', 'pg_temp'
as $function$
declare v_override smallint;
begin
  select o.points into v_override
  from super6.admin_points_overrides o
  where o.round_id = new.round_id and o.player_id = new.player_id;
  if found then new.points := v_override; end if;
  return new;
end;
$function$;
drop trigger if exists trg_apply_manual_points_override on super6.round_player_results;
create trigger trg_apply_manual_points_override
  before insert on super6.round_player_results for each row
  execute function super6._manual_points_on_score_insert();

-- Rebuild rankings, crowns, seconds and spoons from effective points after ALL
-- rows have been inserted, not from the unmodified scoring CTE's initial ranking.
create or replace function super6._normalise_after_manual_points()
returns trigger language plpgsql security definer
set search_path to 'super6', 'pg_temp'
as $function$
declare v_round_id uuid;
begin
  for v_round_id in select distinct round_id from inserted_rows loop
    if exists (
      select 1 from super6.admin_points_overrides o where o.round_id = v_round_id
    ) then
      perform super6.normalise_round_awards(v_round_id);
    end if;
  end loop;
  return null;
end;
$function$;
drop trigger if exists trg_normalise_manual_points_after_insert on super6.round_player_results;
create trigger trg_normalise_manual_points_after_insert
  after insert on super6.round_player_results
  referencing new table as inserted_rows
  for each statement
  execute function super6._normalise_after_manual_points();

create or replace function super6.admin_set_player_points_override(
  p_round_id uuid,
  p_player_id uuid,
  p_points integer,
  p_reason text,
  p_clear boolean default false
) returns jsonb language plpgsql security definer
set search_path to 'super6', 'pg_temp'
as $function$
declare
  v_status text;
  v_cutoff timestamptz;
  v_hours integer;
  v_reason text := btrim(coalesce(p_reason,''));
  v_previous smallint;
  v_previous_exists boolean;
  v_effective smallint;
begin
  if not super6.is_admin() then
    raise exception 'Admin access required';
  end if;
  if length(v_reason) not between 8 and 500 then
    raise exception 'Please enter a reason (8–500 characters) for this points correction';
  end if;

  select status,cutoff_at into v_status,v_cutoff
  from super6.rounds where id=p_round_id for update;
  if not found then raise exception 'Round not found'; end if;
  if v_status <> 'completed' then
    raise exception 'Complete the round before changing player points';
  end if;

  select coalesce(admin_entry_edit_hours,168) into v_hours
  from super6.app_settings where id=1;
  v_hours := coalesce(v_hours,168);
  if now() >= v_cutoff+make_interval(hours=>v_hours) then
    raise exception 'The Admin score correction window has closed';
  end if;

  if not exists (
    select 1 from super6.round_player_results s
    join super6.payments pay on pay.round_id=s.round_id
      and pay.player_id=s.player_id and pay.paid=true
    join super6.entries e on e.round_id=s.round_id and e.player_id=s.player_id
    where s.round_id=p_round_id and s.player_id=p_player_id and s.counted=true
  ) then
    raise exception 'Only a paid player with a counted entry can have points overridden';
  end if;

  select points into v_previous from super6.admin_points_overrides
  where round_id=p_round_id and player_id=p_player_id for update;
  v_previous_exists := found;

  if p_clear then
    if not v_previous_exists then raise exception 'No override is active for this player'; end if;
    delete from super6.admin_points_overrides
    where round_id=p_round_id and player_id=p_player_id;
  else
    if p_points is null or p_points not between 0 and 30 then
      raise exception 'Points must be a whole number between 0 and 30';
    end if;
    insert into super6.admin_points_overrides(
      round_id,player_id,points,reason,updated_by,updated_at
    ) values (p_round_id,p_player_id,p_points,v_reason,auth.uid(),now())
    on conflict(round_id,player_id) do update
      set points=excluded.points,reason=excluded.reason,
          updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end if;

  -- The BEFORE INSERT trigger reapplies overrides and the AFTER INSERT trigger
  -- normalises league positions; cup scorers read the effective points.
  perform super6.recalculate_round(p_round_id);
  perform super6.normalise_round_awards(p_round_id);
  perform super6.chumpions_recalculate_round(p_round_id);
  perform super6.nohope_recalculate_round(p_round_id);
  perform super6._refresh_fall_round(p_round_id);
  perform super6.shart_recalculate_round(p_round_id);

  select points into v_effective from super6.round_player_results
  where round_id=p_round_id and player_id=p_player_id;

  insert into super6.audit_log(admin_id,action,entity_type,entity_id,details)
  values (
    auth.uid(),
    case when p_clear then 'admin_clear_points_override' else 'admin_set_points_override' end,
    'round_player_result',
    p_round_id::text || ':' || p_player_id::text,
    jsonb_build_object(
      'round_id',p_round_id,'player_id',p_player_id,
      'previous_override',v_previous,
      'new_override',case when p_clear then null else p_points end,
      'effective_points',v_effective,
      'reason',v_reason,'edited_at',now()
    )
  );
  return jsonb_build_object(
    'round_id',p_round_id,'player_id',p_player_id,
    'points',v_effective,'override_active',not p_clear
  );
end;
$function$;

revoke all on function super6.admin_set_player_points_override(uuid,uuid,integer,text,boolean)
  from public, anon;
grant execute on function super6.admin_set_player_points_override(uuid,uuid,integer,text,boolean)
  to authenticated;

commit;
