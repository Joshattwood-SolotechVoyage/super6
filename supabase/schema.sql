-- SUPER 6 — Supabase production schema v0.9
-- Safe for a shared Supabase project: all Super 6 application objects live in the dedicated super6 schema.
-- Cup competitions are intentionally out of scope for this version.

create extension if not exists pgcrypto;

create schema if not exists super6;

create table if not exists super6.app_settings (
  id smallint primary key default 1 check (id = 1),
  default_entry_fee numeric(8,2) not null default 6.00,
  payment_grace_hours smallint not null default 12 check (payment_grace_hours between 0 and 72),
  updated_at timestamptz not null default now()
);
insert into super6.app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists super6.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists super6.leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references super6.seasons(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (season_id, name)
);

create table if not exists super6.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('admin','player')),
  league_id uuid references super6.leagues(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'admin' and league_id is null) or role = 'player')
);

create table if not exists super6.rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references super6.seasons(id) on delete cascade,
  name text not null,
  cutoff_at timestamptz not null,
  entry_fee numeric(8,2) not null default 6.00,
  status text not null default 'draft' check (status in ('draft','published','completed')),
  official_first_goal_minute smallint check (official_first_goal_minute between 1 and 90),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists super6.fixtures (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references super6.rounds(id) on delete cascade,
  sort_order smallint not null check (sort_order between 1 and 6),
  home_team text not null,
  away_team text not null,
  removed boolean not null default false,
  home_score smallint check (home_score >= 0),
  away_score smallint check (away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, sort_order)
);

create table if not exists super6.entries (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references super6.rounds(id) on delete cascade,
  player_id uuid not null references super6.profiles(id) on delete cascade,
  first_goal_minute smallint not null check (first_goal_minute between 1 and 90),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table if not exists super6.predictions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references super6.entries(id) on delete cascade,
  fixture_id uuid not null references super6.fixtures(id) on delete cascade,
  home_score smallint not null check (home_score >= 0),
  away_score smallint not null check (away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, fixture_id)
);

create table if not exists super6.payments (
  round_id uuid not null references super6.rounds(id) on delete cascade,
  player_id uuid not null references super6.profiles(id) on delete cascade,
  paid boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references super6.profiles(id) on delete set null,
  primary key (round_id, player_id)
);

create table if not exists super6.round_player_results (
  round_id uuid not null references super6.rounds(id) on delete cascade,
  player_id uuid not null references super6.profiles(id) on delete cascade,
  points smallint not null default 0 check (points >= 0),
  exact_scores smallint not null default 0 check (exact_scores >= 0),
  correct_results smallint not null default 0 check (correct_results >= 0),
  tie_break_difference smallint check (tie_break_difference >= 0),
  position smallint check (position > 0),
  is_winner boolean not null default false,
  is_second boolean not null default false,
  is_wooden_spoon boolean not null default false,
  counted boolean not null default true,
  calculated_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

create table if not exists super6.audit_log (
  id bigint generated by default as identity primary key,
  admin_id uuid references super6.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Lightweight archive retained after detailed weekly data is exported/cleared.
create table if not exists super6.season_final_standings (
  id bigint generated by default as identity primary key,
  season_id uuid not null references super6.seasons(id) on delete cascade,
  season_name text not null,
  league_name text not null,
  final_position smallint not null,
  player_name text not null,
  points integer not null default 0,
  wins integer not null default 0,
  exact_scores integer not null default 0,
  correct_results integer not null default 0,
  weeks_played integer not null default 0,
  wooden_spoons integer not null default 0,
  archived_at timestamptz not null default now()
);

create index if not exists idx_profiles_league on super6.profiles(league_id);
create index if not exists idx_rounds_season on super6.rounds(season_id, cutoff_at desc);
create index if not exists idx_fixtures_round on super6.fixtures(round_id, sort_order);
create index if not exists idx_entries_round on super6.entries(round_id, player_id);
create index if not exists idx_predictions_entry on super6.predictions(entry_id);
create index if not exists idx_results_player on super6.round_player_results(player_id, round_id);

-- Current season table. Ranking rule: points -> weekly wins -> exact scores -> shared position.
create or replace view super6.season_standings as
with totals as (
  select
    p.id as player_id,
    p.username,
    p.league_id,
    l.name as league_name,
    coalesce(sum(rpr.points) filter (where rpr.counted),0)::int as points,
    count(*) filter (where rpr.counted)::int as weeks_played,
    count(*) filter (where rpr.counted and rpr.is_winner)::int as wins,
    coalesce(sum(rpr.exact_scores) filter (where rpr.counted),0)::int as exact_scores,
    coalesce(sum(rpr.correct_results) filter (where rpr.counted),0)::int as correct_results,
    count(*) filter (where rpr.counted and rpr.is_wooden_spoon)::int as wooden_spoons
  from super6.profiles p
  left join super6.leagues l on l.id = p.league_id
  left join super6.round_player_results rpr on rpr.player_id = p.id
  where p.role = 'player'
  group by p.id,p.username,p.league_id,l.name
)
select
  rank() over (partition by league_id order by points desc, wins desc, exact_scores desc) as position,
  totals.*
from totals;

-- Helper functions for RLS.
create or replace function super6.is_admin()
returns boolean language sql stable security definer set search_path = super6 as $$
  select exists(select 1 from super6.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function super6.my_league_id()
returns uuid language sql stable security definer set search_path = super6 as $$
  select league_id from super6.profiles where id = auth.uid();
$$;

alter table super6.app_settings enable row level security;
alter table super6.seasons enable row level security;
alter table super6.leagues enable row level security;
alter table super6.profiles enable row level security;
alter table super6.rounds enable row level security;
alter table super6.fixtures enable row level security;
alter table super6.entries enable row level security;
alter table super6.predictions enable row level security;
alter table super6.payments enable row level security;
alter table super6.round_player_results enable row level security;
alter table super6.audit_log enable row level security;
alter table super6.season_final_standings enable row level security;

-- Readable competition structure for signed-in users.
create policy "authenticated read settings" on super6.app_settings for select to authenticated using (true);
create policy "authenticated read seasons" on super6.seasons for select to authenticated using (true);
create policy "authenticated read leagues" on super6.leagues for select to authenticated using (true);
create policy "authenticated read profiles" on super6.profiles for select to authenticated using (true);
create policy "authenticated read rounds" on super6.rounds for select to authenticated using (true);
create policy "authenticated read fixtures" on super6.fixtures for select to authenticated using (true);
create policy "authenticated read final archive" on super6.season_final_standings for select to authenticated using (true);

-- Predictions remain private: a player sees only their own; admins see all.
create policy "entry read own or admin" on super6.entries for select to authenticated
using (player_id = auth.uid() or super6.is_admin());
create policy "entry insert own before cutoff" on super6.entries for insert to authenticated
with check (
  player_id = auth.uid() and exists (
    select 1 from super6.rounds r where r.id = round_id and r.status = 'published' and now() < r.cutoff_at
  )
);
create policy "entry update own before cutoff" on super6.entries for update to authenticated
using (player_id = auth.uid() and exists (select 1 from super6.rounds r where r.id = round_id and now() < r.cutoff_at))
with check (player_id = auth.uid());
create policy "admin manage entries" on super6.entries for all to authenticated using (super6.is_admin()) with check (super6.is_admin());

create policy "prediction read own or admin" on super6.predictions for select to authenticated
using (exists(select 1 from super6.entries e where e.id = entry_id and (e.player_id = auth.uid() or super6.is_admin())));
create policy "prediction insert own before cutoff" on super6.predictions for insert to authenticated
with check (exists(select 1 from super6.entries e join super6.rounds r on r.id=e.round_id where e.id=entry_id and e.player_id=auth.uid() and now()<r.cutoff_at));
create policy "prediction update own before cutoff" on super6.predictions for update to authenticated
using (exists(select 1 from super6.entries e join super6.rounds r on r.id=e.round_id where e.id=entry_id and e.player_id=auth.uid() and now()<r.cutoff_at));
create policy "admin manage predictions" on super6.predictions for all to authenticated using (super6.is_admin()) with check (super6.is_admin());

-- Payment status: admin controls it; each player can see their own.
create policy "payment read own or admin" on super6.payments for select to authenticated
using (player_id = auth.uid() or super6.is_admin());
create policy "admin manage payments" on super6.payments for all to authenticated using (super6.is_admin()) with check (super6.is_admin());

-- Weekly results can be read by admins and by players in the same current league.
create policy "weekly result same league or admin" on super6.round_player_results for select to authenticated
using (
  super6.is_admin() or exists (
    select 1 from super6.profiles p where p.id = player_id and p.league_id = super6.my_league_id()
  )
);
create policy "admin manage weekly results" on super6.round_player_results for all to authenticated using (super6.is_admin()) with check (super6.is_admin());

-- All competition mutations outside prediction entry are admin-only.
create policy "admin manage settings" on super6.app_settings for all to authenticated using (super6.is_admin()) with check (super6.is_admin());
create policy "admin manage seasons" on super6.seasons for all to authenticated using (super6.is_admin()) with check (super6.is_admin());
create policy "admin manage leagues" on super6.leagues for all to authenticated using (super6.is_admin()) with check (super6.is_admin());
create policy "admin manage profiles" on super6.profiles for all to authenticated using (super6.is_admin()) with check (super6.is_admin());
create policy "admin manage rounds" on super6.rounds for all to authenticated using (super6.is_admin()) with check (super6.is_admin());
create policy "admin manage fixtures" on super6.fixtures for all to authenticated using (super6.is_admin()) with check (super6.is_admin());
create policy "admin audit read" on super6.audit_log for select to authenticated using (super6.is_admin());
create policy "admin audit insert" on super6.audit_log for insert to authenticated with check (super6.is_admin());
create policy "admin manage final archive" on super6.season_final_standings for all to authenticated using (super6.is_admin()) with check (super6.is_admin());

-- Seed the current season / three legacy league names.
insert into super6.seasons(name,status)
values ('2026/27','active')
on conflict (name) do nothing;

insert into super6.leagues(season_id,name,sort_order)
select s.id, x.name, x.sort_order
from super6.seasons s
cross join (values
  ('The Serie-As League',1),
  ('The Trampionship',2),
  ('Major Losers Syndicate',3)
) as x(name,sort_order)
where s.name='2026/27'
on conflict (season_id,name) do nothing;


-- Data API permissions for the dedicated Super 6 schema.
-- Do NOT grant this schema to anon; browser table access starts only after login.
revoke all on schema super6 from anon;
grant usage on schema super6 to authenticated, service_role;
grant select, insert, update, delete on all tables in schema super6 to authenticated;
grant usage, select on all sequences in schema super6 to authenticated;
grant execute on all functions in schema super6 to authenticated;
grant all privileges on all tables in schema super6 to service_role;
grant all privileges on all sequences in schema super6 to service_role;
grant execute on all functions in schema super6 to service_role;

alter default privileges for role postgres in schema super6
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema super6
  grant usage, select on sequences to authenticated;
alter default privileges for role postgres in schema super6
  grant execute on functions to authenticated;
alter default privileges for role postgres in schema super6
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema super6
  grant all privileges on sequences to service_role;
alter default privileges for role postgres in schema super6
  grant execute on functions to service_role;


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

-- Super 6 v0.25 — fixed £6 Monzo link + published league predictions
-- Run this once in Supabase SQL Editor after v0.24.
-- Safe to re-run.

-- Keep the Super 6 £6 Monzo link in the database.
alter table super6.app_settings
  add column if not exists payment_url text;

update super6.app_settings
set payment_url = 'https://monzo.me/daylehodge/6.00?h=GgbX1T&d=Super%206&account_type=personal',
    updated_at = now()
where id = 1;

-- Once Admin has completed/published the round results, players may see the
-- counted predictions of players in their own league. Before completion this
-- function deliberately returns no prediction data.
create or replace function super6.get_published_league_predictions(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_league_id uuid;
  v_round_status text;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select p.role, p.league_id
    into v_role, v_league_id
  from super6.profiles p
  where p.id = v_user_id;

  if v_role is null then
    raise exception 'Super 6 profile not found.';
  end if;

  select r.status
    into v_round_status
  from super6.rounds r
  where r.id = p_round_id;

  if v_round_status is null then
    raise exception 'Round not found.';
  end if;

  if v_round_status <> 'completed' then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', p.id,
        'username', p.username,
        'league_id', p.league_id,
        'league_name', l.name,
        'first_goal_minute', e.first_goal_minute,
        'fixture_id', f.id,
        'fixture_order', f.sort_order,
        'home_score', pr.home_score,
        'away_score', pr.away_score,
        'points', rr.points,
        'position', rr.position,
        'exact_scores', rr.exact_scores,
        'correct_results', rr.correct_results
      )
      order by rr.position, p.username, f.sort_order
    ),
    '[]'::jsonb
  )
  into v_result
  from super6.entries e
  join super6.profiles p on p.id = e.player_id
  join super6.leagues l on l.id = p.league_id
  join super6.round_player_results rr
    on rr.round_id = e.round_id
   and rr.player_id = e.player_id
   and rr.counted = true
  join super6.predictions pr on pr.entry_id = e.id
  join super6.fixtures f on f.id = pr.fixture_id
  where e.round_id = p_round_id
    and (v_role = 'admin' or p.league_id = v_league_id);

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function super6.get_published_league_predictions(uuid) from public;
grant execute on function super6.get_published_league_predictions(uuid) to authenticated;
grant execute on function super6.get_published_league_predictions(uuid) to service_role;
-- Super 6 v0.26 — league-week awards + all-league latest predictions
-- Run this once in Supabase SQL Editor after v0.25.
-- Safe to re-run.

-- Keep the fixed £6 Monzo link in place.
alter table super6.app_settings
  add column if not exists payment_url text;

update super6.app_settings
set payment_url = 'https://monzo.me/daylehodge/6.00?h=GgbX1T&d=Super%206&account_type=personal',
    updated_at = now()
where id = 1;

-- Rebuild only the award/position flags for a completed league round.
-- Core match scoring (5/2/0) stays in the existing recalculate_round function.
-- Rules:
--   * 1st = highest points, then closest first-goal minute.
--   * If still tied after the tiebreak, 1st is shared.
--   * If 1st is shared there is no 2nd.
--   * Wooden spoon = lowest points only; a 1st-place player can never also get it.
create or replace function super6.normalise_round_awards(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_official_first_goal smallint;
begin
  if auth.uid() is not null and not super6.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select r.official_first_goal_minute
    into v_official_first_goal
  from super6.rounds r
  where r.id = p_round_id;

  if not found then
    raise exception 'Round not found.';
  end if;

  -- Clear the previous award state first. Uncounted rows never hold awards.
  update super6.round_player_results
  set position = null,
      is_winner = false,
      is_second = false,
      is_wooden_spoon = false,
      calculated_at = now()
  where round_id = p_round_id;

  -- Competition position is points first, then first-goal difference when there
  -- was a goal. rank() preserves shared places when both are still tied.
  with ranked as (
    select
      rpr.player_id,
      rank() over (
        partition by p.league_id
        order by
          rpr.points desc,
          case
            when v_official_first_goal is null then 0
            else coalesce(rpr.tie_break_difference, 32767)
          end asc
      )::smallint as new_position
    from super6.round_player_results rpr
    join super6.profiles p on p.id = rpr.player_id
    where rpr.round_id = p_round_id
      and rpr.counted = true
      and p.role = 'player'
      and p.league_id is not null
  )
  update super6.round_player_results rpr
  set position = ranked.new_position,
      calculated_at = now()
  from ranked
  where rpr.round_id = p_round_id
    and rpr.player_id = ranked.player_id;

  -- Everyone at position 1 shares the crown.
  update super6.round_player_results rpr
  set is_winner = true,
      calculated_at = now()
  from super6.profiles p
  where rpr.round_id = p_round_id
    and rpr.player_id = p.id
    and rpr.counted = true
    and rpr.position = 1;

  -- 2nd place exists only where that league has exactly one winner.
  with winner_counts as (
    select p.league_id, count(*)::int as winner_count
    from super6.round_player_results rpr
    join super6.profiles p on p.id = rpr.player_id
    where rpr.round_id = p_round_id
      and rpr.counted = true
      and rpr.is_winner = true
    group by p.league_id
  )
  update super6.round_player_results rpr
  set is_second = true,
      calculated_at = now()
  from super6.profiles p
  join winner_counts wc on wc.league_id = p.league_id
  where rpr.round_id = p_round_id
    and rpr.player_id = p.id
    and rpr.counted = true
    and wc.winner_count = 1
    and rpr.position = 2;

  -- Spoon is based only on the lowest points total. Winners are explicitly
  -- excluded so no player can show both crown and spoon for the same week.
  with lowest_non_winner as (
    select p.league_id, min(rpr.points) as min_points
    from super6.round_player_results rpr
    join super6.profiles p on p.id = rpr.player_id
    where rpr.round_id = p_round_id
      and rpr.counted = true
      and rpr.is_winner = false
    group by p.league_id
  )
  update super6.round_player_results rpr
  set is_wooden_spoon = true,
      calculated_at = now()
  from super6.profiles p
  join lowest_non_winner lw on lw.league_id = p.league_id
  where rpr.round_id = p_round_id
    and rpr.player_id = p.id
    and rpr.counted = true
    and rpr.is_winner = false
    and rpr.points = lw.min_points;
end;
$$;

revoke all on function super6.normalise_round_awards(uuid) from public;
grant execute on function super6.normalise_round_awards(uuid) to authenticated;
grant execute on function super6.normalise_round_awards(uuid) to service_role;

-- Correct the award flags on every already-completed league week so historic
-- win/spoon totals and the latest badges follow the same rules immediately.
do $$
declare
  v_round record;
begin
  for v_round in
    select id
    from super6.rounds
    where status = 'completed'
    order by completed_at nulls last, created_at
  loop
    perform super6.normalise_round_awards(v_round.id);
  end loop;
end;
$$;

-- Latest completed week only. Once results are complete, every signed-in user
-- can see every counted prediction across all normal leagues. Before completion
-- no future/current-round prediction data is exposed by this function.
create or replace function super6.get_latest_published_predictions()
returns jsonb
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_season_id uuid;
  v_round super6.rounds%rowtype;
  v_predictions jsonb;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (select 1 from super6.profiles p where p.id = v_user_id) then
    raise exception 'Super 6 profile not found.';
  end if;

  select s.id
    into v_season_id
  from super6.seasons s
  where s.status = 'active'
  order by s.created_at desc
  limit 1;

  if v_season_id is null then
    return jsonb_build_object('round', null, 'predictions', '[]'::jsonb);
  end if;

  select r.*
    into v_round
  from super6.rounds r
  where r.season_id = v_season_id
    and r.status = 'completed'
  order by r.completed_at desc nulls last, r.created_at desc
  limit 1;

  if v_round.id is null then
    return jsonb_build_object('round', null, 'predictions', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', p.id,
        'username', p.username,
        'league_id', p.league_id,
        'league_name', l.name,
        'league_sort_order', l.sort_order,
        'first_goal_minute', e.first_goal_minute,
        'fixture_id', f.id,
        'fixture_order', f.sort_order,
        'home_team', f.home_team,
        'away_team', f.away_team,
        'removed', f.removed,
        'home_score', pr.home_score,
        'away_score', pr.away_score,
        'actual_home_score', f.home_score,
        'actual_away_score', f.away_score,
        'points', rr.points,
        'position', rr.position,
        'exact_scores', rr.exact_scores,
        'correct_results', rr.correct_results,
        'tie_break_difference', rr.tie_break_difference,
        'is_winner', rr.is_winner,
        'is_second', rr.is_second,
        'is_wooden_spoon', rr.is_wooden_spoon
      )
      order by l.sort_order, rr.position, p.username, f.sort_order
    ),
    '[]'::jsonb
  )
  into v_predictions
  from super6.entries e
  join super6.profiles p on p.id = e.player_id and p.role = 'player'
  join super6.leagues l on l.id = p.league_id
  join super6.round_player_results rr
    on rr.round_id = e.round_id
   and rr.player_id = e.player_id
   and rr.counted = true
  join super6.predictions pr on pr.entry_id = e.id
  join super6.fixtures f on f.id = pr.fixture_id
  where e.round_id = v_round.id;

  return jsonb_build_object(
    'round', jsonb_build_object(
      'id', v_round.id,
      'name', v_round.name,
      'official_first_goal_minute', v_round.official_first_goal_minute,
      'completed_at', v_round.completed_at
    ),
    'predictions', coalesce(v_predictions, '[]'::jsonb)
  );
end;
$$;

revoke all on function super6.get_latest_published_predictions() from public;
grant execute on function super6.get_latest_published_predictions() to authenticated;
grant execute on function super6.get_latest_published_predictions() to service_role;

-- Keep the v0.25 RPC compatible, but allow all league predictions for a
-- completed round. This still returns nothing until that round is final.
create or replace function super6.get_published_league_predictions(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = super6, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_round_status text;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (select 1 from super6.profiles p where p.id = v_user_id) then
    raise exception 'Super 6 profile not found.';
  end if;

  select r.status into v_round_status
  from super6.rounds r
  where r.id = p_round_id;

  if v_round_status is null then
    raise exception 'Round not found.';
  end if;

  if v_round_status <> 'completed' then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', p.id,
        'username', p.username,
        'league_id', p.league_id,
        'league_name', l.name,
        'league_sort_order', l.sort_order,
        'first_goal_minute', e.first_goal_minute,
        'fixture_id', f.id,
        'fixture_order', f.sort_order,
        'home_team', f.home_team,
        'away_team', f.away_team,
        'removed', f.removed,
        'home_score', pr.home_score,
        'away_score', pr.away_score,
        'actual_home_score', f.home_score,
        'actual_away_score', f.away_score,
        'points', rr.points,
        'position', rr.position,
        'exact_scores', rr.exact_scores,
        'correct_results', rr.correct_results,
        'tie_break_difference', rr.tie_break_difference,
        'is_winner', rr.is_winner,
        'is_second', rr.is_second,
        'is_wooden_spoon', rr.is_wooden_spoon
      )
      order by l.sort_order, rr.position, p.username, f.sort_order
    ),
    '[]'::jsonb
  )
  into v_result
  from super6.entries e
  join super6.profiles p on p.id = e.player_id and p.role = 'player'
  join super6.leagues l on l.id = p.league_id
  join super6.round_player_results rr
    on rr.round_id = e.round_id
   and rr.player_id = e.player_id
   and rr.counted = true
  join super6.predictions pr on pr.entry_id = e.id
  join super6.fixtures f on f.id = pr.fixture_id
  where e.round_id = p_round_id;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function super6.get_published_league_predictions(uuid) from public;
grant execute on function super6.get_published_league_predictions(uuid) to authenticated;
grant execute on function super6.get_published_league_predictions(uuid) to service_role;
