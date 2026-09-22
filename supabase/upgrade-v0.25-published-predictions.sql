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
