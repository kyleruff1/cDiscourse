/**
 * Maps a fixture move into the body expected by submit-argument.
 * CommonJS for direct test require().
 */
const { randomUUID } = require('node:crypto');

function buildSubmitArgumentBody(input) {
  const { debateId, parentArgumentId, move, side, clientSubmissionId } = input;
  const body = {
    debate_id: debateId,
    parent_id: parentArgumentId,
    argument_type: move.argumentType,
    side,
    body: move.body,
    selected_tag_codes: move.selectedTagCodes || [],
    client_submission_id: clientSubmissionId || randomUUID(),
  };

  const target = {};
  if (move.targetExcerpt) target.target_excerpt = move.targetExcerpt;
  if (move.disagreementAxis) target.disagreement_axis = move.disagreementAxis;
  if (Object.keys(target).length > 0) body.target = target;

  if (move.evidence) {
    const attached = {};
    if (move.evidence.url) attached.url = move.evidence.url;
    if (move.evidence.label) attached.label = move.evidence.label;
    if (move.evidence.sourceText) attached.source_text = move.evidence.sourceText;
    body.attached_evidence = [attached];
  }

  return body;
}

function isAllowedSubmitBody(body) {
  const allowed = new Set([
    'debate_id',
    'parent_id',
    'argument_type',
    'side',
    'body',
    'selected_tag_codes',
    'client_submission_id',
    'target',
    'attached_evidence',
    'client_validation',
  ]);
  for (const k of Object.keys(body)) {
    if (!allowed.has(k)) return false;
  }
  const forbidden = ['author_id', 'depth', 'status', 'server_validation', 'created_at', 'id'];
  for (const f of forbidden) {
    if (f in body) return false;
  }
  return true;
}

/**
 * Extract HTTP status from a supabase-js v2 FunctionsHttpError.
 * The library's `error.status` is undefined; the real status lives on the
 * underlying Response, exposed as `error.context.status`.
 *
 * Falls back through, in order:
 *   1. error.context.status (FunctionsHttpError)
 *   2. error.status (some older wrappers)
 *   3. 0 (unknown — caller treats as transport/relay error)
 */
function extractErrorStatus(error) {
  const ctx = error && error.context;
  if (ctx && typeof ctx.status === 'number') return ctx.status;
  if (error && typeof error.status === 'number') return error.status;
  return 0;
}

/**
 * Parse the JSON body of a non-2xx Response without consuming it twice and
 * without exposing headers, JWTs, or apikey values.
 *
 * Returns null on non-JSON / parse failure. We intentionally swallow errors —
 * the caller has the status code and will treat a null body as "no detail".
 */
async function extractErrorBody(error) {
  const ctx = error && error.context;
  if (!ctx || typeof ctx.json !== 'function') return null;
  try {
    return await ctx.json();
  } catch {
    return null;
  }
}

/**
 * Pull a short, safe detail string from the parsed error body.
 *
 * For 422 validation_failed, surfaces the first blockingError message.
 * For 403 forbidden, surfaces the `reason` field.
 * Never returns headers, JWTs, apikey, request bodies, or other secrets.
 */
function summarizeErrorDetail(errorBody) {
  if (!errorBody || typeof errorBody !== 'object') return null;
  if (Array.isArray(errorBody.blockingErrors) && errorBody.blockingErrors.length > 0) {
    const first = errorBody.blockingErrors[0];
    if (first && typeof first === 'object') {
      const rule = first.ruleCode || first.flagCode || '';
      const msg = typeof first.message === 'string' ? first.message : '';
      return rule ? `${rule}: ${msg}` : msg;
    }
  }
  if (typeof errorBody.reason === 'string') return errorBody.reason;
  if (typeof errorBody.detail === 'string') return errorBody.detail;
  return null;
}

async function invokeSubmitArgument(sb, body) {
  if (!isAllowedSubmitBody(body)) {
    return { ok: false, error: { error: 'forbidden_body_shape' }, status: 400, detail: null };
  }
  const { data, error } = await sb.functions.invoke('submit-argument', { body });
  if (!error) return { ok: true, data };

  const errorBody = (await extractErrorBody(error)) || { error: 'unknown_error' };
  let status = extractErrorStatus(error);
  if (status === 0) {
    // No status available — only true transport failures land here.
    status = errorBody && errorBody.error === 'unknown_error' ? 500 : 500;
  }
  const detail = summarizeErrorDetail(errorBody);
  return { ok: false, error: errorBody, status, detail };
}

module.exports = {
  buildSubmitArgumentBody,
  isAllowedSubmitBody,
  invokeSubmitArgument,
  extractErrorStatus,
  extractErrorBody,
  summarizeErrorDetail,
};
