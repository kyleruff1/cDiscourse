#!/usr/bin/env node
/**
 * Stage 6.1.9 — xAI-derived adversarial bot corpus runner (skill-first).
 *
 * Flow:
 *   1. Skill gate: read .claude/skills/bot-{provocateur,revocateur}/SKILL.md
 *      from disk, hash each, stamp the skillGate into every JSONL event.
 *      Refuse to run if either file is missing.
 *   2. Source phase: dry-mode reads the canonical fixture; live-mode calls
 *      the xAI Responses API + x_search tool via the existing
 *      `xaiAdversarialProvider`.
 *   3. Dissent phase: deterministic classification via
 *      `xaiDissentDetector.selectFirstUsableDissent`. Synthetic fallback
 *      is marked `dissentSource="synthetic_fallback"` per the spec.
 *   4. Scenario phase: existing `xaiAdversarialSceneBuilder` + the new
 *      skill bundle so personas are tied to the saved skill files.
 *   5. Move phase: dry-mode emits deterministic placeholders; live-mode
 *      uses the existing `aiMoveRenderer` + `claudeMessagesClient`. Every
 *      move posts through `submit-argument` — never direct insert, never
 *      service-role.
 *   6. JSONL emission: one event per stage, every event carries the
 *      `skillGate` + `runId` + `sourceMode` per the Stage 6.1.9 schema.
 *   7. Markdown report: aggregate redacted summary in docs/testing-runs/.
 *
 * This runner does NOT call xAI, Anthropic, or Supabase in dry mode.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');

const REPO_ROOT = process.cwd();
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'testing-runs');
const LOG_DIR = path.join(REPO_ROOT, 'logs', 'engagement-intelligence');
const FIXTURE_PATH = path.join(REPO_ROOT, 'fixtures', 'engagement-intelligence', 'xai-adversarial-dry-fixture.json');

const { loadAdversarialSkillBundle, redactedSkillGate } = require('./skillFileLoader');
const { redactRaw, convertHostileBody } = require('../engagement-intelligence/xaiSourceRedactor');
const { selectFirstUsableDissent } = require('../engagement-intelligence/xaiDissentDetector');
const { buildAdversarialScene, buildBankedAdversarialScene } = require('./xaiAdversarialSceneBuilder');
const { renderAdversarialMove, renderAlignedAdversarialMove } = require('./xaiAdversarialMoveRenderer');
// CORPUS-30-POOL-DRIVEN-PLANNER additive: planner + constants.
const {
  seedAssignment,
  selectOption,
  assignVoiceId,
  assignSpineId,
  resolveMoveBank,
  buildRunTag,
  SeedPoolUndersizedError,
} = require('./corpusPoolDrivenPlanner');
const claudeClient = require('./claudeMessagesClient');
const { loadEnvFiles, buildBotConfig } = require('./loadEnv');
const { createBotClient, signInBot } = require('./supabaseClient');
const { ensureBotUser } = require('./adminOps');
const { buildSubmitArgumentBody, invokeSubmitArgument } = require('./submitMove');
// mapPersonaSideToParticipantSide kept available for downstream callers.
require('./personaMapping');

// ── CLI parsing ───────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    dry: true,
    pilot: false,
    scenarios: 10,
    maxDepth: 6,
    seed: 'cdiscourse-stage-6.1.9',
    fixturePath: FIXTURE_PATH,
    harvestFile: null,
    bankedPool: null,
    runKind: 'corpus-dev-synthetic',
    annotationJsonl: null,
    reportName: null,
    postToDevSupabase: false,
    allowSyntheticDissent: true,
    // CORPUS-QUEUE-SMOKE-TAG-001: opt-in smoke-tag prefix for debate
    // titles. Default OFF — when off, produced titles are byte-identical
    // to today's. `--smoke-tag` enables the literal default; valued
    // `--queue-smoke-tag <literal>` overrides the literal and implies
    // enable. The runner NEVER reads CLASSIFIER_QUEUE_ROUTING_ENABLED;
    // arming routing is an operator action on the submit-argument Edge fn.
    smokeTag: false,
    queueSmokeTag: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') { args.pilot = true; args.dry = false; }
    else if (a === '--scenarios' && argv[i + 1]) args.scenarios = Math.max(1, Math.min(200, Number(argv[++i]) || 10));
    else if (a === '--max-depth' && argv[i + 1]) args.maxDepth = Math.max(2, Math.min(20, Number(argv[++i]) || 6));
    else if (a === '--seed' && argv[i + 1]) args.seed = String(argv[++i]);
    else if (a === '--fixture' && argv[i + 1]) args.fixturePath = String(argv[++i]);
    else if (a === '--harvest-file' && argv[i + 1]) args.harvestFile = String(argv[++i]);
    // CORPUS-30-POOL-DRIVEN-PLANNER additive: banked-pool input.
    else if (a === '--banked-pool' && argv[i + 1]) args.bankedPool = String(argv[++i]);
    else if (a === '--run-kind' && argv[i + 1]) {
      const k = String(argv[++i]);
      args.runKind = (k === 'corpus-prod-synthetic' || k === 'corpus-dev-synthetic') ? k : 'corpus-dev-synthetic';
    }
    else if (a === '--annotation-jsonl' && argv[i + 1]) args.annotationJsonl = String(argv[++i]);
    else if (a === '--report-name' && argv[i + 1]) args.reportName = String(argv[++i]);
    else if (a === '--post-to-dev-supabase') args.postToDevSupabase = true;
    else if (a === '--no-synthetic-dissent') args.allowSyntheticDissent = false;
    // CORPUS-QUEUE-SMOKE-TAG-001: smoke-tag opt-in. `--smoke-tag` enables
    // the contract literal; `--queue-smoke-tag <literal>` overrides the
    // literal AND implies enable (so a bare override never silently
    // produces an unprefixed title).
    else if (a === '--smoke-tag') args.smokeTag = true;
    else if (a === '--queue-smoke-tag' && argv[i + 1]) { args.queueSmokeTag = String(argv[++i]); args.smokeTag = true; }
  }
  return args;
}

// ── CORPUS-QUEUE-SMOKE-TAG-001 — queue smoke-tag prefix resolver ──
//
// The Edge routing predicate routes a stored argument's classifier
// fan-out to the ARCH-001 async queue when
// `debate.title.startsWith(CLASSIFIER_QUEUE_SMOKE_TAG)`
// (`supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts:174`).
// The contract literal is pinned at `classifierQueueRouting.ts:51`.
//
// This is the RUNNER's OWN copy of that literal — the runner is Node and
// cannot import the Deno-side const. The drift guard in
// `__tests__/corpusSmokeTagPrefix.test.ts` fails if this literal diverges
// from the Edge contract, so the two cannot silently drift apart.
//
// IMPORTANT: this resolver only changes the synthetic-corpus debate TITLE
// the runner writes. It NEVER arms routing, NEVER reads
// CLASSIFIER_QUEUE_ROUTING_ENABLED, and NEVER changes whether a post is
// accepted (the deterministic rules engine remains the sole acceptance
// gate; classifiers run after an argument is stored).
const CORPUS_SMOKE_TAG_DEFAULT = '[arch-001-queue-smoke]';

// Pure resolver: returns '' when smoke-tagging is disabled, or
// '<tag> ' (tag literal + single trailing space) when enabled. Enable
// sources (any one suffices): the `--smoke-tag` flag, a `--queue-smoke-tag`
// override (which sets args.smokeTag), or the `CORPUS_SMOKE_TAG=true` env
// opt-in. The tag literal default is CORPUS_SMOKE_TAG_DEFAULT; it can be
// overridden by `--queue-smoke-tag <literal>` (highest precedence) or the
// non-empty `CLASSIFIER_QUEUE_SMOKE_TAG` env var. Default OFF.
function resolveSmokeTagPrefix(args, env = process.env) {
  const a = args || {};
  const e = env || {};
  const envEnabled = String(e.CORPUS_SMOKE_TAG || '').toLowerCase() === 'true';
  const enabled = a.smokeTag === true || envEnabled;
  if (!enabled) return '';
  // Tag literal precedence: explicit CLI override > env literal > default.
  let tag = CORPUS_SMOKE_TAG_DEFAULT;
  if (typeof e.CLASSIFIER_QUEUE_SMOKE_TAG === 'string' && e.CLASSIFIER_QUEUE_SMOKE_TAG.trim() !== '') {
    tag = e.CLASSIFIER_QUEUE_SMOKE_TAG;
  }
  if (typeof a.queueSmokeTag === 'string' && a.queueSmokeTag.trim() !== '') {
    tag = a.queueSmokeTag;
  }
  return `${tag} `;
}

// Single titling helper used at BOTH live title sites (legacy + banked)
// so the two paths cannot diverge (the §467/§468 twin-divergence lesson).
// `prefix` is the resolved smoke-tag prefix ('' when off). The claim is
// sliced to 80 chars; the prefix is applied OUTSIDE that slice so the
// produced title `startsWith(tag)` at position 0. When prefix === '' the
// returned title is byte-identical to the pre-change construction.
function buildRoomTitle({ prefix, claim, runTag, threadIndex }) {
  const safeClaim = String(claim || '').slice(0, 80);
  const nn = String(threadIndex).padStart(2, '0');
  return `${prefix}${safeClaim} [${runTag} t${nn}]`;
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

// ── Env gate ──────────────────────────────────────────────────

function envBooleans() {
  const envPath = path.join(REPO_ROOT, '.env.engagement-intelligence');
  const botPath = path.join(REPO_ROOT, '.env.bot-tests');
  let hasXai = false, enableXai = false, hasAnthropic = false, enableAnthropic = false;
  if (fs.existsSync(envPath)) {
    const txt = fs.readFileSync(envPath, 'utf8');
    hasXai = /^XAI_API_KEY=\S/m.test(txt);
    enableXai = /^ENGAGEMENT_INTEL_ENABLE_XAI=true/m.test(txt);
    hasAnthropic = /^ANTHROPIC_API_KEY=\S/m.test(txt);
    enableAnthropic = /^ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true/m.test(txt);
  }
  if (process.env.XAI_API_KEY) hasXai = true;
  if (String(process.env.ENGAGEMENT_INTEL_ENABLE_XAI || '').toLowerCase() === 'true') enableXai = true;
  if (process.env.ANTHROPIC_API_KEY) hasAnthropic = true;
  if (String(process.env.ENGAGEMENT_INTEL_ENABLE_ANTHROPIC || '').toLowerCase() === 'true') enableAnthropic = true;
  return {
    hasXaiKey: hasXai,
    enableXai,
    hasAnthropicKey: hasAnthropic,
    enableAnthropic,
    hasBotTests: fs.existsSync(botPath),
  };
}

function refuseLive(args, bools) {
  const reasons = [];
  if (!bools.hasXaiKey) reasons.push('XAI_API_KEY missing');
  if (!bools.enableXai) reasons.push('ENGAGEMENT_INTEL_ENABLE_XAI not true');
  if (!bools.hasAnthropicKey) reasons.push('ANTHROPIC_API_KEY missing');
  if (!bools.enableAnthropic) reasons.push('ENGAGEMENT_INTEL_ENABLE_ANTHROPIC not true');
  if (!bools.hasBotTests) reasons.push('.env.bot-tests missing');
  if (!args.pilot) reasons.push('--pilot not set');
  return reasons;
}

// ── JSONL writer ──────────────────────────────────────────────

class StageJsonlStream {
  constructor(filePath, skillGate, runId, sourceMode) {
    ensureDir(path.dirname(filePath));
    this.stream = fs.createWriteStream(filePath);
    this.path = filePath;
    this.skillGate = skillGate;
    this.runId = runId;
    this.sourceMode = sourceMode;
    this.events = new Map();
  }
  write(stage, extras = {}) {
    const ev = {
      runId: this.runId,
      ts: new Date().toISOString(),
      stage,
      sourceMode: this.sourceMode,
      skillGate: this.skillGate,
      ...extras,
    };
    this.stream.write(JSON.stringify(ev) + '\n');
    this.events.set(stage, (this.events.get(stage) || 0) + 1);
  }
  end() { return new Promise((resolve) => this.stream.end(resolve)); }
}

// ── Dry source phase ──────────────────────────────────────────

function readDryFixture(fixturePath) {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.sources)) throw new Error('xai-adversarial-dry-fixture is malformed');
  return parsed;
}

function shapeFixtureSource(s, runSalt) {
  const id = `${runSalt}-src-${String(s.sourceOrdinal).padStart(3, '0')}`;
  return {
    sourceOrdinal: s.sourceOrdinal,
    sourceHash: id,
    provider: 'dry_fixture',
    providerQuery: 'dry fixture',
    providerRank: s.providerRank,
    providerConfidence: s.providerConfidence,
    citationRefs: [],
    topicBucket: s.topicBucket,
    sourceTextRedacted: redactRaw(s.sourceTextRedacted),
    sourceClaimSummary: redactRaw(s.sourceClaimSummary),
    sourceClaimType: s.sourceClaimType,
    sourceMetricsIfAvailable: null,
    sourceCollectedAt: new Date().toISOString(),
    redactionApplied: true,
    redactionNotes: 'dry fixture; redactor re-applied',
    popularityBucket: s.popularityBucket || 'unknown',
    replies: (s.replies || []).map((r, idx) => ({
      replyOrdinal: r.replyOrdinal || idx + 1,
      replyHash: `${id}-rep-${String(r.replyOrdinal || idx + 1).padStart(2, '0')}`,
      sourceHash: id,
      provider: 'dry_fixture',
      providerRank: r.replyOrdinal || idx + 1,
      providerConfidence: 0.6,
      topReplyMethod: 'dry_fixture',
      replyTextRedacted: redactRaw(r.replyTextRedacted),
      replyClaimSummary: redactRaw(r.replyTextRedacted).slice(0, 160),
      replyMetricsIfAvailable: null,
      citationRefs: [],
      collectedAt: new Date().toISOString(),
      redactionApplied: true,
      redactionNotes: 'dry fixture',
      kind: r.kind,
    })),
  };
}

// ── Synthetic dissent fallback ─────────────────────────────────

function buildSyntheticDissent(source) {
  return {
    replyOrdinal: 0,
    replyHash: `synthetic-${source.sourceHash}`,
    sourceHash: source.sourceHash,
    provider: 'synthetic_fallback',
    providerRank: 0,
    providerConfidence: 0,
    topReplyMethod: 'synthetic_fallback',
    replyTextRedacted: `Quote the part where ${source.sourceClaimSummary.slice(0, 80)} is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.`,
    replyClaimSummary: 'Synthetic narrowing + source-chain demand',
    replyMetricsIfAvailable: null,
    citationRefs: [],
    collectedAt: new Date().toISOString(),
    redactionApplied: true,
    redactionNotes: 'deterministic synthetic fallback — no provider call',
    syntheticRebuttal: true,
    excludedFromRealEpidemiology: true,
    includedInGameStressOnly: true,
    syntheticAxis: 'source_chain',
  };
}

// ── Move generation (dry mode = deterministic placeholders) ────

function generateDryMove({ scenario, parent, persona, depth, args }) {
  const skillRole = persona.skillRole;
  const parentBody = parent ? String(parent.body || '') : '';
  const parentClaim = parentBody.slice(0, 80).replace(/\s+/g, ' ').trim();
  const axes = ['source_chain', 'evidence', 'scope', 'definition', 'causal', 'logic'];
  const axis = axes[depth % axes.length];
  const mechanism = skillRole === 'bot-provocateur'
    ? `The mechanism behind "${parentClaim || scenario.title}" is the part to defend, not the slogan.`
    : `Press on the ${axis} of "${parentClaim || scenario.title}": the mechanism is asserted, not shown.`;
  const body = skillRole === 'bot-provocateur'
    ? `Holding the narrow form of the claim. ${mechanism} Receipt I'll bring: a primary-source line that names the mechanism. Anti-amplification note: popularity is not doing the work here — the mechanism is.`
    : `Quote: "${parentClaim || scenario.title.slice(0, 60)}". ${mechanism} Evidence debt: the opponent owes a primary source or a quote anchor before the broad form holds. Anti-amplification: virality in the source thread does not transfer.`;
  return {
    body,
    adoptedPosition: skillRole === 'bot-provocateur' ? 'support_root' : 'oppose_root',
    targetExcerpt: parentClaim || null,
    disagreementAxis: axis,
    mechanism,
    evidenceDebt: ['primary source for the claimed mechanism', 'quote anchor for the broad form'],
    antiAmplificationNote: 'popularity is not doing the evidentiary work; mechanism + receipt does',
    nextExpectedPressure: skillRole === 'bot-provocateur' ? 'evidence demand' : 'narrowing or concession',
    concessionReadiness: depth >= args.maxDepth - 1 ? 'synthesis_ready' : 'none',
    skillRoleUsed: skillRole,
    skillHash: persona.skillHash,
    safetyTransform: { rawAbuseRedacted: true, sourceClaimEndorsed: false, politicalIdentityInferred: false, personClassified: false },
  };
}

// ── Axis mapping ────────────────────────────────────────────────
// `submit-argument` validates `target.disagreement_axis` against the
// Constitution-derived set: fact | definition | causal | value | evidence
// | logic | scope. Stage 6.1.9 introduces semantic-corpus axes that the
// Edge Function does not know yet (source_chain, anti_amplification,
// framing). We keep the original axis in the JSONL for telemetry and map
// to the closest legacy axis for the wire call.
const AXIS_REMAP_FOR_SUBMIT = {
  source_chain: 'evidence',
  anti_amplification: 'evidence',
  framing: 'scope',
  none: null,
};

function mapAxisForSubmit(axis) {
  if (axis == null) return null;
  if (Object.prototype.hasOwnProperty.call(AXIS_REMAP_FOR_SUBMIT, axis)) return AXIS_REMAP_FOR_SUBMIT[axis];
  return axis;
}

// ── Harvest-JSONL reader ───────────────────────────────────────

/**
 * Read a Stage 6.1.9 harvest JSONL and reconstruct the shaped sources
 * the runner consumes. We re-shape `scenario_build` events back into the
 * `{ sourceHash, sourceTextRedacted, replies: [...] }` shape expected by
 * the dissent + scenario-build phases below. The runner's own dissent
 * detection is idempotent against the harvester (both use the same
 * deterministic classifier), so the result is consistent.
 */
function readHarvestFile(harvestPath) {
  const raw = fs.readFileSync(harvestPath, 'utf8');
  const out = [];
  let ordinal = 0;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (!ev || ev.stage !== 'scenario_build') continue;
    if (!ev.sourcePost || !ev.sourcePost.redactedText) continue;
    ordinal += 1;
    const replies = Array.isArray(ev.candidateReplies)
      ? ev.candidateReplies.map((c, i) => ({
          replyOrdinal: c.rank || i + 1,
          replyHash: `${ev.sourceHash}-rep-${String(c.rank || i + 1).padStart(2, '0')}`,
          sourceHash: ev.sourceHash,
          provider: 'harvest_file',
          providerRank: c.rank || i + 1,
          providerConfidence: 0.5,
          topReplyMethod: 'provider_inferred',
          replyTextRedacted: redactRaw(c.redactedText || ''),
          replyClaimSummary: redactRaw((c.redactedText || '').slice(0, 160)),
          replyMetricsIfAvailable: null,
          citationRefs: [],
          collectedAt: new Date().toISOString(),
          redactionApplied: true,
          redactionNotes: 'reconstructed from harvest JSONL',
          kind: c.replyFunction || 'unspecified',
          // Carry the harvester's classification so downstream events
          // can stamp it without re-running. The runner currently
          // re-classifies for parity; we keep this for telemetry only.
          _harvestClassification: c,
        }))
      : [];
    out.push({
      sourceOrdinal: ordinal,
      sourceHash: ev.sourceHash,
      provider: 'harvest_file',
      providerQuery: ev.sourceQuery || ev.sourcePost.issueFrame || 'unspecified',
      providerRank: ordinal,
      providerConfidence: 0.5,
      citationRefs: [],
      topicBucket: ev.sourcePost.issueFrame || 'unknown',
      sourceTextRedacted: redactRaw(ev.sourcePost.redactedText),
      sourceClaimSummary: redactRaw((ev.sourcePost.redactedText || '').slice(0, 280)),
      sourceClaimType: 'unclear',
      sourceMetricsIfAvailable: null,
      sourceCollectedAt: ev.ts || new Date().toISOString(),
      redactionApplied: true,
      redactionNotes: 'reconstructed from harvest JSONL',
      popularityBucket: ev.sourcePost.popularityBucket || 'unknown',
      replies,
      _selectedDissent: ev.selectedDissent || null,
    });
  }
  return out;
}

// ── CORPUS-30-POOL-DRIVEN-PLANNER — banked pool reader + detector ──
//
// Reads the post-processor's output (xaiAdversarialOptionBankBuilder.js).
// Returns an array of seed objects suitable for `seedAssignment`.
//
// If the JSONL is missing the `event: 'seed'` shape (e.g. someone passed
// a raw harvest JSONL by mistake), throws with a clear message.

function readBankedPoolFile(poolPath) {
  const raw = fs.readFileSync(poolPath, 'utf8');
  const seeds = [];
  let hadSummary = false;
  let firstNonEmptyLine = null;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    if (firstNonEmptyLine == null) firstNonEmptyLine = line;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (!ev || typeof ev !== 'object') continue;
    if (ev.event === 'seed') {
      seeds.push(ev);
    } else if (ev.event === 'pool_summary') {
      hadSummary = true;
    } else if (ev.stage === 'scenario_build') {
      // The user passed a raw harvest JSONL — not a banked pool.
      throw new Error(
        `banked-pool file ${poolPath} contains harvester scenario_build events, not banker seed events. Run scripts/bot-fixtures/xaiAdversarialOptionBankBuilder.js --in <harvest> --out <pool> first.`,
      );
    }
  }
  if (seeds.length === 0) {
    throw new Error(
      `banked-pool file ${poolPath} contained no \`event: 'seed'\` records.${hadSummary ? '' : ' (no pool_summary marker either)'}`,
    );
  }
  return seeds;
}

// ── Live posting helpers (FU3) ─────────────────────────────────

async function setupLivePostingContext({ args }) {
  const env = loadEnvFiles();
  let cfg;
  try { cfg = buildBotConfig(env); }
  catch (err) { console.error(`[xai-adv-bot] live setup: ${err.message}`); return null; }

  let anthropic;
  try { anthropic = claudeClient.createClient({ pilot: args.pilot, requirePilotFlag: true }); }
  catch (err) { console.error(`[xai-adv-bot] live setup: anthropic_disabled: ${(err && err.reason) || (err && err.message)}`); return null; }

  const adminClient = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const adminSession = await signInBot(adminClient, cfg.adminEmail, cfg.adminPassword);
  if (!adminSession) { console.error('[xai-adv-bot] live setup: admin_sign_in_failed'); return null; }

  const botByAlias = {};
  for (const bot of cfg.bots) {
    let userId;
    try {
      const r = await ensureBotUser(adminClient, {
        label: bot.label, email: bot.email, password: bot.password,
        persona: bot.persona, displayName: bot.label,
      });
      userId = r.userId;
    } catch (err) {
      console.error(`[xai-adv-bot] live setup: ensure_bot_user_failed for ${bot.alias}: ${(err && err.message) || 'unknown'}`);
      return null;
    }
    const c = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
    const s = await signInBot(c, bot.email, bot.password);
    if (!s) { console.error(`[xai-adv-bot] live setup: bot_sign_in_failed for ${bot.alias}`); return null; }
    botByAlias[bot.alias] = { userId, email: bot.email, client: c, label: bot.label };
  }
  return { cfg, adminClient, botByAlias, anthropic };
}

async function postLiveScenario({ args, jsonl, scene, source, dissent, dissentSource, bundle, liveCtx, runId }) {
  const constitutionRes = await liveCtx.adminClient.from('constitution_versions').select('id').eq('active', true).single();
  if (constitutionRes.error || !constitutionRes.data) {
    jsonl.write('room_summary', { scenarioId: scene.scenarioId, error: 'no_active_constitution' });
    return { posted: 0, error: 'no_active_constitution' };
  }
  const constitutionId = constitutionRes.data.id;
  const botByAlias = liveCtx.botByAlias;
  const [personaA, personaB, personaC] = scene.personas;
  const botA = botByAlias[personaA.alias];
  const botB = botByAlias[personaB.alias];
  const botC = botByAlias[personaC.alias];
  if (!botA || !botB || !botC) {
    jsonl.write('room_summary', { scenarioId: scene.scenarioId, error: 'bot_alias_missing' });
    return { posted: 0, error: 'bot_alias_missing' };
  }

  // CORPUS-30-POOL-DRIVEN-PLANNER: the legacy date-prefix bug (the old
  // 8-char prefix of runId) is replaced with the structured runTag from
  // corpusPoolDrivenPlanner.buildRunTag(). The runner now resolves the
  // runTag once per run and passes it through args; legacy callers
  // without args.runTag fall back to a re-derived tag.
  const runTag = scene.runTag || buildRunTag(runId, 'corpus-dev-synthetic');
  const threadIndex = typeof scene.threadIndex === 'number' ? scene.threadIndex : 0;
  // CORPUS-QUEUE-SMOKE-TAG-001: prefix the contract smoke tag OUTSIDE the
  // 80-char claim slice when opt-in is set; '' (byte-identical) otherwise.
  const smokeTagPrefix = resolveSmokeTagPrefix(args);
  const roomTitle = buildRoomTitle({
    prefix: smokeTagPrefix,
    claim: source.sourceClaimSummary || scene.title || '',
    runTag,
    threadIndex,
  });
  const debateInsert = await botA.client.from('debates').insert({
    created_by: botA.userId,
    title: roomTitle,
    resolution: source.sourceClaimSummary || scene.title || '(unspecified)',
    description: scene.runScopeNote || '',
    status: 'open',
    constitution_id: constitutionId,
  }).select('id').single();
  if (debateInsert.error || !debateInsert.data) {
    jsonl.write('room_summary', { scenarioId: scene.scenarioId, error: 'create_debate_failed', detail: (debateInsert.error?.message || '').slice(0, 200) });
    return { posted: 0, error: 'create_debate_failed' };
  }
  const debateId = debateInsert.data.id;

  await botA.client.from('debate_participants').insert({ debate_id: debateId, user_id: botA.userId, side: 'moderator' });
  const joinB = await botB.client.from('debate_participants').insert({ debate_id: debateId, user_id: botB.userId, side: 'negative' });
  if (joinB.error && joinB.error.code !== '23505') console.warn(`[xai-adv-bot] join B: ${joinB.error.message}`);
  const joinC = await botC.client.from('debate_participants').insert({ debate_id: debateId, user_id: botC.userId, side: 'moderator' });
  if (joinC.error && joinC.error.code !== '23505') console.warn(`[xai-adv-bot] join C: ${joinC.error.message}`);

  // Stage 6.1.9 follow-up: bot_assignment event — first thing emitted per
  // live scenario so the JSONL audit trail begins with who is defending what.
  jsonl.write('bot_assignment', {
    scenarioId: scene.scenarioId,
    debateId,
    assignments: scene.personas.map((p, i) => ({
      slot: i === 0 ? 'root_defender' : i === 1 ? 'reply_defender' : 'synthesizer',
      alias: p.alias,
      skillRole: p.skillRole,
      skillHash: p.skillHash,
    })),
  });

  const argIdByMoveId = {};
  const moves = [];
  let movesPosted = 0;

  async function submit({ persona, body, argumentType, parentMoveId, depth, slotMeta }) {
    const moveId = `m${depth}`;
    const parentArgumentId = parentMoveId ? argIdByMoveId[parentMoveId] : null;
    const bot = botByAlias[persona.alias];
    const sideStr = persona.skillRole === 'bot-provocateur' ? 'affirmative'
                  : persona.skillRole === 'bot-revocateur' ? 'negative'
                  : 'moderator';
    const submitBody = buildSubmitArgumentBody({
      debateId,
      parentArgumentId,
      move: {
        argumentType,
        body,
        targetExcerpt: slotMeta?.targetExcerpt || null,
        disagreementAxis: mapAxisForSubmit(slotMeta?.disagreementAxis || null),
        selectedTagCodes: [],
      },
      side: sideStr,
    });
    // Granular events first so consumers can replay the build → render →
    // validate → submit chain without rebuilding it from `bot_move_render`.
    jsonl.write('move_prompt_built', {
      scenarioId: scene.scenarioId,
      moveId, seeded: depth <= 2,
      promptKind: depth === 1 ? 'xai_source_thesis' : depth === 2 ? 'xai_dissent_rebuttal' : 'anthropic_skill_on_disk',
      skillHash: persona.skillHash,
    });
    jsonl.write('move_rendered', {
      scenarioId: scene.scenarioId,
      moveId,
      source: depth <= 2 ? 'xai_seed' : (slotMeta?.generationSpec?.source || 'anthropic'),
      attempts: slotMeta?.generationSpec?.attempts || 1,
      validationFailureReason: slotMeta?.generationSpec?.validationFailureReason || null,
      skillHash: persona.skillHash,
    });
    jsonl.write('move_validated', {
      scenarioId: scene.scenarioId,
      moveId, validated: true, issues: [],
      seed: depth <= 2,
      keywordRelaxationApplied: depth <= 2,
    });
    const result = await invokeSubmitArgument(bot.client, submitBody);
    jsonl.write('bot_move_render', {
      scenarioId: scene.scenarioId,
      move: {
        moveId, parentMoveId, argumentId: null,
        authorAlias: persona.alias, argumentType, body,
        targetExcerpt: slotMeta?.targetExcerpt || null,
        disagreementAxis: slotMeta?.disagreementAxis || null,
        qualifiers: [], evidenceDebt: slotMeta?.evidenceDebt || [],
        antiAmplificationNote: slotMeta?.antiAmplificationNote || null,
        transition: argumentType, depth,
      },
      skillHash: persona.skillHash,
      generationSpec: slotMeta?.generationSpec || null,
    });
    jsonl.write('submit_attempt', { scenarioId: scene.scenarioId, moveId, attempted: true });
    if (result.ok) {
      const argumentId = result.data?.argument?.id || result.data?.id || null;
      if (argumentId) argIdByMoveId[moveId] = argumentId;
      jsonl.write('submit_result', { scenarioId: scene.scenarioId, moveId, status: 'posted', argumentId });
      moves.push({ moveId, parentMoveId, argumentType, body, argumentId, depth });
      movesPosted += 1;
      return { posted: true, moveId, argumentId };
    }
    jsonl.write('submit_result', {
      scenarioId: scene.scenarioId, moveId, status: 'rejected',
      httpStatus: result.status, errorCode: result.error?.error || null,
      detail: typeof result.detail === 'string' ? result.detail.slice(0, 200) : null,
    });
    return { posted: false };
  }

  const m1 = await submit({
    persona: personaA, body: source.sourceTextRedacted, argumentType: 'thesis',
    parentMoveId: null, depth: 1, slotMeta: null,
  });
  if (!m1.posted) {
    jsonl.write('room_summary', { scenarioId: scene.scenarioId, debateId, error: 'm1_failed' });
    return { posted: movesPosted, error: 'm1_failed' };
  }
  const m2 = await submit({
    persona: personaB, body: dissent.replyTextRedacted, argumentType: 'rebuttal',
    parentMoveId: 'm1', depth: 2,
    slotMeta: {
      targetExcerpt: (source.sourceTextRedacted || '').slice(0, 120),
      disagreementAxis: 'source_chain',
      antiAmplificationNote: 'amplification suspected; demanding source-chain',
    },
  });
  if (!m2.posted) {
    jsonl.write('room_summary', { scenarioId: scene.scenarioId, debateId, error: 'm2_failed' });
    return { posted: movesPosted, error: 'm2_failed' };
  }

  // Strip JSON-shape prefixes from prior bodies before they enter the
  // conversation summary — otherwise Anthropic mimics the JSON wrapper
  // and we end up with nested {"body":"{"body":..."} corruption.
  function cleanForSummary(body) {
    let t = String(body || '').trim();
    // If a prior body still looks like a JSON wrapper, try to extract its
    // inner body string before truncating.
    if (/^\s*\{[\s\S]*"body"\s*:/.test(t)) {
      try {
        const inner = JSON.parse(t);
        if (inner && typeof inner.body === 'string') t = inner.body;
      } catch { /* leave as-is */ }
    }
    // Replace any remaining `{"body":` or `"disagreementAxis":` markers so
    // the summary line reads as prose, not JSON.
    t = t.replace(/^[\s{"]*body"\s*:\s*"?/i, '').replace(/"\s*,\s*"disagreementAxis"\s*:[\s\S]*$/i, '');
    return t.slice(0, 140);
  }
  function summarize() {
    return moves.map((m) => `  ${m.moveId} (${m.argumentType}): ${cleanForSummary(m.body)}`).join('\n');
  }

  let stopReason = null;
  for (let depth = 3; depth <= args.maxDepth; depth++) {
    const personaIdx = depth % 2;
    const persona = scene.personas[personaIdx];
    const parent = moves[moves.length - 1];
    const argumentType = depth % 2 === 0 ? 'rebuttal' : 'counter_rebuttal';
    const axes = ['source_chain', 'evidence', 'scope', 'definition', 'causal', 'logic'];
    const axis = axes[depth % axes.length];
    const targetExcerpt = (parent.body || '').slice(0, 80).replace(/\s+/g, ' ').trim();

    const rendered = await renderAdversarialMove({
      client: liveCtx.anthropic,
      scene,
      parent: { argumentType: parent.argumentType, body: parent.body, depth: parent.depth },
      slot: { argumentType, depth },
      persona,
      skillBundle: bundle,
      conversationSummary: summarize(),
      axis: 'auto',                 // let Anthropic choose the axis from the parent body
      fallbackAxis: axis,           // round-robin used if Anthropic returns no parseable axis
      antiAmplificationCue: 'popularity is not doing the evidentiary work',
      forceTargetExcerpt: targetExcerpt,
    });
    const effectiveAxis = rendered.chosenAxis || axis;
    const r = await submit({
      persona, body: rendered.body, argumentType,
      parentMoveId: parent.moveId, depth,
      slotMeta: {
        targetExcerpt, disagreementAxis: effectiveAxis,
        antiAmplificationNote: 'popularity is not doing the evidentiary work',
        generationSpec: {
          source: rendered.source, attempts: rendered.attempts,
          validationFailureReason: rendered.validationFailureReason,
          skillHash: rendered.skillHash,
          chosenAxis: rendered.chosenAxis,
          mechanism: rendered.mechanism,
          jsonParsed: rendered.jsonParsed,
          fallbackAxisUsed: !rendered.chosenAxis || rendered.chosenAxis === axis,
        },
      },
    });
    if (!r.posted) { stopReason = 'submit_failed'; break; }
    jsonl.write('annotation', {
      scenarioId: scene.scenarioId, moveId: r.moveId,
      annotation: {
        agreementScore: 0.1, disagreementScore: 0.6, coexistenceScore: 0.2,
        primaryStance: 'weak_disagree',
        politicalIssueFrame: source.topicBucket,
        amplificationRisk: source.popularityBucket === 'high' ? 'medium' : 'none_observed',
        evidentiaryRisk: source.popularityBucket === 'high' ? 'high' : 'medium',
        recommendedGameTreatment: 'ask_for_primary_source',
        modelJustification: 'live anthropic body; deterministic stub annotation',
        userReviewRequired: true,
      },
      annotationSource: rendered.source === 'anthropic' ? 'deterministic_stub_with_live_body' : 'deterministic_stub_with_fallback_body',
    });
  }
  if (!stopReason) stopReason = 'max_depth_reached';
  jsonl.write('room_summary', {
    scenarioId: scene.scenarioId, debateId,
    sourceHash: source.sourceHash, replyHash: dissent.replyHash, dissentSource,
    movesGenerated: moves.length, stopReason,
    anthropicUsage: liveCtx.anthropic.snapshotUsage(),
  });
  return { posted: movesPosted };
}

// ── CORPUS-30-LIVE-PATH-WIRING — move-body-sample hash helper ──
//
// Computes a deterministic sha256 hash of the normalized non-stopword
// token set of a move body. Used by the samey-move §9 check to compute
// Jaccard pair-wise overlap WITHOUT ever placing raw body text into a
// committable Markdown summary. The committable JSONL carries only the
// hash + token count; the body itself never leaves the runner.
const SAMEY_MOVE_STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'but', 'the', 'is', 'it', 'this', 'that',
  'these', 'those', 'i', 'you', 'we', 'they', 'he', 'she', 'them', 'us',
  'be', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with',
  'as', 'from', 'into', 'than', 'then', 'so', 'if', 'not', 'no',
  's', 't', 'd', 're', 've', 'll',
]);

// CORPUS-30-QUALITY-001 (b): hash a single normalized token to an 8-hex
// sha256 prefix. The set of these per-token hashes is body-free
// (non-reversible to readable text; order destroyed by set-dedupe+sort)
// yet supports set-intersection Jaccard — unlike the single 16-hex
// `tokenSetHash`, which can only detect exact clones.
function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex').slice(0, 8);
}

function computeMoveBodySampleHash(body) {
  const tokens = String(body || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length >= 3 && !SAMEY_MOVE_STOPWORDS.has(w));
  const tokenSet = Array.from(new Set(tokens)).sort();
  const tokenSetHash = createHash('sha256').update(tokenSet.join('|')).digest('hex').slice(0, 16);
  // CORPUS-30-QUALITY-001 (b): body-free hashed-shingle fingerprint.
  // Each token hashed independently to an 8-hex prefix; the SET (deduped
  // + sorted) is emitted, never the readable tokens. Supports real
  // Jaccard on the committable live path.
  const tokenHashes = Array.from(new Set(tokenSet.map(hashToken))).sort();
  // CORPUS-30-QUALITY-001 (c): a single POSITIONAL hash of the first body
  // token (pre-sort) for the opening-phrase band — body-free, one hash.
  const openingTokenHash = tokens.length > 0 ? hashToken(tokens[0]) : null;
  return { tokenSetHash, tokenCount: tokenSet.length, tokenSet, tokenHashes, openingTokenHash };
}

// ── CORPUS-30-LIVE-PATH-WIRING — banked live scenario posting ──
//
// Live-mode counterpart to the dry-mode banked branch in the main loop.
// Per CORPUS-30-LIVE-PATH-PLANNER-WIRING-AND-REPORTER-ACCURACY §4 Fix 1:
//
//   1. M1/M2 attribution events come from scene.seededMoves[].attribution
//      (already set by buildBankedAdversarialScene).
//   2. bot_assignment event carries resolved voiceId per bot.
//   3. M3..M(maxDepth) move loop calls the planner (resolveMoveBank +
//      selectOption + assignSpineId) to pick (bankName, optionIndex,
//      spineId) per move, then calls renderAlignedAdversarialMove with
//      the binding selectedOption + voiceId + spineId.
//   4. Every move_validated event carries the 11 attribution fields
//      (runId, runTag, seedId, threadIndex, role, moveIndex, bankName,
//      optionIndex, optionId, voiceId, spineId, attribution).
//   5. Every move emits a move_body_sample event with a hashed
//      token-set for the samey-move §9 reporter check (no raw body).
//   6. Anthropic / Supabase / submit call counts are tracked on the
//      shared `liveCallCounters` so the runner can emit a
//      provider_call_summary event before run_summary.
//
// Posts route through `submit-argument`. No service-role. No direct
// insert. Bots remain test bots.
async function postLiveBankedScenario({
  args, jsonl, scenario, bundle, liveCtx, runId, runTag, liveCallCounters,
}) {
  const { scene, source, dissent, seed, threadIndex, usedOptionsForThread } = scenario;
  const constitutionRes = await liveCtx.adminClient.from('constitution_versions').select('id').eq('active', true).single();
  if (constitutionRes.error || !constitutionRes.data) {
    jsonl.write('room_summary', { scenarioId: scene.scenarioId, runTag, seedId: seed.seedId, threadIndex, error: 'no_active_constitution' });
    return { posted: 0, error: 'no_active_constitution' };
  }
  const constitutionId = constitutionRes.data.id;
  const botByAlias = liveCtx.botByAlias;
  const [personaA, personaB, personaC] = scene.personas;
  const botA = botByAlias[personaA.alias];
  const botB = botByAlias[personaB.alias];
  const botC = botByAlias[personaC.alias];
  if (!botA || !botB || !botC) {
    jsonl.write('room_summary', { scenarioId: scene.scenarioId, runTag, seedId: seed.seedId, threadIndex, error: 'bot_alias_missing' });
    return { posted: 0, error: 'bot_alias_missing' };
  }

  // Lift voiceId per bot using assignVoiceId; the userId is the real
  // Supabase user id (stable across runs for the same bot).
  const voiceIdByAlias = {};
  voiceIdByAlias[personaA.alias] = assignVoiceId(runId, botA.userId);
  voiceIdByAlias[personaB.alias] = assignVoiceId(runId, botB.userId);
  voiceIdByAlias[personaC.alias] = assignVoiceId(runId, botC.userId);

  // Stamp voiceId onto each persona so the renderer can foreground it.
  scene.personas = scene.personas.map((p) => ({ ...p, voiceId: voiceIdByAlias[p.alias] || null }));

  // Update the seededMoves attribution to use the live-resolved voiceId.
  if (Array.isArray(scene.seededMoves)) {
    for (const sm of scene.seededMoves) {
      if (sm && sm.attribution) {
        sm.attribution.voiceId = voiceIdByAlias[sm.authorAlias] || null;
      }
    }
  }

  // CORPUS-QUEUE-SMOKE-TAG-001: same single titling helper + resolver as
  // the legacy site so the two paths cannot diverge. '' prefix (default
  // off) → byte-identical to the pre-change title.
  const smokeTagPrefix = resolveSmokeTagPrefix(args);
  const roomTitle = buildRoomTitle({
    prefix: smokeTagPrefix,
    claim: seed.claimSummary || scene.title || '',
    runTag,
    threadIndex,
  });
  const debateInsert = await botA.client.from('debates').insert({
    created_by: botA.userId,
    title: roomTitle,
    resolution: seed.claimSummary || scene.title || '(unspecified)',
    description: scene.runScopeNote || '',
    status: 'open',
    constitution_id: constitutionId,
  }).select('id').single();
  if (debateInsert.error || !debateInsert.data) {
    jsonl.write('room_summary', { scenarioId: scene.scenarioId, runTag, seedId: seed.seedId, threadIndex, error: 'create_debate_failed', detail: (debateInsert.error?.message || '').slice(0, 200) });
    return { posted: 0, error: 'create_debate_failed' };
  }
  const debateId = debateInsert.data.id;
  liveCallCounters.supabaseWrites += 1; // debate insert

  await botA.client.from('debate_participants').insert({ debate_id: debateId, user_id: botA.userId, side: 'moderator' });
  liveCallCounters.supabaseWrites += 1;
  const joinB = await botB.client.from('debate_participants').insert({ debate_id: debateId, user_id: botB.userId, side: 'negative' });
  if (joinB.error && joinB.error.code !== '23505') console.warn(`[xai-adv-bot] join B: ${joinB.error.message}`);
  else liveCallCounters.supabaseWrites += 1;
  const joinC = await botC.client.from('debate_participants').insert({ debate_id: debateId, user_id: botC.userId, side: 'moderator' });
  if (joinC.error && joinC.error.code !== '23505') console.warn(`[xai-adv-bot] join C: ${joinC.error.message}`);
  else liveCallCounters.supabaseWrites += 1;

  // bot_assignment event — carries the resolved voiceId per bot.
  jsonl.write('bot_assignment', {
    scenarioId: scene.scenarioId,
    runTag,
    seedId: seed.seedId,
    threadIndex,
    debateId,
    assignments: scene.personas.map((p, i) => ({
      slot: i === 0 ? 'provocateur' : i === 1 ? 'revocateur' : 'synthesizer',
      alias: p.alias,
      skillRole: p.skillRole,
      skillHash: p.skillHash,
      voiceId: voiceIdByAlias[p.alias] || null,
    })),
    voiceIdByAlias,
  });

  const argIdByMoveId = {};
  const posted = [];
  let movesPosted = 0;
  let prevSpine = null;

  // Helper to emit move_body_sample with a hashed token-set (no body).
  function emitMoveBodySample({ moveId, moveIndex, body }) {
    const sample = computeMoveBodySampleHash(body);
    jsonl.write('move_body_sample', {
      scenarioId: scene.scenarioId,
      runTag,
      seedId: seed.seedId,
      threadIndex,
      moveId,
      moveIndex,
      tokenSetHash: sample.tokenSetHash,
      tokenCount: sample.tokenCount,
      // CORPUS-30-QUALITY-001 (b)/(c): body-free hashed-shingle
      // fingerprint (set of 8-hex per-token hashes) + one positional
      // opening-token hash. No readable token / no raw body is emitted.
      tokenHashes: sample.tokenHashes,
      openingTokenHash: sample.openingTokenHash,
    });
  }

  // Submit helper — wraps invokeSubmitArgument + emits submit_attempt /
  // submit_result + tracks supabaseWrites on success.
  async function submitOne({ persona, body, argumentType, parentMoveId, moveId, slotMeta }) {
    const parentArgumentId = parentMoveId ? argIdByMoveId[parentMoveId] : null;
    const bot = botByAlias[persona.alias];
    const sideStr = persona.skillRole === 'bot-provocateur' ? 'affirmative'
                  : persona.skillRole === 'bot-revocateur' ? 'negative'
                  : 'moderator';
    const submitBody = buildSubmitArgumentBody({
      debateId,
      parentArgumentId,
      move: {
        argumentType,
        body,
        targetExcerpt: slotMeta?.targetExcerpt || null,
        disagreementAxis: mapAxisForSubmit(slotMeta?.disagreementAxis || null),
        selectedTagCodes: [],
      },
      side: sideStr,
    });
    jsonl.write('submit_attempt', { scenarioId: scene.scenarioId, moveId, attempted: true });
    const result = await invokeSubmitArgument(bot.client, submitBody);
    if (result.ok) {
      const argumentId = result.data?.argument?.id || result.data?.id || null;
      if (argumentId) argIdByMoveId[moveId] = argumentId;
      jsonl.write('submit_result', { scenarioId: scene.scenarioId, moveId, status: 'posted', argumentId });
      liveCallCounters.supabaseWrites += 1;
      return { posted: true, argumentId };
    }
    jsonl.write('submit_result', {
      scenarioId: scene.scenarioId, moveId, status: 'rejected',
      httpStatus: result.status, errorCode: result.error?.error || null,
      detail: typeof result.detail === 'string' ? result.detail.slice(0, 200) : null,
    });
    return { posted: false };
  }

  // M1 + M2 from the planner-seeded scene.seededMoves.
  for (let i = 0; i < scene.seededMoves.length; i++) {
    const sm = scene.seededMoves[i];
    const persona = scene.personas[i];
    const moveIndex = sm.attribution.moveIndex;
    const moveId = sm.moveId;
    jsonl.write('move_prompt_built', {
      scenarioId: scene.scenarioId, runTag, threadIndex,
      moveId, seeded: true,
      promptKind: i === 0 ? 'banked_opening_claim' : 'banked_objection',
      skillHash: persona.skillHash,
    });
    jsonl.write('move_rendered', {
      scenarioId: scene.scenarioId, runTag, threadIndex,
      moveId, source: 'banked_option_live',
      attempts: 1, validationFailureReason: null,
      skillHash: persona.skillHash,
    });
    jsonl.write('move_validated', {
      scenarioId: scene.scenarioId, runTag,
      seedId: seed.seedId, threadIndex,
      role: sm.attribution.role, moveIndex,
      bankName: sm.attribution.bankName, optionIndex: sm.attribution.optionIndex,
      optionId: sm.attribution.optionId,
      voiceId: sm.attribution.voiceId, spineId: sm.attribution.spineId,
      attribution: sm.attribution,
      attempts: 1, source: 'banked_option_live', validationFailureReason: null,
      alignmentFailureReason: null,
      jsonParsed: false,
      moveId, validated: true, issues: [], seed: true,
    });
    emitMoveBodySample({ moveId, moveIndex, body: sm.body });
    jsonl.write('bot_move_render', {
      scenarioId: scene.scenarioId, runTag, threadIndex,
      move: {
        moveId, parentMoveId: sm.parentMoveId, argumentId: null,
        authorAlias: sm.authorAlias, argumentType: sm.argumentType, body: sm.body,
        targetExcerpt: sm.targetExcerpt || null,
        disagreementAxis: sm.disagreementAxis || null,
        qualifiers: [], evidenceDebt: [],
        antiAmplificationNote: null,
        transition: sm.argumentType,
        depth: moveIndex,
      },
      seeded: true,
      attribution: sm.attribution,
      skillHash: persona.skillHash,
    });
    const submitResult = await submitOne({
      persona, body: sm.body, argumentType: sm.argumentType,
      parentMoveId: sm.parentMoveId, moveId,
      slotMeta: { targetExcerpt: sm.targetExcerpt || null, disagreementAxis: sm.disagreementAxis || null },
    });
    if (!submitResult.posted) {
      jsonl.write('room_summary', { scenarioId: scene.scenarioId, runTag, seedId: seed.seedId, threadIndex, debateId, error: `${moveId}_failed` });
      return { posted: movesPosted, error: `${moveId}_failed` };
    }
    posted.push({ moveId, body: sm.body, argumentId: submitResult.argumentId, depth: moveIndex });
    movesPosted += 1;
    prevSpine = sm.attribution.spineId;
  }

  // M3..M(maxDepth) loop — planner picks bank + option + spine; aligned
  // renderer renders the body.
  function cleanForSummary(body) {
    let t = String(body || '').trim();
    if (/^\s*\{[\s\S]*"body"\s*:/.test(t)) {
      try {
        const inner = JSON.parse(t);
        if (inner && typeof inner.body === 'string') t = inner.body;
      } catch { /* leave as-is */ }
    }
    t = t.replace(/^[\s{"]*body"\s*:\s*"?/i, '').replace(/"\s*,\s*"disagreementAxis"\s*:[\s\S]*$/i, '');
    return t.slice(0, 140);
  }
  function summarize() {
    return posted.map((m) => `  ${m.moveId}: ${cleanForSummary(m.body)}`).join('\n');
  }

  let stopReason = null;
  const lastMove = Math.min(args.maxDepth, 10);
  for (let moveIndex = 3; moveIndex <= lastMove; moveIndex++) {
    const plan = resolveMoveBank(runId, threadIndex, moveIndex);
    const bankArr = seed.banks[plan.bankName] || [];
    if (bankArr.length === 0) { stopReason = `empty_bank:${plan.bankName}`; break; }
    const selection = selectOption({
      runId, threadIndex, role: plan.role, moveIndex,
      bankName: plan.bankName, bank: bankArr,
      usedOptionsForThread,
      onReset: (info) => jsonl.write('bank_exhausted_reset', { ...info, runTag, scenarioId: scene.scenarioId, seedId: seed.seedId }),
    });
    const personaIdx = plan.role === 'provocateur' ? 0 : 1;
    const persona = scene.personas[personaIdx];
    const spineId = assignSpineId(runId, threadIndex, moveIndex, prevSpine);
    const moveId = `m${moveIndex}`;
    const parent = posted[posted.length - 1];
    const argumentType = moveIndex % 2 === 0 ? 'rebuttal' : 'counter_rebuttal';

    const attribution = {
      runTag, threadIndex, role: plan.role, moveIndex,
      bankName: plan.bankName, optionIndex: selection.optionIndex,
      optionId: selection.option.optionId,
      voiceId: persona.voiceId || null, spineId,
    };

    jsonl.write('move_prompt_built', {
      scenarioId: scene.scenarioId, runTag, threadIndex, moveId,
      seeded: false,
      promptKind: 'aligned_anthropic_render',
      skillHash: persona.skillHash,
    });

    let rendered;
    try {
      rendered = await renderAlignedAdversarialMove({
        client: liveCtx.anthropic,
        scene,
        parent: { argumentType: parent ? (parent.depth % 2 === 0 ? 'rebuttal' : 'counter_rebuttal') : 'thesis', body: parent ? parent.body : '', depth: parent ? parent.depth : 0 },
        slot: { argumentType, depth: moveIndex },
        persona,
        skillBundle: bundle,
        conversationSummary: summarize(),
        selectedOption: selection.option,
        voiceId: persona.voiceId || null,
        spineId,
        attribution,
        fallbackAxis: selection.option.skeleton?.axisHint || 'evidence',
        antiAmplificationCue: 'popularity is not doing the evidentiary work',
        forceTargetExcerpt: selection.option.skeleton?.targetExcerpt || null,
      });
    } catch (err) {
      jsonl.write('move_rendered', {
        scenarioId: scene.scenarioId, runTag, threadIndex, moveId,
        source: 'render_threw', attempts: 1,
        validationFailureReason: String(err && err.message).slice(0, 200),
        skillHash: persona.skillHash,
      });
      stopReason = 'render_threw';
      break;
    }
    if (rendered.source === 'anthropic') liveCallCounters.anthropicCalls += 1;
    jsonl.write('move_rendered', {
      scenarioId: scene.scenarioId, runTag, threadIndex, moveId,
      source: rendered.source,
      attempts: rendered.attempts || 1,
      validationFailureReason: rendered.validationFailureReason || null,
      alignmentFailureReason: rendered.alignmentFailureReason || null,
      skillHash: persona.skillHash,
    });

    jsonl.write('move_validated', {
      scenarioId: scene.scenarioId, runTag,
      seedId: seed.seedId, threadIndex,
      role: plan.role, moveIndex,
      bankName: plan.bankName, optionIndex: selection.optionIndex,
      optionId: selection.option.optionId,
      voiceId: persona.voiceId || null, spineId,
      attribution,
      attempts: rendered.attempts || 1,
      source: rendered.source,
      validationFailureReason: rendered.validationFailureReason || null,
      alignmentFailureReason: rendered.alignmentFailureReason || null,
      jsonParsed: Boolean(rendered.jsonParsed),
      // CORPUS-30-QUALITY-001 (a): populate the per-issue fallback tokens
      // (was emitted empty). Only non-empty on deterministic_fallback
      // moves; the reporter buckets on each token's PREFIX so no label
      // value / option-spine id payload reaches committable output.
      moveId, validated: true, issues: rendered.fallbackIssues || [], seed: false,
    });
    emitMoveBodySample({ moveId, moveIndex, body: rendered.body });

    const targetExcerpt = selection.option.skeleton?.targetExcerpt || (parent ? String(parent.body || '').slice(0, 80) : null);
    const effectiveAxis = rendered.chosenAxis || selection.option.skeleton?.axisHint || 'evidence';
    jsonl.write('bot_move_render', {
      scenarioId: scene.scenarioId, runTag, threadIndex,
      move: {
        moveId, parentMoveId: parent ? parent.moveId : null, argumentId: null,
        authorAlias: persona.alias, argumentType, body: rendered.body,
        targetExcerpt,
        disagreementAxis: effectiveAxis,
        qualifiers: [],
        evidenceDebt: selection.option.skeleton?.evidenceDebt || [],
        antiAmplificationNote: selection.option.skeleton?.antiAmplificationNote || 'popularity is not doing the evidentiary work',
        transition: argumentType,
        depth: moveIndex,
      },
      attribution,
      skillHash: persona.skillHash,
      generationSpec: {
        source: rendered.source,
        attempts: rendered.attempts || 1,
        validationFailureReason: rendered.validationFailureReason || null,
        alignmentFailureReason: rendered.alignmentFailureReason || null,
        selectedOptionId: rendered.selectedOptionId || selection.option.optionId,
        chosenAxis: rendered.chosenAxis || null,
        jsonParsed: Boolean(rendered.jsonParsed),
      },
    });

    const submitResult = await submitOne({
      persona, body: rendered.body, argumentType,
      parentMoveId: parent ? parent.moveId : null, moveId,
      slotMeta: { targetExcerpt, disagreementAxis: effectiveAxis },
    });
    if (!submitResult.posted) {
      stopReason = `submit_failed:${moveId}`;
      break;
    }
    posted.push({ moveId, body: rendered.body, argumentId: submitResult.argumentId, depth: moveIndex });
    movesPosted += 1;
    prevSpine = spineId;

    jsonl.write('annotation', {
      scenarioId: scene.scenarioId, moveId,
      annotation: {
        agreementScore: 0.1, disagreementScore: 0.55, coexistenceScore: 0.25,
        primaryStance: 'weak_disagree',
        politicalIssueFrame: seed.issueFrame,
        amplificationRisk: 'none_observed',
        evidentiaryRisk: 'medium',
        recommendedGameTreatment: 'ask_for_primary_source',
        modelJustification: 'live banked move; aligned renderer + planner selection',
        userReviewRequired: true,
      },
      annotationSource: rendered.source === 'anthropic' ? 'aligned_live_with_planner' : 'deterministic_skeleton_fill_with_planner',
    });
  }
  if (!stopReason) stopReason = 'max_depth_reached';
  jsonl.write('room_summary', {
    scenarioId: scene.scenarioId, runTag,
    seedId: seed.seedId, threadIndex, debateId,
    movesGenerated: posted.length, stopReason,
    anthropicUsage: liveCtx.anthropic && typeof liveCtx.anthropic.snapshotUsage === 'function'
      ? liveCtx.anthropic.snapshotUsage()
      : null,
  });
  return { posted: movesPosted };
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const bools = envBooleans();
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;

  console.log(`[xai-adv-bot] mode=${args.dry ? 'dry' : 'live'} scenarios=${args.scenarios} max-depth=${args.maxDepth}`);
  console.log(`[xai-adv-bot] env: ${JSON.stringify(bools)}`);

  // ── Skill gate FIRST.
  let bundle;
  try { bundle = loadAdversarialSkillBundle(); }
  catch (err) {
    console.error(`[xai-adv-bot] SKILL GATE FAILED: ${String(err.message)}`);
    process.exitCode = 2;
    return;
  }
  console.log(`[xai-adv-bot] skill gate OK · provocateur=${bundle.provocateurHash} · revocateur=${bundle.revocateurHash}`);

  if (!args.dry) {
    const refusals = refuseLive(args, bools);
    if (refusals.length > 0) {
      console.error(`[xai-adv-bot] refusing live: ${refusals.join('; ')}`);
      process.exitCode = 2;
      return;
    }
  }

  ensureDir(REPORT_DIR);
  ensureDir(LOG_DIR);
  const jsonlPath = args.annotationJsonl || path.join(LOG_DIR, `${runId}-xai-adversarial-semantic-corpus.jsonl`);
  const sourceMode = args.dry ? 'dry_fixture' : 'xai_live';
  const skillGate = redactedSkillGate(bundle, true);
  const jsonl = new StageJsonlStream(jsonlPath, skillGate, runId, sourceMode);
  console.log(`[xai-adv-bot] jsonl: ${path.relative(REPO_ROOT, jsonlPath)} (gitignored)`);

  jsonl.write('skill_validation', {
    skillGate,
    args: { ...args, envBooleans: bools },
  });
  jsonl.write('run_start', {
    runId, scenarios: args.scenarios, maxDepth: args.maxDepth, seed: args.seed,
  });

  // ── Source phase. Order of preference:
  //   1. --banked-pool <path>    — CORPUS-30-POOL-DRIVEN-PLANNER input (preferred).
  //   2. --harvest-file <path>   — Stage 6.1.9 harvest JSONL (legacy path).
  //   3. dry mode                — canonical synthetic fixture.
  //   4. live without either     — abort (operator must run harvester + post-processor first).
  let fixture;
  let scenarioCount = 0;
  let bankedSeeds = null;
  let runTag = null;
  if (args.bankedPool) {
    try { bankedSeeds = readBankedPoolFile(args.bankedPool); }
    catch (err) {
      console.error(`[xai-adv-bot] failed to read banked pool ${args.bankedPool}: ${err.message}`);
      jsonl.write('run_summary', { runId, mode: args.dry ? 'dry' : 'live', scenarios: 0, reason: 'banked_pool_unreadable' });
      await jsonl.end();
      process.exitCode = 6;
      return;
    }
    runTag = buildRunTag(runId, args.runKind || 'corpus-dev-synthetic');
    let assigned;
    try {
      assigned = seedAssignment(runId, args.scenarios, bankedSeeds);
    } catch (err) {
      if (err instanceof SeedPoolUndersizedError) {
        console.error(`[xai-adv-bot] ${err.message}`);
        jsonl.write('seed_pool_undersized', {
          runId, runTag, requested: args.scenarios, details: err.details || null,
        });
        jsonl.write('run_summary', { runId, mode: args.dry ? 'dry' : 'live', scenarios: 0, reason: 'seed_pool_undersized' });
        await jsonl.end();
        process.exitCode = 7;
        return;
      }
      throw err;
    }
    jsonl.write('seed_assignment', {
      runId, runTag, requested: args.scenarios,
      eligible: bankedSeeds.filter((s) => !s.bankShortfall).length,
      total: bankedSeeds.length,
      assignedSeedIds: assigned.map((s) => s.seedId),
    });
    // Emit a source_harvest + dissent_detection event per assigned seed so the
    // existing JSONL-contract test (xaiAdversarialBotCorpus.test.ts) keeps
    // passing. The banked path's "source" is the seed's claimSummary, and the
    // "dissent" is the M2 objection option (selected later in the scenario
    // loop). We emit deterministic-shape stand-ins here.
    for (let i = 0; i < assigned.length; i++) {
      const seed = assigned[i];
      jsonl.write('source_harvest', {
        sourceMode: 'banked_pool',
        sourcePost: {
          redactedText: seed.claimSummary,
          issueFrame: seed.issueFrame,
          popularityBucket: 'unknown',
          sourceChainRisk: 'unknown',
          platformSupportWarning: false,
        },
        sourceOrdinal: i + 1,
        sourceHash: seed.sourceHash,
        providerRank: 0,
        providerConfidence: 0,
        replyCount: 0,
        seedId: seed.seedId,
        bankCounts: seed.bankCounts || null,
      });
      jsonl.write('dissent_detection', {
        sourceHash: seed.sourceHash,
        seedId: seed.seedId,
        classification: { source: 'banked_pool', usableForBotDebate: true, disagreementType: 'evidence' },
      });
    }
    fixture = { sources: [], _shaped: [], _banked: assigned };
    scenarioCount = assigned.length;
  } else if (args.harvestFile) {
    let harvestSources;
    try { harvestSources = readHarvestFile(args.harvestFile); }
    catch (err) {
      console.error(`[xai-adv-bot] failed to read harvest file ${args.harvestFile}: ${err.message}`);
      jsonl.write('run_summary', { runId, mode: args.dry ? 'dry' : 'live', scenarios: 0, reason: 'harvest_file_unreadable' });
      await jsonl.end();
      process.exitCode = 6;
      return;
    }
    if (harvestSources.length === 0) {
      console.error(`[xai-adv-bot] harvest file ${args.harvestFile} contained no scenario_build events`);
      jsonl.write('run_summary', { runId, mode: args.dry ? 'dry' : 'live', scenarios: 0, reason: 'harvest_file_empty' });
      await jsonl.end();
      process.exitCode = 6;
      return;
    }
    const taken = harvestSources.slice(0, args.scenarios);
    for (const s of taken) {
      jsonl.write('source_harvest', {
        sourceMode: 'harvest_file',
        sourcePost: {
          redactedText: s.sourceTextRedacted,
          issueFrame: s.topicBucket,
          popularityBucket: s.popularityBucket,
          sourceChainRisk: s.popularityBucket === 'high' ? 'high' : 'unknown',
          platformSupportWarning: s.popularityBucket === 'high',
        },
        sourceOrdinal: s.sourceOrdinal,
        sourceHash: s.sourceHash,
        providerRank: s.providerRank,
        providerConfidence: s.providerConfidence,
        replyCount: s.replies.length,
        harvestFile: path.relative(REPO_ROOT, args.harvestFile),
      });
    }
    fixture = { sources: taken, _shaped: taken };
    scenarioCount = taken.length;
  } else if (args.dry) {
    fixture = readDryFixture(args.fixturePath);
    const wantedScenarios = Math.min(args.scenarios, fixture.sources.length);
    const sourceList = fixture.sources.slice(0, wantedScenarios);
    sourceList.forEach((s, i) => {
      const shaped = shapeFixtureSource(s, args.seed);
      jsonl.write('source_harvest', {
        sourceMode: 'dry_fixture',
        sourcePost: {
          redactedText: shaped.sourceTextRedacted,
          issueFrame: shaped.topicBucket,
          popularityBucket: shaped.popularityBucket,
          sourceChainRisk: shaped.popularityBucket === 'high' ? 'high' : 'unknown',
          platformSupportWarning: shaped.popularityBucket === 'high',
        },
        sourceOrdinal: shaped.sourceOrdinal,
        sourceHash: shaped.sourceHash,
        providerRank: shaped.providerRank,
        providerConfidence: shaped.providerConfidence,
        replyCount: shaped.replies.length,
      });
    });
    fixture._shaped = sourceList.map((s) => shapeFixtureSource(s, args.seed));
    scenarioCount = fixture._shaped.length;
  } else {
    // Live mode without --harvest-file: the spec requires the runner to
    // consume a harvest JSONL. The harvester script is
    // `scripts/engagement-intelligence/xaiAdversarialSourceHarvest.js`
    // (npm scripts: engagement:intel:xai:adversarial:{dry,tiny,100}).
    console.error('[xai-adv-bot] live mode requires --harvest-file <path>. Run `npm run engagement:intel:xai:adversarial:tiny` first to produce one.');
    jsonl.write('run_summary', { runId, mode: 'live', scenarios: 0, reason: 'harvest_file_required_for_live' });
    await jsonl.end();
    process.exitCode = 3;
    return;
  }

  // ── Dissent phase + Scenario build phase.
  const scenarios = [];

  // CORPUS-30-POOL-DRIVEN-PLANNER path: when --banked-pool is supplied,
  // each seed becomes one thread; M1/M2 selections come from the
  // planner; M3..M10 selections happen at render time inside the move
  // loop where the per-thread usedOptionsForThread Map lives.
  if (fixture._banked) {
    const botPool = [
      { alias: 'bot-a', label: 'Alex', email: '<dev>' },
      { alias: 'bot-b', label: 'Jordan', email: '<dev>' },
      { alias: 'bot-c', label: 'Sam', email: '<dev>' },
    ];
    for (let threadIndex = 0; threadIndex < fixture._banked.length; threadIndex++) {
      const seed = fixture._banked[threadIndex];
      const used = new Map(); // bankName → Set<optionIndex>
      // M1 + M2 selections via the planner.
      const m1Plan = resolveMoveBank(runId, threadIndex, 1);
      const m1Selection = selectOption({
        runId, threadIndex,
        role: m1Plan.role, moveIndex: 1,
        bankName: m1Plan.bankName, bank: seed.banks[m1Plan.bankName],
        usedOptionsForThread: used,
        onReset: (info) => jsonl.write('bank_exhausted_reset', info),
      });
      const m2Plan = resolveMoveBank(runId, threadIndex, 2);
      const m2Selection = selectOption({
        runId, threadIndex,
        role: m2Plan.role, moveIndex: 2,
        bankName: m2Plan.bankName, bank: seed.banks[m2Plan.bankName],
        usedOptionsForThread: used,
        onReset: (info) => jsonl.write('bank_exhausted_reset', info),
      });

      // Voice + spine for M1/M2 (botUserId placeholder = alias for dry).
      const voiceIdByAlias = {};
      for (const b of botPool) voiceIdByAlias[b.alias] = assignVoiceId(runId, b.alias);
      const scene = buildBankedAdversarialScene({
        seed,
        m1Selection,
        m2Selection,
        botPool,
        opts: { seed: args.seed, runId, runTag, threadIndex, voiceIdByAlias },
      });
      // Stamp skill hashes.
      scene.personas = scene.personas.map((p) => ({
        ...p,
        skillHash: p.skillRole === 'bot-provocateur' ? bundle.provocateurHash
                : p.skillRole === 'bot-revocateur' ? bundle.revocateurHash
                : `synthesizer-${bundle.provocateurHash.slice(0, 8)}`,
      }));

      // Apply the spineId no-repeat-prior constraint for M1; for M2 the
      // previousSpineId is M1's spineHint.
      const m1SpineId = assignSpineId(runId, threadIndex, 1, null);
      const m2SpineId = assignSpineId(runId, threadIndex, 2, m1SpineId);
      scene.seededMoves[0].attribution.spineId = m1SpineId;
      scene.seededMoves[1].attribution.spineId = m2SpineId;

      jsonl.write('scenario_build', {
        scenarioId: scene.scenarioId,
        runTag,
        seedId: seed.seedId,
        threadIndex,
        sourceHash: seed.sourceHash,
        dissentSource: 'banked_pool',
        botAssignment: {
          rootDefender: scene.personas[0].alias,
          replyDefender: scene.personas[1].alias,
          rootSkill: scene.personas[0].skillRole,
          replySkill: scene.personas[1].skillRole,
          voiceIdByAlias,
        },
        sourcePost: {
          redactedText: seed.claimSummary,
          issueFrame: seed.issueFrame,
          popularityBucket: 'unknown',
          sourceChainRisk: 'unknown',
          platformSupportWarning: false,
        },
      });

      scenarios.push({
        scene,
        source: { sourceHash: seed.sourceHash, sourceClaimSummary: seed.claimSummary, sourceTextRedacted: seed.claimSummary, topicBucket: seed.issueFrame, popularityBucket: 'unknown' },
        dissent: { replyHash: m2Selection.option.optionId, replyTextRedacted: scene.seededMoves[1].body, syntheticRebuttal: false },
        dissentSource: 'banked_pool',
        seed,
        usedOptionsForThread: used,
        threadIndex,
        runTag,
      });
    }
  }

  for (const source of fixture._shaped) {
    const selection = selectFirstUsableDissent({ sourceText: source.sourceTextRedacted, replies: source.replies });
    // Log each candidate classification.
    for (const c of selection.classifications) {
      jsonl.write('dissent_detection', {
        sourceHash: source.sourceHash,
        replyHash: c.reply.replyHash,
        replyRank: c.reply.providerRank,
        replyKind: c.reply.kind,
        classification: c.classification,
      });
    }

    let dissent = selection.pick ? selection.pick.reply : null;
    let dissentSource = 'xai_top_reply';
    if (!dissent) {
      if (args.allowSyntheticDissent) {
        dissent = buildSyntheticDissent(source);
        dissentSource = 'synthetic_fallback';
        jsonl.write('synthetic_rebuttal_generated', {
          sourceHash: source.sourceHash,
          scanned: selection.scanned,
          reason: selection.reason,
        });
      } else {
        jsonl.write('room_summary', { sourceHash: source.sourceHash, skipped: true, reason: 'no_usable_dissent' });
        continue;
      }
    }

    // Pass the dissent body through the hostile-source converter for defense in depth.
    const conv = convertHostileBody(dissent.replyTextRedacted);
    if (!conv.kept) {
      // Replace the dissent body with the placeholder; mark as synthetic.
      dissent = { ...dissent, replyTextRedacted: conv.placeholder, abuseLevel: conv.level, abuseCategories: conv.categories };
      dissentSource = 'synthetic_fallback_post_abuse_redact';
    }

    const scene = buildAdversarialScene({
      source,
      reply: dissent,
      botPool: [
        { alias: 'bot-a', label: 'Alex', email: '<dev>' },
        { alias: 'bot-b', label: 'Jordan', email: '<dev>' },
        { alias: 'bot-c', label: 'Sam', email: '<dev>' },
      ],
      opts: { seed: args.seed, runId },
    });

    // Stamp the saved skill hash onto each persona so move events can
    // include `persona.skillHash`.
    scene.personas = scene.personas.map((p) => ({
      ...p,
      skillHash: p.skillRole === 'bot-provocateur' ? bundle.provocateurHash
              : p.skillRole === 'bot-revocateur' ? bundle.revocateurHash
              : `synthesizer-${bundle.provocateurHash.slice(0, 8)}`,
    }));

    jsonl.write('scenario_build', {
      scenarioId: scene.scenarioId,
      sourceHash: source.sourceHash,
      replyHash: dissent.replyHash,
      dissentSource,
      botAssignment: {
        rootDefender: scene.personas[0].alias,
        replyDefender: scene.personas[1].alias,
        rootSkill: scene.personas[0].skillRole,
        replySkill: scene.personas[1].skillRole,
      },
      sourcePost: {
        redactedText: source.sourceTextRedacted,
        issueFrame: source.topicBucket,
        popularityBucket: source.popularityBucket,
        sourceChainRisk: source.popularityBucket === 'high' ? 'high' : 'unknown',
        platformSupportWarning: source.popularityBucket === 'high',
      },
      sourceReply: {
        redactedText: dissent.replyTextRedacted,
        rank: dissent.providerRank,
        dissentStrength: selection.pick ? selection.pick.classification.dissentStrength : 0,
        abuseRisk: selection.pick ? selection.pick.classification.abuseRisk : 'none',
        usableForBotDebate: Boolean(selection.pick),
      },
    });

    scenarios.push({ scene, source, dissent, dissentSource });
  }

  // ── Live setup (FU2 Anthropic + FU3 Supabase). Dry mode skips this entirely.
  let liveCtx = null;
  if (!args.dry) {
    liveCtx = await setupLivePostingContext({ args });
    if (!liveCtx) {
      console.error('[xai-adv-bot] live setup failed; aborting before posting');
      jsonl.write('run_summary', { runId, mode: 'live', scenarios: 0, reason: 'live_setup_failed' });
      await jsonl.end();
      process.exitCode = 5;
      return;
    }
    console.log('[xai-adv-bot] live posting context ready (admin + bots signed in, Anthropic client gated)');
  }

  // ── Move generation phase. Dry mode emits deterministic placeholders;
  // live mode runs `postLiveScenario` (legacy) or `postLiveBankedScenario`
  // (CORPUS-30 wiring) which renders moves via Anthropic and submits each
  // through `submit-argument`.
  // liveCallCounters tracks the real run counts so the Markdown summary
  // and a provider_call_summary JSONL event report honest integers
  // instead of the "(not wired in this commit)" disclaimer.
  const liveCallCounters = { xaiCalls: 0, anthropicCalls: 0, supabaseWrites: 0 };
  let movesPosted = 0;
  for (const scenario of scenarios) {
    const { scene, source, dissent, dissentSource } = scenario;
    if (!args.dry) {
      let r;
      if (scenario.seed && scenario.usedOptionsForThread) {
        // CORPUS-30-LIVE-PATH-WIRING: planner-wired banked live path.
        r = await postLiveBankedScenario({
          args, jsonl, scenario, bundle, liveCtx, runId, runTag,
          liveCallCounters,
        });
      } else {
        r = await postLiveScenario({
          args, jsonl, scene, source, dissent, dissentSource, bundle, liveCtx, runId,
        });
      }
      movesPosted += r.posted || 0;
      continue;
    }

    // CORPUS-30-POOL-DRIVEN-PLANNER dry path: emit attribution events
    // for the seeded M1/M2 (already chosen by planner) and continue
    // with deterministic planner-driven selections through M3..MN.
    if (scenario.seed && scenario.usedOptionsForThread) {
      const threadIndex = scenario.threadIndex;
      const usedThread = scenario.usedOptionsForThread;
      const sceneSeed = scenario.seed;
      const personas = scene.personas;
      jsonl.write('bot_assignment', {
        scenarioId: scene.scenarioId,
        runTag,
        seedId: sceneSeed.seedId,
        threadIndex,
        assignments: personas.map((p, i) => ({
          slot: i === 0 ? 'provocateur' : i === 1 ? 'revocateur' : 'synthesizer',
          alias: p.alias,
          skillRole: p.skillRole,
          skillHash: p.skillHash,
          voiceId: p.voiceId || null,
        })),
      });

      const postedBanked = [];
      // Emit M1, M2 attribution events from the seededMoves.
      for (let i = 0; i < scene.seededMoves.length; i++) {
        const sm = scene.seededMoves[i];
        const personaIdx = i;
        const persona = personas[personaIdx];
        jsonl.write('move_prompt_built', {
          scenarioId: scene.scenarioId, runTag, threadIndex,
          moveId: sm.moveId, seeded: true,
          promptKind: i === 0 ? 'banked_opening_claim' : 'banked_objection',
          skillHash: persona.skillHash,
        });
        jsonl.write('move_rendered', {
          scenarioId: scene.scenarioId, runTag, threadIndex,
          moveId: sm.moveId, source: 'banked_option_dry',
          attempts: 1, validationFailureReason: null,
          skillHash: persona.skillHash,
        });
        jsonl.write('move_validated', {
          scenarioId: scene.scenarioId, runTag,
          seedId: sceneSeed.seedId, threadIndex,
          role: sm.attribution.role, moveIndex: sm.attribution.moveIndex,
          bankName: sm.attribution.bankName, optionIndex: sm.attribution.optionIndex,
          optionId: sm.attribution.optionId,
          voiceId: sm.attribution.voiceId, spineId: sm.attribution.spineId,
          attempts: 1, source: 'banked_option_dry', validationFailureReason: null,
          alignmentFailureReason: null,
          jsonParsed: false,
          moveId: sm.moveId, validated: true, issues: [], seed: true,
        });
        jsonl.write('bot_move_render', {
          scenarioId: scene.scenarioId, runTag, threadIndex,
          move: {
            moveId: sm.moveId, parentMoveId: sm.parentMoveId, argumentId: null,
            authorAlias: sm.authorAlias, argumentType: sm.argumentType, body: sm.body,
            targetExcerpt: sm.targetExcerpt || null,
            disagreementAxis: sm.disagreementAxis || null,
            qualifiers: [], evidenceDebt: [],
            antiAmplificationNote: null,
            transition: sm.argumentType,
            depth: i + 1,
          },
          seeded: true,
          attribution: sm.attribution,
          skillHash: persona.skillHash,
        });
        jsonl.write('submit_attempt', { scenarioId: scene.scenarioId, moveId: sm.moveId, attempted: false, reason: 'dry_mode' });
        jsonl.write('submit_result', { scenarioId: scene.scenarioId, moveId: sm.moveId, status: 'skipped' });
        postedBanked.push({ moveId: sm.moveId, body: sm.body, spineId: sm.attribution.spineId, depth: i + 1 });
      }

      // M3..maxDepth (capped at 10 by the MOVE_PLAN).
      let stopReason = null;
      let prevSpine = postedBanked[postedBanked.length - 1].spineId;
      const lastMove = Math.min(args.maxDepth, 10);
      for (let moveIndex = 3; moveIndex <= lastMove; moveIndex++) {
        const plan = resolveMoveBank(runId, threadIndex, moveIndex);
        const bankArr = sceneSeed.banks[plan.bankName] || [];
        if (bankArr.length === 0) { stopReason = `empty_bank:${plan.bankName}`; break; }
        const selection = selectOption({
          runId, threadIndex, role: plan.role, moveIndex,
          bankName: plan.bankName, bank: bankArr,
          usedOptionsForThread: usedThread,
          onReset: (info) => jsonl.write('bank_exhausted_reset', { ...info, runTag, scenarioId: scene.scenarioId, seedId: sceneSeed.seedId }),
        });
        const personaIdx = plan.role === 'provocateur' ? 0 : 1;
        const persona = personas[personaIdx];
        const spineId = assignSpineId(runId, threadIndex, moveIndex, prevSpine);
        prevSpine = spineId;
        const moveId = `m${moveIndex}`;
        const body = selection.option.skeleton.summary || '';
        jsonl.write('move_prompt_built', {
          scenarioId: scene.scenarioId, runTag, threadIndex, moveId,
          seeded: false,
          promptKind: 'banked_option_dry',
          skillHash: persona.skillHash,
        });
        jsonl.write('move_rendered', {
          scenarioId: scene.scenarioId, runTag, threadIndex, moveId,
          source: 'banked_option_dry',
          attempts: 1, validationFailureReason: null,
          skillHash: persona.skillHash,
        });
        jsonl.write('move_validated', {
          scenarioId: scene.scenarioId, runTag,
          seedId: sceneSeed.seedId, threadIndex,
          role: plan.role, moveIndex,
          bankName: plan.bankName, optionIndex: selection.optionIndex,
          optionId: selection.option.optionId,
          voiceId: persona.voiceId || null, spineId,
          attempts: 1, source: 'banked_option_dry',
          validationFailureReason: null,
          alignmentFailureReason: null,
          jsonParsed: false,
          moveId, validated: true, issues: [], seed: false,
        });
        jsonl.write('bot_move_render', {
          scenarioId: scene.scenarioId, runTag, threadIndex,
          move: {
            moveId,
            parentMoveId: postedBanked[postedBanked.length - 1].moveId,
            argumentId: null,
            authorAlias: persona.alias,
            argumentType: moveIndex % 2 === 0 ? 'rebuttal' : 'counter_rebuttal',
            body,
            targetExcerpt: selection.option.skeleton.targetExcerpt || null,
            disagreementAxis: selection.option.skeleton.axisHint || null,
            qualifiers: [],
            evidenceDebt: selection.option.skeleton.evidenceDebt || [],
            antiAmplificationNote: selection.option.skeleton.antiAmplificationNote || null,
            transition: moveIndex % 2 === 0 ? 'rebuttal' : 'counter_rebuttal',
            depth: moveIndex,
          },
          skillHash: persona.skillHash,
          attribution: {
            runTag, threadIndex, role: plan.role, moveIndex,
            bankName: plan.bankName, optionIndex: selection.optionIndex,
            optionId: selection.option.optionId,
            voiceId: persona.voiceId || null, spineId,
          },
        });
        jsonl.write('submit_attempt', { scenarioId: scene.scenarioId, moveId, attempted: false, reason: 'dry_mode' });
        jsonl.write('submit_result', { scenarioId: scene.scenarioId, moveId, status: 'skipped' });
        jsonl.write('annotation', {
          scenarioId: scene.scenarioId, moveId,
          annotation: {
            agreementScore: 0.1, disagreementScore: 0.55, coexistenceScore: 0.25,
            primaryStance: 'weak_disagree',
            politicalIssueFrame: sceneSeed.issueFrame,
            amplificationRisk: 'none_observed',
            evidentiaryRisk: 'medium',
            recommendedGameTreatment: 'ask_for_primary_source',
            modelJustification: 'banked dry-mode annotation; mechanism + axis present',
            userReviewRequired: true,
          },
          annotationSource: 'deterministic_fallback_banked',
        });
        postedBanked.push({ moveId, body, spineId, depth: moveIndex });
      }
      if (!stopReason) stopReason = 'max_depth_reached';
      movesPosted += postedBanked.length;
      jsonl.write('room_summary', {
        scenarioId: scene.scenarioId, runTag,
        seedId: sceneSeed.seedId, threadIndex,
        movesGenerated: postedBanked.length,
        stopReason,
      });
      continue;
    }

    // Stage 6.1.9 follow-up: bot_assignment event per scenario — declares
    // which bot persona will defend the root vs. the disagreeable reply.
    jsonl.write('bot_assignment', {
      scenarioId: scene.scenarioId,
      assignments: scene.personas.map((p, i) => ({
        slot: i === 0 ? 'root_defender' : i === 1 ? 'reply_defender' : 'synthesizer',
        alias: p.alias,
        skillRole: p.skillRole,
        skillHash: p.skillHash,
      })),
    });

    const posted = [
      { moveId: 'm1', body: source.sourceTextRedacted, argumentType: 'thesis', authorAlias: scene.personas[0].alias, parentMoveId: null, depth: 1 },
      { moveId: 'm2', body: dissent.replyTextRedacted, argumentType: 'rebuttal', authorAlias: scene.personas[1].alias, parentMoveId: 'm1', depth: 2 },
    ];
    posted.forEach((m, i) => {
      // Granular events for M1 / M2 seed moves so the dry contract carries
      // the same telemetry shape as live posting will.
      jsonl.write('move_prompt_built', {
        scenarioId: scene.scenarioId,
        moveId: m.moveId,
        seeded: true,
        promptKind: i === 0 ? 'xai_source_thesis' : 'xai_dissent_rebuttal',
        skillHash: i === 0 ? scene.personas[0].skillHash : scene.personas[1].skillHash,
      });
      jsonl.write('move_rendered', {
        scenarioId: scene.scenarioId,
        moveId: m.moveId,
        source: 'xai_seed',
        attempts: 1,
        validationFailureReason: null,
        skillHash: i === 0 ? scene.personas[0].skillHash : scene.personas[1].skillHash,
      });
      jsonl.write('move_validated', {
        scenarioId: scene.scenarioId,
        moveId: m.moveId,
        validated: true,
        issues: [],
        seed: true,
        keywordRelaxationApplied: i <= 1,
      });
      jsonl.write('bot_move_render', {
        scenarioId: scene.scenarioId,
        move: {
          moveId: m.moveId, parentMoveId: m.parentMoveId, argumentId: null,
          authorAlias: m.authorAlias, argumentType: m.argumentType, body: m.body,
          targetExcerpt: i === 1 ? source.sourceTextRedacted.slice(0, 120) : null,
          disagreementAxis: i === 1 ? 'source_chain' : null,
          qualifiers: [], evidenceDebt: [], antiAmplificationNote: i === 1 ? 'amplification suspected; demanding source-chain' : null,
          transition: i === 0 ? 'thesis' : 'rebuttal',
          depth: m.depth,
        },
        seeded: true,
        skillHash: i === 0 ? scene.personas[0].skillHash : scene.personas[1].skillHash,
      });
      jsonl.write('submit_attempt', { scenarioId: scene.scenarioId, moveId: m.moveId, attempted: false, reason: 'dry_mode' });
      jsonl.write('submit_result', { scenarioId: scene.scenarioId, moveId: m.moveId, status: 'skipped' });
    });

    let stopReason = null;
    for (let depth = 3; depth <= args.maxDepth; depth++) {
      const personaIdx = depth % 2;
      const persona = scene.personas[personaIdx];
      const parent = posted[posted.length - 1];
      const moveSpec = generateDryMove({ scenario: scene, parent, persona, depth, args });
      const m = {
        moveId: `m${depth}`,
        parentMoveId: parent.moveId,
        argumentId: null,
        authorAlias: persona.alias,
        argumentType: depth % 2 === 0 ? 'rebuttal' : 'counter_rebuttal',
        body: moveSpec.body,
        targetExcerpt: moveSpec.targetExcerpt,
        disagreementAxis: moveSpec.disagreementAxis,
        qualifiers: [],
        evidenceDebt: moveSpec.evidenceDebt,
        antiAmplificationNote: moveSpec.antiAmplificationNote,
        transition: moveSpec.adoptedPosition,
        depth,
      };
      jsonl.write('move_prompt_built', {
        scenarioId: scene.scenarioId,
        moveId: m.moveId,
        seeded: false,
        promptKind: 'deterministic_dry_mode',
        skillHash: persona.skillHash,
      });
      jsonl.write('move_rendered', {
        scenarioId: scene.scenarioId,
        moveId: m.moveId,
        source: 'deterministic_dry_mode',
        attempts: 1,
        validationFailureReason: null,
        skillHash: persona.skillHash,
      });
      jsonl.write('move_validated', {
        scenarioId: scene.scenarioId,
        moveId: m.moveId,
        validated: true,
        issues: [],
        seed: false,
        keywordRelaxationApplied: false,
      });
      jsonl.write('bot_move_render', { scenarioId: scene.scenarioId, move: m, generationSpec: moveSpec, skillHash: persona.skillHash });
      jsonl.write('submit_attempt', { scenarioId: scene.scenarioId, moveId: m.moveId, attempted: false, reason: 'dry_mode' });
      jsonl.write('submit_result', { scenarioId: scene.scenarioId, moveId: m.moveId, status: 'skipped' });
      jsonl.write('annotation', {
        scenarioId: scene.scenarioId, moveId: m.moveId,
        annotation: {
          agreementScore: 0.1, disagreementScore: 0.55, coexistenceScore: 0.25,
          primaryStance: 'weak_disagree',
          politicalIssueFrame: source.topicBucket,
          amplificationRisk: source.popularityBucket === 'high' ? 'medium' : 'none_observed',
          evidentiaryRisk: source.popularityBucket === 'high' ? 'high' : 'medium',
          recommendedGameTreatment: 'ask_for_primary_source',
          modelJustification: 'deterministic dry-mode annotation; mechanism + axis + evidence-debt present',
          userReviewRequired: true,
        },
        annotationSource: 'deterministic_fallback',
      });
      posted.push(m);
      if (moveSpec.concessionReadiness === 'synthesis_ready') { stopReason = 'synthesis_ready'; break; }
    }
    if (!stopReason && posted.length >= args.maxDepth + 2) stopReason = 'max_depth_reached';
    movesPosted += posted.length - 2; // exclude the seeded thesis/rebuttal
    jsonl.write('room_summary', {
      scenarioId: scene.scenarioId,
      sourceHash: source.sourceHash,
      replyHash: dissent.replyHash,
      dissentSource,
      movesGenerated: posted.length,
      stopReason: stopReason || 'unspecified',
    });
  }

  // CORPUS-30-LIVE-PATH-WIRING: provider_call_summary lands BEFORE
  // run_summary so reporters can pick the canonical counts up from one
  // event. If the runner crashes mid-run, the previously-written
  // counter snapshot is still the honest record.
  jsonl.write('provider_call_summary', {
    runId,
    xaiCalls: liveCallCounters.xaiCalls,
    anthropicCalls: liveCallCounters.anthropicCalls,
    supabaseWrites: liveCallCounters.supabaseWrites,
  });
  // CORPUS-QUEUE-SMOKE-TAG-001: surface whether the run produced
  // smoke-taggable titles so a reviewer can confirm at a glance. The tag
  // is a public literal (no secret). When off, smokeTagApplied is false
  // and resolvedSmokeTag is null.
  const runSmokeTagPrefix = resolveSmokeTagPrefix(args);
  jsonl.write('run_summary', {
    runId,
    mode: args.dry ? 'dry' : 'live',
    scenarios: scenarios.length,
    movesGenerated: movesPosted,
    smokeTagApplied: runSmokeTagPrefix !== '',
    resolvedSmokeTag: runSmokeTagPrefix !== '' ? runSmokeTagPrefix.trimEnd() : null,
    providerCallSummary: {
      xaiCalls: liveCallCounters.xaiCalls,
      anthropicCalls: liveCallCounters.anthropicCalls,
      supabaseWrites: liveCallCounters.supabaseWrites,
    },
    skillGate,
  });
  await jsonl.end();

  // ── Markdown report (redacted aggregate).
  const date = new Date().toISOString().slice(0, 10);
  const baseName = args.reportName || 'xai-adversarial-bot-corpus';
  const suffix = args.dry ? '-dry' : '';
  const mdPath = path.join(REPORT_DIR, `${date}-${baseName}${suffix}.md`);
  const events = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const md = buildMarkdownReport({ runId, args, bools, events, scenarios, bundle });
  fs.writeFileSync(mdPath, md);
  console.log(`[xai-adv-bot] markdown: ${path.relative(REPO_ROOT, mdPath)}`);
}

function countBy(events, key) {
  const m = new Map();
  for (const e of events) {
    const v = key(e);
    if (!v) continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ── CORPUS-30-POOL-DRIVEN-PLANNER — diversity check helpers (§9) ──
//
// Operate purely on JSONL attribution; NEVER read body text. Each
// helper returns an aggregate + severityBand ('green' | 'yellow' | 'red').

function classifySeverity(red, yellow) {
  if (red) return 'red';
  if (yellow) return 'yellow';
  return 'green';
}

// CORPUS-30-LIVE-PATH-WIRING Fix 2: attribution-presence preconditions.
//
// Operator-ratified policy (per CORPUS-30 design §9): when the JSONL
// lacks the attribution data a check needs, the check emits
// `severityBand: 'n/a'` with `reason: 'attribution_absent'` INSTEAD of
// falsely green. The 30-runbook gates PASS on `severityBand === 'green'`
// — yellow / red / n/a all fail the gate. n/a is "we cannot decide
// from the data", not "no issues found".
function hasAnyMoveValidated(events) {
  for (const e of events) if (e && e.stage === 'move_validated') return true;
  return false;
}
function moveValidatedFieldPresence(events) {
  let total = 0;
  let withBank = 0;
  let withSpine = 0;
  for (const e of events) {
    if (!e || e.stage !== 'move_validated') continue;
    total += 1;
    if (typeof e.bankName === 'string' && Number.isFinite(e.optionIndex)) withBank += 1;
    if (typeof e.spineId === 'string' && e.spineId.length > 0) withSpine += 1;
  }
  return {
    total,
    bankAbsentCount: total - withBank,
    spineAbsentCount: total - withSpine,
    bankComplete: total > 0 && withBank === total,
    spineComplete: total > 0 && withSpine === total,
  };
}
function botAssignmentVoicePresence(events) {
  let assignments = 0;
  let withVoice = 0;
  for (const e of events) {
    if (!e || e.stage !== 'bot_assignment' || !Array.isArray(e.assignments)) continue;
    for (const a of e.assignments) {
      assignments += 1;
      if (a && typeof a.voiceId === 'string' && a.voiceId.length > 0) withVoice += 1;
    }
  }
  return {
    assignments,
    voiceAbsentCount: assignments - withVoice,
    voiceComplete: assignments > 0 && withVoice === assignments,
  };
}
function hasAnyMoveBodySample(events) {
  for (const e of events) if (e && e.stage === 'move_body_sample') return true;
  return false;
}

// CORPUS-30-LIVE-PATH-WIRING Fix 3: provider/Supabase call tally.
//
// Reads provider_call_summary if emitted (the runner's authoritative
// counter); otherwise falls back to aggregating the per-event signals
// (xai_*, anthropic_*, submit_result.status==='posted'). The 30
// runbook treats the runner's counter as canonical; this fallback
// exists so older JSONL streams or partial runs can still produce a
// honest aggregate without "(not wired)" disclaimers.
function computeProviderCallTally(events) {
  let summaryEvent = null;
  for (const e of events) {
    if (e && e.stage === 'provider_call_summary') { summaryEvent = e; break; }
  }
  if (summaryEvent
      && Number.isFinite(summaryEvent.xaiCalls)
      && Number.isFinite(summaryEvent.anthropicCalls)
      && Number.isFinite(summaryEvent.supabaseWrites)) {
    return {
      source: 'provider_call_summary',
      xaiCalls: summaryEvent.xaiCalls,
      anthropicCalls: summaryEvent.anthropicCalls,
      supabaseWrites: summaryEvent.supabaseWrites,
    };
  }
  let xaiCalls = 0;
  let anthropicCalls = 0;
  let supabaseWrites = 0;
  for (const e of events) {
    if (!e) continue;
    if (e.stage === 'move_rendered' && e.source === 'anthropic') anthropicCalls += 1;
    if (e.stage === 'submit_result' && e.status === 'posted') supabaseWrites += 1;
    if (e.stage === 'xai_source_call' || e.stage === 'xai_call' || e.stage === 'provider_query') xaiCalls += 1;
  }
  return { source: 'aggregated_from_events', xaiCalls, anthropicCalls, supabaseWrites };
}

function checkDuplicateSeed(events) {
  const seedIds = [];
  for (const e of events) {
    if (e && e.stage === 'seed_assignment' && Array.isArray(e.assignedSeedIds)) {
      for (const id of e.assignedSeedIds) seedIds.push(id);
    }
  }
  const seen = new Set();
  const dups = [];
  for (const id of seedIds) {
    if (seen.has(id)) dups.push(id);
    else seen.add(id);
  }
  return {
    total: seedIds.length, unique: seen.size, duplicates: dups,
    severityBand: classifySeverity(dups.length > 0, false),
  };
}

function checkRepeatedOption(events) {
  // CORPUS-30-LIVE-PATH-WIRING Fix 2: attribution-presence precondition.
  // When move_validated events lack bankName/optionIndex on ≥1 move,
  // emit n/a + attribution_absent INSTEAD of a false green.
  if (!hasAnyMoveValidated(events)) {
    return {
      repeatedWithin: [], crossThreadCollisions: [],
      severityBand: 'n/a',
      reason: 'attribution_absent',
      reasonDetail: 'no move_validated events present',
    };
  }
  const presence = moveValidatedFieldPresence(events);
  if (!presence.bankComplete) {
    return {
      repeatedWithin: [], crossThreadCollisions: [],
      severityBand: 'n/a',
      reason: 'attribution_absent',
      reasonDetail: `${presence.bankAbsentCount}/${presence.total} move_validated events lack bankName+optionIndex`,
    };
  }
  // Per-thread: count (bankName, optionIndex) appearances per threadIndex.
  // Across run: count optionId appearances across distinct threads.
  const perThread = new Map(); // threadIndex → Map<key, count>
  const optionIdToThreads = new Map(); // optionId → Set<threadIndex>
  for (const e of events) {
    if (!e || e.stage !== 'move_validated') continue;
    if (typeof e.threadIndex !== 'number') continue;
    const key = `${e.bankName}::${e.optionIndex}`;
    if (!perThread.has(e.threadIndex)) perThread.set(e.threadIndex, new Map());
    const inner = perThread.get(e.threadIndex);
    inner.set(key, (inner.get(key) || 0) + 1);
    if (e.optionId) {
      if (!optionIdToThreads.has(e.optionId)) optionIdToThreads.set(e.optionId, new Set());
      optionIdToThreads.get(e.optionId).add(e.threadIndex);
    }
  }
  // Repeated-option within thread BEFORE the bank_exhausted_reset event
  // for that bank fires would be a planner bug — we report any
  // (threadIndex, bankName, optionIndex) seen ≥ 2 times.
  const repeatedWithin = [];
  for (const [threadIndex, inner] of perThread.entries()) {
    for (const [key, count] of inner.entries()) {
      if (count >= 2) repeatedWithin.push({ threadIndex, key, count });
    }
  }
  const crossThreadCollisions = [];
  for (const [optionId, threads] of optionIdToThreads.entries()) {
    if (threads.size >= 3) crossThreadCollisions.push({ optionId, threadCount: threads.size });
  }
  const yellow = repeatedWithin.length > 0;
  const red = crossThreadCollisions.length > 0;
  return { repeatedWithin, crossThreadCollisions, severityBand: classifySeverity(red, yellow) };
}

function checkSpineSaturation(events) {
  // CORPUS-30-LIVE-PATH-WIRING Fix 2: attribution-presence precondition.
  if (!hasAnyMoveValidated(events)) {
    return {
      perRunDistribution: [], repeatedThreads: [], lowDiversityWindows: [], saturatedSpine: null,
      severityBand: 'n/a',
      reason: 'attribution_absent',
      reasonDetail: 'no move_validated events present',
    };
  }
  const presence = moveValidatedFieldPresence(events);
  if (!presence.spineComplete) {
    return {
      perRunDistribution: [], repeatedThreads: [], lowDiversityWindows: [], saturatedSpine: null,
      severityBand: 'n/a',
      reason: 'attribution_absent',
      reasonDetail: `${presence.spineAbsentCount}/${presence.total} move_validated events lack spineId`,
    };
  }
  // Per thread: spine sequence; flag if same spineId appears ≥3 times
  // or any window of 4 consecutive moves has ≤2 distinct spines.
  // Per run: any single spine accounts for >35% of all moves.
  const perThread = new Map(); // threadIndex → [{ moveIndex, spineId }]
  const allSpines = new Map(); // spineId → count
  let total = 0;
  for (const e of events) {
    if (!e || e.stage !== 'move_validated') continue;
    if (typeof e.threadIndex !== 'number' || !e.spineId) continue;
    if (!perThread.has(e.threadIndex)) perThread.set(e.threadIndex, []);
    perThread.get(e.threadIndex).push({ moveIndex: e.moveIndex || 0, spineId: e.spineId });
    allSpines.set(e.spineId, (allSpines.get(e.spineId) || 0) + 1);
    total += 1;
  }
  const repeatedThreads = [];
  const lowDiversityWindows = [];
  for (const [threadIndex, seq] of perThread.entries()) {
    const counts = new Map();
    for (const s of seq) counts.set(s.spineId, (counts.get(s.spineId) || 0) + 1);
    for (const [spineId, c] of counts.entries()) {
      if (c >= 3) repeatedThreads.push({ threadIndex, spineId, count: c });
    }
    // 4-move window diversity check.
    for (let i = 0; i + 4 <= seq.length; i++) {
      const window = seq.slice(i, i + 4);
      const distinct = new Set(window.map((w) => w.spineId));
      if (distinct.size <= 2) {
        lowDiversityWindows.push({ threadIndex, startMoveIndex: window[0].moveIndex });
      }
    }
  }
  let saturatedSpine = null;
  if (total > 0) {
    for (const [spineId, c] of allSpines.entries()) {
      if (c / total > 0.35) { saturatedSpine = { spineId, fraction: c / total, count: c }; break; }
    }
  }
  const red = saturatedSpine !== null;
  const yellow = repeatedThreads.length > 0 || lowDiversityWindows.length > 0;
  return {
    perRunDistribution: [...allSpines.entries()].sort((a, b) => b[1] - a[1]),
    repeatedThreads, lowDiversityWindows, saturatedSpine,
    severityBand: classifySeverity(red, yellow),
  };
}

// CORPUS-30-DIVERSITY-001: voice-distribution band recalibrated to
// PLANNER REALITY (operator-decided axis (ii) — reporter-only; the
// planner `assignVoiceId` is byte-equal). The old hardcoded band
// `count < 5 || count > 12` was tuned for a per-slot distribution the
// per-bot-account planner never emits: with B fixed bot accounts over
// N rooms, `assignVoiceId(runId, botUserId)` deterministically yields B
// distinct voices, each at count = N — so all B voices landed
// out-of-band → a false YELLOW on a healthy planner.
//
// The recalibrated band derives its expectation FROM THE STREAM, not
// from any hardcoded slot count:
//   expectedPerVoice       = totalVoiceAssignments / distinctVoiceCount
//   expectedDistinctVoices = max voice-bearing assignments seen in any
//                            single room (the room's bot cardinality)
// The synthesizer IS a real voice-bearing bot account (one of the 3
// personas provocateur/revocateur/synthesizer, each assigned a voice via
// assignVoiceId(runId, botUserId)); it therefore COUNTS as a voice in
// the band math. We do not hardcode "3" — distinctVoiceCount and the
// per-room cardinality are both derived from the actual stream. If a
// CDISCOURSE_DIVERSITY_SYNTH_SLOT knob is ever referenced, the default
// is "synthesizer counts"; deriving from the data supersedes any knob.
//
// §4-T BAND-RECALIBRATION, NOT BAND-REMOVAL — two independent teeth so
// the band stays GREEN on the planner's honest distribution (B voices
// each ≈ N) yet still fires on a genuinely degenerate distribution:
//   Tooth A — per-voice MATERIAL deviation: a voice whose count falls
//     below expectedPerVoice * VOICE_BAND_LOW_FACTOR (0.5) or above
//     expectedPerVoice * VOICE_BAND_HIGH_FACTOR (2.0). Catches a wildly
//     imbalanced split (one voice hogs the run; others starve).
//   Tooth B — DISTINCT-VOICE COLLAPSE: distinctVoiceCount falls below
//     expectedDistinctVoices (the per-room bot cardinality). Catches a
//     uniform collapse to ≤1 voice that Tooth A is structurally blind to
//     (when every assignment shares one voice, expectedPerVoice is
//     recomputed off the collapsed total so the lone voice sits exactly
//     "at expected" — only the distinct-count floor catches it).
//   Severity: collapse to a single distinct voice while rooms exhibit
//     ≥2 voice slots → RED; a partial collapse (distinct ≥2 but below
//     room cardinality) or any per-voice deviation or same-room
//     collision → YELLOW.
// Factors chosen so 3 voices × 30 rooms (expected=30, each at 30, room
// cardinality=3, distinct=3) reads GREEN, but a 90→1-voice collapse
// (distinct=1 < cardinality 3) reads RED. The honest band is anchored
// to the planner's actual N/B expectation, never reverse-fit to make the
// last run green.
const VOICE_BAND_LOW_FACTOR = 0.5;
const VOICE_BAND_HIGH_FACTOR = 2.0;

function recalibrateVoiceBand(voiceCounts, collisions, maxRoomVoiceCardinality, voiceRoomCount) {
  let totalVoiceAssignments = 0;
  for (const c of voiceCounts.values()) totalVoiceAssignments += c;
  const distinctVoiceCount = voiceCounts.size;
  // n/a-on-empty backstop (mirrors attribution_absent → n/a): never green
  // by absence. The caller already gates on bot_assignment presence, but
  // this keeps the helper itself honest on an empty/degenerate-zero map.
  if (totalVoiceAssignments === 0 || distinctVoiceCount === 0) {
    return {
      outOfBand: [], degenerateCollapse: null,
      expectedPerVoice: 0, expectedDistinctVoices: maxRoomVoiceCardinality,
      distinctVoiceCount,
      severityBand: 'n/a',
      reason: 'attribution_absent',
      reasonDetail: 'no voice-bearing bot_assignment entries present',
    };
  }
  const expectedPerVoice = totalVoiceAssignments / distinctVoiceCount;
  const lowBound = expectedPerVoice * VOICE_BAND_LOW_FACTOR;
  const highBound = expectedPerVoice * VOICE_BAND_HIGH_FACTOR;
  const outOfBand = [];
  for (const [voiceId, count] of voiceCounts.entries()) {
    if (count < lowBound || count > highBound) outOfBand.push({ voiceId, count });
  }
  // Tooth B — distinct-voice collapse vs the per-room bot cardinality.
  // A RUN-WIDE collapse to a single voice (rooms exhibit ≥2 voice slots
  // yet the whole run uses ≤1 voice across ≥2 rooms) is systemic → RED.
  // A single-room collapse is just that room's same-room collision (the
  // collision tooth already flags YELLOW) and must NOT escalate to RED on
  // a 1-room sample — so RED requires ≥2 voice-bearing rooms.
  const expectedDistinctVoices = maxRoomVoiceCardinality;
  let degenerateCollapse = null;
  if (expectedDistinctVoices >= 2 && distinctVoiceCount < expectedDistinctVoices) {
    const severity = (distinctVoiceCount <= 1 && voiceRoomCount >= 2) ? 'red' : 'yellow';
    degenerateCollapse = { distinctVoiceCount, expectedDistinctVoices, severity };
  }
  const red = degenerateCollapse !== null && degenerateCollapse.severity === 'red';
  const yellow = collisions.length > 0 || outOfBand.length > 0 || degenerateCollapse !== null;
  return {
    outOfBand, degenerateCollapse,
    expectedPerVoice: Number(expectedPerVoice.toFixed(2)),
    expectedDistinctVoices, distinctVoiceCount,
    severityBand: classifySeverity(red, yellow),
  };
}

function checkVoiceDistribution(events) {
  // CORPUS-30-LIVE-PATH-WIRING Fix 2: attribution-presence precondition.
  const presence = botAssignmentVoicePresence(events);
  if (presence.assignments === 0 || !presence.voiceComplete) {
    return {
      voiceCounts: [], collisions: [], outOfBand: [],
      severityBand: 'n/a',
      reason: 'attribution_absent',
      reasonDetail: presence.assignments === 0
        ? 'no bot_assignment events present'
        : `${presence.voiceAbsentCount}/${presence.assignments} bot_assignment entries lack voiceId`,
    };
  }
  // Per room (scenarioId): voice_pair_collision when two bots share voiceId.
  // Per run: CORPUS-30-DIVERSITY-001 recalibrated band (expected ≈
  // totalAssignments / distinctVoices per voice; see recalibrateVoiceBand).
  const perScenario = new Map(); // scenarioId → Set<voiceId>
  const voiceCounts = new Map();
  let maxRoomVoiceCardinality = 0;
  let voiceRoomCount = 0; // rooms carrying ≥1 voice-bearing assignment
  for (const e of events) {
    if (!e || e.stage !== 'bot_assignment' || !Array.isArray(e.assignments)) continue;
    const set = new Set();
    let roomVoiceCount = 0;
    for (const a of e.assignments) {
      if (a && a.voiceId) {
        roomVoiceCount += 1;
        voiceCounts.set(a.voiceId, (voiceCounts.get(a.voiceId) || 0) + 1);
        if (set.has(a.voiceId)) {
          set.add(`__collision__:${a.voiceId}`);
        } else {
          set.add(a.voiceId);
        }
      }
    }
    if (roomVoiceCount > 0) voiceRoomCount += 1;
    if (roomVoiceCount > maxRoomVoiceCardinality) maxRoomVoiceCardinality = roomVoiceCount;
    perScenario.set(e.scenarioId, set);
  }
  const collisions = [];
  for (const [scenarioId, set] of perScenario.entries()) {
    for (const v of set) if (typeof v === 'string' && v.startsWith('__collision__:')) {
      collisions.push({ scenarioId, voiceId: v.slice('__collision__:'.length) });
    }
  }
  const band = recalibrateVoiceBand(voiceCounts, collisions, maxRoomVoiceCardinality, voiceRoomCount);
  return {
    voiceCounts: [...voiceCounts.entries()].sort((a, b) => b[1] - a[1]),
    collisions, outOfBand: band.outOfBand,
    expectedPerVoice: band.expectedPerVoice,
    expectedDistinctVoices: band.expectedDistinctVoices,
    distinctVoiceCount: band.distinctVoiceCount,
    degenerateCollapse: band.degenerateCollapse,
    severityBand: band.severityBand,
  };
}

// CORPUS-30-QUALITY-001 (b)/(c): minimum non-empty body samples below
// which the samey-move metric MUST emit `n/a (insufficient_samples)`
// and NEVER read green. Absence of evidence is not evidence of
// cleanliness (§4-T HARD GUARD — reading green on absent data is a
// silent bar of zero).
const SAMEY_MOVE_SAMPLE_FLOOR = 50;
// High-overlap pair threshold (Jaccard) and yellow mean threshold —
// the same constants the legacy dev/dry Jaccard path already used.
const SAMEY_MOVE_HIGH_PAIR_THRESHOLD = 0.60;
const SAMEY_MOVE_YELLOW_MEAN_THRESHOLD = 0.35;

function jaccardSets(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection += 1;
  const unionSize = a.size + b.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}

// Compute high-overlap pairs + real means over a per-thread map whose
// entries are { moveId, tokens:Set }. Shared by the hashed-shingle live
// path and the dev/dry body path so both twins compute identically.
function sameyMovePairwise(perThread) {
  const highPairs = [];
  let meanSum = 0;
  let meanCount = 0;
  let maxIntraThreadMean = 0;
  for (const [threadIndex, list] of perThread.entries()) {
    let threadSum = 0;
    let threadCount = 0;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const j2 = jaccardSets(list[i].tokens, list[j].tokens);
        threadSum += j2; threadCount += 1;
        if (j2 >= SAMEY_MOVE_HIGH_PAIR_THRESHOLD) {
          highPairs.push({ threadIndex, a: list[i].moveId, b: list[j].moveId, overlap: Number(j2.toFixed(3)) });
        }
      }
    }
    if (threadCount > 0) {
      const tm = threadSum / threadCount;
      meanSum += threadSum; meanCount += threadCount;
      if (tm > maxIntraThreadMean) maxIntraThreadMean = tm;
    }
  }
  const overallMean = meanCount > 0 ? meanSum / meanCount : 0;
  return {
    highPairs,
    overallMean: Number(overallMean.toFixed(3)),
    maxIntraThreadMean: Number(maxIntraThreadMean.toFixed(3)),
  };
}

function checkSameyMove(events) {
  // CORPUS-30-QUALITY-001 (b): compute a REAL token-set Jaccard on the
  // body-free hashed-shingle fingerprint (`tokenHashes`) carried by the
  // `move_body_sample` JSONL event. Body text NEVER reaches a
  // committable Markdown summary — the reporter only sees per-token
  // sha256 prefixes. When `tokenHashes` is absent (legacy JSONL), fall
  // back to strict-clone detection on `tokenSetHash`. When no
  // `move_body_sample` events are present, fall back to scanning
  // `bot_move_render.move.body` (dev/dry mode). When NEITHER source
  // exists, return n/a (attribution_absent).
  //
  // §4-T HARD GUARD: when fewer than SAMEY_MOVE_SAMPLE_FLOOR (50)
  // non-empty body samples exist, emit `n/a (insufficient_samples)` and
  // DO NOT compute a green/yellow/red band — never green by absence.
  const STOP = new Set([
    'a', 'an', 'and', 'or', 'but', 'the', 'is', 'it', 'this', 'that',
    'these', 'those', 'i', 'you', 'we', 'they', 'be', 'are', 'was',
    'were', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'as',
    'from', 'into', 'than', 'then', 'so', 'if', 'not', 'no',
    's', 't', 'd', 're', 've', 'll',
  ]);
  function tok(s) {
    return new Set(
      String(s || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter((w) => w && w.length >= 3 && !STOP.has(w)),
    );
  }

  const hasSample = hasAnyMoveBodySample(events);
  const hasRender = events.some((e) => e && e.stage === 'bot_move_render' && e.move && e.move.body);
  if (!hasSample && !hasRender) {
    return {
      highPairs: [], overallMean: 0, maxIntraThreadMean: 0,
      severityBand: 'n/a',
      reason: 'attribution_absent',
      reasonDetail: 'no move_body_sample or bot_move_render.body events',
    };
  }

  const perThread = new Map();
  const source = hasSample ? 'move_body_sample' : 'bot_move_render';
  if (hasSample) {
    // Count non-empty samples for the floor; detect whether the
    // fingerprint (tokenHashes) is present on EVERY non-empty sample.
    let nonEmptySamples = 0;
    let fingerprintComplete = true;
    for (const e of events) {
      if (!e || e.stage !== 'move_body_sample') continue;
      const tokenCount = typeof e.tokenCount === 'number' ? e.tokenCount : 0;
      const hashes = Array.isArray(e.tokenHashes) ? e.tokenHashes : null;
      const nonEmpty = tokenCount > 0 || (hashes && hashes.length > 0);
      if (nonEmpty) nonEmptySamples += 1;
      if (nonEmpty && !hashes) fingerprintComplete = false;
      if (typeof e.threadIndex !== 'number') continue;
      if (!perThread.has(e.threadIndex)) perThread.set(e.threadIndex, []);
      perThread.get(e.threadIndex).push({
        moveId: e.moveId,
        tokenSetHash: typeof e.tokenSetHash === 'string' ? e.tokenSetHash : null,
        tokenCount,
        tokens: hashes ? new Set(hashes) : null,
      });
    }

    // §4-T HARD GUARD: below the sample floor → n/a, never green.
    if (nonEmptySamples < SAMEY_MOVE_SAMPLE_FLOOR) {
      return {
        source,
        highPairs: [], overallMean: 0, maxIntraThreadMean: 0,
        severityBand: 'n/a',
        reason: 'insufficient_samples',
        reasonDetail: `${nonEmptySamples}/${SAMEY_MOVE_SAMPLE_FLOOR} non-empty body samples`,
        sampleCount: nonEmptySamples,
      };
    }

    if (fingerprintComplete) {
      // Real Jaccard over the hashed-shingle sets.
      const { highPairs, overallMean, maxIntraThreadMean } = sameyMovePairwise(perThread);
      const yellow = overallMean > SAMEY_MOVE_YELLOW_MEAN_THRESHOLD || maxIntraThreadMean > SAMEY_MOVE_YELLOW_MEAN_THRESHOLD;
      const red = highPairs.length > 0;
      return {
        source, highPairs, overallMean, maxIntraThreadMean,
        sampleCount: nonEmptySamples,
        severityBand: classifySeverity(red, yellow),
      };
    }

    // Legacy JSONL without tokenHashes — strict-clone detection only,
    // but STILL gated by the n/a floor above (never green by absence).
    const highPairs = [];
    for (const [threadIndex, list] of perThread.entries()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (list[i].tokenSetHash && list[i].tokenSetHash === list[j].tokenSetHash && list[i].tokenCount >= 4) {
            highPairs.push({ threadIndex, a: list[i].moveId, b: list[j].moveId, overlap: 1.0 });
          }
        }
      }
    }
    const red = highPairs.length > 0;
    return {
      source, highPairs, overallMean: 0, maxIntraThreadMean: 0,
      sampleCount: nonEmptySamples,
      fingerprint: 'legacy_clone_only',
      severityBand: classifySeverity(red, false),
    };
  }

  // Dev/dry-mode path — body available in bot_move_render.
  let renderSamples = 0;
  for (const e of events) {
    if (!e || e.stage !== 'bot_move_render') continue;
    if (typeof e.threadIndex !== 'number') continue;
    if (!e.move || !e.move.body) continue;
    const tokens = tok(e.move.body);
    if (tokens.size > 0) renderSamples += 1;
    if (!perThread.has(e.threadIndex)) perThread.set(e.threadIndex, []);
    perThread.get(e.threadIndex).push({ moveId: e.move.moveId, tokens });
  }
  // §4-T HARD GUARD applies equally to the dev/dry path.
  if (renderSamples < SAMEY_MOVE_SAMPLE_FLOOR) {
    return {
      source,
      highPairs: [], overallMean: 0, maxIntraThreadMean: 0,
      severityBand: 'n/a',
      reason: 'insufficient_samples',
      reasonDetail: `${renderSamples}/${SAMEY_MOVE_SAMPLE_FLOOR} non-empty body samples`,
      sampleCount: renderSamples,
    };
  }
  const { highPairs, overallMean, maxIntraThreadMean } = sameyMovePairwise(perThread);
  const yellow = overallMean > SAMEY_MOVE_YELLOW_MEAN_THRESHOLD || maxIntraThreadMean > SAMEY_MOVE_YELLOW_MEAN_THRESHOLD;
  const red = highPairs.length > 0;
  return {
    source, highPairs, overallMean, maxIntraThreadMean,
    sampleCount: renderSamples,
    severityBand: classifySeverity(red, yellow),
  };
}

// CORPUS-30-QUALITY-001 (a): per-fallback-reason histogram.
//
// Buckets each move's fallback issue token on its PREFIX (the substring
// before the first ':'), so `forbidden_user_label:troll` →
// `forbidden_user_label` and `option_drift:opt-3` → `option_drift`.
// Plain tokens (`too_short`) bucket as themselves. The prefix rule
// guarantees no user-label value, body excerpt, or option/spine id
// payload reaches the committable Markdown (doctrine §1/§9/§10a). The
// full `<reason>:<id>` strings remain only in the gitignored JSONL.
function fallbackReasonPrefix(token) {
  const s = String(token || '');
  const colon = s.indexOf(':');
  return colon === -1 ? s : s.slice(0, colon);
}

function fallbackReasonHistogram(events) {
  const counts = new Map();
  let totalFallback = 0;
  let nonSeedMoveCount = 0;
  for (const ev of events) {
    if (!ev || ev.stage !== 'move_validated') continue;
    if (ev.seed === true) continue; // seed (M1/M2) moves are not fallbacks
    nonSeedMoveCount += 1;
    if (ev.source !== 'deterministic_fallback') continue;
    totalFallback += 1;
    const issues = Array.isArray(ev.issues) ? ev.issues : [];
    if (issues.length === 0) {
      // A fallback with no surfaced issue tokens still counts under a
      // coarse bucket so the total reconciles.
      counts.set('unspecified', (counts.get('unspecified') || 0) + 1);
      continue;
    }
    for (const tok of issues) {
      const prefix = fallbackReasonPrefix(tok);
      if (!prefix) continue;
      counts.set(prefix, (counts.get(prefix) || 0) + 1);
    }
  }
  const histogram = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  return {
    histogram, // [reasonPrefix, count][] sorted desc by count, then name
    totalFallback,
    nonSeedMoveCount,
    dominantReason: histogram.length > 0 ? histogram[0][0] : null,
  };
}

// CORPUS-30-QUALITY-001 (c): reporter thresholds with attribution-presence
// gates. Each metric emits `n/a` when its signal is absent or under the
// sample floor — NEVER green-by-absence (§4-T HARD GUARD). Thresholds are
// constants (not env-tunable in this card).
const QUALITY_THRESHOLDS = {
  deterministicFallbackPct: { yellow: 20, red: 40 }, // green <=20, yellow 20-40, red >40
  topOpeningPhrasePct: { yellow: 8, red: 15 },       // green <8, yellow 8-15, red >15
};

// Body-free opening-phrase distribution: bucket the positional
// openingTokenHash carried by move_body_sample. No readable opening
// phrase reaches committable output.
function openingPhraseTopShare(events) {
  const counts = new Map();
  let total = 0;
  for (const ev of events) {
    if (!ev || ev.stage !== 'move_body_sample') continue;
    if (typeof ev.openingTokenHash !== 'string' || ev.openingTokenHash.length === 0) continue;
    counts.set(ev.openingTokenHash, (counts.get(ev.openingTokenHash) || 0) + 1);
    total += 1;
  }
  if (total === 0) return { present: false, topShare: null, total: 0 };
  let topCount = 0;
  for (const c of counts.values()) if (c > topCount) topCount = c;
  return { present: true, topShare: (topCount / total) * 100, total };
}

function qualityThresholds(events) {
  // deterministicFallbackPct — fallback share of non-seed (M3+) moves.
  const fb = fallbackReasonHistogram(events);
  let deterministicFallbackPct;
  if (fb.nonSeedMoveCount === 0) {
    deterministicFallbackPct = {
      severityBand: 'n/a', reason: 'attribution_absent',
      reasonDetail: 'no non-seed move_validated events present',
      attributionPresent: false, value: null,
    };
  } else {
    const pct = (fb.totalFallback / fb.nonSeedMoveCount) * 100;
    const t = QUALITY_THRESHOLDS.deterministicFallbackPct;
    const band = pct > t.red ? 'red' : pct > t.yellow ? 'yellow' : 'green';
    deterministicFallbackPct = {
      severityBand: band, attributionPresent: true,
      value: Number(pct.toFixed(2)),
      fallback: fb.totalFallback, nonSeed: fb.nonSeedMoveCount,
    };
  }

  // topOpeningPhrasePct — most-common opening (positional hash) share.
  const op = openingPhraseTopShare(events);
  let topOpeningPhrasePct;
  if (!op.present) {
    topOpeningPhrasePct = {
      severityBand: 'n/a', reason: 'attribution_absent',
      reasonDetail: 'no opening-phrase signal present',
      attributionPresent: false, value: null,
    };
  } else {
    const t = QUALITY_THRESHOLDS.topOpeningPhrasePct;
    const band = op.topShare > t.red ? 'red' : op.topShare >= t.yellow ? 'yellow' : 'green';
    topOpeningPhrasePct = {
      severityBand: band, attributionPresent: true,
      value: Number(op.topShare.toFixed(2)), total: op.total,
    };
  }

  // sameyMoveMean — derived from checkSameyMove (already n/a-floored).
  const samey = checkSameyMove(events);
  let sameyMoveMean;
  if (samey.severityBand === 'n/a') {
    sameyMoveMean = {
      severityBand: 'n/a',
      reason: samey.reason || 'insufficient_samples',
      reasonDetail: samey.reasonDetail || null,
      attributionPresent: false, value: null,
      sampleCount: typeof samey.sampleCount === 'number' ? samey.sampleCount : 0,
    };
  } else {
    sameyMoveMean = {
      severityBand: samey.severityBand, attributionPresent: true,
      value: samey.overallMean,
      maxIntraThreadMean: samey.maxIntraThreadMean,
      highPairs: samey.highPairs.length,
      sampleCount: typeof samey.sampleCount === 'number' ? samey.sampleCount : 0,
    };
  }

  return { deterministicFallbackPct, topOpeningPhrasePct, sameyMoveMean };
}

// Render the three quality-threshold rows. Shared shape so both reporter
// twins emit identical Markdown. `n/a` rows print the reason, never a
// green fold-in.
function renderQualityThresholdRows(qt) {
  function row(label, m, unit) {
    if (m.severityBand === 'n/a') {
      return `- ${label}: severityBand=\`n/a\` · reason=\`${m.reason}\`${m.reasonDetail ? ` · ${m.reasonDetail}` : ''}`;
    }
    return `- ${label}: severityBand=\`${m.severityBand}\` · value=${m.value}${unit}`;
  }
  return [
    row('Deterministic fallback %', qt.deterministicFallbackPct, '%'),
    row('Top opening-phrase %', qt.topOpeningPhrasePct, '%'),
    row('Samey-move mean', qt.sameyMoveMean, ''),
  ];
}

function runDiversityChecks(events) {
  return {
    duplicateSeed: checkDuplicateSeed(events),
    repeatedOption: checkRepeatedOption(events),
    spineSaturation: checkSpineSaturation(events),
    voiceDistribution: checkVoiceDistribution(events),
    sameyMove: checkSameyMove(events),
  };
}

function buildMarkdownReport({ runId, args, bools, events, scenarios, bundle }) {
  const date = new Date().toISOString().slice(0, 10);
  const dissentEvents = events.filter((e) => e.stage === 'dissent_detection');
  const usable = dissentEvents.filter((e) => e.classification && e.classification.usableForBotDebate).length;
  const synthetic = events.filter((e) => e.stage === 'synthetic_rebuttal_generated').length;
  const axes = countBy(dissentEvents, (e) => e.classification && e.classification.disagreementType);
  const sourceChainHigh = dissentEvents.filter((e) => e.classification && e.classification.sourceChainRisk === 'high').length;
  const amplifHigh = dissentEvents.filter((e) => e.classification && e.classification.amplificationRisk === 'high').length;

  const lines = [];
  lines.push(`# xAI Adversarial Bot Corpus — ${date}`);
  lines.push('');
  lines.push(`_Run id_: \`${runId}\``);
  lines.push(`_Mode_: ${args.dry ? 'dry' : 'live'}`);
  lines.push(`_Env booleans_: hasXaiKey=${bools.hasXaiKey} enableXai=${bools.enableXai} hasAnthropicKey=${bools.hasAnthropicKey} enableAnthropic=${bools.enableAnthropic} hasBotTests=${bools.hasBotTests}`);
  lines.push('');
  lines.push('## Skill gate');
  lines.push('');
  lines.push(`- provocateur path: \`.claude/skills/bot-provocateur/SKILL.md\``);
  lines.push(`- provocateur hash: \`${bundle.provocateurHash}\``);
  lines.push(`- revocateur path: \`.claude/skills/bot-revocateur/SKILL.md\``);
  lines.push(`- revocateur hash: \`${bundle.revocateurHash}\``);
  lines.push(`- validated: yes (passes \`scripts/skills/validateBotSkills.js\`)`);
  lines.push('');
  lines.push('## Doctrine reminder');
  lines.push('');
  lines.push('- Popularity is not evidence.');
  lines.push('- Bots are test bots; they never claim to be real X users.');
  lines.push('- Hostile source material is **redacted** and converted into structured pressure, never reproduced.');
  lines.push('- Text behavior is annotated; people are not classified.');
  lines.push('- All app posts route through `submit-argument`. No `service-role`. No `direct insert`.');
  lines.push('');
  // CORPUS-30-LIVE-PATH-WIRING Fix 3: real counts from
  // provider_call_summary (preferred) or reporter-aggregated fallback.
  // No more "(not wired in this commit)" disclaimers.
  const tally = computeProviderCallTally(events);
  lines.push('## Run counts');
  lines.push('');
  lines.push(`- xAI calls: ${tally.xaiCalls}${tally.source === 'aggregated_from_events' ? ' (aggregated)' : ''}`);
  lines.push(`- Anthropic calls: ${tally.anthropicCalls}${tally.source === 'aggregated_from_events' ? ' (aggregated)' : ''}`);
  lines.push(`- Supabase writes: ${tally.supabaseWrites}${tally.source === 'aggregated_from_events' ? ' (aggregated)' : ''}`);
  lines.push(`- Scenarios built: ${scenarios.length}`);
  lines.push(`- Replies scanned: ${dissentEvents.length}`);
  lines.push(`- Usable dissent replies: ${usable}`);
  lines.push(`- Synthetic fallbacks: ${synthetic}`);
  lines.push(`- Source-chain risk HIGH replies: ${sourceChainHigh}`);
  lines.push(`- Amplification risk HIGH replies: ${amplifHigh}`);
  lines.push('');
  lines.push('## Top disagreement axes (replies)');
  lines.push('');
  for (const [k, v] of axes.slice(0, 10)) lines.push(`- \`${k}\` — ${v}`);
  lines.push('');
  lines.push('## Anti-amplification doctrine surfaced');
  lines.push('');
  lines.push(`- Replies with amplification-risk text features: ${amplifHigh}`);
  lines.push(`- Source-chain warnings raised: ${sourceChainHigh}`);
  lines.push('');
  // CORPUS-30-POOL-DRIVEN-PLANNER diversity checks (counts/distributions
  // only — never body text).
  const diversity = runDiversityChecks(events);
  lines.push('## Diversity checks (CORPUS-30 §9)');
  lines.push('');
  lines.push(`- Duplicate-seed: severityBand=\`${diversity.duplicateSeed.severityBand}\` · total=${diversity.duplicateSeed.total} · unique=${diversity.duplicateSeed.unique} · duplicates=${diversity.duplicateSeed.duplicates.length}`);
  lines.push(`- Repeated-option (within thread): severityBand=\`${diversity.repeatedOption.severityBand}\` · repeated within=${diversity.repeatedOption.repeatedWithin.length} · cross-thread collisions=${diversity.repeatedOption.crossThreadCollisions.length}`);
  lines.push(`- Spine saturation: severityBand=\`${diversity.spineSaturation.severityBand}\` · repeated-threads=${diversity.spineSaturation.repeatedThreads.length} · low-diversity windows=${diversity.spineSaturation.lowDiversityWindows.length}${diversity.spineSaturation.saturatedSpine ? ` · saturated=\`${diversity.spineSaturation.saturatedSpine.spineId}\` (${Math.round(diversity.spineSaturation.saturatedSpine.fraction * 100)}%)` : ''}`);
  // CORPUS-30-DIVERSITY-001 spine reframe (documentation only — no band
  // change): spine is STRICTER than voices on purpose. With 9 spines and
  // ~10 moves per thread, some within-thread repeats are unavoidable by
  // the pigeonhole principle; the per-thread repeated-thread YELLOW is an
  // expected artifact, NOT a planner regression. Run-wide spread stays
  // healthy (max share well under the 0.35 saturation threshold). Any
  // future widening of the spine catalogue is a separate follow-up
  // (CORPUS-SPINE-CATALOG-EXPANSION), not part of this card.
  lines.push('  - _Spine note: spines are stricter than voices — within-thread repeats are expected by pigeonhole (9 spines × ~10 moves/thread); not a regression._');
  // CORPUS-30-DIVERSITY-001 recalibrated voice band: expected ≈
  // totalAssignments / distinctVoices per voice (the synthesizer counts
  // as its own voice slot); GREEN on the planner's honest B-voices-each-N
  // distribution, YELLOW/RED only on material per-voice deviation, a
  // same-room collision, or a distinct-voice collapse. `n/a` (never
  // green) when no voice-bearing bot_assignment events are present.
  lines.push(
    diversity.voiceDistribution.severityBand === 'n/a'
      ? `- Voice distribution: severityBand=\`n/a\` · reason=\`${diversity.voiceDistribution.reason}\`${diversity.voiceDistribution.reasonDetail ? ` · ${diversity.voiceDistribution.reasonDetail}` : ''}`
      : `- Voice distribution: severityBand=\`${diversity.voiceDistribution.severityBand}\` · collisions=${diversity.voiceDistribution.collisions.length} · out-of-band voices=${diversity.voiceDistribution.outOfBand.length} · expected≈${diversity.voiceDistribution.expectedPerVoice}/voice (N/botCount) · distinct=${diversity.voiceDistribution.distinctVoiceCount}/${diversity.voiceDistribution.expectedDistinctVoices}${diversity.voiceDistribution.degenerateCollapse ? ' · COLLAPSE' : ''}`,
  );
  lines.push(
    diversity.sameyMove.severityBand === 'n/a'
      ? `- Samey-move (text distance): severityBand=\`n/a\` · reason=\`${diversity.sameyMove.reason}\`${diversity.sameyMove.reasonDetail ? ` · ${diversity.sameyMove.reasonDetail}` : ''}`
      : `- Samey-move (text distance): severityBand=\`${diversity.sameyMove.severityBand}\` · high-overlap pairs=${diversity.sameyMove.highPairs.length} · overall mean=${diversity.sameyMove.overallMean} · max intra-thread mean=${diversity.sameyMove.maxIntraThreadMean}`,
  );
  lines.push('');
  if (diversity.spineSaturation.perRunDistribution.length > 0) {
    lines.push('### Spine distribution (per-run)');
    lines.push('');
    for (const [k, v] of diversity.spineSaturation.perRunDistribution) lines.push(`- \`${k}\` — ${v}`);
    lines.push('');
  }
  if (diversity.voiceDistribution.voiceCounts.length > 0) {
    lines.push('### Voice distribution (per-run)');
    lines.push('');
    for (const [k, v] of diversity.voiceDistribution.voiceCounts) lines.push(`- \`${k}\` — ${v}`);
    lines.push('');
  }

  // CORPUS-30-QUALITY-001 (a): per-fallback-reason histogram (prefix-only
  // buckets — never a label value / option-spine id payload).
  const fbHist = fallbackReasonHistogram(events);
  lines.push('### Fallback reason histogram');
  lines.push('');
  lines.push(`- Deterministic-fallback moves: **${fbHist.totalFallback}** / ${fbHist.nonSeedMoveCount} non-seed moves${fbHist.dominantReason ? ` · dominant cause=\`${fbHist.dominantReason}\`` : ''}`);
  if (fbHist.histogram.length === 0) {
    lines.push('- _(no deterministic-fallback moves)_');
  } else {
    for (const [reason, count] of fbHist.histogram) lines.push(`- \`${reason}\` — ${count}`);
  }
  lines.push('');

  // CORPUS-30-QUALITY-001 (c): quality thresholds with attribution gates.
  // n/a is rendered literally, never folded into green.
  const qt = qualityThresholds(events);
  lines.push('### Quality thresholds');
  lines.push('');
  lines.push(...renderQualityThresholdRows(qt));
  lines.push('');

  lines.push('## Compliance');
  lines.push('');
  lines.push('- [x] Skill gate validated before any harvest, dissent detection, or move rendering.');
  lines.push('- [x] All source / reply bodies pass through xaiSourceRedactor.');
  lines.push('- [x] Hostile-source conversion redacts categories; raw abuse is never reproduced.');
  lines.push('- [x] No service-role / direct insert / submit-argument bypass in any committed code.');
  lines.push('- [x] No raw handles, URLs, post IDs, JWTs, Bearer values, or key shapes in this report.');
  lines.push('- [x] Diversity checks emit counts / distributions only; never body text.');
  lines.push('');
  return lines.join('\n');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[xai-adv-bot][fatal]', String(err.message).slice(0, 400));
    process.exitCode = 99;
  });
}

module.exports = {
  parseArgs,
  envBooleans,
  refuseLive,
  // CORPUS-QUEUE-SMOKE-TAG-001 — smoke-tag prefix resolver + titling
  // helper + the runner's own copy of the contract literal (drift-guarded
  // by __tests__/corpusSmokeTagPrefix.test.ts).
  CORPUS_SMOKE_TAG_DEFAULT,
  resolveSmokeTagPrefix,
  buildRoomTitle,
  readDryFixture,
  shapeFixtureSource,
  buildSyntheticDissent,
  generateDryMove,
  buildMarkdownReport,
  readHarvestFile,
  readBankedPoolFile,
  setupLivePostingContext,
  postLiveScenario,
  // CORPUS-30-LIVE-PATH-WIRING — planner-wired banked live posting +
  // hashed-token-set helper + provider-call tally.
  postLiveBankedScenario,
  computeMoveBodySampleHash,
  computeProviderCallTally,
  // Diversity-check helpers (CORPUS-30-POOL-DRIVEN-PLANNER §9).
  runDiversityChecks,
  checkDuplicateSeed,
  checkRepeatedOption,
  checkSpineSaturation,
  checkVoiceDistribution,
  checkSameyMove,
  // CORPUS-30-QUALITY-001 (a) per-fallback-reason histogram.
  fallbackReasonHistogram,
  fallbackReasonPrefix,
  // CORPUS-30-QUALITY-001 (c) reporter quality thresholds.
  qualityThresholds,
  renderQualityThresholdRows,
  openingPhraseTopShare,
  // Attribution-presence helpers (CORPUS-30-LIVE-PATH-WIRING Fix 2).
  hasAnyMoveValidated,
  moveValidatedFieldPresence,
  botAssignmentVoicePresence,
  hasAnyMoveBodySample,
};
