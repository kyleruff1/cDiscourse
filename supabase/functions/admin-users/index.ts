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
  // "Invite user" email template. We deliberately use this over
  // generateLink('invite') so the invite link/token never enters function
  // memory or the response — the email body stays entirely in the Supabase
  // template (the doctrine-required source of truth).
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
