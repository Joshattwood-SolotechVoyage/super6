// Super 6 backend adapter — real Supabase authentication, local prototype data.
// v0.15 keeps secure Supabase authentication/account management and now reads the live season standings from Supabase.
// Weekly round/prediction data remains local for this migration step.
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

  async function signOut(){
    if (!client) return;
    await client.auth.signOut();
  }

  window.Super6Backend = {
    mode: 'supabase-auth-admin-users-live-standings-local-round',
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
    signOut,
    client: getClient
  };
})();
