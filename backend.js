// Super 6 backend adapter — Supabase-backed authentication and competition data.
// v0.25 adds published same-league prediction viewing after results are final, plus the v0.24 payment flow.
(function(){
  const cfg = window.SUPER6_CONFIG || {};
  let client = null;

  function getClient(){
    if (client) return client;
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('Super 6 is not connected to Supabase.');
    }
    if (!window.supabase?.createClient) {
      throw new Error('Supabase client failed to load.');
    }
    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY,
      { db: { schema: cfg.SUPABASE_SCHEMA || 'super6' } }
    );
    return client;
  }

  async function pinLogin(username, pin){
    const cleanName = String(username || '').trim();
    const cleanPin = String(pin || '').trim();
    if (!cleanName || !/^\d{4}$/.test(cleanPin)) {
      throw new Error('Enter your username and 4-digit PIN.');
    }

    const sb = getClient();
    // Clear any previous Supabase session before starting a fresh PIN login.
    await sb.auth.signOut().catch(() => {});

    const response = await fetch(
      cfg.SUPABASE_URL + '/functions/v1/super6-pin-login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({ username: cleanName, pin: cleanPin })
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok || !payload?.token_hash) {
      throw new Error(payload?.error || 'Username or PIN not recognised.');
    }

    const { data: sessionData, error: sessionError } = await sb.auth.verifyOtp({
      token_hash: payload.token_hash,
      type: 'email'
    });
    if (sessionError || !sessionData?.session || !sessionData?.user) {
      throw new Error(sessionError?.message || 'Could not create your Super 6 session.');
    }

    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('id, username, role, league_id')
      .eq('id', sessionData.user.id)
      .single();
    if (profileError || !profile) {
      await sb.auth.signOut().catch(() => {});
      throw new Error('Your Super 6 profile could not be loaded.');
    }

    return profile;
  }

  async function requireSession(){
    const sb = getClient();
    const { data, error } = await sb.auth.getSession();
    const session = data?.session;
    if (error || !session?.access_token) {
      throw new Error('Your Super 6 session has expired. Please sign in again.');
    }
    return session;
  }

  async function loadAppSettings(){
    const sb = getClient();
    await requireSession();

    let res = await sb
      .from('app_settings')
      .select('id, default_entry_fee, payment_grace_hours, payment_url')
      .eq('id', 1)
      .maybeSingle();

    // Backward-compatible fallback if the v0.24 SQL has not been applied yet.
    if (res.error) {
      res = await sb
        .from('app_settings')
        .select('id, default_entry_fee, payment_grace_hours')
        .eq('id', 1)
        .maybeSingle();
    }
    if (res.error) throw new Error(res.error.message || 'Could not load Super 6 settings.');
    return {
      id: 1,
      default_entry_fee: Number(res.data?.default_entry_fee ?? 6),
      payment_grace_hours: Number(res.data?.payment_grace_hours ?? 12),
      payment_url: String(res.data?.payment_url || '')
    };
  }

  async function savePaymentUrl(url){
    const sb = getClient();
    await requireSession();
    const cleanUrl = String(url || '').trim();
    const { data, error } = await sb
      .from('app_settings')
      .update({ payment_url: cleanUrl || null, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select('id, default_entry_fee, payment_grace_hours, payment_url')
      .single();
    if (error) throw new Error(error.message || 'Could not save the payment link. Run the v0.24 Supabase upgrade SQL first.');
    return data;
  }

  async function listAccountManagerData(){
    const sb = getClient();
    await requireSession();

    const [leagueRes, playerRes] = await Promise.all([
      sb.from('leagues').select('id, name, sort_order').order('sort_order'),
      sb.from('profiles').select('id, username, role, league_id').eq('role', 'player').order('username')
    ]);

    if (leagueRes.error) throw new Error(leagueRes.error.message || 'Could not load leagues.');
    if (playerRes.error) throw new Error(playerRes.error.message || 'Could not load player accounts.');

    return { leagues: leagueRes.data || [], players: playerRes.data || [] };
  }

  async function callAdminUsers(body){
    const session = await requireSession();
    const response = await fetch(
      cfg.SUPABASE_URL + '/functions/v1/super6-admin-users',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.SUPABASE_PUBLISHABLE_KEY,
          'Authorization': 'Bearer ' + session.access_token
        },
        body: JSON.stringify(body)
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'The account request could not be completed.');
    }
    return payload;
  }

  async function createPlayerAccount(username, pin, leagueId){
    return callAdminUsers({
      action: 'create_player',
      username: String(username || '').trim(),
      pin: String(pin || '').trim(),
      league_id: String(leagueId || '').trim()
    });
  }

  async function resetPlayerPin(userId, pin){
    return callAdminUsers({
      action: 'reset_pin',
      user_id: String(userId || '').trim(),
      pin: String(pin || '').trim()
    });
  }

  async function bulkCreatePendingPlayers(){
    return callAdminUsers({ action: 'bulk_create_pending' });
  }


  async function loadSeasonStandings(){
    const sb = getClient();
    await requireSession();
    const { data, error } = await sb
      .from('season_standings')
      .select('position, player_id, username, league_id, league_name, points, weeks_played, wins, exact_scores, correct_results, wooden_spoons')
      .order('league_name')
      .order('position')
      .order('username');
    if (error) throw new Error(error.message || 'Could not load the live league tables.');
    return data || [];
  }


  async function loadRoundById(roundId){
    const sb = getClient();
    await requireSession();
    if (!roundId) return null;

    const { data: round, error: roundError } = await sb
      .from('rounds')
      .select('id, name, cutoff_at, entry_fee, status, official_first_goal_minute, completed_at, created_at')
      .eq('id', roundId)
      .single();

    if (roundError) throw new Error(roundError.message || 'Could not load the round.');

    const { data: fixtures, error: fixturesError } = await sb
      .from('fixtures')
      .select('id, sort_order, home_team, away_team, removed, home_score, away_score')
      .eq('round_id', round.id)
      .order('sort_order');

    if (fixturesError) throw new Error(fixturesError.message || 'Could not load the round fixtures.');
    return { ...round, fixtures: fixtures || [] };
  }

  async function loadCurrentRound(){
    const sb = getClient();
    await requireSession();

    // Prefer an open/published round. If there is none, keep the most recent
    // completed round visible so players can see their locked entry/results
    // and admins can correct/recalculate it.
    let { data: round, error: roundError } = await sb
      .from('rounds')
      .select('id')
      .eq('status', 'published')
      .order('cutoff_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError) throw new Error(roundError.message || 'Could not load the current round.');

    if (!round) {
      const completed = await sb
        .from('rounds')
        .select('id')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (completed.error) throw new Error(completed.error.message || 'Could not load the latest completed round.');
      round = completed.data || null;
    }

    if (!round) return null;
    return loadRoundById(round.id);
  }

  async function saveAndPublishRound({ roundId=null, name, cutoffAt, fixtures }){
    const sb = getClient();
    await requireSession();

    const cleanFixtures = (fixtures || []).map(f => ({
      home: String(f?.home || '').trim(),
      away: String(f?.away || '').trim()
    }));

    const { data, error } = await sb.rpc('admin_save_round', {
      p_round_id: roundId || null,
      p_name: String(name || '').trim(),
      p_cutoff_at: cutoffAt,
      p_fixtures: cleanFixtures
    });

    if (error) throw new Error(error.message || 'Could not save the round.');
    return data;
  }


  async function loadMyRoundEntry(roundId){
    const sb = getClient();
    const session = await requireSession();
    const userId = session.user?.id;
    if (!roundId || !userId) return { entry: null, predictions: [], paid: false, paymentPending: false, paymentClaimedAt: null };

    const entryPromise = sb.from('entries')
      .select('id, first_goal_minute, submitted_at, updated_at')
      .eq('round_id', roundId)
      .eq('player_id', userId)
      .maybeSingle();

    let paymentRes = await sb.from('payments')
      .select('paid, player_claimed_paid, claimed_at, updated_at')
      .eq('round_id', roundId)
      .eq('player_id', userId)
      .maybeSingle();

    // Keep the site usable if the new pending-payment columns have not been added yet.
    if (paymentRes.error) {
      paymentRes = await sb.from('payments')
        .select('paid, updated_at')
        .eq('round_id', roundId)
        .eq('player_id', userId)
        .maybeSingle();
    }

    const entryRes = await entryPromise;
    if (entryRes.error) throw new Error(entryRes.error.message || 'Could not load your entry.');
    if (paymentRes.error) throw new Error(paymentRes.error.message || 'Could not load your payment status.');

    let predictions = [];
    if (entryRes.data?.id) {
      const predRes = await sb.from('predictions')
        .select('fixture_id, home_score, away_score')
        .eq('entry_id', entryRes.data.id);
      if (predRes.error) throw new Error(predRes.error.message || 'Could not load your predictions.');
      predictions = predRes.data || [];
    }

    return {
      entry: entryRes.data || null,
      predictions,
      paid: Boolean(paymentRes.data?.paid),
      paymentPending: Boolean(paymentRes.data?.player_claimed_paid) && !Boolean(paymentRes.data?.paid),
      paymentClaimedAt: paymentRes.data?.claimed_at || null
    };
  }

  async function submitMyPredictions(roundId, firstGoalMinute, predictions){
    const sb = getClient();
    await requireSession();

    const cleanPredictions = (predictions || []).map(p => ({
      fixture_id: String(p.fixture_id || ''),
      home_score: Number(p.home_score),
      away_score: Number(p.away_score)
    }));

    const { data, error } = await sb.rpc('submit_my_predictions', {
      p_round_id: roundId,
      p_first_goal_minute: Number(firstGoalMinute),
      p_predictions: cleanPredictions
    });

    if (error) throw new Error(error.message || 'Could not submit your predictions.');
    return data;
  }


  async function markMyPaymentPending(roundId){
    const sb = getClient();
    await requireSession();
    const { data, error } = await sb.rpc('mark_my_payment_pending', {
      p_round_id: roundId
    });
    if (error) throw new Error(error.message || 'Could not mark your payment as pending. Run the v0.24 Supabase upgrade SQL first.');
    return data;
  }

  async function loadAdminRoundOverview(roundId){
    const sb = getClient();
    await requireSession();
    if (!roundId) return { leagues: [], players: [] };

    const [leagueRes, playerRes, entryRes] = await Promise.all([
      sb.from('leagues').select('id, name, sort_order').order('sort_order'),
      sb.from('profiles').select('id, username, league_id').eq('role', 'player').order('username'),
      sb.from('entries').select('id, player_id, first_goal_minute, submitted_at').eq('round_id', roundId)
    ]);

    let paymentRes = await sb.from('payments')
      .select('player_id, paid, player_claimed_paid, claimed_at, updated_at')
      .eq('round_id', roundId);

    // Backward-compatible fallback before the v0.24 database upgrade.
    if (paymentRes.error) {
      paymentRes = await sb.from('payments')
        .select('player_id, paid, updated_at')
        .eq('round_id', roundId);
    }

    if (leagueRes.error) throw new Error(leagueRes.error.message || 'Could not load leagues.');
    if (playerRes.error) throw new Error(playerRes.error.message || 'Could not load players.');
    if (entryRes.error) throw new Error(entryRes.error.message || 'Could not load round entries.');
    if (paymentRes.error) throw new Error(paymentRes.error.message || 'Could not load payments.');

    const leagueMap = new Map((leagueRes.data || []).map(l => [l.id, l.name]));
    const entries = new Map((entryRes.data || []).map(e => [e.player_id, e]));
    const payments = new Map((paymentRes.data || []).map(p => [p.player_id, p]));

    return {
      leagues: leagueRes.data || [],
      players: (playerRes.data || []).map(p => {
        const entry = entries.get(p.id) || null;
        const payment = payments.get(p.id) || null;
        return {
          id: p.id,
          username: p.username,
          league_id: p.league_id,
          league_name: leagueMap.get(p.league_id) || '',
          submitted: Boolean(entry),
          submitted_at: entry?.submitted_at || null,
          first_goal_minute: entry?.first_goal_minute ?? null,
          paid: Boolean(payment?.paid),
          payment_pending: Boolean(payment?.player_claimed_paid) && !Boolean(payment?.paid),
          payment_claimed_at: payment?.claimed_at || null,
          payment_updated_at: payment?.updated_at || null
        };
      })
    };
  }

  async function setAdminPayment(roundId, playerId, paid){
    const sb = getClient();
    await requireSession();
    const { error } = await sb.rpc('admin_set_payment', {
      p_round_id: roundId,
      p_player_id: playerId,
      p_paid: Boolean(paid)
    });
    if (error) throw new Error(error.message || 'Could not update payment status.');
  }

  async function loadAdminPlayerEntry(roundId, playerId){
    const sb = getClient();
    await requireSession();
    const { data: entry, error: entryError } = await sb
      .from('entries')
      .select('id, player_id, first_goal_minute, submitted_at, updated_at')
      .eq('round_id', roundId)
      .eq('player_id', playerId)
      .maybeSingle();
    if (entryError) throw new Error(entryError.message || 'Could not load the player entry.');
    if (!entry) return { entry: null, predictions: [] };

    const { data: predictions, error: predictionError } = await sb
      .from('predictions')
      .select('fixture_id, home_score, away_score')
      .eq('entry_id', entry.id);
    if (predictionError) throw new Error(predictionError.message || 'Could not load the player predictions.');
    return { entry, predictions: predictions || [] };
  }

  async function completeRound(roundId, fixtures, officialFirstGoalMinute){
    const sb = getClient();
    await requireSession();
    if (!roundId) throw new Error('No round is selected.');

    // Persist postponed/abandoned flags before calculation.
    for (const fixture of fixtures || []) {
      const { error } = await sb
        .from('fixtures')
        .update({ removed: Boolean(fixture.removed) })
        .eq('id', fixture.id)
        .eq('round_id', roundId);
      if (error) throw new Error(error.message || 'Could not update fixture status.');
    }

    const results = (fixtures || [])
      .filter(f => !f.removed)
      .map(f => ({
        fixture_id: String(f.id || ''),
        home_score: Number(f.result?.[0]),
        away_score: Number(f.result?.[1])
      }));

    const { error } = await sb.rpc('admin_complete_round', {
      p_round_id: roundId,
      p_results: results,
      p_official_first_goal_minute: officialFirstGoalMinute == null ? null : Number(officialFirstGoalMinute)
    });

    if (error) throw new Error(error.message || 'Could not complete the round.');
    return loadRoundById(roundId);
  }

  async function loadRoundResults(roundId){
    const sb = getClient();
    await requireSession();
    if (!roundId) return [];

    const { data: rows, error: resultError } = await sb
      .from('round_player_results')
      .select('round_id, player_id, points, exact_scores, correct_results, tie_break_difference, position, is_winner, is_second, is_wooden_spoon, counted, calculated_at')
      .eq('round_id', roundId)
      .eq('counted', true)
      .order('position')
      .order('points', { ascending: false });

    if (resultError) throw new Error(resultError.message || 'Could not load the weekly results.');
    const list = rows || [];
    if (!list.length) return [];

    const ids = [...new Set(list.map(r => r.player_id).filter(Boolean))];
    const { data: profiles, error: profileError } = await sb
      .from('profiles')
      .select('id, username, league_id')
      .in('id', ids);
    if (profileError) throw new Error(profileError.message || 'Could not load result players.');

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    return list.map(r => ({ ...r, ...(profileMap.get(r.player_id) || {}) }));
  }

  async function loadLatestLeagueWinners(){
    const sb = getClient();
    await requireSession();

    const { data: season, error: seasonError } = await sb
      .from('seasons')
      .select('id')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (seasonError) throw new Error(seasonError.message || 'Could not load the active season.');
    if (!season?.id) return { round: null, winners: [] };

    const { data: round, error: roundError } = await sb
      .from('rounds')
      .select('id, name, completed_at')
      .eq('season_id', season.id)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (roundError) throw new Error(roundError.message || 'Could not load the latest completed league round.');
    if (!round?.id) return { round: null, winners: [] };

    const { data: rows, error: resultError } = await sb
      .from('round_player_results')
      .select('player_id, points, position, is_winner')
      .eq('round_id', round.id)
      .eq('counted', true)
      .eq('is_winner', true);
    if (resultError) throw new Error(resultError.message || 'Could not load the latest league winners.');

    const list = rows || [];
    if (!list.length) return { round, winners: [] };
    const ids = [...new Set(list.map(r => r.player_id).filter(Boolean))];
    const { data: profiles, error: profileError } = await sb
      .from('profiles')
      .select('id, username, league_id')
      .in('id', ids);
    if (profileError) throw new Error(profileError.message || 'Could not load winner profiles.');

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    return {
      round,
      winners: list.map(r => ({ ...r, ...(profileMap.get(r.player_id) || {}) }))
    };
  }

  async function loadPublishedLeaguePredictions(roundId){
    const sb = getClient();
    await requireSession();
    if (!roundId) return [];
    const { data, error } = await sb.rpc('get_published_league_predictions', {
      p_round_id: roundId
    });
    if (error) throw new Error(error.message || 'Could not load published league predictions. Run the v0.25 Supabase upgrade SQL first.');
    return Array.isArray(data) ? data : [];
  }

  async function signOut(){
    if (!client) return;
    await client.auth.signOut();
  }

  window.Super6Backend = {
    mode: 'supabase-auth-admin-users-live-standings-live-round-live-predictions-live-payment-pending-live-results-published-league-picks',
    schema: cfg.SUPABASE_SCHEMA || 'super6',
    isConfigured(){ return Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY); },
    configuration(){
      return {
        url: cfg.SUPABASE_URL || '',
        schema: cfg.SUPABASE_SCHEMA || 'super6',
        hasPublishableKey: Boolean(cfg.SUPABASE_PUBLISHABLE_KEY)
      };
    },
    pinLogin,
    loadAppSettings,
    savePaymentUrl,
    listAccountManagerData,
    createPlayerAccount,
    resetPlayerPin,
    bulkCreatePendingPlayers,
    loadSeasonStandings,
    loadCurrentRound,
    loadRoundById,
    saveAndPublishRound,
    loadMyRoundEntry,
    submitMyPredictions,
    markMyPaymentPending,
    loadAdminRoundOverview,
    setAdminPayment,
    loadAdminPlayerEntry,
    completeRound,
    loadRoundResults,
    loadLatestLeagueWinners,
    loadPublishedLeaguePredictions,
    signOut,
    client: getClient
  };
})();
