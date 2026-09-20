// Super 6 backend adapter — real Supabase authentication, local prototype data.
// v0.17 uses real Supabase authentication, account management, live season standings, live rounds, and live player predictions.
// Payments/admin weekly overview/results are migrated in later steps.
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


  async function loadCurrentRound(){
    const sb = getClient();
    await requireSession();

    const { data: round, error: roundError } = await sb
      .from('rounds')
      .select('id, name, cutoff_at, entry_fee, status, official_first_goal_minute, completed_at')
      .eq('status', 'published')
      .order('cutoff_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError) throw new Error(roundError.message || 'Could not load the current round.');
    if (!round) return null;

    const { data: fixtures, error: fixturesError } = await sb
      .from('fixtures')
      .select('id, sort_order, home_team, away_team, removed, home_score, away_score')
      .eq('round_id', round.id)
      .order('sort_order');

    if (fixturesError) throw new Error(fixturesError.message || 'Could not load the round fixtures.');

    return { ...round, fixtures: fixtures || [] };
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
    if (!roundId || !userId) return { entry: null, predictions: [], paid: false };

    const [entryRes, paymentRes] = await Promise.all([
      sb.from('entries')
        .select('id, first_goal_minute, submitted_at, updated_at')
        .eq('round_id', roundId)
        .eq('player_id', userId)
        .maybeSingle(),
      sb.from('payments')
        .select('paid, updated_at')
        .eq('round_id', roundId)
        .eq('player_id', userId)
        .maybeSingle()
    ]);

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
      paid: Boolean(paymentRes.data?.paid)
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

  async function signOut(){
    if (!client) return;
    await client.auth.signOut();
  }

  window.Super6Backend = {
    mode: 'supabase-auth-admin-users-live-standings-live-round-live-predictions',
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
    listAccountManagerData,
    createPlayerAccount,
    resetPlayerPin,
    bulkCreatePendingPlayers,
    loadSeasonStandings,
    loadCurrentRound,
    saveAndPublishRound,
    loadMyRoundEntry,
    submitMyPredictions,
    signOut,
    client: getClient
  };
})();
