/**
 * admin-users — admin operations Edge Function.
 *
 * Security model:
 *   - verify_jwt = true (set in config.toml).
 *   - Caller must have profiles.role = 'admin' (enforced server-side).
 *   - Service-role client is used only AFTER admin check.
 *   - No service-role/secret keys leave the function.
 *   - Every successful action writes an admin_audit_events row.
 *   - View As is a READ-ONLY snapshot — never an auth session swap.
 *
 * Actions: see _shared/adminSchemas.ts (discriminated union).
 */
import {
  corsHeaders,
  ok,
  badRequest,
  unauthorized,
  forbidden,
  methodNotAllowed,
  validationFailed,
  internalError,
} from '../_shared/http.ts';
import { requireAdmin } from '../_shared/adminAuth.ts';
import { writeAdminAudit, isWhitelistedAction } from '../_shared/adminAudit.ts';
import { AdminUsersRequestSchema, normalizeBlockValue } from '../_shared/adminSchemas.ts';
import type { AdminUsersRequest } from '../_shared/adminSchemas.ts';
import type { createServiceClient } from '../_shared/supabaseClients.ts';
import { buildInviteAuditPayload, buildInviteResponse } from '../_shared/adminInvitePayload.ts';
import type {
  PerIdInactiveResult,
  BulkInactiveResponse,
} from '../_shared/adminInactiveSchemas.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return methodNotAllowed();

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  const parsed = AdminUsersRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return validationFailed({
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  const body = parsed.data;
  if (!isWhitelistedAction(body.action)) {
    return badRequest('unknown_action');
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized();
    return forbidden(auth.reason);
  }
  const { caller, serviceClient } = auth;

  try {
    switch (body.action) {
      case 'list_users':
        return await handleListUsers(body, caller, serviceClient);
      case 'get_user_detail':
        return await handleGetUserDetail(body, caller, serviceClient);
      case 'create_user':
        return await handleCreateUser(body, caller, serviceClient);
      case 'create_bot_user':
        return await handleCreateBotUser(body, caller, serviceClient);
      case 'update_role':
        return await handleUpdateRole(body, caller, serviceClient);
      case 'invite_user':
        return await handleInviteUser(body, caller, serviceClient);
      case 'send_password_reset':
        return await handleSendPasswordReset(body, caller, serviceClient);
      case 'set_temporary_password':
        return await handleSetTemporaryPassword(body, caller, serviceClient);
      case 'disable_user':
        return await handleDisableUser(body, caller, serviceClient);
      case 'enable_user':
        return await handleEnableUser(body, caller, serviceClient);
      case 'soft_delete_user':
        return await handleSoftDeleteUser(body, caller, serviceClient);
      case 'list_blocks':
        return await handleListBlocks(body, caller, serviceClient);
      case 'add_block':
        return await handleAddBlock(body, caller, serviceClient);
      case 'remove_block':
        return await handleRemoveBlock(body, caller, serviceClient);
      case 'view_as_snapshot':
        return await handleViewAsSnapshot(body, caller, serviceClient);
      case 'get_semantic_config':
        return await handleGetSemanticConfig(body, caller, serviceClient);
      case 'set_semantic_config':
        return await handleSetSemanticConfig(body, caller, serviceClient);
      case 'set_argument_inactive':
        return await handleSetArgumentInactive(body, caller, serviceClient);
      case 'bulk_set_argument_inactive':
        return await handleBulkSetArgumentInactive(body, caller, serviceClient);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('admin_users_error', body.action, err);
    return internalError('admin_action_failed');
  }
});

// ── Handlers ──────────────────────────────────────────────────

type Caller = { userId: string; email: string | null; displayName: string | null; role: 'admin' };
type SC = ReturnType<typeof createServiceClient>;
type Req<A extends AdminUsersRequest['action']> = Extract<AdminUsersRequest, { action: A }>;

async function handleListUsers(
  body: Req<'list_users'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  const page = body.page ?? 1;
  const perPage = body.perPage ?? 25;

  // Pull a page of auth users via Admin API.
  const { data: authData, error: authErr } = await sc.auth.admin.listUsers({ page, perPage });
  if (authErr) return internalError(authErr.message);

  const authUsers = authData?.users ?? [];
  const ids = authUsers.map((u) => u.id);

  // Pull profiles & bot registry in bulk.
  const [profileRes, botRes] = await Promise.all([
    sc.from('profiles').select('id, display_name, role, created_at').in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']),
    sc.from('bot_user_registry').select('id, auth_user_id, label, persona, enabled').in('auth_user_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']),
  ]);

  const profilesById = new Map<string, { id: string; display_name: string | null; role: string; created_at: string }>();
  for (const p of profileRes.data ?? []) profilesById.set(p.id, p);
  const botByAuthId = new Map<string, { id: string; label: string; persona: string | null; enabled: boolean }>();
  for (const b of botRes.data ?? []) {
    if (b.auth_user_id) botByAuthId.set(b.auth_user_id, b);
  }

  const users = authUsers.map((u) => {
    const p = profilesById.get(u.id);
    const bot = botByAuthId.get(u.id);
    return {
      id: u.id,
      email: u.email ?? null,
      displayName: p?.display_name ?? null,
      role: p?.role ?? 'user',
      admin: p?.role === 'admin',
      isBot: Boolean(bot),
      botLabel: bot?.label ?? null,
      botPersona: bot?.persona ?? null,
      botEnabled: bot?.enabled ?? null,
      createdAt: u.created_at ?? p?.created_at ?? null,
      lastSignInAt: (u as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
      bannedUntil: (u as { banned_until?: string | null }).banned_until ?? null,
    };
  });

  // Client-side filter (page is already small).
  let filtered = users;
  if (body.search) {
    const s = body.search.toLowerCase();
    filtered = filtered.filter(
      (u) =>
        (u.email ?? '').toLowerCase().includes(s) ||
        (u.displayName ?? '').toLowerCase().includes(s) ||
        u.id.toLowerCase().includes(s),
    );
  }
  if (body.role) filtered = filtered.filter((u) => u.role === body.role);
  if (body.botOnly) filtered = filtered.filter((u) => u.isBot);

  await writeAdminAudit({
    actorUserId: caller.userId,
    action: 'list_users',
    payload: { page, perPage, search: body.search, role: body.role, botOnly: body.botOnly, resultCount: filtered.length },
  });

  return ok({ users: filtered, page, perPage });
}

async function handleGetUserDetail(
  body: Req<'get_user_detail'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  const { data: authUserRes, error: authErr } = await sc.auth.admin.getUserById(body.userId);
  if (authErr || !authUserRes?.user) return validationFailed({ error: 'user_not_found' });
  const authUser = authUserRes.user;

  const [profileRes, botRes, argCountRes, recentArgsRes, recentAuditRes, participantRes] = await Promise.all([
    sc.from('profiles').select('id, display_name, role, created_at').eq('id', body.userId).maybeSingle(),
    sc.from('bot_user_registry').select('id, label, persona, enabled, created_at').eq('auth_user_id', body.userId).maybeSingle(),
    sc.from('arguments').select('id', { count: 'exact', head: true }).eq('author_id', body.userId),
    sc.from('arguments').select('id, debate_id, argument_type, side, body, status, created_at').eq('author_id', body.userId).order('created_at', { ascending: false }).limit(10),
    sc.from('admin_audit_events').select('id, action, reason, created_at, payload, actor_user_id').eq('target_user_id', body.userId).order('created_at', { ascending: false }).limit(20),
    sc.from('debate_participants').select('debate_id, role, created_at').eq('user_id', body.userId).order('created_at', { ascending: false }).limit(20),
  ]);

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: body.userId,
    targetAuthUserId: body.userId,
    action: 'get_user_detail',
    payload: {},
  });

  return ok({
    auth: {
      id: authUser.id,
      email: authUser.email ?? null,
      createdAt: authUser.created_at ?? null,
      lastSignInAt: (authUser as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
      bannedUntil: (authUser as { banned_until?: string | null }).banned_until ?? null,
      emailConfirmedAt: (authUser as { email_confirmed_at?: string | null }).email_confirmed_at ?? null,
    },
    profile: profileRes.data ?? null,
    bot: botRes.data ?? null,
    argumentCount: argCountRes.count ?? 0,
    recentArguments: recentArgsRes.data ?? [],
    recentAuditEvents: recentAuditRes.data ?? [],
    recentParticipations: participantRes.data ?? [],
  });
}

async function handleCreateUser(
  body: Req<'create_user'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  const { data: createRes, error: createErr } = await sc.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: body.emailConfirm,
    user_metadata: body.displayName ? { display_name: body.displayName } : {},
  });
  if (createErr || !createRes?.user) {
    return validationFailed({ error: 'create_user_failed', detail: createErr?.message ?? 'unknown' });
  }
  const newId = createRes.user.id;

  // Profile is auto-created by trigger; update role/displayName if provided.
  await sc.from('profiles')
    .update({ display_name: body.displayName ?? null, role: body.role })
    .eq('id', newId);

  if (body.isBot) {
    await sc.from('bot_user_registry').insert({
      auth_user_id: newId,
      label: body.displayName ?? body.email,
      persona: body.persona ?? null,
      enabled: true,
      created_by: caller.userId,
    });
  }

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: newId,
    targetAuthUserId: newId,
    action: 'create_user',
    payload: {
      email: body.email,
      role: body.role,
      isBot: body.isBot,
      passwordProvided: Boolean(body.password),
    },
  });

  return ok({ userId: newId, email: body.email, role: body.role, isBot: body.isBot });
}

async function handleCreateBotUser(
  body: Req<'create_bot_user'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  const { data: createRes, error: createErr } = await sc.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { display_name: body.displayName ?? body.label, is_bot: true },
  });
  if (createErr || !createRes?.user) {
    return validationFailed({ error: 'create_bot_failed', detail: createErr?.message ?? 'unknown' });
  }
  const newId = createRes.user.id;

  await sc.from('profiles').update({ display_name: body.displayName ?? body.label }).eq('id', newId);

  const { data: botRow, error: botErr } = await sc
    .from('bot_user_registry')
    .insert({
      auth_user_id: newId,
      label: body.label,
      persona: body.persona ?? null,
      enabled: body.enabled,
      created_by: caller.userId,
    })
    .select()
    .single();
  if (botErr) {
    return internalError('bot_registry_insert_failed');
  }

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: newId,
    targetAuthUserId: newId,
    action: 'create_bot_user',
    payload: { label: body.label, persona: body.persona, passwordProvided: Boolean(body.password) },
  });

  return ok({ userId: newId, email: body.email, botRegistryId: botRow.id, label: body.label });
}

async function handleUpdateRole(
  body: Req<'update_role'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  // Block demoting last admin.
  if (body.role !== 'admin') {
    const { count } = await sc.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
    const { data: targetProf } = await sc.from('profiles').select('role').eq('id', body.userId).maybeSingle();
    if (targetProf?.role === 'admin' && (count ?? 0) <= 1) {
      return validationFailed({ error: 'cannot_demote_last_admin' });
    }
  }

  const { error: updErr } = await sc.from('profiles').update({ role: body.role }).eq('id', body.userId);
  if (updErr) return internalError(updErr.message);

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: body.userId,
    targetAuthUserId: body.userId,
    action: 'update_role',
    reason: body.reason,
    payload: { newRole: body.role },
  });

  return ok({ userId: body.userId, role: body.role });
}

async function handleInviteUser(
  body: Req<'invite_user'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  // inviteUserByEmail creates the auth.users row AND triggers the Supabase
  // "Invite user" email template. We deliberately use this rather than the
  // generate-invite-link admin API so the invite link/token never enters
  // function memory or the response — the email body stays entirely in the
  // Supabase template (the doctrine-required source of truth).
  const { data: inviteRes, error: inviteErr } = await sc.auth.admin.inviteUserByEmail(
    body.email,
    {
      data: body.displayName ? { display_name: body.displayName } : {},
      // undefined => Supabase falls back to the dashboard Site URL.
      redirectTo: body.redirectTo,
    },
  );

  if (inviteErr || !inviteRes?.user) {
    const msg = inviteErr?.message ?? 'unknown';
    if (/smtp|email.*not.*config|email provider|sending.*disabled/i.test(msg)) {
      // Plain-mappable: the invite mechanism itself needs operator setup.
      // Distinct from a bad email address. The client maps this to operator-
      // directed copy. ('send_failed' stays in the response union for
      // forward-compat — current @supabase/supabase-js@2 treats invite
      // failures atomically, so it is not emitted today.)
      return validationFailed({
        error: 'invite_email_not_configured',
        invited: false,
        notification: 'not_configured',
      });
    }
    // Generic failure — never special-case "already exists" into a precise
    // message (that would leak account-existence to the caller).
    return validationFailed({ error: 'invite_user_failed', detail: msg });
  }

  const newId = inviteRes.user.id;

  // Profile is auto-created by trigger; set role + displayName if provided.
  // role is 'user' | 'moderator' only (schema-enforced) — never 'admin'.
  await sc.from('profiles')
    .update({ display_name: body.displayName ?? null, role: body.role })
    .eq('id', newId);

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: newId,
    targetAuthUserId: newId,
    action: 'invite_user',
    payload: buildInviteAuditPayload({
      email: body.email,
      role: body.role,
      redirectToProvided: Boolean(body.redirectTo),
    }),
  });

  // Response carries no userId, no email, no link, no token.
  return ok(buildInviteResponse());
}

async function handleSendPasswordReset(
  body: Req<'send_password_reset'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  let email = body.email ?? null;
  let userId = body.userId ?? null;
  if (!email && userId) {
    const { data } = await sc.auth.admin.getUserById(userId);
    email = data?.user?.email ?? null;
  }
  if (!email) return validationFailed({ error: 'email_not_found' });

  // Generate recovery link via Admin API.
  const { error: linkErr } = await sc.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: body.redirectTo ? { redirectTo: body.redirectTo } : undefined,
  });
  if (linkErr) return internalError(linkErr.message);

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: userId ?? null,
    targetAuthUserId: userId ?? null,
    action: 'send_password_reset',
    payload: { emailDomain: email.split('@')[1] ?? null, redirectToProvided: Boolean(body.redirectTo) },
  });

  return ok({ sent: true });
}

async function handleSetTemporaryPassword(
  body: Req<'set_temporary_password'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  // botOnly enforcement: target must have a bot_user_registry row.
  if (body.botOnly) {
    const { data: bot } = await sc.from('bot_user_registry').select('id').eq('auth_user_id', body.userId).maybeSingle();
    if (!bot) {
      return forbidden('target_not_bot');
    }
  }

  const { error: updErr } = await sc.auth.admin.updateUserById(body.userId, {
    password: body.temporaryPassword,
  });
  if (updErr) return internalError(updErr.message);

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: body.userId,
    targetAuthUserId: body.userId,
    action: 'set_temporary_password',
    reason: body.reason,
    payload: { passwordChanged: true, botOnly: body.botOnly },
  });

  return ok({ userId: body.userId, passwordChanged: true });
}

async function handleDisableUser(
  body: Req<'disable_user'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  // Use ban_duration if 'until' not provided — Supabase Auth admin API supports ban_duration string.
  const until = body.until ? new Date(body.until) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10);
  const banDuration = `${Math.max(1, Math.floor((until.getTime() - Date.now()) / 1000))}s`;

  const { error: updErr } = await sc.auth.admin.updateUserById(body.userId, {
    ban_duration: banDuration,
  } as unknown as { ban_duration: string });
  if (updErr) return internalError(updErr.message);

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: body.userId,
    targetAuthUserId: body.userId,
    action: 'disable_user',
    reason: body.reason,
    payload: { until: until.toISOString() },
  });

  return ok({ userId: body.userId, disabled: true, until: until.toISOString() });
}

async function handleEnableUser(
  body: Req<'enable_user'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  const { error: updErr } = await sc.auth.admin.updateUserById(body.userId, {
    ban_duration: 'none',
  } as unknown as { ban_duration: string });
  if (updErr) return internalError(updErr.message);

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: body.userId,
    targetAuthUserId: body.userId,
    action: 'enable_user',
    reason: body.reason,
    payload: {},
  });

  return ok({ userId: body.userId, disabled: false });
}

async function handleSoftDeleteUser(
  body: Req<'soft_delete_user'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  // Supabase deleteUser with soft delete preserves the user with deleted_at set.
  const { error: delErr } = await sc.auth.admin.deleteUser(body.userId, true);
  if (delErr) return internalError(delErr.message);

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: body.userId,
    targetAuthUserId: body.userId,
    action: 'soft_delete_user',
    reason: body.reason,
    payload: { softDelete: true },
  });

  return ok({ userId: body.userId, softDeleted: true });
}

async function handleListBlocks(
  body: Req<'list_blocks'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  let query = sc.from('admin_block_rules').select('*').order('created_at', { ascending: false }).limit(200);
  if (body.active !== undefined) {
    query = sc.from('admin_block_rules').select('*').eq('active', body.active).order('created_at', { ascending: false }).limit(200);
  }
  const { data, error } = await query;
  if (error) return internalError(error.message);

  await writeAdminAudit({
    actorUserId: caller.userId,
    action: 'list_blocks',
    payload: { active: body.active, count: data?.length ?? 0 },
  });

  return ok({ blocks: data ?? [] });
}

async function handleAddBlock(
  body: Req<'add_block'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  const normalized = normalizeBlockValue(body.blockType, body.value);
  const { data, error } = await sc
    .from('admin_block_rules')
    .insert({
      block_type: body.blockType,
      value: body.value,
      normalized_value: normalized,
      reason: body.reason,
      active: true,
      created_by: caller.userId,
    })
    .select()
    .single();
  if (error) {
    // Could be duplicate active rule (unique partial index).
    return validationFailed({ error: 'block_insert_failed', detail: error.message });
  }

  await writeAdminAudit({
    actorUserId: caller.userId,
    action: 'add_block',
    reason: body.reason,
    payload: { blockType: body.blockType, normalizedValue: normalized },
  });

  return ok({ block: data });
}

async function handleRemoveBlock(
  body: Req<'remove_block'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  const { data, error } = await sc
    .from('admin_block_rules')
    .update({ active: false, lifted_by: caller.userId, lifted_at: new Date().toISOString() })
    .eq('id', body.blockRuleId)
    .select()
    .single();
  if (error) return validationFailed({ error: 'block_update_failed', detail: error.message });

  await writeAdminAudit({
    actorUserId: caller.userId,
    action: 'remove_block',
    reason: body.reason,
    payload: { blockRuleId: body.blockRuleId },
  });

  return ok({ block: data });
}

async function handleViewAsSnapshot(
  body: Req<'view_as_snapshot'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  const ctx = body.context ?? { includeRecentArguments: true, includeRooms: true, includeBotRegistry: true };

  const [profileRes, authRes] = await Promise.all([
    sc.from('profiles').select('id, display_name, role, created_at').eq('id', body.targetUserId).maybeSingle(),
    sc.auth.admin.getUserById(body.targetUserId),
  ]);
  if (!profileRes.data || !authRes.data?.user) {
    return validationFailed({ error: 'target_user_not_found' });
  }

  const includeArgs = ctx.includeRecentArguments ?? true;
  const includeRooms = ctx.includeRooms ?? true;
  const includeBot = ctx.includeBotRegistry ?? true;

  const [argsRes, roomsRes, botRes, historyRes] = await Promise.all([
    includeArgs
      ? sc.from('arguments').select('id, debate_id, argument_type, side, body, status, created_at').eq('author_id', body.targetUserId).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as unknown[] }),
    includeRooms
      ? sc.from('debate_participants').select('debate_id, role, created_at').eq('user_id', body.targetUserId).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as unknown[] }),
    includeBot
      ? sc.from('bot_user_registry').select('id, label, persona, enabled, created_at').eq('auth_user_id', body.targetUserId).maybeSingle()
      : Promise.resolve({ data: null as unknown }),
    sc.from('admin_audit_events').select('id, action, reason, created_at, actor_user_id, payload').eq('target_user_id', body.targetUserId).order('created_at', { ascending: false }).limit(10),
  ]);

  await writeAdminAudit({
    actorUserId: caller.userId,
    targetUserId: body.targetUserId,
    targetAuthUserId: body.targetUserId,
    action: 'view_as_snapshot',
    payload: { context: ctx },
  });

  return ok({
    readOnly: true,
    note: 'Read-only admin snapshot — you are not signed in as this user.',
    target: {
      id: authRes.data.user.id,
      email: authRes.data.user.email ?? null,
      profile: profileRes.data,
      bot: botRes.data ?? null,
    },
    recentArguments: argsRes.data ?? [],
    recentParticipations: roomsRes.data ?? [],
    recentAuditEvents: historyRes.data ?? [],
  });
}

// ── ADMIN-AI-001 — semantic-referee runtime provider-mode config ──

/**
 * Read the semantic-referee runtime config singleton for the Admin UI.
 *
 * Returns the provider mode, the enabled flag, who last changed it (resolved
 * to a DISPLAY NAME — never an email), and a SAFE `anthropicKeyPresent`
 * boolean. `anthropicKeyPresent` is a boolean ONLY — the key value, a prefix,
 * a length, or a masked form are NEVER returned (doctrine constraint #2).
 */
async function handleGetSemanticConfig(
  body: Req<'get_semantic_config'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  void body;
  const { data, error } = await sc
    .from('semantic_referee_runtime_config')
    .select('provider_mode, enabled, updated_at, updated_by')
    .eq('id', true)
    .maybeSingle();
  if (error) return internalError(error.message);

  // Resolve updated_by → a display name (NEVER an email).
  let updatedByDisplayName: string | null = null;
  if (data?.updated_by) {
    const { data: prof } = await sc
      .from('profiles')
      .select('display_name')
      .eq('id', data.updated_by)
      .maybeSingle();
    updatedByDisplayName = prof?.display_name ?? null;
  }

  // SAFE Anthropic-key status: a boolean ONLY, never the value / prefix /
  // length / masked form. This is the admin's signal that switching to
  // `anthropic` will (or will not) reach the live provider.
  const anthropicKeyPresent = Boolean(Deno.env.get('ANTHROPIC_API_KEY'));

  await writeAdminAudit({
    actorUserId: caller.userId,
    action: 'get_semantic_config',
    payload: {},
  });

  return ok({
    providerMode: data?.provider_mode ?? 'anthropic',
    enabled: data?.enabled ?? true,
    updatedAt: data?.updated_at ?? null,
    updatedByDisplayName,
    anthropicKeyPresent,
  });
}

/**
 * Update the semantic-referee runtime config singleton.
 *
 * Validation (the zod `.refine()` in `adminSemanticConfigSchemas.ts`) has
 * already enforced: `providerMode` is one of `anthropic | mock | fixture | mcp`
 * (`mcp` is settable as of 2026-06-03 — MCP server is up and configured),
 * and `confirmAnthropic === true` when switching to `anthropic`. This
 * handler reads the previous row for the audit "previous" fields, performs
 * the single-row atomic update, appends the dedicated config-audit row,
 * and writes the generic admin-traffic audit row.
 */
async function handleSetSemanticConfig(
  body: Req<'set_semantic_config'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  // 1. Read the current row for the audit "previous" fields.
  const { data: prev } = await sc
    .from('semantic_referee_runtime_config')
    .select('provider_mode, enabled')
    .eq('id', true)
    .maybeSingle();

  // 2. Update the singleton (single-row atomic write — last write wins).
  const { data: updated, error: updErr } = await sc
    .from('semantic_referee_runtime_config')
    .update({
      provider_mode: body.providerMode,
      enabled: body.enabled,
      updated_by: caller.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true)
    .select('provider_mode, enabled, updated_at')
    .single();
  if (updErr) return internalError(updErr.message);

  // 3. Append the dedicated config-audit row. Audit failure must not break
  //    the action result — `writeConfigAudit` swallows + logs its own errors.
  await writeConfigAudit(sc, {
    actorUserId: caller.userId,
    previousMode: prev?.provider_mode ?? null,
    newMode: body.providerMode,
    previousEnabled: prev?.enabled ?? null,
    newEnabled: body.enabled,
    reason: body.reason ?? null,
  });

  // 4. Generic admin-traffic audit row (the existing every-action pattern).
  await writeAdminAudit({
    actorUserId: caller.userId,
    action: 'set_semantic_config',
    reason: body.reason,
    payload: { providerMode: body.providerMode, enabled: body.enabled },
  });

  return ok({
    providerMode: updated.provider_mode,
    enabled: updated.enabled,
    updatedAt: updated.updated_at,
  });
}

/**
 * Insert a row into the dedicated `semantic_referee_config_audit` table.
 * Stores codes only — never secrets, never the Anthropic-key state. Audit
 * failure is logged but does not propagate (mirrors `writeAdminAudit`).
 */
async function writeConfigAudit(
  sc: SC,
  input: {
    actorUserId: string;
    previousMode: string | null;
    newMode: string;
    previousEnabled: boolean | null;
    newEnabled: boolean;
    reason: string | null;
  },
): Promise<void> {
  try {
    await sc.from('semantic_referee_config_audit').insert({
      actor_user_id: input.actorUserId,
      previous_mode: input.previousMode,
      new_mode: input.newMode,
      previous_enabled: input.previousEnabled,
      new_enabled: input.newEnabled,
      reason: input.reason,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('semantic_config_audit_write_failed', err);
  }
}

// ──────────────────────────────────────────────────────────────────────
// ADMIN-ARGS-INACTIVE-001 — per-argument inactive visibility handlers.
//
// Doctrine:
//   - The Edge handler computes `inactive_at = (inactive ? now() : NULL)`
//     server-side. The client NEVER picks a timestamp on the wire.
//   - `inactive: false` (Mark active) records a symmetric audit row with
//     `previous_inactive_at = <old timestamp>` and `new_inactive_at = NULL`.
//   - The argument body is NEVER stored in the audit row.
//   - The response NEVER returns the argument body. Only per-id ok/error.
//   - Logging strips body / reason / argumentId at info level — only the
//     action name + counts are logged (defense-in-depth; the body never
//     reaches log destinations).
// ──────────────────────────────────────────────────────────────────────

/**
 * Per-id transition. Reads previous_inactive_at, updates the row, inserts
 * one argument_inactive_audit row. Returns a PerIdInactiveResult.
 *
 * Atomicity contract: the audit insert references the same `inactive_at`
 * the handler just stamped. If the UPDATE returns zero rows (id not found),
 * the handler short-circuits to `{ok: false, errorCode: 'not_found'}` and
 * the audit row is NOT inserted. There is no partial state.
 */
async function applyInactiveTransition(
  sc: SC,
  argumentId: string,
  inactive: boolean,
  reason: string | null,
  actorUserId: string,
): Promise<PerIdInactiveResult> {
  // Read previous state for the audit row.
  const { data: prev, error: readErr } = await sc
    .from('arguments')
    .select('id, inactive_at')
    .eq('id', argumentId)
    .maybeSingle();
  if (readErr) {
    return { argumentId, ok: false, errorCode: 'read_failed' };
  }
  if (!prev) {
    return { argumentId, ok: false, errorCode: 'not_found' };
  }

  const newInactiveAt = inactive ? new Date().toISOString() : null;
  const newInactiveBy = inactive ? actorUserId : null;
  const newInactiveReason = inactive ? reason : null;

  // UPDATE arguments. Service-role bypasses RLS; the admin boundary was
  // already enforced by `requireAdmin` at the entry point.
  const { error: updErr } = await sc
    .from('arguments')
    .update({
      inactive_at: newInactiveAt,
      inactive_by: newInactiveBy,
      inactive_reason: newInactiveReason,
    })
    .eq('id', argumentId);
  if (updErr) {
    return { argumentId, ok: false, errorCode: 'update_failed' };
  }

  // Insert the argument-scoped audit row. The body is NEVER stored here.
  const { error: auditErr } = await sc
    .from('argument_inactive_audit')
    .insert({
      actor_user_id: actorUserId,
      argument_id: argumentId,
      previous_inactive_at: (prev as { inactive_at: string | null }).inactive_at,
      new_inactive_at: newInactiveAt,
      reason,
    });
  if (auditErr) {
    // The column mutation already landed; an audit-write failure here would
    // leave history incomplete. Surface the failure rather than silently
    // succeeding so the operator can investigate.
    // eslint-disable-next-line no-console
    console.error('argument_inactive_audit_write_failed', auditErr.message);
    return { argumentId, ok: false, errorCode: 'audit_write_failed' };
  }

  return { argumentId, ok: true };
}

async function handleSetArgumentInactive(
  body: Req<'set_argument_inactive'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  const reason = body.reason ?? null;
  const result = await applyInactiveTransition(
    sc,
    body.argumentId,
    body.inactive,
    reason,
    caller.userId,
  );

  // Defense-in-depth: also write the generic admin-traffic audit row. The
  // payload carries the action shape but NOT the body (body never touches
  // the audit log anywhere on this path).
  await writeAdminAudit({
    actorUserId: caller.userId,
    action: 'set_argument_inactive',
    reason: body.reason ?? null,
    payload: {
      argumentId: body.argumentId,
      inactive: body.inactive,
      ok: result.ok,
      errorCode: result.errorCode,
    },
  });

  if (!result.ok) {
    return validationFailed({ error: 'argument_inactive_transition_failed', detail: result.errorCode ?? 'unknown' });
  }
  return ok({ result });
}

async function handleBulkSetArgumentInactive(
  body: Req<'bulk_set_argument_inactive'>,
  caller: Caller,
  sc: SC,
): Promise<Response> {
  const reason = body.reason ?? null;
  const results: PerIdInactiveResult[] = [];
  for (const argumentId of body.argumentIds) {
    const r = await applyInactiveTransition(
      sc,
      argumentId,
      body.inactive,
      reason,
      caller.userId,
    );
    results.push(r);
  }
  const appliedCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - appliedCount;

  // The batch-level admin audit row carries counts and an aggregated
  // error-code summary — NEVER the argument bodies. The reason is also
  // recorded at the batch level.
  const errorCodeSummary: Record<string, number> = {};
  for (const r of results) {
    if (!r.ok && r.errorCode) {
      errorCodeSummary[r.errorCode] = (errorCodeSummary[r.errorCode] ?? 0) + 1;
    }
  }
  await writeAdminAudit({
    actorUserId: caller.userId,
    action: 'bulk_set_argument_inactive',
    reason: body.reason ?? null,
    payload: {
      inactive: body.inactive,
      requestedCount: body.argumentIds.length,
      appliedCount,
      failedCount,
      errorCodeSummary,
    },
  });

  const response: BulkInactiveResponse = { results, appliedCount, failedCount };
  return ok(response);
}
