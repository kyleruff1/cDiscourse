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

async function invokeSubmitArgument(sb, body) {
  if (!isAllowedSubmitBody(body)) {
    return { ok: false, error: { error: 'forbidden_body_shape' }, status: 400 };
  }
  const { data, error } = await sb.functions.invoke('submit-argument', { body });
  if (error) {
    let errorBody = { error: 'network_error' };
    try {
      const raw = error.context;
      if (raw && raw.json) errorBody = await raw.json();
    } catch {
      // ignore parse failures
    }
    const status = error.status || 500;
    return { ok: false, error: errorBody, status };
  }
  return { ok: true, data };
}

module.exports = { buildSubmitArgumentBody, isAllowedSubmitBody, invokeSubmitArgument };
