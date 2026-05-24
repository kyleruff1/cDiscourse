/**
 * Edge Function: upload-avatar (PR-003)
 *
 * Three actions in a single dispatch shape (mirrors manage-room-invite):
 *
 *   - upload             — decode + resize + EXIF-strip + store + update profile.
 *   - remove             — delete both storage objects + null the profile columns.
 *   - read_url_for_user  — resolve another user's avatar public URLs, honouring
 *                          the moderation_status gate.
 *
 * Security model (per cdiscourse-doctrine + supabase-edge-contract):
 *   - verify_jwt = true in config.toml (every action requires a signed-in caller).
 *   - The caller-scoped client identifies the caller via auth.getUser().
 *   - The service-role client is used ONLY for storage writes and the
 *     profiles UPDATE (the narrowed UPDATE policy refuses client-JWT writes
 *     to the four avatar columns, so the service-role client is the only
 *     write path).
 *   - The upload + remove actions write to a path DERIVED from
 *     auth.getUser().id — never from the request body. A caller cannot
 *     overwrite another user's avatar.
 *
 * Hard rules:
 *   - Never logs Authorization headers, Bearer tokens,
 *     SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY, or
 *     raw headers.
 *   - Never returns service-role tokens or other users' PII.
 *   - Never deletes a row in public.arguments or any other content table.
 *   - Never calls Anthropic, xAI, X API, or any external AI provider.
 *
 * EXIF stripping is by construction: decode the bytes to pixels via
 * imagescript, then re-encode as WebP. A fresh encode emits no EXIF
 * block — there is no "remove EXIF" step because we never read it.
 *
 * Companion design: docs/designs/PR-003.md §4 + §7.
 */
import {
  corsHeaders,
  ok,
  badRequest,
  unauthorized,
  forbidden,
  methodNotAllowed,
  internalError,
} from '../_shared/http.ts';
import { createCallerClient, createServiceClient } from '../_shared/supabaseClients.ts';
import { decode } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';
import type { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';

// ── Constants ─────────────────────────────────────────────────

const AVATAR_BUCKET = 'profile-avatars';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB — mirrors the bucket cap.
const AVATAR_MIN_DIMENSION = 64;
const AVATAR_MAIN_DIMENSION = 256;
const AVATAR_THUMB_DIMENSION = 64;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AvatarMimeType = typeof ALLOWED_MIME_TYPES[number];

// ── Body types ────────────────────────────────────────────────

interface UploadActionBody {
  action: 'upload';
  imageBase64: string;
  mimeType: string;
  originalByteLength: number;
}

interface RemoveActionBody {
  action: 'remove';
}

interface ReadUrlActionBody {
  action: 'read_url_for_user';
  userId: string;
}

type UploadAvatarRequestBody = UploadActionBody | RemoveActionBody | ReadUrlActionBody;

// ── Helpers ───────────────────────────────────────────────────

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function isAllowedMime(value: unknown): value is AvatarMimeType {
  return typeof value === 'string' && (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

function shortId(id: string): string {
  return typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : '(unknown)';
}

function avatarPathFor(userId: string): { main: string; thumb: string } {
  return {
    main: `${userId}/avatar-256.webp`,
    thumb: `${userId}/avatar-64.webp`,
  };
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  // atob is available in the Deno runtime.
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Audit (best-effort, never blocks) ─────────────────────────

async function writeAvatarAudit(
  action: 'avatar_uploaded' | 'avatar_removed',
  actorUserId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from('admin_audit_events').insert({
      action,
      source: 'edge_function',
      actor_user_id: actorUserId,
      target_user_id: actorUserId,
      reason: null,
      payload,
    });
  } catch {
    // Audit failure must NEVER block the user action. The primary
    // doctrine guarantee (storage write + profile update) is already
    // satisfied at this point in the call chain.
  }
}

// ── Server ────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return methodNotAllowed();

  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return unauthorized();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  if (!raw || typeof raw !== 'object') return badRequest('invalid_body');
  const body = raw as Partial<UploadAvatarRequestBody>;

  // Identify the caller BEFORE branching on action. Every action requires
  // a signed-in caller; placing this here means we cannot accidentally
  // skip it on a new action variant.
  const callerClient = createCallerClient(auth);
  const { data: userRes, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userRes?.user?.id) return unauthorized();
  const callerUserId = userRes.user.id;

  switch (body.action) {
    case 'upload':
      return await handleUpload(body as UploadActionBody, callerUserId);
    case 'remove':
      return await handleRemove(callerUserId);
    case 'read_url_for_user':
      return await handleReadUrlForUser(body as ReadUrlActionBody, callerClient);
    default:
      return badRequest('unknown_action');
  }
});

// ── upload action ─────────────────────────────────────────────

async function handleUpload(body: UploadActionBody, callerUserId: string): Promise<Response> {
  // Shape validation
  if (typeof body.imageBase64 !== 'string' || body.imageBase64.length === 0) {
    return badRequest('imageBase64_required');
  }
  if (!isAllowedMime(body.mimeType)) {
    return badRequest('mime_not_allowed');
  }
  if (typeof body.originalByteLength !== 'number' || body.originalByteLength <= 0) {
    return badRequest('originalByteLength_required');
  }

  // Decode base64 to raw bytes; server-side size check enforces the cap
  // independent of the client (the client check is UX only).
  let inputBytes: Uint8Array;
  try {
    inputBytes = decodeBase64ToBytes(body.imageBase64);
  } catch {
    return badRequest('invalid_base64');
  }

  if (inputBytes.length > AVATAR_MAX_BYTES) {
    return badRequest('too_large');
  }
  if (inputBytes.length === 0) {
    return badRequest('empty');
  }

  // Decode pixels — imagescript handles JPEG / PNG / WebP. A decode failure
  // means the file is malformed; we never write the original bytes to
  // storage, so EXIF stripping is by construction.
  let decoded: Image;
  try {
    const result = await decode(inputBytes);
    // decode() may return Image or Frame[]; we only support still images.
    if (Array.isArray(result)) {
      return badRequest('invalid_image');
    }
    decoded = result as Image;
  } catch {
    return badRequest('invalid_image');
  }

  if (
    typeof decoded.width !== 'number' ||
    typeof decoded.height !== 'number' ||
    decoded.width < AVATAR_MIN_DIMENSION ||
    decoded.height < AVATAR_MIN_DIMENSION
  ) {
    return badRequest('image_too_small');
  }

  // Resize to 256x256 main + 64x64 thumb. imagescript's resize is a fresh
  // encode operation, so the resulting bytes never carry EXIF.
  let mainBytes: Uint8Array;
  let thumbBytes: Uint8Array;
  try {
    const main = decoded.clone().resize(AVATAR_MAIN_DIMENSION, AVATAR_MAIN_DIMENSION);
    const thumb = decoded.clone().resize(AVATAR_THUMB_DIMENSION, AVATAR_THUMB_DIMENSION);
    mainBytes = await main.encode();
    thumbBytes = await thumb.encode();
  } catch {
    return internalError('resize_failed');
  }

  const paths = avatarPathFor(callerUserId);
  const svc = createServiceClient();

  // Upload main (upsert so a change action overwrites the prior file at
  // the same path).
  const { error: mainErr } = await svc.storage
    .from(AVATAR_BUCKET)
    .upload(paths.main, mainBytes, {
      upsert: true,
      contentType: 'image/webp',
    });
  if (mainErr) {
    return internalError('storage_upload_failed');
  }

  // Upload thumb. If this fails AFTER main succeeded, attempt a best-effort
  // cleanup of main so the path pair stays consistent for the next upload.
  const { error: thumbErr } = await svc.storage
    .from(AVATAR_BUCKET)
    .upload(paths.thumb, thumbBytes, {
      upsert: true,
      contentType: 'image/webp',
    });
  if (thumbErr) {
    try {
      await svc.storage.from(AVATAR_BUCKET).remove([paths.main]);
    } catch {
      // Cleanup is best-effort; an orphan is overwritten on the next upload.
    }
    return internalError('storage_upload_failed');
  }

  const avatarUpdatedAt = new Date().toISOString();

  // Update the four avatar columns on profiles via service-role (the
  // narrowed UPDATE policy from migration 16 refuses client-JWT writes
  // to these columns). If this fails after storage succeeded, attempt
  // best-effort cleanup of both paths so the next upload starts clean.
  const { error: profileErr } = await svc
    .from('profiles')
    .update({
      avatar_path: paths.main,
      avatar_thumb_path: paths.thumb,
      avatar_updated_at: avatarUpdatedAt,
    })
    .eq('id', callerUserId);
  if (profileErr) {
    try {
      await svc.storage.from(AVATAR_BUCKET).remove([paths.main, paths.thumb]);
    } catch {
      // Orphan cleanup is best-effort.
    }
    return internalError('profile_update_failed');
  }

  // Resolve public URLs via the service-role client. The bucket is
  // public-read so getPublicUrl is a synchronous URL build, not a signed
  // URL request.
  const { data: mainUrl } = svc.storage.from(AVATAR_BUCKET).getPublicUrl(paths.main);
  const { data: thumbUrl } = svc.storage.from(AVATAR_BUCKET).getPublicUrl(paths.thumb);

  await writeAvatarAudit('avatar_uploaded', callerUserId, {
    sizeBytesOriginal: body.originalByteLength,
    sizeBytesMain: mainBytes.length,
    sizeBytesThumb: thumbBytes.length,
    userIdShort: shortId(callerUserId),
  });

  return ok({
    avatarPath: paths.main,
    avatarThumbPath: paths.thumb,
    avatarUpdatedAt,
    publicUrl: mainUrl?.publicUrl ?? null,
    publicThumbUrl: thumbUrl?.publicUrl ?? null,
  });
}

// ── remove action ─────────────────────────────────────────────

async function handleRemove(callerUserId: string): Promise<Response> {
  const paths = avatarPathFor(callerUserId);
  const svc = createServiceClient();

  // Storage remove does not error if the files do not exist; we still
  // tolerate any error here defensively.
  try {
    await svc.storage.from(AVATAR_BUCKET).remove([paths.main, paths.thumb]);
  } catch {
    // The next steps still null the profile columns; an orphaned object
    // is invisible to the UI (nothing references it).
  }

  const avatarUpdatedAt = new Date().toISOString();

  const { error: profileErr } = await svc
    .from('profiles')
    .update({
      avatar_path: null,
      avatar_thumb_path: null,
      avatar_updated_at: avatarUpdatedAt,
    })
    .eq('id', callerUserId);
  if (profileErr) {
    return internalError('profile_update_failed');
  }

  await writeAvatarAudit('avatar_removed', callerUserId, {
    userIdShort: shortId(callerUserId),
  });

  return ok({ removed: true, avatarUpdatedAt });
}

// ── read_url_for_user action ──────────────────────────────────

async function handleReadUrlForUser(
  body: ReadUrlActionBody,
  callerClient: ReturnType<typeof createCallerClient>,
): Promise<Response> {
  if (!isUuid(body.userId)) return badRequest('userId_required');

  // Caller-scoped read of profiles. profiles SELECT RLS lets any
  // authenticated caller read display_name + role (and now the avatar
  // columns), so this is consistent with the existing visibility model.
  const { data: profile, error: profErr } = await callerClient
    .from('profiles')
    .select('avatar_path, avatar_thumb_path, avatar_moderation_status')
    .eq('id', body.userId)
    .maybeSingle();
  if (profErr) return internalError('profile_lookup_failed');

  // Missing profile + missing avatar are both "no avatar" — the caller
  // falls back to the GeneratedAvatar placeholder. We do not 404 a
  // missing profile to avoid leaking existence.
  if (!profile || !profile.avatar_path || !profile.avatar_thumb_path) {
    return ok({
      publicUrl: null,
      publicThumbUrl: null,
      moderationStatus: (profile?.avatar_moderation_status as string) || 'allowed',
    });
  }

  if (profile.avatar_moderation_status === 'removed') {
    return ok({
      publicUrl: null,
      publicThumbUrl: null,
      moderationStatus: 'removed',
    });
  }

  // Resolve public URLs. The service-role client is the cleanest source
  // for getPublicUrl (no JWT round-trip required since the bucket is
  // public-read).
  const svc = createServiceClient();
  const { data: mainUrl } = svc.storage.from(AVATAR_BUCKET).getPublicUrl(profile.avatar_path);
  const { data: thumbUrl } = svc.storage.from(AVATAR_BUCKET).getPublicUrl(profile.avatar_thumb_path);

  // forbidden + shortId are intentionally referenced here so a future
  // maintainer adding a strict-author check has the helpers in scope.
  // Reference them so the importer is not unused.
  void forbidden;
  void shortId;

  return ok({
    publicUrl: mainUrl?.publicUrl ?? null,
    publicThumbUrl: thumbUrl?.publicUrl ?? null,
    moderationStatus: 'allowed',
  });
}
