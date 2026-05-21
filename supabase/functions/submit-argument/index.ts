/**
 * submit-argument — authoritative argument submission Edge Function.
 *
 * Security model:
 *   - verify_jwt = true (set in config.toml).
 *   - callerClient respects RLS for authorization queries.
 *   - serviceClient bypasses RLS only for authoritative inserts after validation.
 *   - No AI or model-provider calls.
 */
import { corsHeaders, ok, created, unauthorized, forbidden, methodNotAllowed, validationFailed, internalError } from '../_shared/http.ts';
import { createCallerClient, createServiceClient } from '../_shared/supabaseClients.ts';
import { SubmitArgumentSchema } from '../_shared/validationSchemas.ts';
import { evaluateArgumentDraft } from '../_shared/constitution/evaluateArgumentDraft.ts';
import { runRailsChecks } from '../_shared/constitution/railsChecks.ts';
import { adaptDbConstitutionVersion, adaptDbRule, adaptDbTagDef, adaptDbFlagDef } from '../_shared/constitution/dbAdapters.ts';
import type { DbConstitutionRule, DbConstitutionTagDef, DbConstitutionFlagDef } from '../_shared/constitution/dbAdapters.ts';
import type { ParentArgument, SiblingArgument, EvidenceAttachment, ArgumentTarget } from '../_shared/constitution/types.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  // ── CORS preflight ────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return methodNotAllowed();
  }

  // ── Parse body ────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return validationFailed({ error: 'invalid_json', blockingErrors: [], warnings: [], normalizedTags: [] });
  }

  // ── Validate schema ───────────────────────────────────────────
  const parsed = SubmitArgumentSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      ruleCode: 'request_schema',
      flagCode: 'invalid_request',
      severity: 'blocking' as const,
      message: i.message,
      payload: { path: i.path },
    }));
    return validationFailed({
      error: 'validation_failed',
      blockingErrors: issues,
      warnings: [],
      normalizedTags: [],
    });
  }

  const data = parsed.data;

  // ── Auth ──────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized();

  const callerClient = createCallerClient(authHeader);
  const serviceClient = createServiceClient();

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return unauthorized();

  // ── Idempotency check ─────────────────────────────────────────
  // If the client retries with the same client_submission_id, return the
  // previously inserted argument without re-running validation or inserting.
  if (data.client_submission_id) {
    const { data: existingArg } = await serviceClient
      .from('arguments')
      .select('id, debate_id, argument_type, side, body, depth, status, created_at, author_id, parent_id')
      .eq('author_id', user.id)
      .eq('client_submission_id', data.client_submission_id)
      .maybeSingle();

    if (existingArg) {
      const [tagsRes, topicRes, flagsRes] = await Promise.all([
        serviceClient.from('argument_tags').select('*').eq('argument_id', existingArg.id),
        serviceClient
          .from('topic_satisfaction_checks')
          .select('*')
          .eq('argument_id', existingArg.id)
          .maybeSingle(),
        serviceClient.from('argument_flags').select('*').eq('argument_id', existingArg.id),
      ]);
      return ok({
        argument: existingArg,
        tags: tagsRes.data ?? [],
        topic_satisfaction_check: topicRes.data ?? null,
        flags: flagsRes.data ?? [],
        validation: {
          allowPost: true,
          blockingErrors: [],
          warnings: [],
          normalizedTags: [],
          serverValidationPayload: {
            idempotent: true,
            clientSubmissionId: data.client_submission_id,
          },
        },
        idempotent: true,
      });
    }
  }

  // ── Profile ───────────────────────────────────────────────────
  const { data: profile } = await callerClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return forbidden('Profile not found. Ensure you have a registered account.');

  // ── Debate ────────────────────────────────────────────────────
  const { data: debate, error: debateError } = await callerClient
    .from('debates')
    .select('id, created_by, title, resolution, description, status, constitution_id')
    .eq('id', data.debate_id)
    .maybeSingle();

  if (debateError || !debate) {
    return forbidden('Debate not found or not accessible.');
  }

  if (!['open', 'draft'].includes(debate.status)) {
    return forbidden(`Debate is not accepting new arguments (status: ${debate.status}).`);
  }

  // ── Participant check ─────────────────────────────────────────
  const { data: participant } = await callerClient
    .from('debate_participants')
    .select('side')
    .eq('debate_id', data.debate_id)
    .eq('user_id', user.id)
    .maybeSingle();

  const isAdmin = profile.role === 'admin';
  const isModerator = profile.role === 'moderator' || participant?.side === 'moderator';
  const isCreator = debate.created_by === user.id;
  const participantSide = participant?.side as string | undefined;

  // Authorization matrix
  let authorized = false;
  let authReason = '';

  if (isAdmin || isModerator || isCreator) {
    authorized = true;
  } else if (!participantSide) {
    authReason = 'You must join this debate before posting arguments.';
  } else if (participantSide === 'affirmative') {
    authorized = data.side === 'affirmative' || data.side === 'neutral';
    if (!authorized) authReason = 'Affirmative participants may post affirmative or neutral arguments.';
  } else if (participantSide === 'negative') {
    authorized = data.side === 'negative' || data.side === 'neutral';
    if (!authorized) authReason = 'Negative participants may post negative or neutral arguments.';
  } else if (participantSide === 'observer') {
    authorized = data.side === 'neutral' && data.argument_type === 'clarification_request';
    if (!authorized) authReason = 'Observers may only post neutral clarification requests.';
  }

  if (!authorized) {
    return forbidden(authReason || 'Not authorized to post this argument.');
  }

  // ── Load constitution ─────────────────────────────────────────
  const { data: constitutionRow } = await callerClient
    .from('constitution_versions')
    .select('id, slug, version, title, active')
    .eq('id', debate.constitution_id)
    .maybeSingle();

  if (!constitutionRow) {
    return internalError('Could not load constitution for this debate.');
  }

  const activeConstitution = adaptDbConstitutionVersion(constitutionRow);

  const { data: dbRules } = await callerClient
    .from('constitution_rules')
    .select('*')
    .eq('constitution_id', debate.constitution_id)
    .eq('enabled', true);

  const { data: dbTags } = await callerClient
    .from('tag_definitions')
    .select('*')
    .eq('enabled', true);

  const { data: dbFlags } = await callerClient
    .from('flag_definitions')
    .select('*')
    .eq('enabled', true);

  const activeRules = ((dbRules ?? []) as DbConstitutionRule[]).map(adaptDbRule);
  const tagDefinitions = ((dbTags ?? []) as DbConstitutionTagDef[]).map(adaptDbTagDef);
  const flagDefinitions = ((dbFlags ?? []) as DbConstitutionFlagDef[]).map(adaptDbFlagDef);

  // ── Parent argument ───────────────────────────────────────────
  let parentArg: ParentArgument | undefined;

  if (data.parent_id) {
    const { data: parentRow, error: parentError } = await callerClient
      .from('arguments')
      .select('id, debate_id, argument_type, side, body, depth, status')
      .eq('id', data.parent_id)
      .maybeSingle();

    if (parentError || !parentRow) {
      return forbidden('Parent argument not found or not accessible.');
    }
    if (parentRow.debate_id !== data.debate_id) {
      return forbidden('Parent argument belongs to a different debate.');
    }
    if (parentRow.status !== 'posted') {
      return forbidden('Cannot reply to an argument that has not been posted.');
    }

    parentArg = {
      id: parentRow.id,
      argumentType: parentRow.argument_type as ParentArgument['argumentType'],
      side: parentRow.side as ParentArgument['side'],
      body: parentRow.body,
      depth: parentRow.depth,
    };
  }

  // ── Sibling arguments (for duplicate detection) ───────────────
  let siblingQuery = serviceClient
    .from('arguments')
    .select('id, argument_type, side, body')
    .eq('debate_id', data.debate_id)
    .eq('status', 'posted');

  if (data.parent_id) {
    siblingQuery = siblingQuery.eq('parent_id', data.parent_id);
  } else {
    siblingQuery = siblingQuery.is('parent_id', null);
  }

  const { data: siblingRows } = await siblingQuery.limit(20);
  const existingSiblingArguments: SiblingArgument[] = (siblingRows ?? []).map((s) => ({
    id: s.id,
    argumentType: s.argument_type as SiblingArgument['argumentType'],
    side: s.side as SiblingArgument['side'],
    body: s.body,
  }));

  // ── Map request target ────────────────────────────────────────
  const target: ArgumentTarget | undefined = data.target
    ? {
        targetExcerpt: data.target.target_excerpt,
        disagreementAxis: data.target.disagreement_axis as ArgumentTarget['disagreementAxis'],
        concessionScope: data.target.concession_scope,
        userStatedUncertainty: data.target.user_stated_uncertainty,
      }
    : undefined;

  // ── Map attached evidence ─────────────────────────────────────
  const attachedEvidence: EvidenceAttachment[] = (data.attached_evidence ?? []).map((e) => ({
    url: e.url,
    label: e.label,
    sourceText: e.source_text,
  }));

  // ── Run engine ────────────────────────────────────────────────
  const evalResult = evaluateArgumentDraft({
    debateId: data.debate_id,
    debateResolution: debate.resolution,
    debateDescription: debate.description || undefined,
    parentArgument: parentArg,
    existingSiblingArguments,
    argumentType: data.argument_type as Parameters<typeof evaluateArgumentDraft>[0]['argumentType'],
    side: data.side as Parameters<typeof evaluateArgumentDraft>[0]['side'],
    body: data.body,
    selectedTagCodes: data.selected_tag_codes,
    attachedEvidence,
    activeConstitution,
    activeRules,
    tagDefinitions,
    flagDefinitions,
    target,
    evaluationContext: 'server',
  });

  // ── Rails validation (already integrated into evaluateArgumentDraft, ─
  //    but compute rail payload separately for storage)               ──
  const railsResult = runRailsChecks({
    argumentType: data.argument_type as Parameters<typeof runRailsChecks>[0]['argumentType'],
    body: data.body,
    parentBody: parentArg?.body,
    selectedTagCodes: data.selected_tag_codes,
    target,
    activeRules,
    source: 'server_rules',
  });

  // ── Blocking check ────────────────────────────────────────────
  if (!evalResult.allowPost) {
    return validationFailed({
      error: 'validation_failed',
      blockingErrors: evalResult.blockingErrors,
      warnings: evalResult.warnings,
      topicSatisfactionCheck: evalResult.topicSatisfactionCheck,
      normalizedTags: evalResult.normalizedTags,
    });
  }

  // ── Compute depth ─────────────────────────────────────────────
  const depth = parentArg ? parentArg.depth + 1 : 0;

  // ── Insert argument (service role = bypasses RLS) ─────────────
  // QOL-037 — copy the optional advisory evidenceResponse block VERBATIM into
  // the server validation snapshot. It is advisory metadata only: the function
  // does not validate it, does not hard-block on it, and does not branch the
  // insert path on it. The applicability status is render-time-derived by the
  // client from these blocks across the room's argument rows. A malformed
  // block can never block a post — the body validation above is the only gate.
  const serverValidation: Record<string, unknown> = {
    ...evalResult.serverValidationPayload,
    railPayload: railsResult.railPayload,
  };
  if (data.evidence_response) {
    serverValidation.evidenceResponse = data.evidence_response;
  }

  // Build the insert row — include new columns only if they exist in the schema.
  // The migration adds target_excerpt, disagreement_axis, rail_payload to arguments.
  const argInsert: Record<string, unknown> = {
    debate_id: data.debate_id,
    parent_id: data.parent_id ?? null,
    author_id: user.id,
    argument_type: data.argument_type,
    side: data.side,
    body: data.body,
    depth,
    status: 'posted',
    client_validation: data.client_validation ?? {},
    server_validation: serverValidation,
    target_excerpt: target?.targetExcerpt ?? null,
    disagreement_axis: target?.disagreementAxis ?? null,
    rail_payload: railsResult.railPayload,
    client_submission_id: data.client_submission_id ?? null,
  };

  const { data: insertedArg, error: insertError } = await serviceClient
    .from('arguments')
    .insert(argInsert)
    .select()
    .single();

  if (insertError || !insertedArg) {
    return internalError(`Failed to insert argument: ${insertError?.message ?? 'unknown'}`);
  }

  // ── Insert argument tags ──────────────────────────────────────
  let insertedTags: unknown[] = [];
  if (evalResult.normalizedTags.length > 0) {
    const tagRows = evalResult.normalizedTags.map((code) => ({
      argument_id: insertedArg.id,
      tag_code: code,
      created_by: user.id,
    }));
    const { data: tags, error: tagsError } = await serviceClient
      .from('argument_tags')
      .insert(tagRows)
      .select();
    if (!tagsError) insertedTags = tags ?? [];
  }

  // ── Insert topic satisfaction check ──────────────────────────
  let insertedTopicCheck: unknown = null;
  if (evalResult.topicSatisfactionCheck) {
    const tc = evalResult.topicSatisfactionCheck;
    const { data: topicCheck } = await serviceClient
      .from('topic_satisfaction_checks')
      .insert({
        debate_id: data.debate_id,
        argument_id: insertedArg.id,
        parent_argument_id: data.parent_id ?? null,
        method: 'lexical',
        score: tc.score,
        threshold: tc.threshold,
        status: tc.status,
        matched_terms: tc.matchedTerms,
        missing_terms: tc.missingTerms,
        payload: {
          resolutionScore: tc.resolutionScore,
          parentScore: tc.parentScore,
          combinedScore: tc.combinedScore,
          matchedResolutionTerms: tc.matchedResolutionTerms,
          missingResolutionTerms: tc.missingResolutionTerms,
          matchedParentTerms: tc.matchedParentTerms,
          missingParentTerms: tc.missingParentTerms,
          railMode: tc.railMode,
        },
      })
      .select()
      .single();
    insertedTopicCheck = topicCheck;
  }

  // ── Insert argument flags (server_rules source only) ─────────
  let insertedFlags: unknown[] = [];
  const serverFlags = evalResult.flagsToPersist.filter((f) => f.source === 'server_rules');
  if (serverFlags.length > 0) {
    const flagRows = serverFlags.map((f) => ({
      debate_id: data.debate_id,
      argument_id: insertedArg.id,
      flag_code: f.flagCode,
      rule_code: f.ruleCode === 'duplicate_sibling_heuristic' ? null : f.ruleCode,
      source: 'server_rules',
      confidence: f.confidence,
      status: f.defaultStatus,
      payload: f.payload,
      created_by: null,
    }));
    const { data: flags } = await serviceClient
      .from('argument_flags')
      .insert(flagRows)
      .select();
    if (flags) insertedFlags = flags;
  }

  // ── Return 201 ────────────────────────────────────────────────
  return created({
    argument: insertedArg,
    tags: insertedTags,
    topic_satisfaction_check: insertedTopicCheck,
    flags: insertedFlags,
    validation: {
      allowPost: true,
      blockingErrors: [],
      warnings: evalResult.warnings,
      normalizedTags: evalResult.normalizedTags,
      serverValidationPayload: serverValidation,
    },
  });
});
