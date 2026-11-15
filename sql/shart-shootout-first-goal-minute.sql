-- Existing predictions retain NULL minutes and must be resubmitted before completion.
ALTER TABLE super6.shart_shootout_predictions ADD COLUMN IF NOT EXISTS first_goal_minute integer CHECK (first_goal_minute between 1 and 120);
ALTER TABLE super6.shart_shootouts ADD COLUMN IF NOT EXISTS actual_first_goal_minute integer CHECK (actual_first_goal_minute between 1 and 120);
-- Keep legacy 3-argument functions for compatibility with in-flight clients.
-- New frontend calls the 4-argument overloads below.
CREATE OR REPLACE FUNCTION super6.submit_shart_shootout_prediction(p_shootout_id uuid, p_home_score integer, p_away_score integer, p_first_goal_minute integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'super6', 'public'
AS $function$
declare
  s super6.shart_shootouts%rowtype;
  m super6.shart_matches%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  if p_home_score is null or p_away_score is null or p_home_score<0 or p_away_score<0 then
    raise exception 'Enter a valid shootout score prediction.';
  end if;

  if p_first_goal_minute is null or p_first_goal_minute<1 or p_first_goal_minute>120 then raise exception 'Enter a first-goal minute (1–120).'; end if;
  select * into s from super6.shart_shootouts where id=p_shootout_id;
  if s.id is null then raise exception 'Shootout not found.'; end if;
  if s.status<>'open' then raise exception 'This shootout is closed.'; end if;
  if now()>=s.cutoff_at then raise exception 'The shootout prediction deadline has passed.'; end if;

  select * into m from super6.shart_matches where id=s.match_id;
  if auth.uid() is distinct from m.player1_id and auth.uid() is distinct from m.player2_id then
    raise exception 'Only the two players in this SHART tie can enter this shootout.';
  end if;

  insert into super6.shart_shootout_predictions(shootout_id,player_id,home_score,away_score,first_goal_minute,submitted_at,updated_at)
  values (s.id,auth.uid(),p_home_score,p_away_score,p_first_goal_minute,now(),now())
  on conflict (shootout_id,player_id) do update set
    home_score=excluded.home_score,
    away_score=excluded.away_score,
    first_goal_minute=excluded.first_goal_minute,
    submitted_at=now(),
    updated_at=now();
end;
$function$
;
CREATE OR REPLACE FUNCTION super6.admin_complete_shart_shootout(p_shootout_id uuid, p_actual_home integer, p_actual_away integer, p_actual_first_goal_minute integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'super6', 'public'
AS $function$
declare
  s super6.shart_shootouts%rowtype;
  m super6.shart_matches%rowtype;
  p1 super6.shart_shootout_predictions%rowtype;
  p2 super6.shart_shootout_predictions%rowtype;
  v_p1 integer := 0;
  v_p2 integer := 0;
  v_winner uuid;
  v_result text;
  v_d1 integer;
  v_d2 integer;
  v_actual_result integer;
  v_pred1_result integer;
  v_pred2_result integer;
begin
  if not super6.is_admin() then raise exception 'Admin access required.'; end if;
  if p_actual_home is null or p_actual_away is null or p_actual_home<0 or p_actual_away<0 then
    raise exception 'Enter a valid final score.';
  end if;

  if p_actual_home+p_actual_away>0 and (p_actual_first_goal_minute is null or p_actual_first_goal_minute<1 or p_actual_first_goal_minute>120) then raise exception 'Enter the actual first-goal minute.'; end if;
  if p_actual_home+p_actual_away=0 and p_actual_first_goal_minute is not null then raise exception 'No first goal in a 0–0 match.'; end if;
  select * into s from super6.shart_shootouts where id=p_shootout_id;
  if s.id is null then raise exception 'Shootout not found.'; end if;
  if s.status<>'open' then raise exception 'This shootout has already been closed.'; end if;
  if now()<s.cutoff_at then raise exception 'The shootout is still open for predictions.'; end if;

  select * into m from super6.shart_matches where id=s.match_id;
  if m.id is null or m.status<>'shootout' then raise exception 'The parent SHART tie is no longer waiting for a shootout.'; end if;

  select * into p1 from super6.shart_shootout_predictions
  where shootout_id=s.id and player_id=m.player1_id;
  select * into p2 from super6.shart_shootout_predictions
  where shootout_id=s.id and player_id=m.player2_id;

  if p1.player_id is null or p2.player_id is null then
    raise exception 'Both players must submit a shootout prediction before it can be completed.';
  end if;

  v_actual_result := case when p_actual_home>p_actual_away then 1 when p_actual_home<p_actual_away then -1 else 0 end;
  v_pred1_result := case when p1.home_score>p1.away_score then 1 when p1.home_score<p1.away_score then -1 else 0 end;
  v_pred2_result := case when p2.home_score>p2.away_score then 1 when p2.home_score<p2.away_score then -1 else 0 end;

  v_p1 := case
    when p1.home_score=p_actual_home and p1.away_score=p_actual_away then 5
    when v_pred1_result=v_actual_result then 2
    else 0 end;
  v_p2 := case
    when p2.home_score=p_actual_home and p2.away_score=p_actual_away then 5
    when v_pred2_result=v_actual_result then 2
    else 0 end;

  if p1.first_goal_minute is null or p2.first_goal_minute is null then raise exception 'Both players must submit a first-goal minute before completion.'; end if;
  if p_actual_first_goal_minute is not null then
    v_d1:=abs(p1.first_goal_minute-p_actual_first_goal_minute);
    v_d2:=abs(p2.first_goal_minute-p_actual_first_goal_minute);
  end if;
  if v_p1>v_p2 then v_winner:=m.player1_id;
  elsif v_p2>v_p1 then v_winner:=m.player2_id;
  elsif v_d1<v_d2 then v_winner:=m.player1_id;
  elsif v_d2<v_d1 then v_winner:=m.player2_id;
  else v_winner:=null;
  end if;

  if v_winner is null then
    update super6.shart_shootouts set
      actual_home=p_actual_home,actual_away=p_actual_away,actual_first_goal_minute=p_actual_first_goal_minute,
      player1_points=v_p1,player2_points=v_p2,
      status='tied',winner_id=null,completed_at=now(),updated_at=now()
    where id=s.id;
    update super6.shart_matches set status='shootout',winner_id=null,decided_by=null,updated_at=now()
    where id=m.id;
    v_result:='tied';
  else
    update super6.shart_shootouts set
      actual_home=p_actual_home,actual_away=p_actual_away,actual_first_goal_minute=p_actual_first_goal_minute,
      player1_points=v_p1,player2_points=v_p2,
      status='completed',winner_id=v_winner,completed_at=now(),updated_at=now()
    where id=s.id;
    update super6.shart_matches set
      status='completed',winner_id=v_winner,decided_by='shootout',calculated_at=now(),updated_at=now()
    where id=m.id;
    perform super6.shart_sync_advancement(m.id);
    v_result:='completed';
  end if;

  insert into super6.audit_log(admin_id,action,entity_type,entity_id,details)
  values (auth.uid(),'complete_shart_shootout','shart_shootout',s.id::text,
          jsonb_build_object('actual_home',p_actual_home,'actual_away',p_actual_away,
                             'player1_points',v_p1,'player2_points',v_p2,
                             'winner_id',v_winner,'result',v_result));

  return v_result;
end;
$function$
;

REVOKE ALL ON FUNCTION super6.submit_shart_shootout_prediction(uuid,integer,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION super6.admin_complete_shart_shootout(uuid,integer,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION super6.submit_shart_shootout_prediction(uuid,integer,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION super6.admin_complete_shart_shootout(uuid,integer,integer,integer) TO authenticated;
