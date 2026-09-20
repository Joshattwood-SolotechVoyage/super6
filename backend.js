// Super 6 backend adapter — real Supabase authentication, local prototype data.
// v0.12 moves the main login to the secure Username + 4-digit PIN flow.
// Competition data is still the existing local prototype until the next migration steps.
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

  async function signOut(){
    if (!client) return;
    await client.auth.signOut();
  }

  window.Super6Backend = {
    mode: 'supabase-auth-local-data',
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
    signOut,
    client: getClient
  };
})();
