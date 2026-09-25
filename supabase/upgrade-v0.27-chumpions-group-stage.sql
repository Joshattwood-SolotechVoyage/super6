-- Super 6 v0.27 — Chumpions League group-stage foundation
-- Run once after v0.26. Safe to re-run.
--
-- Chumpions rules in this build:
--   * Admin manually decides, round by round, whether a Super 6 week also counts.
--   * Four groups: A, B, C and D.
--   * Head-to-head score = each player's normal counted Super 6 points that week.
--   * Group match: 3 points win, 1 draw, 0 loss.
--   * Group ranking: group points -> head-to-head mini-table -> total Chumpions
--     Super 6 points -> cumulative first-goal accuracy.
--   * If still tied, the UI flags it for an Admin decision later.
--   * Top four from each group are the qualifying places for the future Round of 16.

alter table super6.rounds
  add column if not exists chumpions_league boolean not null default false;

create table if not exists super6.chumpions_members (
  season_id uuid not null references super6.seasons(id) on delete cascade,
  player_id uuid not null references super6.profiles(id) on delete cascade,
  group_code text not null check (group_code in ('A','B','C','D')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id)
);

create table if not exists super6.chumpions_matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references super6.seasons(id) on delete cascade,
  round_id uuid not null references super6.rounds(id) on delete cascade,
  group_code text not null check (group_code in ('A','B','C','D')),
  player1_id uuid not null references super6.profiles(id) on delete cascade,
  player2_id uuid not null references super6.profiles(id) on delete cascade,
  player1_score smallint check (player1_score >= 0),
  player2_score smallint check (player2_score >= 0),
  player1_tiebreak smallint check (player1_tiebreak >= 0),
  player2_tiebreak smallint check (player2_tiebreak >= 0),
  status text not null default 'scheduled' check (status in ('scheduled','completed','review')),
  winner_id uuid references super6.profiles(id) on delete set null,
  is_draw boolean not null default false,
  calculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player1_id <> player2_id),
  unique (round_id, player1_id, player2_id)
);

create index if not exists idx_chumpions_members_group
  on super6.chumpions_members(season_id, group_code);
create index if not exists idx_chumpions_matches_round
  on super6.chumpions_matches(round_id, group_code);
create index if not exists idx_chumpions_matches_season
  on super6.chumpions_matches(season_id, group_code);

alter table super6.chumpions_members enable row level security;
alter table super6.chumpions_matches enable row level security;

-- Everyone signed in can browse the competition. Only admins can change it.
drop policy if exists "chumpions members readable" on super6.chumpions_members;
create policy "chumpions members readable"
  on super6.chumpions_members for select to authenticated using (true);

drop policy if exists "admin manage chumpions members" on super6.chumpions_members;
create policy "admin manage chumpions members"
  on super6.chumpions_members for all to authenticated
  using (super6.is_admin()) with check (super6.is_admin());

drop policy if exists "chumpions matches readable" on super6.chumpions_matches;
create policy "chumpions matches readable"
  on super6.chumpions_matches for select to authenticated using (true);

drop policy if exists "admin manage chumpions matches" on super6.chumpions_matches;
create policy "admin manage chumpions matches"
  on super6.chumpions_matches for all to authenticated
  using (super6.is_admin()) with check (super6.is_admin());

grant select, insert, update, delete on super6.chumpions_members to authenticated;
grant select, insert, update, delete on super6.chumpions_matches to authenticated;
grant all privileges on super6.chumpions_members to service_role;
grant all privileges on super6.chumpions_matches to service_role;

-- Admin controls the cup-week checkbox explicitly for each normal Super 6 round.
create or replace function super6.admin_set_chumpions_round(
  p_round_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
begin
  if not super6.is_admin() then
    raise exception 'Admin access required.';
  end if;

  if not exists (select 1 from super6.rounds where id = p_round_id) then
    raise exception 'Round not found.';
  end if;

  if exists (select 1 from super6.rounds where id = p_round_id and status = 'completed') then
    raise exception 'A completed round cannot be changed into or out of a Chumpions League week.';
  end if;

  update super6.rounds
  set chumpions_league = coalesce(p_enabled, false),
      updated_at = now()
  where id = p_round_id;

  -- Unticking an open round removes that week's still-unplayed cup pairings so
  -- there is no hidden Chumpions fixture left attached to a normal week.
  if not coalesce(p_enabled, false) then
    delete from super6.chumpions_matches
    where round_id = p_round_id and status <> 'completed';
  end if;

  insert into super6.audit_log(admin_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'set_chumpions_round',
    'round',
    p_round_id::text,
    jsonb_build_object('enabled', coalesce(p_enabled, false))
  );
end;
$$;

-- Assign/remove a player from one of the four groups.
create or replace function super6.admin_set_chumpions_member(
  p_player_id uuid,
  p_group_code text
)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_season_id uuid;
  v_group text := upper(nullif(trim(p_group_code), ''));
begin
  if not super6.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select id into v_season_id
  from super6.seasons
  where status = 'active'
  order by created_at desc
  limit 1;

  if v_season_id is null then
    raise exception 'No active season.';
  end if;

  if not exists (
    select 1 from super6.profiles
    where id = p_player_id and role = 'player'
  ) then
    raise exception 'Player not found.';
  end if;

  if v_group is null then
    delete from super6.chumpions_members
    where season_id = v_season_id and player_id = p_player_id;
    return;
  end if;

  if v_group not in ('A','B','C','D') then
    raise exception 'Group must be A, B, C or D.';
  end if;

  insert into super6.chumpions_members(season_id, player_id, group_code)
  values (v_season_id, p_player_id, v_group)
  on conflict (season_id, player_id)
  do update set group_code = excluded.group_code, updated_at = now();
end;
$$;

-- Add one manual head-to-head tie for a Chumpions-enabled Super 6 round.
create or replace function super6.admin_add_chumpions_match(
  p_round_id uuid,
  p_group_code text,
  p_player1_id uuid,
  p_player2_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_season_id uuid;
  v_group text := upper(trim(p_group_code));
  v_match_id uuid;
begin
  if not super6.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select season_id into v_season_id
  from super6.rounds
  where id = p_round_id
    and chumpions_league = true
    and status <> 'completed';

  if v_season_id is null then
    raise exception 'Tick Chumpions League on this open round first.';
  end if;

  if p_player1_id = p_player2_id then
    raise exception 'Choose two different players.';
  end if;

  if not exists (
    select 1 from super6.chumpions_members
    where season_id = v_season_id and player_id = p_player1_id and group_code = v_group
  ) or not exists (
    select 1 from super6.chumpions_members
    where season_id = v_season_id and player_id = p_player2_id and group_code = v_group
  ) then
    raise exception 'Both players must be members of the selected group.';
  end if;

  if exists (
    select 1
    from super6.chumpions_matches m
    where m.round_id = p_round_id
      and (m.player1_id in (p_player1_id, p_player2_id)
        or m.player2_id in (p_player1_id, p_player2_id))
  ) then
    raise exception 'One of these players already has a Chumpions fixture this week.';
  end if;

  insert into super6.chumpions_matches(
    season_id, round_id, group_code, player1_id, player2_id
  ) values (
    v_season_id, p_round_id, v_group, p_player1_id, p_player2_id
  )
  returning id into v_match_id;

  return v_match_id;
end;
$$;

create or replace function super6.admin_delete_chumpions_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
begin
  if not super6.is_admin() then
    raise exception 'Admin access required.';
  end if;

  if exists (
    select 1
    from super6.chumpions_matches m
    join super6.rounds r on r.id = m.round_id
    where m.id = p_match_id and r.status = 'completed'
  ) then
    raise exception 'Completed Chumpions fixtures cannot be deleted.';
  end if;

  delete from super6.chumpions_matches where id = p_match_id;
end;
$$;

-- Re-score the Chumpions head-to-heads whenever a completed Super 6 round is
-- calculated/recalculated (including payment changes during the grace window).
create or replace function super6.chumpions_recalculate_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_enabled boolean;
  v_status text;
begin
  if auth.uid() is not null and not super6.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select chumpions_league, status
    into v_enabled, v_status
  from super6.rounds
  where id = p_round_id;

  if not found then
    raise exception 'Round not found.';
  end if;

  if not v_enabled then
    return;
  end if;

  if v_status <> 'completed' then
    update super6.chumpions_matches
    set player1_score = null,
        player2_score = null,
        player1_tiebreak = null,
        player2_tiebreak = null,
        status = 'scheduled',
        winner_id = null,
        is_draw = false,
        calculated_at = null,
        updated_at = now()
    where round_id = p_round_id;
    return;
  end if;

  update super6.chumpions_matches m
  set player1_score = case when r1.counted then r1.points else null end,
      player2_score = case when r2.counted then r2.points else null end,
      player1_tiebreak = case when r1.counted then r1.tie_break_difference else null end,
      player2_tiebreak = case when r2.counted then r2.tie_break_difference else null end,
      status = case when coalesce(r1.counted,false) and coalesce(r2.counted,false) then 'completed' else 'review' end,
      winner_id = case
        when coalesce(r1.counted,false) and coalesce(r2.counted,false) and r1.points > r2.points then m.player1_id
        when coalesce(r1.counted,false) and coalesce(r2.counted,false) and r2.points > r1.points then m.player2_id
        else null
      end,
      is_draw = case
        when coalesce(r1.counted,false) and coalesce(r2.counted,false) and r1.points = r2.points then true
        else false
      end,
      calculated_at = now(),
      updated_at = now()
  from super6.round_player_results r1,
       super6.round_player_results r2
  where m.round_id = p_round_id
    and r1.round_id = p_round_id and r1.player_id = m.player1_id
    and r2.round_id = p_round_id and r2.player_id = m.player2_id;

  -- Any tie where one/both players do not have a result row must still be visible
  -- for Admin review rather than silently disappearing.
  update super6.chumpions_matches m
  set status = 'review',
      player1_score = null,
      player2_score = null,
      player1_tiebreak = null,
      player2_tiebreak = null,
      winner_id = null,
      is_draw = false,
      calculated_at = now(),
      updated_at = now()
  where m.round_id = p_round_id
    and (
      not exists (
        select 1 from super6.round_player_results r1
        where r1.round_id = p_round_id and r1.player_id = m.player1_id and r1.counted = true
      )
      or not exists (
        select 1 from super6.round_player_results r2
        where r2.round_id = p_round_id and r2.player_id = m.player2_id and r2.counted = true
      )
    );
end;
$$;

revoke all on function super6.admin_set_chumpions_round(uuid, boolean) from public;
revoke all on function super6.admin_set_chumpions_member(uuid, text) from public;
revoke all on function super6.admin_add_chumpions_match(uuid, text, uuid, uuid) from public;
revoke all on function super6.admin_delete_chumpions_match(uuid) from public;
revoke all on function super6.chumpions_recalculate_round(uuid) from public;

grant execute on function super6.admin_set_chumpions_round(uuid, boolean) to authenticated, service_role;
grant execute on function super6.admin_set_chumpions_member(uuid, text) to authenticated, service_role;
grant execute on function super6.admin_add_chumpions_match(uuid, text, uuid, uuid) to authenticated, service_role;
grant execute on function super6.admin_delete_chumpions_match(uuid) to authenticated, service_role;
grant execute on function super6.chumpions_recalculate_round(uuid) to authenticated, service_role;
