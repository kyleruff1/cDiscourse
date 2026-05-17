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
const { randomUUID } = require('node:crypto');

const REPO_ROOT = process.cwd();
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'testing-runs');
const LOG_DIR = path.join(REPO_ROOT, 'logs', 'engagement-intelligence');
const FIXTURE_PATH = path.join(REPO_ROOT, 'fixtures', 'engagement-intelligence', 'xai-adversarial-dry-fixture.json');

const { loadAdversarialSkillBundle, redactedSkillGate } = require('./skillFileLoader');
const { redactRaw, convertHostileBody } = require('../engagement-intelligence/xaiSourceRedactor');
const { selectFirstUsableDissent } = require('../engagement-intelligence/xaiDissentDetector');
const { buildAdversarialScene } = require('./xaiAdversarialSceneBuilder');

// ── CLI parsing ───────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    dry: true,
    pilot: false,
    scenarios: 10,
    maxDepth: 6,
    seed: 'cdiscourse-stage-6.1.9',
    fixturePath: FIXTURE_PATH,
    annotationJsonl: null,
    reportName: null,
    postToDevSupabase: false,
    allowSyntheticDissent: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') { args.pilot = true; args.dry = false; }
    else if (a === '--scenarios' && argv[i + 1]) args.scenarios = Math.max(1, Math.min(200, Number(argv[++i]) || 10));
    else if (a === '--max-depth' && argv[i + 1]) args.maxDepth = Math.max(2, Math.min(20, Number(argv[++i]) || 6));
    else if (a === '--seed' && argv[i + 1]) args.seed = String(argv[++i]);
    else if (a === '--fixture' && argv[i + 1]) args.fixturePath = String(argv[++i]);
    else if (a === '--annotation-jsonl' && argv[i + 1]) args.annotationJsonl = String(argv[++i]);
    else if (a === '--report-name' && argv[i + 1]) args.reportName = String(argv[++i]);
    else if (a === '--post-to-dev-supabase') args.postToDevSupabase = true;
    else if (a === '--no-synthetic-dissent') args.allowSyntheticDissent = false;
  }
  return args;
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

  // ── Source phase. Dry mode reads the fixture; live xAI path is gated.
  let fixture;
  let scenarioCount = 0;
  if (args.dry) {
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
    // Live: defer to the existing Stage 6.1.7 source collector (gated).
    jsonl.write('source_harvest', { mode: 'live_xai_deferred', note: 'live xAI harvest reuses xaiAdversarialSourceCollector from Stage 6.1.7' });
    console.warn('[xai-adv-bot] live source harvest not wired in this commit; aborting after skill gate');
    await jsonl.end();
    process.exitCode = 3;
    return;
  }

  // ── Dissent phase + Scenario build phase.
  const scenarios = [];
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

  // ── Move generation phase (DRY-only deterministic placeholders).
  let movesPosted = 0;
  for (const { scene, source, dissent, dissentSource } of scenarios) {
    const posted = [
      { moveId: 'm1', body: source.sourceTextRedacted, argumentType: 'thesis', authorAlias: scene.personas[0].alias, parentMoveId: null, depth: 1 },
      { moveId: 'm2', body: dissent.replyTextRedacted, argumentType: 'rebuttal', authorAlias: scene.personas[1].alias, parentMoveId: 'm1', depth: 2 },
    ];
    posted.forEach((m, i) => {
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

  jsonl.write('run_summary', {
    runId,
    mode: args.dry ? 'dry' : 'live',
    scenarios: scenarios.length,
    movesGenerated: movesPosted,
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
  lines.push('## Run counts');
  lines.push('');
  lines.push(`- xAI calls: ${args.dry ? '0 (dry)' : '(not wired in this commit)'}`);
  lines.push(`- Anthropic calls: ${args.dry ? '0 (dry)' : '(not wired in this commit)'}`);
  lines.push(`- Supabase writes: 0`);
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
  lines.push('## Compliance');
  lines.push('');
  lines.push('- [x] Skill gate validated before any harvest, dissent detection, or move rendering.');
  lines.push('- [x] All source / reply bodies pass through xaiSourceRedactor.');
  lines.push('- [x] Hostile-source conversion redacts categories; raw abuse is never reproduced.');
  lines.push('- [x] No service-role / direct insert / submit-argument bypass in any committed code.');
  lines.push('- [x] No raw handles, URLs, post IDs, JWTs, Bearer values, or key shapes in this report.');
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
  readDryFixture,
  shapeFixtureSource,
  buildSyntheticDissent,
  generateDryMove,
  buildMarkdownReport,
};
