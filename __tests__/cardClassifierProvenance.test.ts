/**
 * CARD-VIEW-REFINE-001 — source-provenance label model.
 *
 * The classifier chip now carries a plain-language provenance badge derived
 * from the mark's raw `NodeLabelSource` code. Doctrine §9 / §10a: the raw
 * snake_case code must NEVER surface; unknown codes are SUPPRESSED (→ null).
 */
import {
  CARD_CLASSIFIER_EVIDENCE_PREFIX,
  EVIDENCE_QUOTE_OPEN,
  EVIDENCE_QUOTE_CLOSE,
  markToChip,
  sourceProvenanceLabel,
} from '../src/features/arguments/cardView/cardClassifierStripModel';
import { ALL_NODE_LABEL_SOURCES } from '../src/features/nodeLabels/nodeLabelTypes';
import type { NodeLabelMark } from '../src/features/nodeLabels/nodeLabelTypes';

const BANNED = [
  'winner', 'loser', 'correct', 'incorrect', 'true', 'false', 'liar',
  'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist',
  'stupid', 'idiot',
];

describe('sourceProvenanceLabel', () => {
  it('maps each known machine-observation source to plain language', () => {
    expect(sourceProvenanceLabel('auto_metadata')).toBe('From system metadata');
    expect(sourceProvenanceLabel('lifecycle')).toBe('From the move’s lifecycle');
    expect(sourceProvenanceLabel('ai_classifier')).toBe('From the AI classifier');
    expect(sourceProvenanceLabel('semantic_referee')).toBe('From the referee');
  });

  it('SUPPRESSES (→ null) an unknown / empty code — never echoes the raw code', () => {
    expect(sourceProvenanceLabel('totally_unknown_code')).toBeNull();
    expect(sourceProvenanceLabel('')).toBeNull();
    expect(sourceProvenanceLabel(null)).toBeNull();
    expect(sourceProvenanceLabel(undefined)).toBeNull();
  });

  it('every resolved label is plain-language (no snake_case leak) + ban-list clean', () => {
    for (const src of ALL_NODE_LABEL_SOURCES) {
      const label = sourceProvenanceLabel(src);
      if (label == null) continue; // suppressed codes are fine
      // No raw code echoed.
      expect(label).not.toBe(src);
      // No snake_case token.
      expect(label).not.toMatch(/[a-z]+_[a-z]/);
      const lower = label.toLowerCase();
      for (const b of BANNED) {
        expect(lower).not.toContain(b);
      }
    }
  });
});

describe('markToChip carries the resolved provenance label', () => {
  function mark(over: Partial<NodeLabelMark> = {}): NodeLabelMark {
    return {
      id: 'm:auto_metadata:has_rebuttal:n1',
      rawKey: 'has_rebuttal',
      source: 'auto_metadata',
      kind: 'machine_observation',
      label: 'Has a rebuttal',
      shortLabel: 'Rebutted',
      description: 'This move has a challenge child.',
      confidence: 'high',
      disposition: 'rendered_now',
      defaultSurface: 'selected_context',
      priority: 10,
      visibleByDefault: true,
      ...(over as Partial<NodeLabelMark>),
    } as NodeLabelMark;
  }

  it('populates sourceProvenanceLabel from mark.source', () => {
    const chip = markToChip(mark());
    expect(chip.category).toBe('auto_metadata'); // raw code retained internally
    expect(chip.sourceProvenanceLabel).toBe('From system metadata'); // plain language for UI
  });

  it('suppresses the badge for an unknown source', () => {
    const chip = markToChip(mark({ source: 'future_source' }));
    expect(chip.sourceProvenanceLabel).toBeNull();
  });
});

/**
 * OPS-MCP-EVIDENCE-SPAN-QUOTATION-FRAMING — the evidence span is framed as a
 * marked QUOTATION of the move's own text: an attribution prefix + the
 * verbatim span wrapped in curly quote marks. The raw `evidenceSpan` is
 * UNCHANGED (verbatim); the framed display string lives on
 * `evidenceSpanFramed`. The frame copy is attributive, never a verdict.
 */
describe('markToChip — evidenceSpanFramed (quotation framing)', () => {
  /** Build a mark with an additively-attached evidenceSpan (the canonical
   *  NodeLabelMark interface does not declare it; the persistence adapter
   *  attaches it for forward consumers). */
  function markWithSpan(span: string | null): NodeLabelMark {
    const base = {
      id: 'm:semantic_referee:off_topic:n1',
      rawKey: 'off_topic',
      source: 'semantic_referee',
      kind: 'machine_observation',
      label: 'Possibly off topic',
      shortLabel: 'Off topic?',
      description: 'This move may not address the resolution.',
      confidence: 'medium',
      disposition: 'rendered_now',
      defaultSurface: 'selected_context',
      priority: 10,
      visibleByDefault: true,
    };
    const withSpan = span != null ? { ...base, evidenceSpan: span } : base;
    return withSpan as unknown as NodeLabelMark;
  }

  it('happy path — frames the span as a prefixed curly-quoted excerpt; raw span unchanged', () => {
    const chip = markToChip(markWithSpan('plain excerpt'));
    expect(chip.evidenceSpanFramed).toBe('From this move’s text: “plain excerpt”');
    // The raw span is verbatim — NOT mutated, NOT prefixed, NOT quoted.
    expect(chip.evidenceSpan).toBe('plain excerpt');
    expect(chip.isExpandable).toBe(true);
  });

  it('null span — evidenceSpanFramed is null and the chip is not expandable', () => {
    const chip = markToChip(markWithSpan(null));
    expect(chip.evidenceSpan).toBeNull();
    expect(chip.evidenceSpanFramed).toBeNull();
    expect(chip.isExpandable).toBe(false);
  });

  it('nested-quote edge — inner quotes (straight AND curly) are preserved VERBATIM inside the outer curly frame', () => {
    // Straight inner quotes.
    const straight = markToChip(markWithSpan('"already quoted"'));
    expect(straight.evidenceSpanFramed).toBe(
      `${CARD_CLASSIFIER_EVIDENCE_PREFIX} ${EVIDENCE_QUOTE_OPEN}"already quoted"${EVIDENCE_QUOTE_CLOSE}`,
    );
    expect(straight.evidenceSpanFramed).toContain('"already quoted"'); // inner unaltered
    expect(straight.evidenceSpan).toBe('"already quoted"'); // raw unaltered

    // Curly inner quotes — wrapped unconditionally, not normalized.
    const curly = markToChip(markWithSpan('“curly”'));
    expect(curly.evidenceSpanFramed).toBe(
      `${CARD_CLASSIFIER_EVIDENCE_PREFIX} ${EVIDENCE_QUOTE_OPEN}“curly”${EVIDENCE_QUOTE_CLOSE}`,
    );
    expect(curly.evidenceSpanFramed?.startsWith(`${CARD_CLASSIFIER_EVIDENCE_PREFIX} ${EVIDENCE_QUOTE_OPEN}`)).toBe(true);
    expect(curly.evidenceSpanFramed?.endsWith(EVIDENCE_QUOTE_CLOSE)).toBe(true);
  });

  it('truncation-ellipsis edge — a trailing ellipsis lands INSIDE the quotes (closing quote after the ellipsis)', () => {
    // The persistence adapter appends a single trailing U+2026 on overflow;
    // the model wraps the whole (already-truncated) span, so the close quote
    // is the last character and the ellipsis sits just inside it.
    const chip = markToChip(markWithSpan('a long excerpt that was cut…'));
    expect(chip.evidenceSpanFramed).toBe('From this move’s text: “a long excerpt that was cut…”');
    expect(chip.evidenceSpanFramed?.endsWith('…”')).toBe(true);
    // There is no LEADING ellipsis (the adapter only adds a trailing one).
    expect(chip.evidenceSpanFramed?.includes('“…')).toBe(false);
  });

  it('accessibility — the span hint reframes to a quotation cue (no "why this fired"); absent for a non-span mark', () => {
    const expandable = markToChip(markWithSpan('some excerpt'));
    expect(expandable.accessibilityLabel.endsWith('. Tap to see the quoted text from this move.')).toBe(true);
    expect(expandable.accessibilityLabel.toLowerCase()).not.toContain('why this fired');

    const noSpan = markToChip(markWithSpan(null));
    expect(noSpan.accessibilityLabel).not.toContain('Tap to see');
  });

  it('DOCTRINE — the FRAME copy (prefix + quote marks + a11y hint) carries no verdict token and no snake_case', () => {
    // Scan the frame constants — NOT the span (the span is a verbatim quote
    // and may legitimately contain a hostile token; banning it would re-add a
    // suppression the ADR explicitly rejected).
    const frameStrings = [
      CARD_CLASSIFIER_EVIDENCE_PREFIX,
      EVIDENCE_QUOTE_OPEN,
      EVIDENCE_QUOTE_CLOSE,
      // The a11y span hint, isolated from any label/span.
      markToChip(markWithSpan('clean')).accessibilityLabel.replace('clean', ''),
    ];
    for (const s of frameStrings) {
      const lower = s.toLowerCase();
      for (const b of BANNED) {
        expect(lower).not.toContain(b);
      }
      // Plain language — no internal snake_case code in the frame copy.
      expect(s).not.toMatch(/[a-z]+_[a-z]/);
    }
  });

  it('DOCTRINE — a verbatim HOSTILE token is preserved inside the quotes; the frame around it stays verdict-clean', () => {
    // The motivating residual: one family's span legitimately quotes another's
    // hostile token. The ADR (Option 0) keeps the span; this card only frames
    // it. Proof: (a) the token survives verbatim, (b) the frame portion is
    // clean, (c) the span is wrapped in the curly quote marks.
    const chip = markToChip(markWithSpan('astroturfed'));
    // (a) verbatim preserved — NOT dropped or altered.
    expect(chip.evidenceSpan).toBe('astroturfed');
    expect(chip.evidenceSpanFramed).toContain('astroturfed');
    // (c) wrapped in the curly frame.
    expect(chip.evidenceSpanFramed).toBe(
      `${CARD_CLASSIFIER_EVIDENCE_PREFIX} ${EVIDENCE_QUOTE_OPEN}astroturfed${EVIDENCE_QUOTE_CLOSE}`,
    );
    // (b) the frame MINUS the quoted span carries no verdict token.
    const frameOnly = (chip.evidenceSpanFramed ?? '').replace('astroturfed', '').toLowerCase();
    for (const b of BANNED) {
      expect(frameOnly).not.toContain(b);
    }
  });

  it('the framing has ONE source — markToChip produces the framed string byte-identically for any caller', () => {
    // The capped strip and the uncapped hub both call markToChip, so a second
    // call on the same mark yields the same framed string (no per-surface
    // divergence).
    const m = markWithSpan('shared excerpt');
    expect(markToChip(m).evidenceSpanFramed).toBe(markToChip(m).evidenceSpanFramed);
    expect(markToChip(m).evidenceSpanFramed).toBe('From this move’s text: “shared excerpt”');
  });
});
