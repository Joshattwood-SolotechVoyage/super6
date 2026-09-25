-- Super 6 v0.28 — Chumpions League knockout stage
-- Run once after v0.27. Safe to re-run.
--
-- Adds:
--   * Admin confirmation of the final four group tables.
--   * Automatic Round of 16 seeding: A1-B4, B1-A4, C1-D4, D1-C4,
--     A2-B3, B2-A3, C2-D3, D2-C3.
--   * Admin still chooses each Chumpions week manually with the existing checkbox.
--     After the group stage is confirmed, ticking a week automatically attaches the
--     next unfinished knockout stage to that Super 6 round.
--   * Knockout tie-break: Super 6 points -> closest first-goal prediction -> Admin.
--   * Automatic advancement R16 -> QF -> SF -> Final.

create table if not exists super6.chumpions_competition_state (
  season_id uuid primary key references super6.seasons(id) on delete cascade,
  group_stage_confirmed boolean not null default false,
  group_stage_confirmed_at timestamptz,
  group_stage_confirmed_by uuid references super6.profiles(id) on delete set null,
  champion_id uuid references super6.profiles(id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists super6.chumpions_group_finalists (
  season_id uuid not null references super6.seasons(id) on delete cascade,
  group_code text not null check (group_code in ('A','B','C','D')),
  position smallint not null check (position between 1 and 4),
  player_id uuid not null references super6.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (season_id, group_code, position),
  unique (season_id, player_id)
);

create table if not exists super6.chumpions_knockout_matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references super6.seasons(id) on delete cascade,
  stage text not null check (stage in ('R16','QF','SF','F')),
  slot_no smallint not null,
  round_id uuid references super6.rounds(id) on delete set null,
  player1_id uuid not null references super6.profiles(id) on delete cascade,
  player2_id uuid not null references super6.profiles(id) on delete cascade,
  player1_score smallint check (player1_score >= 0),
  player2_score smallint check (player2_score >= 0),
  player1_tiebreak smallint check (player1_tiebreak >= 0),
  player2_tiebreak smallint check (player2_tiebreak >= 0),
  status text not null default 'waiting' check (status in ('waiting','scheduled','completed','review')),
  winner_id uuid references super6.profiles(id) on delete set null,
  decided_by text check (decided_by in ('score','first_goal','admin')),
  calculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player1_id <> player2_id),
  unique (season_id, stage, slot_no)
);

create index if not exists idx_chumpions_knockout_round
  on super6.chumpions_knockout_matches(round_id);
create index if not exists idx_chumpions_knockout_stage
  on super6.chumpions_knockout_matches(season_id, stage, slot_no);

alter table super6.chumpions_competition_state enable row level security;
alter table super6.chumpions_group_finalists enable row level security;
alter table super6.chumpions_knockout_matches enable row level security;

drop policy if exists "chumpions state readable" on super6.chumpions_competition_state;
create policy "chumpions state readable"
  on super6.chumpions_competition_state for select to authenticated using (true);
drop policy if exists "admin manage chumpions state" on super6.chumpions_competition_state;
create policy "admin manage chumpions state"
  on super6.chumpions_competition_state for all to authenticated
  using (super6.is_admin()) with check (super6.is_admin());

drop policy if exists "chumpions finalists readable" on super6.chumpions_group_finalists;
create policy "chumpions finalists readable"
  on super6.chumpions_group_finalists for select to authenticated using (true);
drop policy if exists "admin manage chumpions finalists" on super6.chumpions_group_finalists;
create policy "admin manage chumpions finalists"
  on super6.chumpions_group_finalists for all to authenticated
  using (super6.is_admin()) with check (super6.is_admin());

drop policy if exists "chumpions knockout readable" on super6.chumpions_knockout_matches;
create policy "chumpions knockout readable"
  on super6.chumpions_knockout_matches for select to authenticated using (true);
drop policy if exists "admin manage chumpions knockout" on super6.chumpions_knockout_matches;
create policy "admin manage chumpions knockout"
  on super6.chumpions_knockout_matches for all to authenticated
  using (super6.is_admin()) with check (super6.is_admin());

grant select on super6.chumpions_competition_state to authenticated;
grant select on super6.chumpions_group_finalists to authenticated;
grant select on super6.chumpions_knockout_matches to authenticated;
grant all privileges on super6.chumpions_competition_state to service_role;
grant all privileges on super6.chumpions_group_finalists to service_role;
grant all privileges on super6.chumpions_knockout_matches to service_role;

-- Lock group membership after the group tables are confirmed.
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

  if exists (
    select 1 from super6.chumpions_competition_state
    where season_id = v_season_id and group_stage_confirmed = true
  ) then
    raise exception 'The Chumpions group stage has been confirmed. Group membership is locked.';
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

-- Once Admin is happy with the final standings, snapshot the top four in each
-- group and create the Round of 16 bracket. The app passes the displayed order.
create or replace function super6.admin_confirm_chumpions_groups(
  p_group_a uuid[],
  p_group_b uuid[],
  p_group_c uuid[],
  p_group_d uuid[]
)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_season_id uuid;
  v_all uuid[];
  v_count integer;
  g text;
  arr uuid[];
  i integer;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid;
  b1 uuid; b2 uuid; b3 uuid; b4 uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
  d1 uuid; d2 uuid; d3 uuid; d4 uuid;
begin
  if not super6.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select id into v_season_id
  from super6.seasons
  where status = 'active'
  order by created_at desc
  limit 1;

  if v_season_id is null then raise exception 'No active season.'; end if;

  if exists (
    select 1 from super6.chumpions_competition_state
    where season_id = v_season_id and group_stage_confirmed = true
  ) then
    raise exception 'The Chumpions group stage has already been confirmed.';
  end if;

  if coalesce(array_length(p_group_a,1),0) <> 4
     or coalesce(array_length(p_group_b,1),0) <> 4
     or coalesce(array_length(p_group_c,1),0) <> 4
     or coalesce(array_length(p_group_d,1),0) <> 4 then
    raise exception 'Exactly four qualifiers are required from each group.';
  end if;

  v_all := p_group_a || p_group_b || p_group_c || p_group_d;
  select count(distinct u.player_id) into v_count from unnest(v_all) as u(player_id);
  if v_count <> 16 then
    raise exception 'The 16 qualifying players must all be different.';
  end if;

  foreach g in array array['A','B','C','D'] loop
    arr := case g when 'A' then p_group_a when 'B' then p_group_b when 'C' then p_group_c else p_group_d end;
    for i in 1..4 loop
      if not exists (
        select 1 from super6.chumpions_members m
        where m.season_id = v_season_id
          and m.group_code = g
          and m.player_id = arr[i]
      ) then
        raise exception 'Every qualifier must belong to the group being confirmed.';
      end if;
    end loop;
  end loop;

  delete from super6.chumpions_group_finalists where season_id = v_season_id;
  delete from super6.chumpions_knockout_matches where season_id = v_season_id;

  for i in 1..4 loop
    insert into super6.chumpions_group_finalists(season_id, group_code, position, player_id)
    values
      (v_season_id,'A',i,p_group_a[i]),
      (v_season_id,'B',i,p_group_b[i]),
      (v_season_id,'C',i,p_group_c[i]),
      (v_season_id,'D',i,p_group_d[i]);
  end loop;

  a1:=p_group_a[1]; a2:=p_group_a[2]; a3:=p_group_a[3]; a4:=p_group_a[4];
  b1:=p_group_b[1]; b2:=p_group_b[2]; b3:=p_group_b[3]; b4:=p_group_b[4];
  c1:=p_group_c[1]; c2:=p_group_c[2]; c3:=p_group_c[3]; c4:=p_group_c[4];
  d1:=p_group_d[1]; d2:=p_group_d[2]; d3:=p_group_d[3]; d4:=p_group_d[4];

  insert into super6.chumpions_knockout_matches(season_id,stage,slot_no,player1_id,player2_id,status)
  values
    (v_season_id,'R16',1,a1,b4,'waiting'),
    (v_season_id,'R16',2,b1,a4,'waiting'),
    (v_season_id,'R16',3,c1,d4,'waiting'),
    (v_season_id,'R16',4,d1,c4,'waiting'),
    (v_season_id,'R16',5,a2,b3,'waiting'),
    (v_season_id,'R16',6,b2,a3,'waiting'),
    (v_season_id,'R16',7,c2,d3,'waiting'),
    (v_season_id,'R16',8,d2,c3,'waiting');

  insert into super6.chumpions_competition_state(
    season_id, group_stage_confirmed, group_stage_confirmed_at,
    group_stage_confirmed_by, updated_at
  ) values (
    v_season_id, true, now(), auth.uid(), now()
  )
  on conflict (season_id) do update set
    group_stage_confirmed = true,
    group_stage_confirmed_at = now(),
    group_stage_confirmed_by = auth.uid(),
    champion_id = null,
    completed_at = null,
    updated_at = now();

  insert into super6.audit_log(admin_id, action, entity_type, entity_id, details)
  values (
    auth.uid(), 'confirm_chumpions_groups', 'season', v_season_id::text,
    jsonb_build_object('qualifiers',16,'round_of_16_created',true)
  );
end;
$$;

-- Internal helper: when a knockout stage is fully decided, build the next one.
create or replace function super6.chumpions_try_advance_stage(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  w1 uuid; w2 uuid; w3 uuid; w4 uuid; w5 uuid; w6 uuid; w7 uuid; w8 uuid;
begin
  -- R16 -> Quarter Finals
  if (select count(*) from super6.chumpions_knockout_matches where season_id=p_season_id and stage='R16') = 8
     and not exists (select 1 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='R16' and status <> 'completed')
     and not exists (select 1 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='QF') then
    select winner_id into w1 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='R16' and slot_no=1;
    select winner_id into w2 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='R16' and slot_no=2;
    select winner_id into w3 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='R16' and slot_no=3;
    select winner_id into w4 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='R16' and slot_no=4;
    select winner_id into w5 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='R16' and slot_no=5;
    select winner_id into w6 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='R16' and slot_no=6;
    select winner_id into w7 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='R16' and slot_no=7;
    select winner_id into w8 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='R16' and slot_no=8;
    insert into super6.chumpions_knockout_matches(season_id,stage,slot_no,player1_id,player2_id,status)
    values
      (p_season_id,'QF',1,w1,w2,'waiting'),
      (p_season_id,'QF',2,w3,w4,'waiting'),
      (p_season_id,'QF',3,w5,w6,'waiting'),
      (p_season_id,'QF',4,w7,w8,'waiting');
  end if;

  -- Quarter Finals -> Semi Finals
  if (select count(*) from super6.chumpions_knockout_matches where season_id=p_season_id and stage='QF') = 4
     and not exists (select 1 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='QF' and status <> 'completed')
     and not exists (select 1 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='SF') then
    select winner_id into w1 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='QF' and slot_no=1;
    select winner_id into w2 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='QF' and slot_no=2;
    select winner_id into w3 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='QF' and slot_no=3;
    select winner_id into w4 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='QF' and slot_no=4;
    insert into super6.chumpions_knockout_matches(season_id,stage,slot_no,player1_id,player2_id,status)
    values
      (p_season_id,'SF',1,w1,w2,'waiting'),
      (p_season_id,'SF',2,w3,w4,'waiting');
  end if;

  -- Semi Finals -> Final
  if (select count(*) from super6.chumpions_knockout_matches where season_id=p_season_id and stage='SF') = 2
     and not exists (select 1 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='SF' and status <> 'completed')
     and not exists (select 1 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='F') then
    select winner_id into w1 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='SF' and slot_no=1;
    select winner_id into w2 from super6.chumpions_knockout_matches where season_id=p_season_id and stage='SF' and slot_no=2;
    insert into super6.chumpions_knockout_matches(season_id,stage,slot_no,player1_id,player2_id,status)
    values (p_season_id,'F',1,w1,w2,'waiting');
  end if;

  -- Final completed -> store champion.
  if exists (
    select 1 from super6.chumpions_knockout_matches
    where season_id=p_season_id and stage='F' and slot_no=1 and status='completed' and winner_id is not null
  ) then
    insert into super6.chumpions_competition_state(season_id, group_stage_confirmed, champion_id, completed_at, updated_at)
    select p_season_id, true, winner_id, now(), now()
    from super6.chumpions_knockout_matches
    where season_id=p_season_id and stage='F' and slot_no=1
    on conflict (season_id) do update set
      champion_id=excluded.champion_id,
      completed_at=coalesce(super6.chumpions_competition_state.completed_at,excluded.completed_at),
      updated_at=now();
  end if;
end;
$$;

-- Keep the existing simple week-by-week checkbox. Once the group stage is
-- confirmed, ticking it attaches the next unfinished knockout stage.
create or replace function super6.admin_set_chumpions_round(
  p_round_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_season_id uuid;
  v_completed boolean;
  v_group_confirmed boolean := false;
  v_stage text;
  v_other_round uuid;
begin
  if not super6.is_admin() then raise exception 'Admin access required.'; end if;

  select season_id, (status='completed') into v_season_id, v_completed
  from super6.rounds where id=p_round_id;
  if v_season_id is null then raise exception 'Round not found.'; end if;
  if v_completed then raise exception 'A completed round cannot be changed into or out of a Chumpions League week.'; end if;

  select coalesce(group_stage_confirmed,false) into v_group_confirmed
  from super6.chumpions_competition_state where season_id=v_season_id;
  v_group_confirmed := coalesce(v_group_confirmed,false);

  if not coalesce(p_enabled,false) then
    update super6.rounds set chumpions_league=false, updated_at=now() where id=p_round_id;
    delete from super6.chumpions_matches where round_id=p_round_id and status <> 'completed';
    update super6.chumpions_knockout_matches
      set round_id=null, status='waiting', updated_at=now()
    where round_id=p_round_id and status in ('waiting','scheduled');
  else
    update super6.rounds set chumpions_league=true, updated_at=now() where id=p_round_id;

    if v_group_confirmed then
      select stage into v_stage
      from super6.chumpions_knockout_matches
      where season_id=v_season_id and status <> 'completed'
      order by case stage when 'R16' then 1 when 'QF' then 2 when 'SF' then 3 else 4 end, slot_no
      limit 1;

      if v_stage is not null then
        select round_id into v_other_round
        from super6.chumpions_knockout_matches
        where season_id=v_season_id and stage=v_stage and round_id is not null
        limit 1;

        if v_other_round is not null and v_other_round <> p_round_id then
          raise exception 'The current Chumpions knockout stage is already attached to another Super 6 round.';
        end if;

        update super6.chumpions_knockout_matches
        set round_id=p_round_id, status='scheduled', updated_at=now()
        where season_id=v_season_id and stage=v_stage and status='waiting' and round_id is null;
      end if;
    end if;
  end if;

  insert into super6.audit_log(admin_id, action, entity_type, entity_id, details)
  values (auth.uid(),'set_chumpions_round','round',p_round_id::text,
    jsonb_build_object('enabled',coalesce(p_enabled,false),'knockout_stage',v_stage));
end;
$$;

-- Re-score both group and knockout fixtures whenever a normal Super 6 round is
-- completed or recalculated.
create or replace function super6.chumpions_recalculate_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_enabled boolean;
  v_status text;
  v_season_id uuid;
begin
  if auth.uid() is not null and not super6.is_admin() then raise exception 'Admin access required.'; end if;

  select chumpions_league, status, season_id into v_enabled, v_status, v_season_id
  from super6.rounds where id=p_round_id;
  if not found then raise exception 'Round not found.'; end if;
  if not v_enabled then return; end if;

  if v_status <> 'completed' then
    update super6.chumpions_matches
    set player1_score=null, player2_score=null, player1_tiebreak=null, player2_tiebreak=null,
        status='scheduled', winner_id=null, is_draw=false, calculated_at=null, updated_at=now()
    where round_id=p_round_id;
    update super6.chumpions_knockout_matches
    set player1_score=null, player2_score=null, player1_tiebreak=null, player2_tiebreak=null,
        status='scheduled', winner_id=null, decided_by=null, calculated_at=null, updated_at=now()
    where round_id=p_round_id;
    return;
  end if;

  -- Group-stage fixtures retain their 3/1/0 behaviour.
  update super6.chumpions_matches m
  set player1_score = case when r1.counted then r1.points else null end,
      player2_score = case when r2.counted then r2.points else null end,
      player1_tiebreak = case when r1.counted then r1.tie_break_difference else null end,
      player2_tiebreak = case when r2.counted then r2.tie_break_difference else null end,
      status = case when coalesce(r1.counted,false) and coalesce(r2.counted,false) then 'completed' else 'review' end,
      winner_id = case
        when coalesce(r1.counted,false) and coalesce(r2.counted,false) and r1.points > r2.points then m.player1_id
        when coalesce(r1.counted,false) and coalesce(r2.counted,false) and r2.points > r1.points then m.player2_id
        else null end,
      is_draw = case when coalesce(r1.counted,false) and coalesce(r2.counted,false) and r1.points = r2.points then true else false end,
      calculated_at=now(), updated_at=now()
  from super6.round_player_results r1, super6.round_player_results r2
  where m.round_id=p_round_id
    and r1.round_id=p_round_id and r1.player_id=m.player1_id
    and r2.round_id=p_round_id and r2.player_id=m.player2_id;

  update super6.chumpions_matches m
  set status='review', player1_score=null, player2_score=null, player1_tiebreak=null, player2_tiebreak=null,
      winner_id=null, is_draw=false, calculated_at=now(), updated_at=now()
  where m.round_id=p_round_id and (
    not exists (select 1 from super6.round_player_results r where r.round_id=p_round_id and r.player_id=m.player1_id and r.counted=true)
    or not exists (select 1 from super6.round_player_results r where r.round_id=p_round_id and r.player_id=m.player2_id and r.counted=true)
  );

  -- Knockout fixtures: points, then closest first-goal prediction.
  update super6.chumpions_knockout_matches m
  set player1_score = case when r1.counted then r1.points else null end,
      player2_score = case when r2.counted then r2.points else null end,
      player1_tiebreak = case when r1.counted then r1.tie_break_difference else null end,
      player2_tiebreak = case when r2.counted then r2.tie_break_difference else null end,
      status = case
        when not (coalesce(r1.counted,false) and coalesce(r2.counted,false)) then 'review'
        when r1.points <> r2.points then 'completed'
        when r1.tie_break_difference is not null and r2.tie_break_difference is not null and r1.tie_break_difference <> r2.tie_break_difference then 'completed'
        else 'review' end,
      winner_id = case
        when not (coalesce(r1.counted,false) and coalesce(r2.counted,false)) then null
        when r1.points > r2.points then m.player1_id
        when r2.points > r1.points then m.player2_id
        when r1.tie_break_difference is not null and r2.tie_break_difference is not null and r1.tie_break_difference < r2.tie_break_difference then m.player1_id
        when r1.tie_break_difference is not null and r2.tie_break_difference is not null and r2.tie_break_difference < r1.tie_break_difference then m.player2_id
        else null end,
      decided_by = case
        when not (coalesce(r1.counted,false) and coalesce(r2.counted,false)) then null
        when r1.points <> r2.points then 'score'
        when r1.tie_break_difference is not null and r2.tie_break_difference is not null and r1.tie_break_difference <> r2.tie_break_difference then 'first_goal'
        else null end,
      calculated_at=now(), updated_at=now()
  from super6.round_player_results r1, super6.round_player_results r2
  where m.round_id=p_round_id
    and r1.round_id=p_round_id and r1.player_id=m.player1_id
    and r2.round_id=p_round_id and r2.player_id=m.player2_id;

  update super6.chumpions_knockout_matches m
  set status='review', winner_id=null, decided_by=null, calculated_at=now(), updated_at=now()
  where m.round_id=p_round_id and (
    not exists (select 1 from super6.round_player_results r where r.round_id=p_round_id and r.player_id=m.player1_id and r.counted=true)
    or not exists (select 1 from super6.round_player_results r where r.round_id=p_round_id and r.player_id=m.player2_id and r.counted=true)
  );

  perform super6.chumpions_try_advance_stage(v_season_id);
end;
$$;

-- Final fallback for an exact knockout tie (or an Admin-reviewed fixture).
create or replace function super6.admin_choose_chumpions_knockout_winner(
  p_match_id uuid,
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_match super6.chumpions_knockout_matches%rowtype;
begin
  if not super6.is_admin() then raise exception 'Admin access required.'; end if;

  select * into v_match from super6.chumpions_knockout_matches where id=p_match_id;
  if not found then raise exception 'Knockout match not found.'; end if;
  if v_match.status <> 'review' then raise exception 'This knockout match does not need an Admin decision.'; end if;
  if p_player_id not in (v_match.player1_id,v_match.player2_id) then raise exception 'Choose one of the two players in this match.'; end if;

  update super6.chumpions_knockout_matches
  set winner_id=p_player_id, status='completed', decided_by='admin', updated_at=now(), calculated_at=coalesce(calculated_at,now())
  where id=p_match_id;

  insert into super6.audit_log(admin_id, action, entity_type, entity_id, details)
  values (auth.uid(),'choose_chumpions_knockout_winner','chumpions_knockout_match',p_match_id::text,
    jsonb_build_object('winner_id',p_player_id));

  perform super6.chumpions_try_advance_stage(v_match.season_id);
end;
$$;

revoke all on function super6.admin_confirm_chumpions_groups(uuid[],uuid[],uuid[],uuid[]) from public;
revoke all on function super6.chumpions_try_advance_stage(uuid) from public;
revoke all on function super6.admin_choose_chumpions_knockout_winner(uuid,uuid) from public;
revoke all on function super6.admin_set_chumpions_round(uuid,boolean) from public;
revoke all on function super6.chumpions_recalculate_round(uuid) from public;
revoke all on function super6.admin_set_chumpions_member(uuid,text) from public;

grant execute on function super6.admin_confirm_chumpions_groups(uuid[],uuid[],uuid[],uuid[]) to authenticated, service_role;
grant execute on function super6.admin_choose_chumpions_knockout_winner(uuid,uuid) to authenticated, service_role;
grant execute on function super6.admin_set_chumpions_round(uuid,boolean) to authenticated, service_role;
grant execute on function super6.chumpions_recalculate_round(uuid) to authenticated, service_role;
grant execute on function super6.admin_set_chumpions_member(uuid,text) to authenticated, service_role;
grant execute on function super6.chumpions_try_advance_stage(uuid) to service_role;
