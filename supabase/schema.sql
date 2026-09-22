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
