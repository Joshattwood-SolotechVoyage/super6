-- Extend the existing attempts in place. Each attempt belongs to exactly one knockout.
alter table super6.shart_shootouts
  alter column match_id drop not null,
  add column chumpions_match_id uuid references super6.chumpions_knockout_matches on delete cascade,
  add column nohope_match_id uuid references super6.nohope_knockout_matches on delete cascade,
  add check (num_nonnulls(match_id,chumpions_match_id,nohope_match_id)=1),
  add unique(chumpions_match_id,attempt_no), add unique(nohope_match_id,attempt_no),
  drop constraint shart_shootouts_status_check,
  add check (status in ('open','completed','tied','review','walkover'));
alter table super6.shart_shootout_predictions add constraint minute_required_on_new_entries
  check(first_goal_minute is not null and first_goal_minute between 1 and 120) not valid;
revoke insert,update,delete,truncate on super6.shart_shootouts,super6.shart_shootout_predictions from public,anon,authenticated;

alter table super6.chumpions_knockout_matches drop constraint chumpions_knockout_matches_decided_by_check,
  add check(decided_by in ('score','first_goal','admin','walkover','shootout'));
alter table super6.nohope_knockout_matches drop constraint nohope_knockout_matches_decided_by_check,
  add check(decided_by in ('score','first_goal','admin','walkover','shootout'));

create view super6.shootout_parents with(security_invoker=true) as
select 'shart'::text cup,id,season_id,stage,slot_no,player1_id,player2_id,round_id,
  (status='shootout') is_tie
from super6.shart_matches
union all
select 'chumpions'::text cup,id,season_id,stage,slot_no,player1_id,player2_id,round_id,
  (status='review' and player1_score=player2_score and (player1_tiebreak is null or player2_tiebreak is null or player1_tiebreak=player2_tiebreak)) is_tie
from super6.chumpions_knockout_matches
union all
select 'nohope'::text cup,id,season_id,stage,slot_no,player1_id,player2_id,round_id,
  (status='review' and player1_score=player2_score and (player1_tiebreak is null or player2_tiebreak is null or player1_tiebreak=player2_tiebreak)) is_tie
from super6.nohope_knockout_matches;
revoke all on super6.shootout_parents from public,anon;
grant select on super6.shootout_parents to authenticated,service_role;

create function super6.lock_shootout_parent(c text, mid uuid) returns super6.shootout_parents
language plpgsql set search_path='' as $$
declare t regclass; m super6.shootout_parents;
begin
  t:=case c when 'shart' then 'super6.shart_matches'::regclass when 'chumpions' then 'super6.chumpions_knockout_matches'::regclass when 'nohope' then 'super6.nohope_knockout_matches'::regclass end;
  if t is null then raise exception 'Unknown competition'; end if;
  execute format('select id from %s where id=$1 for update',t) using mid;
  select * into m from super6.shootout_parents where cup=c and id=mid;
  if m.is_tie is not true or m.player1_id is null or m.player2_id is null then raise exception 'This fixture is not awaiting a shootout'; end if;
  return m;
end $$;

create function super6.admin_open_shootout(c text,mid uuid,home text,away text,deadline timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare m super6.shootout_parents; attempt integer; sid uuid;
begin
  if not coalesce(super6.is_admin(),false) then raise exception 'Admin access required'; end if;
  if nullif(trim(home),'') is null or nullif(trim(away),'') is null or deadline is null or deadline<=clock_timestamp() then raise exception 'Enter both teams and a future deadline'; end if;
  m:=super6.lock_shootout_parent(c,mid);
  select max(attempt_no) into attempt from super6.shart_shootouts where mid=coalesce(match_id,chumpions_match_id,nohope_match_id);
  if exists(select from super6.shart_shootouts where mid=coalesce(match_id,chumpions_match_id,nohope_match_id) and status='open') then raise exception 'An attempt is already open'; end if;
  insert into super6.shart_shootouts(season_id,match_id,chumpions_match_id,nohope_match_id,attempt_no,home_team,away_team,cutoff_at,status)
  values(m.season_id,case when c='shart' then mid end,case when c='chumpions' then mid end,case when c='nohope' then mid end,coalesce(attempt,0)+1,trim(home),trim(away),deadline,'open') returning id into sid;
  return sid;
end $$;

create or replace function super6.submit_shart_shootout_prediction(p_shootout_id uuid,p_home_score integer,p_away_score integer,p_first_goal_minute integer) returns void
language plpgsql security definer set search_path='' as $$
declare s super6.shart_shootouts; m super6.shootout_parents;
begin
  select * into s from super6.shart_shootouts where id=p_shootout_id for update;
  if s.status is distinct from 'open' or clock_timestamp()>=s.cutoff_at then raise exception 'Shootout closed'; end if;
  select * into m from super6.shootout_parents where id=coalesce(s.match_id,s.chumpions_match_id,s.nohope_match_id) and cup=case when s.match_id is not null then 'shart' when s.chumpions_match_id is not null then 'chumpions' else 'nohope' end;
  if m.is_tie is not true or auth.uid() is null or (auth.uid() is distinct from m.player1_id and auth.uid() is distinct from m.player2_id) then raise exception 'Only the two players in this tie can enter'; end if;
  if p_home_score is null or p_away_score is null or least(p_home_score,p_away_score)<0 or p_first_goal_minute is null or p_first_goal_minute not between 1 and 120 then raise exception 'Enter a score and first-goal minute (1–120)'; end if;
  insert into super6.shart_shootout_predictions(shootout_id,player_id,home_score,away_score,first_goal_minute,submitted_at)
  values(s.id,auth.uid(),p_home_score,p_away_score,p_first_goal_minute,clock_timestamp())
  on conflict(shootout_id,player_id) do update set home_score=excluded.home_score,away_score=excluded.away_score,first_goal_minute=excluded.first_goal_minute,submitted_at=excluded.submitted_at;
end $$;

create function super6.shootout_points(h integer,a integer,rh integer,ra integer) returns integer language sql immutable strict as $$
select case when (h,a)=(rh,ra) then 5 when sign(h::bigint-a)=sign(rh::bigint-ra) then 2 else 0 end $$;

create function super6.resolve_competition_shootout(sid uuid,h integer,a integer,minute integer,deadline_only boolean) returns text
language plpgsql set search_path='' as $$
declare s super6.shart_shootouts; m super6.shootout_parents; c text; mid uuid;
  p super6.shart_shootout_predictions; q super6.shart_shootout_predictions;
  xp integer; yp integer; winner uuid; outcome text; t regclass;
begin
  select * into s from super6.shart_shootouts where id=sid for update;
  if s.id is null then raise exception 'Unknown shootout'; end if;
  if s.status<>'open' then return s.status; end if;
  if clock_timestamp()<s.cutoff_at then raise exception 'Predictions are still open'; end if;
  c:=case when s.match_id is not null then 'shart' when s.chumpions_match_id is not null then 'chumpions' else 'nohope' end;
  mid:=coalesce(s.match_id,s.chumpions_match_id,s.nohope_match_id);
  perform pg_advisory_xact_lock(hashtextextended(c||s.season_id::text,0));
  m:=super6.lock_shootout_parent(c,mid);
  select * into p from super6.shart_shootout_predictions where shootout_id=sid and player_id=m.player1_id and first_goal_minute is not null and submitted_at<s.cutoff_at;
  select * into q from super6.shart_shootout_predictions where shootout_id=sid and player_id=m.player2_id and first_goal_minute is not null and submitted_at<s.cutoff_at;
  if p.player_id is null or q.player_id is null then
    winner:=coalesce(p.player_id,q.player_id);
    outcome:=case when winner is null then 'review' else 'walkover' end;
    h:=null; a:=null; minute:=null;
  else
    if deadline_only then return 'awaiting_result'; end if;
    if h is null or a is null or least(h,a)<0 or ((h>0 or a>0) and (minute is null or minute not between 1 and 120)) or (h=0 and a=0 and minute is not null) then raise exception 'Enter the actual score and first-goal minute. Leave the minute empty for 0–0'; end if;
    xp:=super6.shootout_points(p.home_score,p.away_score,h,a);
    yp:=super6.shootout_points(q.home_score,q.away_score,h,a);
    if xp<>yp then winner:=case when xp>yp then p.player_id else q.player_id end;
    elsif minute is not null and p.first_goal_minute<>q.first_goal_minute then
      winner:=case when (abs(p.first_goal_minute-minute),-p.first_goal_minute)<(abs(q.first_goal_minute-minute),-q.first_goal_minute) then p.player_id else q.player_id end;
    end if;
    outcome:=case when winner is null then 'tied' else 'completed' end;
  end if;
  update super6.shart_shootouts set status=outcome,winner_id=winner,actual_home=h,actual_away=a,actual_first_goal_minute=minute,player1_points=xp,player2_points=yp,completed_at=clock_timestamp() where id=sid;
  if winner is not null then
    t:=case c when 'shart' then 'super6.shart_matches'::regclass when 'chumpions' then 'super6.chumpions_knockout_matches'::regclass else 'super6.nohope_knockout_matches'::regclass end;
    execute format('update %s set winner_id=$1,status=''completed'',decided_by=$2,calculated_at=now(),updated_at=now() where id=$3',t)
      using winner,case when outcome='walkover' then 'walkover' else 'shootout' end,mid;
    case c when 'shart' then perform super6.shart_sync_advancement(mid);
      when 'chumpions' then perform super6.chumpions_try_advance_stage(m.season_id);
      else perform super6.nohope_try_advance_stage(m.season_id); end case;
  end if;
  return outcome;
end $$;

create or replace function super6.admin_complete_shart_shootout(p_shootout_id uuid,p_actual_home integer,p_actual_away integer,p_actual_first_goal_minute integer) returns text
language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(super6.is_admin(),false) then raise exception 'Admin access required'; end if;
  return super6.resolve_competition_shootout(p_shootout_id,p_actual_home,p_actual_away,p_actual_first_goal_minute,false);
end $$;
create or replace function super6.admin_create_shart_shootout(p_match_id uuid,p_home_team text,p_away_team text,p_cutoff_at timestamptz) returns uuid
language sql security invoker set search_path='' as $$select super6.admin_open_shootout('shart',p_match_id,p_home_team,p_away_team,p_cutoff_at)$$;
drop function super6.submit_shart_shootout_prediction(uuid,integer,integer);
drop function super6.admin_complete_shart_shootout(uuid,integer,integer);

create function super6.check_shootout_deadlines() returns void language plpgsql set search_path='' as $$
declare sid uuid;
begin
  for sid in select s.id from super6.shart_shootouts s join super6.shootout_parents m on m.id=coalesce(s.match_id,s.chumpions_match_id,s.nohope_match_id)
    where m.is_tie and s.status='open' and s.cutoff_at<=clock_timestamp()
      and (select count(*) from super6.shart_shootout_predictions p where p.shootout_id=s.id and p.first_goal_minute is not null and p.player_id in(m.player1_id,m.player2_id) and p.submitted_at<s.cutoff_at)<2
    order by s.id for update of s skip locked
  loop perform super6.resolve_competition_shootout(sid,null,null,null,true); end loop;
end $$;
select cron.schedule('super6-shootout-deadlines','* * * * *','select super6.check_shootout_deadlines()');

revoke all on function super6.lock_shootout_parent(text,uuid),super6.resolve_competition_shootout(uuid,integer,integer,integer,boolean),super6.check_shootout_deadlines() from public,anon,authenticated;
revoke all on function super6.admin_open_shootout(text,uuid,text,text,timestamptz),super6.submit_shart_shootout_prediction(uuid,integer,integer,integer),super6.admin_complete_shart_shootout(uuid,integer,integer,integer) from public,anon;
grant execute on function super6.admin_open_shootout(text,uuid,text,text,timestamptz),super6.submit_shart_shootout_prediction(uuid,integer,integer,integer),super6.admin_complete_shart_shootout(uuid,integer,integer,integer) to authenticated;
notify pgrst,'reload schema';

-- Keep regular recalculation from overwriting a settled shootout. Other matches follow their existing rules.
CREATE OR REPLACE FUNCTION super6.admin_choose_chumpions_knockout_winner(p_match_id uuid, p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'super6', 'public'
AS $function$
declare
  v_match super6.chumpions_knockout_matches%rowtype;
begin
  if exists(select 1 from super6.shootout_parents where cup='chumpions' and id=p_match_id and is_tie)
     and not exists(select 1 from super6.shart_shootouts where chumpions_match_id=p_match_id and status='review' and attempt_no=(select max(attempt_no) from super6.shart_shootouts where chumpions_match_id=p_match_id)) then
    raise exception 'Set a shootout to decide this tie'; end if;

  ----------------------------------------------------------
  -- ADMIN ONLY
  ----------------------------------------------------------

  if not super6.is_admin() then
    raise exception 'Admin access required.';
  end if;


  ----------------------------------------------------------
  -- FIND THE KNOCKOUT MATCH
  ----------------------------------------------------------

  select *
  into v_match
  from super6.chumpions_knockout_matches
  where id = p_match_id;


  if not found then
    raise exception 'Chumpions knockout match not found.';
  end if;


  ----------------------------------------------------------
  -- ADMIN SHOULD ONLY DECIDE MATCHES THAT NEED REVIEW
  ----------------------------------------------------------

  if v_match.status <> 'review' then
    raise exception 'This knockout match does not require an Admin decision.';
  end if;


  ----------------------------------------------------------
  -- WINNER MUST BE ONE OF THE TWO PLAYERS
  ----------------------------------------------------------

  if p_player_id <> v_match.player1_id
     and p_player_id <> v_match.player2_id
  then
    raise exception 'Choose one of the two players in this knockout match.';
  end if;


  ----------------------------------------------------------
  -- RECORD THE ADMIN DECISION
  ----------------------------------------------------------

  update super6.chumpions_knockout_matches
  set
    winner_id = p_player_id,
    status = 'completed',
    decided_by = 'admin',
    calculated_at = coalesce(calculated_at, now()),
    updated_at = now()
  where id = p_match_id;


  ----------------------------------------------------------
  -- AUDIT LOG
  ----------------------------------------------------------

  insert into super6.audit_log (
    admin_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'choose_chumpions_knockout_winner',
    'chumpions_knockout_match',
    p_match_id::text,
    jsonb_build_object(
      'winner_id', p_player_id
    )
  );


  ----------------------------------------------------------
  -- IF THIS COMPLETES THE WHOLE STAGE,
  -- AUTOMATICALLY CREATE THE NEXT ONE
  ----------------------------------------------------------

  perform super6.chumpions_try_advance_stage(
    v_match.season_id
  );

end;
$function$
;
CREATE OR REPLACE FUNCTION super6.admin_choose_nohope_knockout_winner(p_match_id uuid, p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'super6', 'public'
AS $function$
declare
  m super6.nohope_knockout_matches%rowtype;
begin
  if exists(select 1 from super6.shootout_parents where cup='nohope' and id=p_match_id and is_tie)
     and not exists(select 1 from super6.shart_shootouts where nohope_match_id=p_match_id and status='review' and attempt_no=(select max(attempt_no) from super6.shart_shootouts where nohope_match_id=p_match_id)) then
    raise exception 'Set a shootout to decide this tie'; end if;
  if not super6.is_admin() then raise exception 'Admin access required.'; end if;
  select * into m from super6.nohope_knockout_matches where id=p_match_id;
  if not found then raise exception 'No-Hope-A knockout match not found.'; end if;
  if m.status<>'review' then raise exception 'This knockout match does not require an Admin decision.'; end if;
  if p_player_id<>m.player1_id and p_player_id<>m.player2_id then raise exception 'Choose one of the two players in this match.'; end if;

  update super6.nohope_knockout_matches
  set winner_id=p_player_id,status='completed',decided_by='admin',
      calculated_at=coalesce(calculated_at,now()),updated_at=now()
  where id=p_match_id;

  insert into super6.audit_log(admin_id,action,entity_type,entity_id,details)
  values(auth.uid(),'choose_nohope_knockout_winner','nohope_knockout_match',p_match_id::text,jsonb_build_object('winner_id',p_player_id));

  perform super6.nohope_try_advance_stage(m.season_id);
end;
$function$
;
CREATE OR REPLACE FUNCTION super6.chumpions_recalculate_round(p_round_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'super6', 'public'
AS $function$
declare
  v_enabled boolean;
  v_round_status text;
  v_season_id uuid;
begin

  if auth.uid() is not null
     and not super6.is_admin()
  then
    raise exception 'Admin access required.';
  end if;


  select
    chumpions_league,
    status,
    season_id
  into
    v_enabled,
    v_round_status,
    v_season_id
  from super6.rounds
  where id = p_round_id;


  if not found then
    raise exception 'Round not found.';
  end if;


  -- Normal Super 6 week only
  if not coalesce(v_enabled, false) then
    return;
  end if;


  ----------------------------------------------------------
  -- IF THE SUPER 6 ROUND IS NOT YET COMPLETE
  -- clear any calculated Chumpions scores.
  ----------------------------------------------------------

  if v_round_status <> 'completed' then

    update super6.chumpions_matches
    set
      player1_score = null,
      player2_score = null,
      player1_tiebreak = null,
      player2_tiebreak = null,
      status = 'scheduled',
      winner_id = null,
      is_draw = false,
      calculated_at = null,
      updated_at = now()
    where round_id = p_round_id;


    update super6.chumpions_knockout_matches
    set
      player1_score = null,
      player2_score = null,
      player1_tiebreak = null,
      player2_tiebreak = null,
      status = 'scheduled',
      winner_id = null,
      decided_by = null,
      calculated_at = null,
      updated_at = now()
    where round_id = p_round_id;


    return;

  end if;


  ----------------------------------------------------------
  -- GROUP-STAGE MATCHES
  --
  -- Winner is decided on Super 6 points only.
  -- Equal score remains a group-stage draw.
  ----------------------------------------------------------

  with group_scores as (
    select m.id as match_id,
      r1.points as player1_points, r1.tie_break_difference as player1_first_goal,
      coalesce(r1.counted,false) as player1_counted,
      r2.points as player2_points, r2.tie_break_difference as player2_first_goal,
      coalesce(r2.counted,false) as player2_counted,
      exists(select 1 from super6.entries e where e.round_id=p_round_id and e.player_id=m.player1_id) as player1_entered,
      exists(select 1 from super6.entries e where e.round_id=p_round_id and e.player_id=m.player2_id) as player2_entered
    from super6.chumpions_matches m
    left join super6.round_player_results r1 on r1.round_id=p_round_id and r1.player_id=m.player1_id
    left join super6.round_player_results r2 on r2.round_id=p_round_id and r2.player_id=m.player2_id
    where m.round_id=p_round_id
  )
  update super6.chumpions_matches m
  set player1_score=case when s.player1_counted then s.player1_points
                         when s.player2_counted and not s.player1_entered then 0 else null end,
      player2_score=case when s.player2_counted then s.player2_points
                         when s.player1_counted and not s.player2_entered then 0 else null end,
      player1_tiebreak=case when s.player1_counted then s.player1_first_goal else null end,
      player2_tiebreak=case when s.player2_counted then s.player2_first_goal else null end,
      status=case when s.player1_counted and s.player2_counted then 'completed'
                  when s.player1_counted and not s.player2_entered then 'completed'
                  when s.player2_counted and not s.player1_entered then 'completed'
                  else 'review' end,
      winner_id=case
        when s.player1_counted and not s.player2_entered then m.player1_id
        when s.player2_counted and not s.player1_entered then m.player2_id
        when s.player1_counted and s.player2_counted and s.player1_points>s.player2_points then m.player1_id
        when s.player1_counted and s.player2_counted and s.player2_points>s.player1_points then m.player2_id
        else null end,
      is_draw=case when s.player1_counted and s.player2_counted and s.player1_points=s.player2_points then true else false end,
      calculated_at=now(), updated_at=now()
  from group_scores s where m.id=s.match_id;


  ----------------------------------------------------------
  -- KNOCKOUT MATCHES
  --
  -- 1. Highest Super 6 points
  -- 2. Closest first-goal prediction
  -- 3. If still tied -> Admin review
  ----------------------------------------------------------

  with knockout_scores as (
    select
      m.id as match_id,

      r1.points as player1_points,
      r1.tie_break_difference as player1_first_goal,
      coalesce(r1.counted, false) as player1_counted,

      r2.points as player2_points,
      r2.tie_break_difference as player2_first_goal,
      coalesce(r2.counted, false) as player2_counted

    from super6.chumpions_knockout_matches m

    left join super6.round_player_results r1
      on r1.round_id = p_round_id
     and r1.player_id = m.player1_id

    left join super6.round_player_results r2
      on r2.round_id = p_round_id
     and r2.player_id = m.player2_id

    where m.round_id = p_round_id
  )

  update super6.chumpions_knockout_matches m
  set
    player1_score =
      case
        when s.player1_counted then s.player1_points
        else null
      end,

    player2_score =
      case
        when s.player2_counted then s.player2_points
        else null
      end,

    player1_tiebreak =
      case
        when s.player1_counted then s.player1_first_goal
        else null
      end,

    player2_tiebreak =
      case
        when s.player2_counted then s.player2_first_goal
        else null
      end,

    status =
      case

        when not (
          s.player1_counted
          and s.player2_counted
        )
        then 'review'

        when s.player1_points <> s.player2_points
        then 'completed'

        when s.player1_first_goal is not null
         and s.player2_first_goal is not null
         and s.player1_first_goal <> s.player2_first_goal
        then 'completed'

        else 'review'

      end,

    winner_id =
      case

        when not (
          s.player1_counted
          and s.player2_counted
        )
        then null

        when s.player1_points > s.player2_points
        then m.player1_id

        when s.player2_points > s.player1_points
        then m.player2_id

        when s.player1_first_goal is not null
         and s.player2_first_goal is not null
         and s.player1_first_goal < s.player2_first_goal
        then m.player1_id

        when s.player1_first_goal is not null
         and s.player2_first_goal is not null
         and s.player2_first_goal < s.player1_first_goal
        then m.player2_id

        else null

      end,

    decided_by =
      case

        when not (
          s.player1_counted
          and s.player2_counted
        )
        then null

        when s.player1_points <> s.player2_points
        then 'score'

        when s.player1_first_goal is not null
         and s.player2_first_goal is not null
         and s.player1_first_goal <> s.player2_first_goal
        then 'first_goal'

        else null

      end,

    calculated_at = now(),
    updated_at = now()

  from knockout_scores s

  where m.id = s.match_id and not exists(select 1 from super6.shart_shootouts so where so.chumpions_match_id=m.id and so.status in ('completed','walkover'));


  ----------------------------------------------------------
  -- If that completed the entire knockout stage,
  -- create the next one.
  ----------------------------------------------------------

  perform super6.chumpions_try_advance_stage(v_season_id);

end;
$function$
;
CREATE OR REPLACE FUNCTION super6.nohope_recalculate_round(p_round_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'super6', 'public'
AS $function$
declare
  enabled boolean;
  rstatus text;
  season uuid;
begin
  select no_hope_a,status,season_id into enabled,rstatus,season
  from super6.rounds where id=p_round_id;
  if not found or not coalesce(enabled,false) then return; end if;

  if rstatus<>'completed' then
    update super6.nohope_matches
      set player1_score=null,player2_score=null,player1_tiebreak=null,player2_tiebreak=null,
          status='scheduled',winner_id=null,is_draw=false,calculated_at=null,updated_at=now()
    where round_id=p_round_id;
    update super6.nohope_knockout_matches
      set player1_score=null,player2_score=null,player1_tiebreak=null,player2_tiebreak=null,
          status='scheduled',winner_id=null,decided_by=null,calculated_at=null,updated_at=now()
    where round_id=p_round_id;
    return;
  end if;

  with s as (
    select m.id,
      r1.points p1, r1.tie_break_difference t1, coalesce(r1.counted,false) c1,
      r2.points p2, r2.tie_break_difference t2, coalesce(r2.counted,false) c2
    from super6.nohope_matches m
    left join super6.round_player_results r1 on r1.round_id=p_round_id and r1.player_id=m.player1_id
    left join super6.round_player_results r2 on r2.round_id=p_round_id and r2.player_id=m.player2_id
    where m.round_id=p_round_id
  )
  update super6.nohope_matches m set
    player1_score=case when s.c1 then s.p1 else null end,
    player2_score=case when s.c2 then s.p2 else null end,
    player1_tiebreak=case when s.c1 then s.t1 else null end,
    player2_tiebreak=case when s.c2 then s.t2 else null end,
    status=case when s.c1 and s.c2 then 'completed' else 'review' end,
    winner_id=case when not(s.c1 and s.c2) then null when s.p1>s.p2 then m.player1_id when s.p2>s.p1 then m.player2_id else null end,
    is_draw=case when s.c1 and s.c2 and s.p1=s.p2 then true else false end,
    calculated_at=now(),updated_at=now()
  from s where m.id=s.id;

  with s as (
    select m.id,
      r1.points p1, r1.tie_break_difference t1, coalesce(r1.counted,false) c1,
      r2.points p2, r2.tie_break_difference t2, coalesce(r2.counted,false) c2
    from super6.nohope_knockout_matches m
    left join super6.round_player_results r1 on r1.round_id=p_round_id and r1.player_id=m.player1_id
    left join super6.round_player_results r2 on r2.round_id=p_round_id and r2.player_id=m.player2_id
    where m.round_id=p_round_id
  )
  update super6.nohope_knockout_matches m set
    player1_score=case when s.c1 then s.p1 else null end,
    player2_score=case when s.c2 then s.p2 else null end,
    player1_tiebreak=case when s.c1 then s.t1 else null end,
    player2_tiebreak=case when s.c2 then s.t2 else null end,
    status=case
      when not(s.c1 and s.c2) then 'review'
      when s.p1<>s.p2 then 'completed'
      when s.t1 is not null and s.t2 is not null and s.t1<>s.t2 then 'completed'
      else 'review' end,
    winner_id=case
      when not(s.c1 and s.c2) then null
      when s.p1>s.p2 then m.player1_id
      when s.p2>s.p1 then m.player2_id
      when s.t1 is not null and s.t2 is not null and s.t1<s.t2 then m.player1_id
      when s.t1 is not null and s.t2 is not null and s.t2<s.t1 then m.player2_id
      else null end,
    decided_by=case
      when not(s.c1 and s.c2) then null
      when s.p1<>s.p2 then 'score'
      when s.t1 is not null and s.t2 is not null and s.t1<>s.t2 then 'first_goal'
      else null end,
    calculated_at=now(),updated_at=now()
  from s where m.id=s.id and not exists(select 1 from super6.shart_shootouts so where so.nohope_match_id=m.id and so.status in ('completed','walkover'));

  perform super6.nohope_try_advance_stage(season);
end;
$function$
;
CREATE OR REPLACE FUNCTION super6.shart_recalculate_round(p_round_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'super6', 'public'
AS $function$
declare
  m record;
  v_p1_exists boolean;
  v_p2_exists boolean;
  v_p1_score integer;
  v_p2_score integer;
  v_p1_tb integer;
  v_p2_tb integer;
  v_winner uuid;
  v_decided text;
  v_status text;
begin
  if not super6.is_admin() then raise exception 'Admin access required.'; end if;
  if not exists (select 1 from super6.rounds where id=p_round_id and shart_round=true) then return; end if;

  for m in
    select * from super6.shart_matches where round_id=p_round_id and not exists(select 1 from super6.shart_shootouts s where s.match_id=shart_matches.id and s.status in ('completed','walkover')) order by slot_no
  loop
    v_p1_exists:=false; v_p2_exists:=false;
    v_p1_score:=null; v_p2_score:=null; v_p1_tb:=null; v_p2_tb:=null;
    v_winner:=null; v_decided:=null; v_status:='review';

    if m.player1_id is not null then
      select true,points,tie_break_difference
        into v_p1_exists,v_p1_score,v_p1_tb
      from super6.round_player_results
      where round_id=p_round_id and player_id=m.player1_id and counted=true;
      v_p1_exists:=coalesce(v_p1_exists,false);
    end if;

    if m.player2_id is not null then
      select true,points,tie_break_difference
        into v_p2_exists,v_p2_score,v_p2_tb
      from super6.round_player_results
      where round_id=p_round_id and player_id=m.player2_id and counted=true;
      v_p2_exists:=coalesce(v_p2_exists,false);
    end if;

    if v_p1_exists and not v_p2_exists and m.player2_id is not null then
      v_winner:=m.player1_id; v_decided:='walkover'; v_status:='completed';
    elsif v_p2_exists and not v_p1_exists and m.player1_id is not null then
      v_winner:=m.player2_id; v_decided:='walkover'; v_status:='completed';
    elsif v_p1_exists and v_p2_exists then
      if v_p1_score>v_p2_score then
        v_winner:=m.player1_id; v_decided:='points'; v_status:='completed';
      elsif v_p2_score>v_p1_score then
        v_winner:=m.player2_id; v_decided:='points'; v_status:='completed';
      elsif v_p1_tb is not null and v_p2_tb is not null and v_p1_tb<v_p2_tb then
        v_winner:=m.player1_id; v_decided:='first_goal'; v_status:='completed';
      elsif v_p1_tb is not null and v_p2_tb is not null and v_p2_tb<v_p1_tb then
        v_winner:=m.player2_id; v_decided:='first_goal'; v_status:='completed';
      else
        v_status:='shootout';
      end if;
    end if;

    update super6.shart_matches set
      player1_score=case when v_p1_exists then v_p1_score else null end,
      player2_score=case when v_p2_exists then v_p2_score else null end,
      player1_tiebreak=case when v_p1_exists then v_p1_tb else null end,
      player2_tiebreak=case when v_p2_exists then v_p2_tb else null end,
      status=v_status,
      winner_id=v_winner,
      decided_by=v_decided,
      calculated_at=now(),
      updated_at=now()
    where id=m.id;

    perform super6.shart_sync_advancement(m.id);
  end loop;
end;
$function$
;

create function super6.notify_shootout_open() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform net.http_post(url:='https://wrwdhtzworxrmbkmjuge.supabase.co/functions/v1/super6-push',
    headers:=jsonb_build_object('Content-Type','application/json','x-super6-cron',(select cron_secret from super6.push_private_config where singleton)),
    body:=jsonb_build_object('action','shootouts'),timeout_milliseconds:=30000);
  return new;
end $$;
revoke all on function super6.notify_shootout_open() from public,anon,authenticated;
create trigger notify_shootout_created after insert on super6.shart_shootouts for each row execute function super6.notify_shootout_open();
