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
// MCP-021C-AUTO-TRIGGER-FAMILY-A — fire-and-forget Boolean Observation
// classifier dispatcher (Family A = parent_relation; production mode).
// Invoked from the post-insert tail BEFORE `return created(...)`. The
// submit-argument response is returned BEFORE this dispatcher settles —
// argument submission is structurally unblocked by the design.
import { dispatchAutoTriggerForArgument } from '../_shared/booleanObservations/autoTriggerDispatcher.ts';
// ARCH-001 Card 2 — smoke-only, DEFAULT-DISABLED queue routing. When the
// operator master flag is on AND the debate is smoke-tagged, the classifier
// fan-out routes to the QUEUE (a fast local enqueue + the background drainer)
// instead of the direct dispatch. Ordinary production submits ALWAYS take the
// unchanged direct-dispatch path (the predicate returns false). Card 3 owns
// any production rollout.
import {
  shouldRouteToQueue,
  enqueueClassifierJobs,
  CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV,
} from '../_shared/booleanObservations/classifierQueueRouting.ts';

// EdgeRuntime is a Deno-runtime-provided global for Supabase Edge
// Functions (https://supabase.com/docs/guides/functions/background-tasks).
// At type level Deno does not surface it; declare a narrow shape so the
// fire-and-forget call below is typed without forcing the function to
// fail at load time when EdgeRuntime is absent (local Deno run, jest).
declare const EdgeRuntime:
  | { waitUntil?: (promise: Promise<unknown>) => void }
  | undefined;

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

  // ── QOL-041 — insert concession_items + concession_acceptances ────
  //
  // The conceding-party's `respond` move may carry an optional
  // concession_items[] array; the receiver's `respond_to_concession`
  // move may carry an optional concession_acceptances[] array. Both go
  // into their own tables, in the same Edge-Function call as the
  // parent argument so the move is atomic (design §5.6 — "Inserting
  // them in the same Edge-Function transaction keeps the move
  // atomic"). Postgres does not support a single multi-statement
  // transaction across supabase-js calls; on a child-insert failure
  // the parent argument is soft-rolled-back by setting status='deleted'
  // (the closest atomic-rollback approximation available to the
  // service client). Doctrine: the child-row inserts NEVER touch
  // standing / score; they only persist LEVEL + CLARIFICATION (QOL-041
  // §4 / §11).
  if (data.concession_items && data.concession_items.length > 0) {
    const itemsRows = data.concession_items.map((it) => ({
      debate_id: data.debate_id,
      argument_id: insertedArg.id,
      conceded_to_argument_id: data.parent_id, // a concession is always to a parent
      author_id: user.id,
      ordinal: it.ordinal,
      item_text: it.item_text.trim(),
    }));
    // A concession requires a parent (the node being responded to).
    if (!data.parent_id) {
      await serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id);
      return validationFailed({
        error: 'validation_failed',
        blockingErrors: [
          {
            ruleCode: 'qol_041_concession',
            flagCode: 'concession_requires_parent',
            severity: 'blocking' as const,
            message: 'A concession can only be attached to a reply (parent_id is required).',
            payload: {},
          },
        ],
        warnings: [],
        normalizedTags: [],
      });
    }
    const { error: itemsErr } = await serviceClient
      .from('concession_items')
      .insert(itemsRows);
    if (itemsErr) {
      // Soft-rollback the parent argument so the move is atomic.
      await serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id);
      return internalError(
        `concession_items_insert_failed:${String(itemsErr.message || 'unknown').slice(0, 120)}`,
      );
    }
  }

  if (data.concession_acceptances && data.concession_acceptances.length > 0) {
    // Defense-in-depth: the receiver must be the author of the
    // conceded-to node for EVERY incoming concession_item the acceptance
    // refers to. The migration RLS enforces this too; this server-side
    // check produces a clean validation_failed error instead of an RLS
    // bypass attempt.
    const itemIds = data.concession_acceptances.map((a) => a.concession_item_id);
    const { data: items, error: itemsLookupErr } = await serviceClient
      .from('concession_items')
      .select('id, debate_id, conceded_to_argument_id')
      .in('id', itemIds);
    if (itemsLookupErr || !items) {
      await serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id);
      return internalError('concession_items_lookup_failed');
    }
    if (items.length !== itemIds.length) {
      await serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id);
      return validationFailed({
        error: 'validation_failed',
        blockingErrors: [
          {
            ruleCode: 'qol_041_concession',
            flagCode: 'concession_item_unknown',
            severity: 'blocking' as const,
            message: 'One of the concession items being graded was not found.',
            payload: {},
          },
        ],
        warnings: [],
        normalizedTags: [],
      });
    }
    // Every item must belong to this debate.
    const wrongDebate = items.some((it) => it.debate_id !== data.debate_id);
    if (wrongDebate) {
      await serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id);
      return validationFailed({
        error: 'validation_failed',
        blockingErrors: [
          {
            ruleCode: 'qol_041_concession',
            flagCode: 'concession_item_wrong_debate',
            severity: 'blocking' as const,
            message: 'A concession item belongs to a different room.',
            payload: {},
          },
        ],
        warnings: [],
        normalizedTags: [],
      });
    }
    // Only the conceded-to author may grade. We look up the
    // conceded-to-node author for every item and confirm it matches the
    // caller.
    const concededToIds = Array.from(new Set(items.map((it) => it.conceded_to_argument_id)));
    const { data: concededTo, error: concededLookupErr } = await serviceClient
      .from('arguments')
      .select('id, author_id')
      .in('id', concededToIds);
    if (concededLookupErr || !concededTo) {
      await serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id);
      return internalError('conceded_to_lookup_failed');
    }
    const concededToAuthorById = new Map<string, string>();
    for (const row of concededTo) {
      concededToAuthorById.set(row.id, row.author_id);
    }
    const notReceiver = items.some(
      (it) => concededToAuthorById.get(it.conceded_to_argument_id) !== user.id,
    );
    if (notReceiver) {
      await serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id);
      return forbidden(
        'Only the participant the concession was made to may grade it.',
      );
    }
    // Authoritative clarification-required check (mirrors the
    // migration CHECK + the client `respondToConcessionModel.isPostable()`).
    const missingClarification = data.concession_acceptances.find(
      (a) =>
        a.acceptance_level !== 'agree'
        && a.clarification_body.trim().length === 0,
    );
    if (missingClarification) {
      await serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id);
      return validationFailed({
        error: 'validation_failed',
        blockingErrors: [
          {
            ruleCode: 'qol_041_concession',
            flagCode: 'clarification_required_unless_agree',
            severity: 'blocking' as const,
            message: 'Explain why you disagree on each point.',
            payload: { concessionItemId: missingClarification.concession_item_id },
          },
        ],
        warnings: [],
        normalizedTags: [],
      });
    }
    const acceptanceRows = data.concession_acceptances.map((a) => ({
      debate_id: data.debate_id,
      concession_item_id: a.concession_item_id,
      argument_id: insertedArg.id,
      receiver_id: user.id,
      acceptance_level: a.acceptance_level,
      clarification_body:
        a.acceptance_level === 'agree' ? '' : a.clarification_body.trim(),
    }));
    const { error: acceptanceErr } = await serviceClient
      .from('concession_acceptances')
      .insert(acceptanceRows);
    if (acceptanceErr) {
      await serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id);
      return internalError(
        `concession_acceptances_insert_failed:${String(acceptanceErr.message || 'unknown').slice(0, 120)}`,
      );
    }
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

  // ── QOL-040 — notification side-effect (best-effort) ─────────
  //
  // Classify the just-inserted argument into one of the four
  // argument-derived trigger types (new_response,
  // concession_challenged, source_requested, evidence_supplied)
  // and insert one row per recipient into public.room_notifications.
  //
  // Doctrine:
  //   - This is a SIDE EFFECT. Failures here are swallowed; the
  //     argument post has already succeeded and the user must
  //     never be blocked on a notification.
  //   - The author NEVER self-notifies.
  //   - Recipients are computed from the room's current
  //     debate_participants — primaries only (the four
  //     argument-derived triggers all address primaries or the
  //     specific author of a challenged concession). The
  //     concession-challenged author resolver looks up the
  //     parent's author when the trigger is concession_challenged.
  try {
    // Pure classifier inputs (kept inline since this file cannot
    // import from src/ — the model under src/ is the canonical
    // source and the inline logic must mirror it precisely).
    const argType = String(data.argument_type || '').toLowerCase();
    const parentArgType = parentArg
      ? String(parentArg.argumentType || '').toLowerCase()
      : null;
    const hasConcessionAcceptances =
      Array.isArray(data.concession_acceptances) && data.concession_acceptances.length > 0;
    // A "disagree" gradient is any acceptance level not equal to 'agree'.
    const hasDisagreeGradient =
      hasConcessionAcceptances &&
      (data.concession_acceptances || []).some((a) => a.acceptance_level !== 'agree');
    const opensEvidenceDebt =
      argType === 'clarification_request' &&
      Boolean(
        data.selected_tag_codes &&
          (data.selected_tag_codes.includes('ask_source') ||
            data.selected_tag_codes.includes('ask_quote') ||
            data.selected_tag_codes.includes('needs_receipts')),
      );
    const resolvesEvidenceDebt =
      argType === 'evidence' ||
      Boolean(data.evidence_response) ||
      Boolean(data.attached_evidence && data.attached_evidence.length > 0 && argType !== 'thesis');

    let trigger:
      | 'new_response'
      | 'concession_challenged'
      | 'source_requested'
      | 'evidence_supplied'
      | null = null;
    if (resolvesEvidenceDebt) {
      trigger = 'evidence_supplied';
    } else if (hasDisagreeGradient) {
      trigger = 'concession_challenged';
    } else if (opensEvidenceDebt) {
      trigger = 'source_requested';
    } else if (
      argType === 'rebuttal' ||
      argType === 'counter_rebuttal' ||
      argType === 'clarification_request' ||
      argType === 'synthesis'
    ) {
      trigger = 'new_response';
    }

    if (trigger !== null) {
      // Resolve recipients.
      const recipients: string[] = [];
      if (trigger === 'concession_challenged') {
        // The author of the challenged concession is the author
        // of the conceded-to node. The QOL-041 acceptance row
        // already carries `concession_item_id`; we look up the
        // conceded_to_argument_id on each item to find its
        // author. The author NEVER self-notifies, so we strip
        // the caller.
        if (hasConcessionAcceptances) {
          const itemIds = (data.concession_acceptances || []).map((a) => a.concession_item_id);
          const { data: items } = await serviceClient
            .from('concession_items')
            .select('id, author_id')
            .in('id', itemIds);
          const authorIds = new Set<string>();
          for (const it of items || []) {
            const aid = (it as { author_id?: string }).author_id;
            if (aid && aid !== user.id) authorIds.add(aid);
          }
          for (const id of authorIds) recipients.push(id);
        }
      } else if (trigger === 'evidence_supplied') {
        // The recipient is the user who asked for the source.
        // For now, the design treats all primaries (except the
        // author) as the recipient set — the dedicated
        // `source_requester_id` is a §17 enrichment that
        // requires tying an evidence-supplied move to a specific
        // source_requested move. For v1 we deliver to all
        // primaries; the in-app surface shows "Evidence was
        // supplied" to anyone who would care.
        const { data: parts } = await serviceClient
          .from('debate_participants')
          .select('user_id, side')
          .eq('debate_id', data.debate_id);
        for (const p of parts || []) {
          const uid = (p as { user_id?: string; side?: string }).user_id;
          const side = (p as { user_id?: string; side?: string }).side;
          if (uid && uid !== user.id && (side === 'affirmative' || side === 'negative')) {
            recipients.push(uid);
          }
        }
      } else {
        // new_response + source_requested → every primary except author.
        const { data: parts } = await serviceClient
          .from('debate_participants')
          .select('user_id, side')
          .eq('debate_id', data.debate_id);
        for (const p of parts || []) {
          const uid = (p as { user_id?: string; side?: string }).user_id;
          const side = (p as { user_id?: string; side?: string }).side;
          if (uid && uid !== user.id && (side === 'affirmative' || side === 'negative')) {
            recipients.push(uid);
          }
        }
      }

      if (recipients.length > 0) {
        const roomTitle = (debate.title || '').slice(0, 200);
        const notificationRows = recipients.map((rid) => ({
          recipient_id: rid,
          debate_id: data.debate_id,
          argument_id: insertedArg.id,
          type: trigger as string,
          room_title: roomTitle,
          meta: {},
        }));
        await serviceClient
          .from('room_notifications')
          .insert(notificationRows);
      }
    }
    // Suppress unused-binding lint for the never-referenced types.
    void parentArgType;
  } catch (notifyErr) {
    // The argument post has succeeded. A notification failure must
    // never roll back the post. Log once at error level WITHOUT
    // including the body, the Authorization header, or any
    // recipient identifier.
    // eslint-disable-next-line no-console
    console.error('submit_argument_notification_failed', {
      argumentIdShort: typeof insertedArg.id === 'string' ? insertedArg.id.slice(0, 8) : '(unknown)',
      message: notifyErr instanceof Error ? notifyErr.message.slice(0, 120) : 'unknown',
    });
  }

  // ── MCP-021C-AUTO-TRIGGER-FAMILY-A — fire-and-forget classifier ──
  //
  // Kick off the Boolean Observation classifier (Family A, production
  // mode) for the just-inserted argument. The dispatcher:
  //   - Reads the runtime-config kill switch first; skips if disabled.
  //   - Checks idempotency (Option A) against the most-recent
  //     production run for this argument; skips if already classified.
  //   - Invokes the MCP adapter with bounded retry (2 attempts max for
  //     transient classes).
  //   - Persists the run row + result rows; emits a structured log.
  //
  // The promise is intentionally NOT awaited — the submit-argument
  // response is returned BEFORE the dispatcher settles. Doctrine: the
  // user must never wait on classifier latency or failures.
  // `EdgeRuntime.waitUntil` keeps the isolate alive until the promise
  // settles in Supabase Edge runtime; when absent (local Deno run,
  // jest) the promise is still dispatched but the isolate may terminate
  // sooner. Both paths are correct — the response is already returned.
  //
  // ── ARCH-001 Card 2 — mutually-exclusive routing branch ──────────
  // shouldRouteToQueue is DEFAULT DISABLED: it returns false for EVERY
  // argument unless the operator master flag
  // (CLASSIFIER_QUEUE_ROUTING_ENABLED) is exactly 'true' AND the debate is
  // smoke-tagged. So the ELSE branch below is the current direct dispatch,
  // BYTE-UNCHANGED for ordinary production submits (the only path they ever
  // take). When routed (smoke only): we ENQUEUE one job per production
  // family A–G (a fast local INSERT, idempotent via Card-1 index #5) INSTEAD
  // of the direct dispatch — NEVER both (design §A.11 double-dispatch proof;
  // index #4/#5 are the DB backstops). Submit stays nonblocking either way.
  const queueRoutingEnabled =
    Deno.env.get(CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV) === 'true';
  if (
    shouldRouteToQueue(
      { id: insertedArg.id, debate_id: data.debate_id },
      { id: debate.id, title: debate.title },
      queueRoutingEnabled,
    )
  ) {
    // QUEUE path: enqueue A–G jobs; the kick trigger + cron tick drive the
    // drainer. Fire-and-forget (kept off the 201 critical path, same posture
    // as the direct dispatch). The kick trigger fires from the DB INSERT.
    const enqueuePromise = enqueueClassifierJobs(
      insertedArg.id,
      data.debate_id,
      serviceClient,
    ).catch(() => undefined);
    if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime?.waitUntil === 'function') {
      EdgeRuntime.waitUntil(enqueuePromise);
    }
  } else {
    // DIRECT-DISPATCH path (UNCHANGED) — the only path ordinary submits take.
    const autoTriggerPromise = dispatchAutoTriggerForArgument(
      insertedArg.id,
      data.debate_id,
      serviceClient,
    ).catch(() => undefined);
    if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime?.waitUntil === 'function') {
      EdgeRuntime.waitUntil(autoTriggerPromise);
    }
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
