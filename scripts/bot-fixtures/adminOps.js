/**
 * Calls the admin-users Edge Function with an admin JWT. CommonJS.
 * Service-role key is NEVER used.
 */

async function findBotByLabel(sb, label) {
  const { data, error } = await sb.functions.invoke('admin-users', {
    body: { action: 'list_users', botOnly: true, perPage: 50 },
  });
  if (error || !data || !data.users) return null;
  const match = data.users.find((u) => u.botLabel === label);
  if (!match) return null;
  return { userId: match.id, email: match.email };
}

async function ensureBotUser(sb, input) {
  const existing = await findBotByLabel(sb, input.label);
  if (existing) {
    return { userId: existing.userId, email: existing.email || input.email, created: false };
  }
  const { data, error } = await sb.functions.invoke('admin-users', {
    body: {
      action: 'create_bot_user',
      label: input.label,
      email: input.email,
      password: input.password,
      persona: input.persona,
      displayName: input.displayName || input.label,
      enabled: true,
    },
  });
  if (error || !data || !data.userId) {
    throw new Error(`create_bot_user failed for ${input.label}: ${(error && error.message) || (data && data.error) || 'unknown'}`);
  }
  return { userId: data.userId, email: data.email || input.email, created: true };
}

async function resetBotPassword(sb, input) {
  const { error } = await sb.functions.invoke('admin-users', {
    body: {
      action: 'set_temporary_password',
      userId: input.userId,
      temporaryPassword: input.temporaryPassword,
      reason: input.reason,
      botOnly: true,
    },
  });
  if (error) throw new Error(`set_temporary_password failed: ${error.message}`);
}

module.exports = { findBotByLabel, ensureBotUser, resetBotPassword };
