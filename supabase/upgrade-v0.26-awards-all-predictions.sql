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
