/**
 * Anon-key Supabase client factory for the bot runner. CommonJS.
 * Service-role key is NEVER used here.
 */
const { createClient } = require('@supabase/supabase-js');

function createBotClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInBot(sb, email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data || !data.session || !data.user) return null;
  return { userId: data.user.id, accessToken: data.session.access_token };
}

module.exports = { createBotClient, signInBot };
