-- Transaction-only acceptance test. Run inside BEGIN / ROLLBACK.
do $test$
declare season uuid; players uuid[]; admin_id uuid; c text; t regclass; mid uuid; sid uuid; champ uuid; mode integer; outcome text; won uuid; guard boolean; actual integer; expected uuid;
begin
  select id into strict admin_id from super6.profiles where role='admin' limit 1;
  select array(select id from super6.profiles where role='player' limit 3) into players;
  if super6.shootout_points(2,1,2,1)<>5 or super6.shootout_points(3,1,2,1)<>2 or super6.shootout_points(1,2,2,1)<>0 or super6.shootout_points(1,1,0,0)<>2 then raise exception 'Scoring'; end if;
  if to_regprocedure('super6.submit_shart_shootout_prediction(uuid,integer,integer)') is not null or has_table_privilege('authenticated','super6.shart_shootout_predictions','INSERT') or has_function_privilege('authenticated','super6.resolve_competition_shootout(uuid,integer,integer,integer,boolean)','execute') then raise exception 'Legacy/direct permissions'; end if;
  foreach c in array array['shart','chumpions','nohope'] loop
    t:=case c when 'shart' then 'super6.shart_matches'::regclass when 'chumpions' then 'super6.chumpions_knockout_matches'::regclass else 'super6.nohope_knockout_matches'::regclass end;
    for mode in 1..10 loop
      insert into super6.seasons(name,status) values(gen_random_uuid()::text,'closed') returning id into season;
      execute format('insert into %s(season_id,stage,slot_no,player1_id,player2_id,status,player1_score,player2_score) values($1,$5,1,$2,$3,$4,2,2) returning id',t)
        into mid using season,players[1],players[2],case when c='shart' then 'shootout' else 'review' end,case when mode=10 then 'SF' else 'F' end;
      if mode=10 then
        if c='shart' then insert into super6.shart_matches(season_id,stage,slot_no,status) values(season,'F',1,'scheduled');
        else execute format('insert into %s(season_id,stage,slot_no,player1_id,player2_id,status,winner_id) values($1,''SF'',2,$2,$3,''completed'',$3)',t) using season,players[1],players[3]; end if;
      end if;
      perform set_config('request.jwt.claim.sub',players[3]::text,true);
      guard:=false;
      begin perform super6.admin_open_shootout(c,mid,'Home','Away',now()+interval '1 hour'); exception when others then guard:=sqlerrm='Admin access required'; end;
      if not guard then raise exception 'Non-admin create'; end if;
      perform set_config('request.jwt.claim.sub',admin_id::text,true);
      sid:=super6.admin_open_shootout(c,mid,'Home','Away',now()+interval '1 hour');
      perform set_config('request.jwt.claim.sub',players[3]::text,true);
      guard:=false; begin perform super6.submit_shart_shootout_prediction(sid,1,0,20); exception when others then guard:=sqlerrm like 'Only the two%'; end;
      if not guard then raise exception 'Non-participant'; end if;
      guard:=false; begin perform super6.admin_complete_shart_shootout(sid,2,1,20); exception when others then guard:=sqlerrm='Admin access required'; end;
      if not guard then raise exception 'Non-admin finalisation'; end if;
      perform set_config('request.jwt.claim.sub',players[1]::text,true);
      guard:=false; begin perform super6.submit_shart_shootout_prediction(sid,1,0,null); exception when others then guard:=sqlerrm like 'Enter a score%'; end;
      if not guard then raise exception 'Missing minute'; end if;
      if mode<>8 then perform super6.submit_shart_shootout_prediction(sid,case when mode=6 then 0 when mode=1 then 2 else 3 end,case when mode=6 then 0 else 1 end,18); end if;
      if mode not in (7,8) then
        perform set_config('request.jwt.claim.sub',players[2]::text,true);
        perform super6.submit_shart_shootout_prediction(sid,3,1,case mode when 3 then 21 when 4 then 18 else 22 end);
      end if;
      update super6.shart_shootout_predictions set submitted_at=now()-interval '2 minutes' where shootout_id=sid;
      update super6.shart_shootouts set cutoff_at=now()-interval '1 minute' where id=sid;
      guard:=false; begin perform super6.submit_shart_shootout_prediction(sid,1,0,20); exception when others then guard:=sqlerrm='Shootout closed'; end;
      if not guard then raise exception 'Late submission'; end if;
      perform set_config('request.jwt.claim.sub',admin_id::text,true);
      if mode in (7,8) then
        perform super6.check_shootout_deadlines();
        select status into outcome from super6.shart_shootouts where id=sid;
      else
        actual:=case when mode in (5,6) then null when mode=9 then 17 else 20 end;
        outcome:=super6.admin_complete_shart_shootout(sid,case when mode in(5,6) then 0 else 2 end,case when mode in(5,6) then 0 else 1 end,actual);
      end if;
      if outcome<>(case when mode=8 then 'review' when mode=7 then 'walkover' when mode in(4,5) then 'tied' else 'completed' end) then raise exception 'Bad outcome % % %',c,mode,outcome; end if;
      expected:=case when mode in(1,6,7,9) then players[1] when mode in(2,3,10) then players[2] end;
      execute format('select winner_id from %s where id=$1',t) into won using mid;
      execute format('select champion_id from super6.%I where season_id=$1',c||'_competition_state') into champ using season;
      if mode=10 then execute format('select player1_id from %s where season_id=$1 and stage=''F''',t) into champ using season; end if;
      if won is distinct from expected or champ is distinct from expected then raise exception 'Progression % %',c,mode; end if;
      if mode in(4,5,8) then perform super6.admin_open_shootout(c,mid,'Replay','Away',now()+interval '1 day'); end if;
    end loop;
  end loop;
end $test$;
