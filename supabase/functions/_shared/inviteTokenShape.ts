/**
 * QOL-038 — token shape constants shared by the Edge Function's Zod
 * schema and the token helper. Duplicated from
 * `src/features/invites/inviteDeepLink.ts` so the Edge Function does NOT
 * import from `src/` (no client-runtime coupling on Deno).
 *
 * If you change either side, change both. The client/server mismatch is
 * a class of bug a single literal change cannot create — a token that
 * passes the client shape gate must also pass the server gate. The
 * existing __tests__/inviteSchemasMirror.test.ts asserts byte-equality
 * of the shape (length + regex) across the two.
 */
export const INVITE_TOKEN_MIN_LENGTH = 32;
export const INVITE_TOKEN_MAX_LENGTH = 64;
