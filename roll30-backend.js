(function () {
  const url = 'https://eujhtcnnjtwsthscdfqk.supabase.co';
  const key = 'sb_publishable_N0AviKRP_IyMGQMtKo0ZlQ_uuD-2dnq';
  if (!window.supabase) throw new Error('Supabase client failed to load.');

  const client = window.supabase.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function ensureProfile(user) {
    const { data, error } = await client.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (data) return data;
    const name = user.user_metadata && user.user_metadata.display_name || user.email.split('@')[0];
    const { data: profile, error: createError } = await client.from('profiles').insert({ id:user.id, display_name:name }).select().single();
    if (createError) throw createError;
    return profile;
  }

  async function createCampaign(name) {
    const { data, error } = await client.rpc('create_roll30_campaign', { campaign_name:name });
    if (error) throw error;
    return data;
  }

  async function joinCampaign(code) {
    const { data, error } = await client.rpc('join_roll30_campaign', { code });
    if (error) throw error;
    return data;
  }

  async function campaigns() {
    const { data, error } = await client.from('campaigns').select('*, campaign_members!inner(role,user_id)').order('updated_at', { ascending:false });
    if (error) throw error;
    return data;
  }

  async function trashedCampaigns() {
    const { data, error } = await client.rpc('list_roll30_trashed_campaigns');
    if (error) throw error;
    return data || [];
  }

  window.Roll30Backend = { client, getSession, ensureProfile, createCampaign, joinCampaign, campaigns, trashedCampaigns };
})();
