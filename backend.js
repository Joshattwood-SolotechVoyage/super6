// Backend adapter foundation for Super 6.
// v0.9 still runs the proven local prototype while the real Supabase project is connected.
// All future database calls target the dedicated `super6` schema so Voyage data remains isolated.
(function(){
  const cfg = window.SUPER6_CONFIG || {};
  window.Super6Backend = {
    mode: cfg.DEMO_MODE ? 'demo' : 'supabase',
    schema: cfg.SUPABASE_SCHEMA || 'super6',
    isConfigured(){ return Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY); },
    configuration(){
      return {
        url: cfg.SUPABASE_URL || '',
        schema: cfg.SUPABASE_SCHEMA || 'super6',
        hasPublishableKey: Boolean(cfg.SUPABASE_PUBLISHABLE_KEY)
      };
    }
  };
})();
