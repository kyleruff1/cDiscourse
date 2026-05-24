/**
 * PR-003 — Avatar client wrapper.
 *
 * Pure validation helpers (testable without RN / Supabase) plus thin
 * Supabase / Edge Function callers. The Edge Function `upload-avatar` is
 * the only WRITE path for the four profiles.avatar_* columns (the
 * narrowed RLS policy from migration 16 refuses client-JWT writes); the
 * client never touches the columns directly. Reading a public URL goes
 * through the supabase storage helper (no Edge Function round-trip).
 *
 * Doctrine surface:
 *   - Internal codes (`mime_not_allowed`, `too_large`, `empty`, `removed`)
 *     never appear in user-facing strings; the consumer maps them via
 *     `messageForAvatarError`.
 *   - No service-role import. No AI provider import. No console.log.
 */
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';

// ── Constants ─────────────────────────────────────────────────

export const AVATAR_BUCKET = 'profile-avatars';
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB

export const AVATAR_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type AvatarMimeType = typeof AVATAR_ALLOWED_MIME_TYPES[number];

// ── Types ─────────────────────────────────────────────────────

export type AvatarValidationError =
  | 'mime_not_allowed'
  | 'too_large'
  | 'empty';

export type AvatarApiErrorCode =
  | 'config_missing'
  | 'no_session'
  | 'network_error'
  | 'invalid_response'
  | 'mime_not_allowed'
  | 'too_large'
  | 'empty'
  | 'invalid_image'
  | 'image_too_small'
  | 'storage_upload_failed'
  | 'profile_update_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'unknown';

export interface AvatarUploadResult {
  avatarPath: string;
  avatarThumbPath: string;
  avatarUpdatedAt: string;
  publicUrl: string | null;
  publicThumbUrl: string | null;
}

export interface AvatarReadUrlsResult {
  publicUrl: string | null;
  publicThumbUrl: string | null;
  moderationStatus: 'allowed' | 'removed';
}

export type AvatarApiResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: AvatarApiErrorCode; message: string };

// ── Pure helpers (testable without picker / network) ──────────

/** Returns ok or an explicit validation error code. Pure equality on the
 * MIME string — no parsing of parameter suffixes (a parameter-suffixed
 * MIME like `image/jpeg; charset=utf-8` is rejected by design). */
export function validateAvatarSelection(input: {
  mimeType: string;
  byteLength: number;
}): { ok: true } | { ok: false; error: AvatarValidationError } {
  const mime = typeof input.mimeType === 'string' ? input.mimeType : '';
  if (!(AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    return { ok: false, error: 'mime_not_allowed' };
  }
  const size = typeof input.byteLength === 'number' ? input.byteLength : 0;
  if (size <= 0) return { ok: false, error: 'empty' };
  if (size > AVATAR_MAX_BYTES) return { ok: false, error: 'too_large' };
  return { ok: true };
}

/** Plain-language message for an error code. Internal codes NEVER leak
 * (the doctrine ban-list scan in __tests__/avatarDoctrine.test.ts asserts
 * this — internal codes do not appear in any return value here). */
export function messageForAvatarError(code: AvatarApiErrorCode | AvatarValidationError): string {
  switch (code) {
    case 'mime_not_allowed':
      return 'Use a JPG, PNG, or WebP photo.';
    case 'too_large':
      return 'That photo is too large (max 2 MB).';
    case 'empty':
      return "We couldn't read that photo. Try another file.";
    case 'invalid_image':
      return "We couldn't read that photo. Try another file.";
    case 'image_too_small':
      return 'Use a photo at least 64 by 64 pixels.';
    case 'storage_upload_failed':
      return 'Upload failed. Try again.';
    case 'profile_update_failed':
      return 'Upload failed. Try again.';
    case 'network_error':
      return 'Network error. Check your connection.';
    case 'invalid_response':
      return 'Upload failed. Try again.';
    case 'no_session':
      return 'Please sign in again.';
    case 'unauthorized':
      return 'Please sign in again.';
    case 'forbidden':
      return 'You do not have permission to do that.';
    case 'config_missing':
      return 'Supabase is not configured.';
    case 'unknown':
    default:
      return 'Something went wrong. Try again.';
  }
}

/** Resolves a profile.avatar_path to a public URL via Supabase storage.
 * Pure — no Edge Function call. Returns null if path is null/empty.
 * Optional cache-bust query parameter (`avatarUpdatedAt` timestamp). */
export function resolveAvatarPublicUrl(
  avatarPath: string | null,
  options?: { cacheBustToken?: string | null },
): string | null {
  if (!avatarPath || typeof avatarPath !== 'string') return null;
  if (!SUPABASE_CONFIGURED) return null;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
  const url = data?.publicUrl ?? null;
  if (!url) return null;
  const token = options?.cacheBustToken;
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  // The token is opaque; the consumer passes avatarUpdatedAt (an ISO
  // timestamp) which changes on every upload / remove so the cache key
  // changes accordingly.
  return `${url}${sep}v=${encodeURIComponent(token)}`;
}

// ── Picker payload builder (consumes a picker asset) ──────────

/**
 * Reads bytes from a picker URI (filesystem URI on native, blob URL on
 * web) and produces the Edge Function payload. The Edge Function
 * re-validates MIME + size + decode on the server — this client step
 * is for UX (early reject before a 2 MB upload starts) and for shape.
 */
export async function buildAvatarUploadPayload(input: {
  uri: string;
  mimeType: AvatarMimeType;
}): Promise<{ imageBase64: string; mimeType: AvatarMimeType; originalByteLength: number }> {
  const res = await fetch(input.uri);
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const imageBase64 = bytesToBase64(bytes);
  return {
    imageBase64,
    mimeType: input.mimeType,
    originalByteLength: bytes.length,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked btoa avoids stack overflows on multi-megabyte payloads.
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// ── Edge Function callers ─────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

function buildFunctionUrl(): string | null {
  const baseUrl = (supabase as unknown as { supabaseUrl?: string }).supabaseUrl;
  if (!baseUrl || typeof baseUrl !== 'string') return null;
  return `${baseUrl.replace(/\/$/, '')}/functions/v1/upload-avatar`;
}

function mapEdgeFunctionError(error: unknown): AvatarApiErrorCode {
  if (typeof error !== 'string') return 'unknown';
  if (error === 'mime_not_allowed') return 'mime_not_allowed';
  if (error === 'too_large') return 'too_large';
  if (error === 'empty') return 'empty';
  if (error === 'invalid_image') return 'invalid_image';
  if (error === 'image_too_small') return 'image_too_small';
  if (error === 'storage_upload_failed') return 'storage_upload_failed';
  if (error === 'profile_update_failed') return 'profile_update_failed';
  if (error === 'unauthorized') return 'unauthorized';
  if (error === 'forbidden') return 'forbidden';
  return 'unknown';
}

interface EdgeFunctionResponse {
  status: number;
  body: unknown;
}

async function callUploadAvatar(payload: Record<string, unknown>): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: AvatarApiErrorCode; message: string }
> {
  if (!SUPABASE_CONFIGURED) {
    return { ok: false, error: 'config_missing', message: messageForAvatarError('config_missing') };
  }
  const token = await getAccessToken();
  if (!token) {
    return { ok: false, error: 'no_session', message: messageForAvatarError('no_session') };
  }
  const url = buildFunctionUrl();
  if (!url) {
    return { ok: false, error: 'config_missing', message: messageForAvatarError('config_missing') };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: 'network_error', message: messageForAvatarError('network_error') };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      error: 'invalid_response',
      message: messageForAvatarError('invalid_response'),
    };
  }

  const parsed: EdgeFunctionResponse = { status: response.status, body };

  if (!response.ok || (body && typeof body === 'object' && 'error' in (body as Record<string, unknown>))) {
    const errorField = (body as Record<string, unknown>)?.error;
    const detailField = (body as Record<string, unknown>)?.detail;
    const errorCode = mapEdgeFunctionError(
      typeof detailField === 'string' && detailField ? detailField : errorField,
    );
    return { ok: false, error: errorCode, message: messageForAvatarError(errorCode) };
  }

  if (!parsed.body || typeof parsed.body !== 'object') {
    return {
      ok: false,
      error: 'invalid_response',
      message: messageForAvatarError('invalid_response'),
    };
  }

  return { ok: true, body: parsed.body as Record<string, unknown> };
}

/** Calls the upload-avatar Edge Function `upload` action. */
export async function uploadAvatar(input: {
  uri: string;
  mimeType: AvatarMimeType;
}): Promise<AvatarApiResult<AvatarUploadResult>> {
  const validation = validateAvatarSelection({ mimeType: input.mimeType, byteLength: 1 });
  if (!validation.ok) {
    return { ok: false, error: validation.error, message: messageForAvatarError(validation.error) };
  }

  let payload: { imageBase64: string; mimeType: AvatarMimeType; originalByteLength: number };
  try {
    payload = await buildAvatarUploadPayload(input);
  } catch {
    return { ok: false, error: 'network_error', message: messageForAvatarError('network_error') };
  }

  const sizeValidation = validateAvatarSelection({
    mimeType: payload.mimeType,
    byteLength: payload.originalByteLength,
  });
  if (!sizeValidation.ok) {
    return {
      ok: false,
      error: sizeValidation.error,
      message: messageForAvatarError(sizeValidation.error),
    };
  }

  const result = await callUploadAvatar({
    action: 'upload',
    imageBase64: payload.imageBase64,
    mimeType: payload.mimeType,
    originalByteLength: payload.originalByteLength,
  });

  if (!result.ok) return result;

  const body = result.body;
  const data: AvatarUploadResult = {
    avatarPath: (body.avatarPath as string) ?? '',
    avatarThumbPath: (body.avatarThumbPath as string) ?? '',
    avatarUpdatedAt: (body.avatarUpdatedAt as string) ?? '',
    publicUrl: (body.publicUrl as string | null) ?? null,
    publicThumbUrl: (body.publicThumbUrl as string | null) ?? null,
  };
  return { ok: true, data };
}

/** Calls the upload-avatar Edge Function `remove` action. */
export async function removeAvatar(): Promise<AvatarApiResult<{ avatarUpdatedAt: string }>> {
  const result = await callUploadAvatar({ action: 'remove' });
  if (!result.ok) return result;
  const avatarUpdatedAt = (result.body.avatarUpdatedAt as string) ?? '';
  return { ok: true, data: { avatarUpdatedAt } };
}

/** Calls the upload-avatar Edge Function `read_url_for_user` action. */
export async function readAvatarUrlsForUser(
  userId: string,
): Promise<AvatarApiResult<AvatarReadUrlsResult>> {
  const result = await callUploadAvatar({ action: 'read_url_for_user', userId });
  if (!result.ok) return result;
  const body = result.body;
  const moderationStatus = body.moderationStatus === 'removed' ? 'removed' : 'allowed';
  return {
    ok: true,
    data: {
      publicUrl: (body.publicUrl as string | null) ?? null,
      publicThumbUrl: (body.publicThumbUrl as string | null) ?? null,
      moderationStatus,
    },
  };
}
