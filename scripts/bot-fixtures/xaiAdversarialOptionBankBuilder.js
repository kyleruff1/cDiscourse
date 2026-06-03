#!/usr/bin/env node
/**
 * CORPUS-30-POOL-DRIVEN-PLANNER — deterministic option-bank post-processor.
 *
 * Reads the harvester JSONL (one `scenario_build` event per source) and
 * emits a pool JSONL where each seed carries six option banks derived
 * deterministically from:
 *
 *   - the harvester's selectedDissent.playableSkeleton (the primary
 *     dissent anchor),
 *   - candidateReplies grouped by replyFunction (the deterministic
 *     classifier output: ask_source, ask_quote, ask_definition,
 *     counterexample, narrow_scope, rebut, support, caveat, tangent,
 *     insult_only, unclear),
 *   - fixed paraphrase / template rules that ensure each bank reaches
 *     its floor without provider calls.
 *
 * The output is plain JSON Lines; one `seed` event per seed plus a
 * single `pool_summary` event at the end. Per design §4.1 every seed
 * is shaped:
 *
 *   {
 *     event: 'seed',
 *     seedId, sourceHash, claimSummary, issueFrame,
 *     banks: { opening_claim_options: [...], objection_options: [...],
 *              evidence_pressure_options: [...],
 *              alternative_explanation_options: [...],
 *              concession_or_narrowing_options: [...],
 *              resolution_pressure_options: [...] },
 *     bankShortfall: false,
 *     bankCounts: { ... },
 *   }
 *
 * Per Option:
 *
 *   {
 *     optionId, bankName,
 *     skeleton: { targetExcerpt, spineHint, axisHint, summary,
 *                 evidenceDebt: [...], antiAmplificationNote },
 *     provenance: 'harvester_post_processed' | 'paraphrase_rule' |
 *                 'synthetic_default'
 *   }
 *
 * No xAI / Anthropic / network call. Pure node + crypto.
 *
 * CLI:
 *   node xaiAdversarialOptionBankBuilder.js \
 *      --in <harvest.jsonl> \
 *      --out <pool.jsonl> \
 *      [--target-count 30]
 *
 * Exits:
 *   0 — wrote the pool successfully
 *   2 — invalid CLI args
 *   3 — input unreadable / empty
 *   4 — fewer eligible seeds than --target-count (warning, still writes)
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const { redactRaw } = require('../engagement-intelligence/xaiSourceRedactor');
const { BANK_FLOORS, ALL_BANK_NAMES, SPINES } = require('./corpusPoolDrivenPlannerConstants');

// ── Helpers ────────────────────────────────────────────────────────

function sha256Hex(s) {
  return createHash('sha256').update(String(s)).digest('hex');
}

function clamp(s, n) {
  return String(s || '').slice(0, n).trim();
}

function squish(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * Stable seedId from sourceHash + claim summary. 16 hex chars.
 */
function deriveSeedId(sourceHash, claimSummary) {
  return sha256Hex(`${sourceHash}::${claimSummary}`).slice(0, 16);
}

/**
 * Stable optionId from seedId + bankName + skeleton summary + spine.
 * 12 hex chars.
 */
function deriveOptionId(seedId, bankName, summary, spineHint) {
  return sha256Hex(`${seedId}::${bankName}::${summary}::${spineHint}`).slice(0, 12);
}

// ── Reply-function adapter ────────────────────────────────────────
//
// The deterministic classifier in xaiDissentDetector.js emits a smaller
// vocabulary than the design's §4.2 routing references. The mapping
// below is the conservative bridge between them. We keep design-level
// labels in the skeleton.summary text so reporter output stays readable.

const REPLY_FUNCTION_TO_BANKS = {
  // ask_source → evidence_pressure (and opening_claim restatement family)
  ask_source: ['evidence_pressure_options'],
  ask_quote: ['evidence_pressure_options'],
  ask_definition: ['alternative_explanation_options'],
  counterexample: ['alternative_explanation_options', 'objection_options'],
  narrow_scope: ['alternative_explanation_options', 'concession_or_narrowing_options'],
  rebut: ['objection_options'],
  // support is conceptually a restatement of the claim → opening_claim_options
  support: ['opening_claim_options'],
  caveat: ['concession_or_narrowing_options'],
  // tangent + insult_only + unclear contribute to no bank.
};

const DEFAULT_AXIS_BY_BANK = {
  opening_claim_options: 'framing',
  objection_options: 'logic',
  evidence_pressure_options: 'evidence',
  alternative_explanation_options: 'causal',
  concession_or_narrowing_options: 'scope',
  resolution_pressure_options: 'source_chain',
};

const DEFAULT_SPINE_BY_BANK = {
  opening_claim_options: 'mechanism-led',
  objection_options: 'counterexample-led',
  evidence_pressure_options: 'quote-led',
  alternative_explanation_options: 'analogy-led',
  concession_or_narrowing_options: 'scope-led',
  resolution_pressure_options: 'second-order-effect-led',
};

// ── Paraphrase / template rules per bank ──────────────────────────

/**
 * Build the four canonical openings of the seed claim:
 *   - direct assertion
 *   - conditional (if-then) framing
 *   - comparative framing
 *   - scope-bounded framing
 */
function openingClaimParaphrases(claim) {
  const c = squish(claim);
  return [
    {
      kind: 'assertion',
      summary: clamp(c, 180),
      antiAmplificationNote: 'mechanism stated up front, not the slogan',
    },
    {
      kind: 'conditional',
      summary: clamp(`If the mechanism behind "${clamp(c, 80)}" holds, the broader form follows.`, 180),
      antiAmplificationNote: 'conditional framing — popularity is irrelevant',
    },
    {
      kind: 'comparative',
      summary: clamp(`Compared to the alternative reading, "${clamp(c, 80)}" remains the cleaner fit.`, 180),
      antiAmplificationNote: 'comparative framing — engagement is not a comparator',
    },
    {
      kind: 'scope-bounded',
      summary: clamp(`Held to its narrow form, "${clamp(c, 80)}" is what we are defending.`, 180),
      antiAmplificationNote: 'narrow form first — viral form not the burden',
    },
  ];
}

function objectionTemplates({ axis, mechanism }) {
  const baseAxis = axis || 'evidence';
  const baseMech = mechanism || 'the named mechanism';
  return [
    {
      summary: clamp(`Press on the ${baseAxis}: ${baseMech} is asserted, not shown.`, 180),
      axis: baseAxis,
      antiAmplificationNote: 'asserted mechanism is not a receipt',
    },
    {
      summary: clamp(`Counter-press: the broad form does not hold without the missing primary record.`, 180),
      axis: 'source_chain',
      antiAmplificationNote: 'platform reach is not a primary record',
    },
    {
      summary: clamp(`Rebut on logic: the conclusion does not follow from the stated premise.`, 180),
      axis: 'logic',
      antiAmplificationNote: 'logic gap is independent of popularity',
    },
    {
      summary: clamp(`Definition pressure: the key term is being used loosely.`, 180),
      axis: 'definition',
      antiAmplificationNote: 'definition is not negotiated by reach',
    },
  ];
}

function evidencePressureTemplates({ targetExcerpt }) {
  const ex = clamp(targetExcerpt || '', 80);
  return [
    {
      summary: clamp(`Name the primary source for the asserted mechanism.`, 180),
      axis: 'evidence',
      antiAmplificationNote: 'mechanism receipt, not engagement count',
    },
    {
      summary: clamp(`Quote the sentence — not the summary — of the report you are leaning on.${ex ? ` Anchor: "${ex}".` : ''}`, 180),
      axis: 'evidence',
      antiAmplificationNote: 'quote anchor required',
    },
    {
      summary: clamp(`Show the data, not a screenshot of a screenshot. Primary record only.`, 180),
      axis: 'source_chain',
      antiAmplificationNote: 'screenshot chains are not primary records',
    },
    {
      summary: clamp(`Receipt please — the page, the line, the table cell — anything that fixes the claim.`, 180),
      axis: 'evidence',
      antiAmplificationNote: 'fixed citation, not vibes',
    },
  ];
}

function alternativeExplanationTemplates({ axis }) {
  return [
    {
      summary: clamp(`Could also be explained by a different mechanism — name a competing one.`, 180),
      axis: 'causal',
      antiAmplificationNote: 'alt mechanism is a fair pressure',
    },
    {
      summary: clamp(`The data is equally consistent with an alternative reading.`, 180),
      axis: axis || 'logic',
      antiAmplificationNote: 'multi-fit data is not single-cause',
    },
    {
      summary: clamp(`What about the secondary factor that the headline left out?`, 180),
      axis: 'framing',
      antiAmplificationNote: 'omitted variable is not addressed',
    },
  ];
}

function concessionOrNarrowingTemplates({ axis }) {
  return [
    {
      summary: clamp(`Narrow the claim to the subset where the evidence actually fits.`, 180),
      axis: 'scope',
      antiAmplificationNote: 'narrowing is a scoring repair',
    },
    {
      summary: clamp(`I concede the narrow point about ${axis || 'scope'} while preserving the broader form.`, 180),
      axis: axis || 'scope',
      antiAmplificationNote: 'narrow concession protects the broad claim',
    },
    {
      summary: clamp(`Fair point on the edge case — the core claim still holds for the central case.`, 180),
      axis: 'scope',
      antiAmplificationNote: 'edge-case fairness is not full retreat',
    },
  ];
}

function resolutionPressureTemplates({ axis, antiAmplificationNote }) {
  return [
    {
      summary: clamp(`Synthesize: the live disagreement reduces to ${axis || 'evidence'} and is testable.`, 180),
      axis: axis || 'evidence',
      antiAmplificationNote: antiAmplificationNote || 'synthesis closes the room when the axis is named',
    },
    {
      summary: clamp(`Branch the room: the second-order effect deserves its own thread.`, 180),
      axis: 'scope',
      antiAmplificationNote: 'branching prevents tangent drift',
    },
    {
      summary: clamp(`Burden shift: the receipts are owed by the side carrying the broad form.`, 180),
      axis: 'evidence',
      antiAmplificationNote: 'burden is named, not assumed',
    },
  ];
}

// ── Per-bank derivation ──────────────────────────────────────────

function buildOpeningClaimOptions({ seedId, claimSummary, candidateReplies }) {
  const out = [];
  const paraphrases = openingClaimParaphrases(claimSummary);
  for (const p of paraphrases) {
    out.push(makeOption({
      seedId,
      bankName: 'opening_claim_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: DEFAULT_SPINE_BY_BANK.opening_claim_options,
        axisHint: DEFAULT_AXIS_BY_BANK.opening_claim_options,
        summary: p.summary,
        evidenceDebt: ['primary source for the named mechanism'],
        antiAmplificationNote: p.antiAmplificationNote,
      },
      provenance: 'paraphrase_rule',
    }));
  }
  // Add any support / restatement replies (deterministically dedup'd).
  for (const r of candidateReplies) {
    const bankList = REPLY_FUNCTION_TO_BANKS[r.replyFunction] || [];
    if (!bankList.includes('opening_claim_options')) continue;
    const text = clamp(r.redactedText, 180);
    if (!text) continue;
    out.push(makeOption({
      seedId,
      bankName: 'opening_claim_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: 'mechanism-led',
        axisHint: 'framing',
        summary: text,
        evidenceDebt: [],
        antiAmplificationNote: 'restatement — popularity not asserted',
      },
      provenance: 'harvester_post_processed',
    }));
  }
  return dedupeOptions(out);
}

function buildObjectionOptions({ seedId, playableSkeleton, candidateReplies }) {
  const out = [];
  // Primary: the harvester's playableSkeleton.
  if (playableSkeleton) {
    out.push(makeOption({
      seedId,
      bankName: 'objection_options',
      skeleton: {
        targetExcerpt: clamp(playableSkeleton.targetExcerpt, 240) || null,
        spineHint: 'mechanism-led',
        axisHint: playableSkeleton.disagreementAxis || 'logic',
        summary: clamp(playableSkeleton.mechanism, 180) || 'Press on the asserted mechanism.',
        evidenceDebt: Array.isArray(playableSkeleton.evidenceDebt) ? playableSkeleton.evidenceDebt.slice(0, 3).map((e) => clamp(e, 120)) : [],
        antiAmplificationNote: clamp(playableSkeleton.antiAmplificationNote || 'mechanism + receipt, not virality', 200),
      },
      provenance: 'harvester_post_processed',
    }));
  }
  // candidateReplies that mapped to objection_options (rebut, counterexample).
  for (const r of candidateReplies) {
    const bankList = REPLY_FUNCTION_TO_BANKS[r.replyFunction] || [];
    if (!bankList.includes('objection_options')) continue;
    const text = clamp(r.redactedText, 180);
    if (!text) continue;
    out.push(makeOption({
      seedId,
      bankName: 'objection_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: r.replyFunction === 'counterexample' ? 'counterexample-led' : 'mechanism-led',
        axisHint: pickAxisFromDisagreementType(r.disagreementType, 'logic'),
        summary: text,
        evidenceDebt: [],
        antiAmplificationNote: 'rebuttal text — not a popularity argument',
      },
      provenance: 'harvester_post_processed',
    }));
  }
  // Templates to ensure floor.
  const templates = objectionTemplates({
    axis: playableSkeleton && playableSkeleton.disagreementAxis,
    mechanism: playableSkeleton && playableSkeleton.mechanism,
  });
  for (const t of templates) {
    out.push(makeOption({
      seedId,
      bankName: 'objection_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: 'mechanism-led',
        axisHint: t.axis,
        summary: t.summary,
        evidenceDebt: ['primary source', 'quote anchor'],
        antiAmplificationNote: t.antiAmplificationNote,
      },
      provenance: 'synthetic_default',
    }));
  }
  return dedupeOptions(out);
}

function buildEvidencePressureOptions({ seedId, playableSkeleton, candidateReplies }) {
  const out = [];
  if (playableSkeleton && Array.isArray(playableSkeleton.evidenceDebt)) {
    for (const e of playableSkeleton.evidenceDebt.slice(0, 3)) {
      const text = clamp(e, 180);
      if (!text) continue;
      out.push(makeOption({
        seedId,
        bankName: 'evidence_pressure_options',
        skeleton: {
          targetExcerpt: clamp(playableSkeleton.targetExcerpt, 240) || null,
          spineHint: 'quote-led',
          axisHint: 'evidence',
          summary: `Demand: ${text}.`,
          evidenceDebt: [text],
          antiAmplificationNote: 'evidence-debt — not a popularity claim',
        },
        provenance: 'harvester_post_processed',
      }));
    }
  }
  for (const r of candidateReplies) {
    const bankList = REPLY_FUNCTION_TO_BANKS[r.replyFunction] || [];
    if (!bankList.includes('evidence_pressure_options')) continue;
    const text = clamp(r.redactedText, 180);
    if (!text) continue;
    out.push(makeOption({
      seedId,
      bankName: 'evidence_pressure_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: r.replyFunction === 'ask_quote' ? 'quote-led' : 'question-led',
        axisHint: 'evidence',
        summary: text,
        evidenceDebt: ['primary source for the asserted mechanism'],
        antiAmplificationNote: 'evidence-demand — not a popularity claim',
      },
      provenance: 'harvester_post_processed',
    }));
  }
  const templates = evidencePressureTemplates({
    targetExcerpt: playableSkeleton && playableSkeleton.targetExcerpt,
  });
  for (const t of templates) {
    out.push(makeOption({
      seedId,
      bankName: 'evidence_pressure_options',
      skeleton: {
        targetExcerpt: clamp(playableSkeleton && playableSkeleton.targetExcerpt, 240) || null,
        spineHint: 'quote-led',
        axisHint: t.axis,
        summary: t.summary,
        evidenceDebt: ['primary source', 'quote anchor'],
        antiAmplificationNote: t.antiAmplificationNote,
      },
      provenance: 'synthetic_default',
    }));
  }
  return dedupeOptions(out);
}

function buildAlternativeExplanationOptions({ seedId, playableSkeleton, candidateReplies }) {
  const out = [];
  for (const r of candidateReplies) {
    const bankList = REPLY_FUNCTION_TO_BANKS[r.replyFunction] || [];
    if (!bankList.includes('alternative_explanation_options')) continue;
    const text = clamp(r.redactedText, 180);
    if (!text) continue;
    out.push(makeOption({
      seedId,
      bankName: 'alternative_explanation_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: 'analogy-led',
        axisHint: pickAxisFromDisagreementType(r.disagreementType, 'causal'),
        summary: text,
        evidenceDebt: ['mechanism comparison'],
        antiAmplificationNote: 'alt-explanation — independent of reach',
      },
      provenance: 'harvester_post_processed',
    }));
  }
  const templates = alternativeExplanationTemplates({
    axis: playableSkeleton && playableSkeleton.disagreementAxis,
  });
  for (const t of templates) {
    out.push(makeOption({
      seedId,
      bankName: 'alternative_explanation_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: 'analogy-led',
        axisHint: t.axis,
        summary: t.summary,
        evidenceDebt: ['competing mechanism'],
        antiAmplificationNote: t.antiAmplificationNote,
      },
      provenance: 'synthetic_default',
    }));
  }
  return dedupeOptions(out);
}

function buildConcessionOrNarrowingOptions({ seedId, playableSkeleton, candidateReplies }) {
  const out = [];
  for (const r of candidateReplies) {
    const bankList = REPLY_FUNCTION_TO_BANKS[r.replyFunction] || [];
    if (!bankList.includes('concession_or_narrowing_options')) continue;
    const text = clamp(r.redactedText, 180);
    if (!text) continue;
    out.push(makeOption({
      seedId,
      bankName: 'concession_or_narrowing_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: 'concession-then-pivot',
        axisHint: 'scope',
        summary: text,
        evidenceDebt: [],
        antiAmplificationNote: 'narrowing — not a defeat, a repair',
      },
      provenance: 'harvester_post_processed',
    }));
  }
  const templates = concessionOrNarrowingTemplates({
    axis: playableSkeleton && playableSkeleton.disagreementAxis,
  });
  for (const t of templates) {
    out.push(makeOption({
      seedId,
      bankName: 'concession_or_narrowing_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: 'concession-then-pivot',
        axisHint: t.axis,
        summary: t.summary,
        evidenceDebt: [],
        antiAmplificationNote: t.antiAmplificationNote,
      },
      provenance: 'synthetic_default',
    }));
  }
  return dedupeOptions(out);
}

function buildResolutionPressureOptions({ seedId, playableSkeleton }) {
  const out = [];
  const templates = resolutionPressureTemplates({
    axis: playableSkeleton && playableSkeleton.disagreementAxis,
    antiAmplificationNote: playableSkeleton && playableSkeleton.antiAmplificationNote,
  });
  for (const t of templates) {
    out.push(makeOption({
      seedId,
      bankName: 'resolution_pressure_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: 'second-order-effect-led',
        axisHint: t.axis,
        summary: t.summary,
        evidenceDebt: [],
        antiAmplificationNote: t.antiAmplificationNote,
      },
      provenance: 'synthetic_default',
    }));
  }
  // If the harvester provided antiAmplificationNote, surface as one
  // additional "settle the source-chain first" closer.
  if (playableSkeleton && playableSkeleton.antiAmplificationNote) {
    out.push(makeOption({
      seedId,
      bankName: 'resolution_pressure_options',
      skeleton: {
        targetExcerpt: null,
        spineHint: 'second-order-effect-led',
        axisHint: 'source_chain',
        summary: clamp(`Settle the source-chain first; the rest of the room follows.`, 180),
        evidenceDebt: ['primary source'],
        antiAmplificationNote: clamp(playableSkeleton.antiAmplificationNote, 200),
      },
      provenance: 'harvester_post_processed',
    }));
  }
  return dedupeOptions(out);
}

// ── Option helpers ───────────────────────────────────────────────

function pickAxisFromDisagreementType(disagreementType, fallback) {
  // The dissent classifier emits axes that overlap our 10-axis vocab.
  // Map unknown values to the fallback.
  const known = [
    'fact', 'definition', 'causal', 'value', 'evidence', 'logic',
    'scope', 'source_chain', 'anti_amplification', 'framing',
  ];
  if (typeof disagreementType === 'string' && known.includes(disagreementType)) {
    return disagreementType;
  }
  return fallback;
}

function makeOption({ seedId, bankName, skeleton, provenance }) {
  const sk = {
    targetExcerpt: skeleton.targetExcerpt ? clamp(redactRaw(skeleton.targetExcerpt), 240) : null,
    spineHint: SPINES.includes(skeleton.spineHint) ? skeleton.spineHint : 'mechanism-led',
    axisHint: skeleton.axisHint || DEFAULT_AXIS_BY_BANK[bankName],
    summary: clamp(redactRaw(skeleton.summary), 180),
    evidenceDebt: (Array.isArray(skeleton.evidenceDebt) ? skeleton.evidenceDebt : [])
      .slice(0, 3)
      .map((e) => clamp(redactRaw(e), 120))
      .filter(Boolean),
    antiAmplificationNote: skeleton.antiAmplificationNote
      ? clamp(redactRaw(skeleton.antiAmplificationNote), 200)
      : null,
  };
  return {
    optionId: deriveOptionId(seedId, bankName, sk.summary, sk.spineHint),
    bankName,
    skeleton: sk,
    provenance,
  };
}

function dedupeOptions(options) {
  const seen = new Set();
  const out = [];
  for (const o of options) {
    if (!o || !o.optionId) continue;
    if (seen.has(o.optionId)) continue;
    if (!o.skeleton || !o.skeleton.summary) continue;
    seen.add(o.optionId);
    out.push(o);
  }
  return out;
}

// ── Seed builder ─────────────────────────────────────────────────

/**
 * Build a seed from one harvester `scenario_build` event.
 *
 * Pure function: same input always produces the same seed shape.
 */
function buildSeedFromScenarioEvent(ev) {
  if (!ev || ev.stage !== 'scenario_build') return null;
  const sourcePost = ev.sourcePost || {};
  const issueFrame = sourcePost.issueFrame || 'unknown';
  const claimSummary = clamp(redactRaw(sourcePost.redactedText || ''), 200);
  const sourceHash = ev.sourceHash || sha256Hex(claimSummary).slice(0, 16);
  const seedId = deriveSeedId(sourceHash, claimSummary);
  const playableSkeleton = (ev.selectedDissent && ev.selectedDissent.playableSkeleton) || null;
  const candidateReplies = Array.isArray(ev.candidateReplies) ? ev.candidateReplies : [];

  // Each bank derivation is independent and deterministic.
  const banks = {
    opening_claim_options: buildOpeningClaimOptions({ seedId, claimSummary, candidateReplies }),
    objection_options: buildObjectionOptions({ seedId, playableSkeleton, candidateReplies }),
    evidence_pressure_options: buildEvidencePressureOptions({ seedId, playableSkeleton, candidateReplies }),
    alternative_explanation_options: buildAlternativeExplanationOptions({ seedId, playableSkeleton, candidateReplies }),
    concession_or_narrowing_options: buildConcessionOrNarrowingOptions({ seedId, playableSkeleton, candidateReplies }),
    resolution_pressure_options: buildResolutionPressureOptions({ seedId, playableSkeleton }),
  };

  const bankCounts = {};
  const failingBanks = [];
  for (const name of ALL_BANK_NAMES) {
    bankCounts[name] = banks[name].length;
    if (banks[name].length < BANK_FLOORS[name]) failingBanks.push(name);
  }
  const bankShortfall = failingBanks.length > 0;

  return {
    event: 'seed',
    seedId,
    sourceHash,
    claimSummary,
    issueFrame,
    banks,
    bankCounts,
    bankShortfall,
    bankShortfallDetails: bankShortfall
      ? { failing: failingBanks.map((n) => ({ bank: n, count: bankCounts[n], floor: BANK_FLOORS[n] })) }
      : null,
  };
}

// ── JSONL streaming ──────────────────────────────────────────────

function readScenarioEvents(harvestPath) {
  const raw = fs.readFileSync(harvestPath, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev && ev.stage === 'scenario_build') out.push(ev);
  }
  return out;
}

function writePoolJsonl(outPath, seeds, summary) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const lines = [];
  for (const s of seeds) lines.push(JSON.stringify(s));
  lines.push(JSON.stringify(summary));
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
}

// ── CLI ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { in: null, out: null, targetCount: 30 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in' && argv[i + 1]) args.in = String(argv[++i]);
    else if (a === '--out' && argv[i + 1]) args.out = String(argv[++i]);
    else if (a === '--target-count' && argv[i + 1]) args.targetCount = Math.max(1, Number(argv[++i]) || 30);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.in || !args.out) {
    console.error('[option-bank-builder] usage: --in <harvest.jsonl> --out <pool.jsonl> [--target-count 30]');
    process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(args.in)) {
    console.error(`[option-bank-builder] input file not found: ${args.in}`);
    process.exitCode = 3;
    return;
  }
  const scenarioEvents = readScenarioEvents(args.in);
  if (scenarioEvents.length === 0) {
    console.error(`[option-bank-builder] no scenario_build events in ${args.in}`);
    process.exitCode = 3;
    return;
  }
  const seeds = [];
  for (const ev of scenarioEvents) {
    const seed = buildSeedFromScenarioEvent(ev);
    if (seed) seeds.push(seed);
  }
  const eligible = seeds.filter((s) => !s.bankShortfall);
  const summary = {
    event: 'pool_summary',
    builtAt: new Date().toISOString(),
    inputFile: path.relative(process.cwd(), args.in),
    inputSourceCount: scenarioEvents.length,
    seedCount: seeds.length,
    eligibleSeedCount: eligible.length,
    targetCount: args.targetCount,
    bankShortfallSeeds: seeds.filter((s) => s.bankShortfall).map((s) => ({ seedId: s.seedId, failing: s.bankShortfallDetails })),
  };
  writePoolJsonl(args.out, seeds, summary);
  console.log(`[option-bank-builder] wrote ${seeds.length} seeds (${eligible.length} eligible) to ${args.out}`);
  if (eligible.length < args.targetCount) {
    console.warn(`[option-bank-builder] WARNING: only ${eligible.length} eligible seeds; planner requires ${args.targetCount}.`);
    process.exitCode = 4;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildSeedFromScenarioEvent,
  buildOpeningClaimOptions,
  buildObjectionOptions,
  buildEvidencePressureOptions,
  buildAlternativeExplanationOptions,
  buildConcessionOrNarrowingOptions,
  buildResolutionPressureOptions,
  openingClaimParaphrases,
  objectionTemplates,
  evidencePressureTemplates,
  alternativeExplanationTemplates,
  concessionOrNarrowingTemplates,
  resolutionPressureTemplates,
  readScenarioEvents,
  writePoolJsonl,
  parseArgs,
  deriveSeedId,
  deriveOptionId,
  dedupeOptions,
  pickAxisFromDisagreementType,
  REPLY_FUNCTION_TO_BANKS,
  DEFAULT_AXIS_BY_BANK,
  DEFAULT_SPINE_BY_BANK,
};
