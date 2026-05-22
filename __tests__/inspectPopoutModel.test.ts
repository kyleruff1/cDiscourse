/**
 * QOL-032 — Inspect popout content model tests.
 *
 * QOL-032 design §8 test plan, the `inspectPopoutModel` slice:
 *  - the fixed seven-section set is ALWAYS all-present (design §3.2),
 *  - stage-driven emphasis — every row of the §3.3 table: the right
 *    section is pulled to slot 0 + expanded; **no section is ever removed**
 *    (the named doctrine test),
 *  - the §5 narrative-frame table (S1 F3/F5/F10, S2 F3/F5/F9),
 *  - the §5 hand-off names the right `ActEntryId` per stage,
 *  - the read-only contract — the model exposes no posting / editing
 *    affordance, only a hand-off descriptor,
 *  - the §7 edge cases — node with no evidence, no semantic flags, archived
 *    room (hand-off chip disabled),
 *  - no raw `snake_case` in any rendered string (RULE-001 ban-list),
 *  - determinism / purity.
 *
 * Full branch coverage of every public function (test-discipline: pure-TS
 * models get 100% branch coverage). The companion render contract lives in
 * `inspectPopoutComponent.test.tsx`; the shared one-box ban-list lives in
 * `oneBoxCopyBanList.test.ts`. Pure-TS — no React, no Supabase, no network.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  buildInspectPopout,
  getInspectSection,
  getInspectSuggestedMove,
  getEmphasizedSection,
  INSPECT_SECTION_ORDER,
  INSPECT_SECTION_TITLE,
  INSPECT_SECTION_ACCESSIBILITY_LABEL,
  INSPECT_EMPTY_BODY,
  INSPECT_ARCHIVED_HANDOFF_REASON,
  INSPECT_SETTLED_BANNER,
  _debug,
  type BuildInspectPopoutInput,
  type InspectSectionContent,
  type InspectSectionId,
} from '../src/features/arguments/oneBox/inspectPopoutModel';
import { ALL_POINT_LIFECYCLE_STATES } from '../src/features/lifecycle';
import type { PointLifecycleState } from '../src/features/lifecycle';
import type { ActEntryId } from '../src/features/arguments/oneBox/actPopoutModel';

// ── Fixture helpers ────────────────────────────────────────────

/**
 * Plain-language section content with every field populated — so a test
 * that does NOT exercise a §7 fallback sees real bodies, not the fallback
 * copy. Tests that DO want a fallback omit the field.
 */
function fullContent(over: Partial<InspectSectionContent> = {}): InspectSectionContent {
  return {
    says: 'says' in over ? over.says : 'Cars make cities worse for everyone.',
    matters: 'matters' in over ? over.matters : 'This narrows the parent claim about traffic.',
    unresolved:
      'unresolved' in over ? over.unresolved : 'The scope of "everyone" has not been pinned down.',
    sits: 'sits' in over ? over.sits : 'On the main line, three moves in.',
    semanticFlags:
      'semanticFlags' in over
        ? over.semanticFlags
        : ['This move could use a source for the traffic figure.'],
    evidenceDetail:
      'evidenceDetail' in over
        ? over.evidenceDetail
        : 'Payment receipt, March 3, $120, note "practice space" — applicability disputed.',
  };
}

/**
 * A `buildInspectPopout` input with sensible defaults. `stage` is read with
 * an explicit `in` check so a test can pass an explicit `null` (a non-node
 * target) without the default overriding it.
 */
function inspectInput(over: Partial<BuildInspectPopoutInput> = {}): BuildInspectPopoutInput {
  return {
    stage: 'stage' in over ? (over.stage ?? null) : 'open',
    content: over.content ?? fullContent(),
    isArchivedRoom: over.isArchivedRoom,
  };
}

/** The section ids of a built model, in returned order. */
function sectionIds(input: BuildInspectPopoutInput): InspectSectionId[] {
  return buildInspectPopout(input).sections.map((s) => s.id);
}

// ── 1. The fixed section set is ALWAYS all-present (design §3.2) ─

describe('QOL-032 inspectPopoutModel — the fixed section set', () => {
  it('exposes the seven-section numbered order §1..§6 then §E', () => {
    expect([...INSPECT_SECTION_ORDER]).toEqual([
      'says',
      'matters',
      'unresolved',
      'sits',
      'next_move',
      'flags',
      'evidence_detail',
    ]);
  });

  it('every section id has a plain-language title and accessibility label', () => {
    for (const id of INSPECT_SECTION_ORDER) {
      expect(INSPECT_SECTION_TITLE[id].length).toBeGreaterThan(0);
      expect(INSPECT_SECTION_ACCESSIBILITY_LABEL[id].length).toBeGreaterThan(0);
    }
  });

  it('a built model always carries all 7 sections', () => {
    const model = buildInspectPopout(inspectInput());
    expect(model.sections).toHaveLength(7);
  });

  it('every section id appears exactly once — no dupes, no gaps', () => {
    const ids = sectionIds(inspectInput());
    expect(ids.slice().sort()).toEqual([...INSPECT_SECTION_ORDER].slice().sort());
    expect(new Set(ids).size).toBe(7);
  });

  it('the set stays complete for EVERY lifecycle stage', () => {
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const ids = sectionIds(inspectInput({ stage }));
      expect(ids.slice().sort()).toEqual([...INSPECT_SECTION_ORDER].slice().sort());
    }
  });

  it('the set stays complete for a null stage (non-node target — design §7)', () => {
    const ids = sectionIds(inspectInput({ stage: null }));
    expect(ids.slice().sort()).toEqual([...INSPECT_SECTION_ORDER].slice().sort());
  });

  it('the set stays complete with entirely empty content (every §7 fallback)', () => {
    const model = buildInspectPopout(inspectInput({ content: {} }));
    expect(model.sections).toHaveLength(7);
    expect(model.sections.map((s) => s.id).sort()).toEqual([...INSPECT_SECTION_ORDER].sort());
  });

  it('every section carries a non-empty body — a section is never blank', () => {
    // Empty content → every section falls back to its §7 "nothing here"
    // copy; the body is still a non-empty string.
    for (const section of buildInspectPopout(inspectInput({ content: {} })).sections) {
      expect(section.body.length).toBeGreaterThan(0);
    }
  });

  it('every section title + accessibility label matches the model tables', () => {
    for (const section of buildInspectPopout(inspectInput()).sections) {
      expect(section.title).toBe(INSPECT_SECTION_TITLE[section.id]);
      expect(section.accessibilityLabel).toBe(INSPECT_SECTION_ACCESSIBILITY_LABEL[section.id]);
    }
  });

  it('getInspectSection finds every section in a built model', () => {
    const model = buildInspectPopout(inspectInput());
    for (const id of INSPECT_SECTION_ORDER) {
      expect(getInspectSection(model, id)?.id).toBe(id);
    }
  });
});

// ── 2. Stage-driven emphasis — the §3.3 table (DOCTRINE) ───────
//
// QOL-032 design §3.3 — every section is always present; the section
// pulled to slot 0 + expanded follows the node's LIFE-001 stage. Emphasis
// ONLY re-orders — it NEVER removes a section.

interface EmphasisRow {
  stage: PointLifecycleState;
  /** The §3.3 section expected at slot 0 + expanded. */
  emphasized: InspectSectionId;
}

/** The QOL-032 design §3.3 table, verbatim. */
const EMPHASIS_TABLE: EmphasisRow[] = [
  { stage: 'open', emphasized: 'says' },
  { stage: 'answered', emphasized: 'says' },
  { stage: 'rebutted', emphasized: 'unresolved' },
  { stage: 'clarified', emphasized: 'unresolved' },
  { stage: 'source_requested', emphasized: 'unresolved' },
  { stage: 'quote_requested', emphasized: 'unresolved' },
  { stage: 'sourced', emphasized: 'evidence_detail' },
  { stage: 'narrowed', emphasized: 'matters' },
  { stage: 'conceded', emphasized: 'matters' },
  { stage: 'confirmed', emphasized: 'next_move' },
  { stage: 'synthesis_ready', emphasized: 'next_move' },
  { stage: 'moved_on_by_affirmative', emphasized: 'sits' },
  { stage: 'moved_on_by_negative', emphasized: 'sits' },
  { stage: 'ignored_by_affirmative', emphasized: 'sits' },
  { stage: 'ignored_by_negative', emphasized: 'sits' },
  { stage: 'ignored_by_both', emphasized: 'sits' },
  { stage: 'exhausted', emphasized: 'sits' },
  { stage: 'branch_recommended', emphasized: 'sits' },
  { stage: 'archived_or_resolved', emphasized: 'says' },
];

describe('QOL-032 inspectPopoutModel — stage emphasis (§3.3 table)', () => {
  it('the emphasis table covers every lifecycle stage exactly once', () => {
    expect(EMPHASIS_TABLE).toHaveLength(ALL_POINT_LIFECYCLE_STATES.length);
    expect(EMPHASIS_TABLE.map((r) => r.stage).sort()).toEqual(
      [...ALL_POINT_LIFECYCLE_STATES].sort(),
    );
  });

  describe.each(EMPHASIS_TABLE)('stage "$stage" → §3.3 emphasizes "$emphasized"', (row) => {
    const model = buildInspectPopout(inspectInput({ stage: row.stage }));

    it('getEmphasizedSection returns the §3.3 section', () => {
      expect(getEmphasizedSection(row.stage)).toBe(row.emphasized);
    });

    it('the §3.3 section is at slot 0 of the returned sections', () => {
      expect(model.sections[0].id).toBe(row.emphasized);
    });

    it('the §3.3 section is the single emphasized + expanded-by-default section', () => {
      const emphasized = model.sections.filter((s) => s.isEmphasized);
      expect(emphasized.map((s) => s.id)).toEqual([row.emphasized]);
      expect(emphasized[0].isExpandedByDefault).toBe(true);
    });

    it('no section is removed by emphasis — all 7 are still present', () => {
      expect(model.sections).toHaveLength(7);
      expect(model.sections.map((s) => s.id).sort()).toEqual(
        [...INSPECT_SECTION_ORDER].sort(),
      );
    });

    it('the six non-emphasized sections keep the numbered order', () => {
      // After slot 0 the remaining six appear in INSPECT_SECTION_ORDER.
      const rest = model.sections.slice(1).map((s) => s.id);
      const expected = INSPECT_SECTION_ORDER.filter((id) => id !== row.emphasized);
      expect(rest).toEqual([...expected]);
    });

    it('exactly one section is emphasized; the rest collapse by default', () => {
      expect(model.sections.filter((s) => s.isEmphasized)).toHaveLength(1);
      for (const s of model.sections) {
        // isExpandedByDefault tracks isEmphasized exactly.
        expect(s.isExpandedByDefault).toBe(s.isEmphasized);
      }
    });
  });

  it('THE DOCTRINE TEST — emphasis only RE-ORDERS, never changes the set', () => {
    // For EVERY stage the section SET is identical to the no-stage result;
    // only the ORDER may differ. This is the §3.3 "never hides" guarantee.
    const noStage = new Set(sectionIds(inspectInput({ stage: null })));
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const staged = new Set(sectionIds(inspectInput({ stage })));
      expect(staged).toEqual(noStage);
    }
  });

  it('a null stage emphasizes §1 "What this move says" (design §7 fallback)', () => {
    expect(getEmphasizedSection(null)).toBe('says');
    const model = buildInspectPopout(inspectInput({ stage: null }));
    expect(model.sections[0].id).toBe('says');
    expect(model.sections[0].isEmphasized).toBe(true);
  });

  it('only an archived_or_resolved node shows the settled banner', () => {
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const model = buildInspectPopout(inspectInput({ stage }));
      expect(model.showsSettledBanner).toBe(stage === 'archived_or_resolved');
    }
  });

  it('a null stage shows no settled banner', () => {
    expect(buildInspectPopout(inspectInput({ stage: null })).showsSettledBanner).toBe(false);
  });

  it('the STAGE_EMPHASIZED_SECTION table resolves every stage to a real section id', () => {
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const id = _debug.STAGE_EMPHASIZED_SECTION[stage];
      expect(INSPECT_SECTION_ORDER).toContain(id);
    }
  });
});

// ── 3. The §5 hand-off — suggested move per stage ──────────────

describe('QOL-032 inspectPopoutModel — §5 suggested move', () => {
  it('getInspectSuggestedMove resolves every stage to a real ActEntryId', () => {
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const move = getInspectSuggestedMove(stage);
      expect(typeof move.actEntryId).toBe('string');
      expect(move.actEntryId.length).toBeGreaterThan(0);
      expect(move.chipLabel.length).toBeGreaterThan(0);
      expect(move.frame.length).toBeGreaterThan(0);
    }
  });

  it('a null stage falls back to a plain "reply" suggestion (design §7)', () => {
    const move = getInspectSuggestedMove(null);
    expect(move.actEntryId).toBe('reply');
    expect(move.chipLabel.length).toBeGreaterThan(0);
  });

  it('source_requested suggests attaching a source (Add evidence)', () => {
    expect(getInspectSuggestedMove('source_requested').actEntryId).toBe('add_evidence');
  });

  it('quote_requested suggests attaching a quote (Add evidence)', () => {
    expect(getInspectSuggestedMove('quote_requested').actEntryId).toBe('add_evidence');
  });

  it('sourced suggests responding to the evidence', () => {
    expect(getInspectSuggestedMove('sourced').actEntryId).toBe('respond_to_evidence');
  });

  it('narrowed suggests confirming the narrowed point', () => {
    expect(getInspectSuggestedMove('narrowed').actEntryId).toBe('confirm');
  });

  it('confirmed / conceded / synthesis_ready suggest a synthesis', () => {
    for (const stage of ['confirmed', 'conceded', 'synthesis_ready'] as const) {
      expect(getInspectSuggestedMove(stage).actEntryId).toBe('synthesize');
    }
  });

  it('the moved-on / ignored / exhausted / branch stages suggest a side branch', () => {
    const branchStages: PointLifecycleState[] = [
      'moved_on_by_affirmative',
      'moved_on_by_negative',
      'ignored_by_affirmative',
      'ignored_by_negative',
      'ignored_by_both',
      'exhausted',
      'branch_recommended',
    ];
    for (const stage of branchStages) {
      expect(getInspectSuggestedMove(stage).actEntryId).toBe('branch_tangent');
    }
  });

  it('archived_or_resolved suggests viewing the qualifiers (read-only)', () => {
    expect(getInspectSuggestedMove('archived_or_resolved').actEntryId).toBe('view_qualifiers');
  });

  it('the §5 hand-off carries the stage suggested-move into the built model', () => {
    const model = buildInspectPopout(inspectInput({ stage: 'source_requested' }));
    const suggested = getInspectSuggestedMove('source_requested');
    expect(model.handoff.actEntryId).toBe(suggested.actEntryId);
    expect(model.handoff.chipLabel).toBe(suggested.chipLabel);
    expect(model.handoff.frame).toBe(suggested.frame);
  });

  it('the §5 section body IS the hand-off frame (the chip rides on handoff)', () => {
    const model = buildInspectPopout(inspectInput({ stage: 'narrowed' }));
    const nextMove = getInspectSection(model, 'next_move');
    expect(nextMove?.body).toBe(model.handoff.frame);
  });

  it('STAGE → suggested-move table covers every stage with a valid entry', () => {
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const move = _debug.INSPECT_SUGGESTED_MOVE[stage];
      expect(move).toBeDefined();
      expect(move.actEntryId.length).toBeGreaterThan(0);
    }
  });
});

// ── 4. Narrative frames — the design §5 table ──────────────────
//
// QOL-032 design §5 "Inspect in action". Each frame names a node + stage
// and the section Inspect opens emphasizing. The model reproduces it:
// given the frame's stage, the §3.3 emphasized section + the §5 hand-off
// match the design's stated frame.

interface InspectFrame {
  id: string;
  desc: string;
  stage: PointLifecycleState;
  /** The section design §5 says Inspect opens emphasizing. */
  emphasized: InspectSectionId;
  /** The Act entry the §5 hand-off names for this frame. */
  handoff: ActEntryId;
}

/** The QOL-032 design §5 narrative-frame table. */
const NARRATIVE_FRAMES: InspectFrame[] = [
  {
    id: 'S1 F3',
    desc: "A reviews B's response — node rebutted → §3 What is unresolved",
    stage: 'rebutted',
    emphasized: 'unresolved',
    handoff: 'reply',
  },
  {
    id: 'S1 F5',
    desc: 'Observer C surveys before chiming in — node open → §1 + §4',
    stage: 'open',
    emphasized: 'says',
    handoff: 'reply',
  },
  {
    id: 'S1 F10',
    desc: 'the "door unlocked" line — node branch_recommended → §4 Where it sits',
    stage: 'branch_recommended',
    emphasized: 'sits',
    handoff: 'branch_tangent',
  },
  {
    id: 'S2 F3',
    desc: 'A inspects the evidence-backed node — node sourced → §E Evidence detail',
    stage: 'sourced',
    emphasized: 'evidence_detail',
    handoff: 'respond_to_evidence',
  },
  {
    id: 'S2 F5',
    desc: 'after A asks for a source — node source_requested → §3 What is unresolved',
    stage: 'source_requested',
    emphasized: 'unresolved',
    handoff: 'add_evidence',
  },
  {
    id: 'S2 F9',
    desc: 'at settlement — node archived_or_resolved → §1 + settled banner',
    stage: 'archived_or_resolved',
    emphasized: 'says',
    handoff: 'view_qualifiers',
  },
];

describe('QOL-032 inspectPopoutModel — narrative frames (design §5)', () => {
  it('reproduces all six design §5 frames', () => {
    expect(NARRATIVE_FRAMES).toHaveLength(6);
  });

  describe.each(NARRATIVE_FRAMES)('$id — $desc', (frame) => {
    const model = buildInspectPopout(inspectInput({ stage: frame.stage }));

    it('opens emphasizing the design §5 section', () => {
      expect(model.sections[0].id).toBe(frame.emphasized);
      expect(model.sections[0].isEmphasized).toBe(true);
    });

    it('names the design §5 hand-off Act entry', () => {
      expect(model.handoff.actEntryId).toBe(frame.handoff);
    });

    it('still carries the full seven-section set', () => {
      expect(model.sections).toHaveLength(7);
    });
  });

  it('S2 F9 — the settlement frame raises the settled banner', () => {
    const model = buildInspectPopout(inspectInput({ stage: 'archived_or_resolved' }));
    expect(model.showsSettledBanner).toBe(true);
    // The banner copy states the argument is settled — never a verdict.
    expect(INSPECT_SETTLED_BANNER.toLowerCase()).toContain('settled');
  });

  it('S1 F5 — the observer frame still exposes §4 Where it sits in the set', () => {
    // Design §5 S1 F5 names "§1 + §4" — §1 is emphasized; §4 must still be
    // present (emphasis never removes a section).
    const model = buildInspectPopout(inspectInput({ stage: 'open' }));
    expect(getInspectSection(model, 'sits')).not.toBeNull();
  });
});

// ── 5. Read-only contract — Inspect derives & writes nothing ───
//
// QOL-032 design §3.1 / §9 — Inspect is STRICTLY READ-ONLY. The model
// produces a section set + ONE hand-off descriptor; it exposes no
// composing / posting / editing affordance. The single bridge is the §5
// hand-off, which only NAMES an ActEntryId for the host to open Act with.

describe('QOL-032 inspectPopoutModel — read-only contract', () => {
  it('the built model exposes only sections + a hand-off + a banner flag', () => {
    const model = buildInspectPopout(inspectInput());
    expect(Object.keys(model).sort()).toEqual(['handoff', 'sections', 'showsSettledBanner'].sort());
  });

  it('the hand-off only NAMES an ActEntryId — it carries no write payload', () => {
    const model = buildInspectPopout(inspectInput());
    // The hand-off descriptor is a chip + a target entry id — nothing else.
    expect(Object.keys(model.handoff).sort()).toEqual(
      ['actEntryId', 'chipLabel', 'disabledReason', 'frame', 'isDisabled'].sort(),
    );
  });

  it('no section carries an edit / submit / post field — sections are read-only', () => {
    for (const section of buildInspectPopout(inspectInput()).sections) {
      // A section is purely descriptive: id, title, a11y label, body, two
      // display flags. No callback, no payload, no mutable field.
      expect(Object.keys(section).sort()).toEqual(
        [
          'accessibilityLabel',
          'body',
          'id',
          'isEmphasized',
          'isExpandedByDefault',
          'title',
        ].sort(),
      );
    }
  });

  it('Inspect never authors a posting affordance — the only action is the hand-off', () => {
    // The model produces exactly one actionable descriptor (the §5
    // hand-off). Everything else is descriptive text.
    const model = buildInspectPopout(inspectInput());
    expect(model.handoff).toBeDefined();
    // The §5 hand-off opens the ACT popout — it never itself posts.
    expect(typeof model.handoff.actEntryId).toBe('string');
  });

  it('source scan — inspectPopoutModel imports no React / Supabase / network / AI', () => {
    // The pure model must not reach for a write primitive. The shared
    // one-box ban-list test also covers the chassis; this is the explicit
    // QOL-032 guard.
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        'src',
        'features',
        'arguments',
        'oneBox',
        'inspectPopoutModel.ts',
      ),
      'utf8',
    );
    // Strip comments so a doctrine comment naming a primitive is not a hit.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(/from ['"]react(-native)?['"]/.test(code)).toBe(false);
    expect(/from ['"][^'"]*supabase/.test(code)).toBe(false);
    expect(/\bfetch\(/.test(code)).toBe(false);
    expect(/\bXMLHttpRequest\b/.test(code)).toBe(false);
    expect(/anthropic|openai|x\.ai/i.test(code)).toBe(false);
    // No write to public.arguments, no bypass of submit-argument.
    expect(/\.insert\(|\.update\(|\.delete\(/.test(code)).toBe(false);
    expect(/submit-argument/.test(code)).toBe(false);
    expect(/SERVICE_ROLE|service_role/.test(code)).toBe(false);
    // Deterministic — no wall clock.
    expect(/Date\.now\(\)/.test(code)).toBe(false);
  });
});

// ── 6. Hand-off disabled in an archived room (design §7) ───────

describe('QOL-032 inspectPopoutModel — archived room (design §7)', () => {
  it('a non-archived room leaves the hand-off chip enabled', () => {
    const model = buildInspectPopout(inspectInput({ isArchivedRoom: false }));
    expect(model.handoff.isDisabled).toBe(false);
    expect(model.handoff.disabledReason).toBeNull();
  });

  it('an omitted isArchivedRoom defaults to a NOT-archived room', () => {
    const model = buildInspectPopout(inspectInput({ isArchivedRoom: undefined }));
    expect(model.handoff.isDisabled).toBe(false);
  });

  it('an archived room disables the hand-off chip with the §7 reason', () => {
    const model = buildInspectPopout(inspectInput({ isArchivedRoom: true }));
    expect(model.handoff.isDisabled).toBe(true);
    expect(model.handoff.disabledReason).toBe(INSPECT_ARCHIVED_HANDOFF_REASON);
  });

  it('the archived reason states the argument is settled — never a verdict', () => {
    expect(INSPECT_ARCHIVED_HANDOFF_REASON.toLowerCase()).toContain('settled');
  });

  it('an archived room keeps Inspect fully functional — all 7 sections present', () => {
    // Design §7: "Inspect fully works … only the §5 hand-off chip is
    // disabled." The section set is unchanged.
    const model = buildInspectPopout(inspectInput({ isArchivedRoom: true }));
    expect(model.sections).toHaveLength(7);
    for (const section of model.sections) {
      expect(section.body.length).toBeGreaterThan(0);
    }
  });

  it('an archived room still resolves the §3.3 emphasis normally', () => {
    // Disabling the chip does not change which section is emphasized.
    const model = buildInspectPopout(inspectInput({ stage: 'sourced', isArchivedRoom: true }));
    expect(model.sections[0].id).toBe('evidence_detail');
  });

  it('the archived hand-off still names the right Act entry (just disabled)', () => {
    // The chip is disabled but the entry id it WOULD open is still correct.
    const model = buildInspectPopout(inspectInput({ stage: 'narrowed', isArchivedRoom: true }));
    expect(model.handoff.actEntryId).toBe('confirm');
    expect(model.handoff.isDisabled).toBe(true);
  });
});

// ── 7. Section-body fallbacks — design §7 "nothing here" ───────

describe('QOL-032 inspectPopoutModel — §7 section-body fallbacks', () => {
  it('§E renders "No evidence attached" for a node with no evidence', () => {
    const model = buildInspectPopout(inspectInput({ content: fullContent({ evidenceDetail: undefined }) }));
    expect(getInspectSection(model, 'evidence_detail')?.body).toBe(
      INSPECT_EMPTY_BODY.evidenceDetail,
    );
  });

  it('§E renders the evidence detail verbatim when present', () => {
    const detail = 'Dataset, 2024 city traffic counts — primary source anchored.';
    const model = buildInspectPopout(
      inspectInput({ content: fullContent({ evidenceDetail: detail }) }),
    );
    expect(getInspectSection(model, 'evidence_detail')?.body).toBe(detail);
  });

  it('§6 renders "No semantic flags" when the MCP layer produced none', () => {
    const model = buildInspectPopout(inspectInput({ content: fullContent({ semanticFlags: [] }) }));
    expect(getInspectSection(model, 'flags')?.body).toBe(INSPECT_EMPTY_BODY.flags);
  });

  it('§6 renders "No semantic flags" when the flag field is omitted entirely', () => {
    const model = buildInspectPopout(
      inspectInput({ content: fullContent({ semanticFlags: undefined }) }),
    );
    expect(getInspectSection(model, 'flags')?.body).toBe(INSPECT_EMPTY_BODY.flags);
  });

  it('§6 joins multiple semantic-flag lines with a separator', () => {
    const model = buildInspectPopout(
      inspectInput({
        content: fullContent({
          semanticFlags: ['This move could use a source.', 'The scope is broad.'],
        }),
      }),
    );
    const body = getInspectSection(model, 'flags')?.body ?? '';
    expect(body).toContain('This move could use a source.');
    expect(body).toContain('The scope is broad.');
  });

  it('§6 drops blank / whitespace-only flag lines before joining', () => {
    const model = buildInspectPopout(
      inspectInput({
        content: fullContent({ semanticFlags: ['  ', '', 'A real flag line.'] }),
      }),
    );
    expect(getInspectSection(model, 'flags')?.body).toBe('A real flag line.');
  });

  it('§6 falls back to "No semantic flags" when every flag line is blank', () => {
    const model = buildInspectPopout(
      inspectInput({ content: fullContent({ semanticFlags: ['   ', ''] }) }),
    );
    expect(getInspectSection(model, 'flags')?.body).toBe(INSPECT_EMPTY_BODY.flags);
  });

  it('§1 falls back when the move has no readable body', () => {
    const model = buildInspectPopout(inspectInput({ content: fullContent({ says: '' }) }));
    expect(getInspectSection(model, 'says')?.body).toBe(INSPECT_EMPTY_BODY.says);
  });

  it('§1 falls back when the body is whitespace only', () => {
    const model = buildInspectPopout(inspectInput({ content: fullContent({ says: '   ' }) }));
    expect(getInspectSection(model, 'says')?.body).toBe(INSPECT_EMPTY_BODY.says);
  });

  it('§2 falls back to the opening-claim note when there is no parent', () => {
    const model = buildInspectPopout(inspectInput({ content: fullContent({ matters: undefined }) }));
    expect(getInspectSection(model, 'matters')?.body).toBe(INSPECT_EMPTY_BODY.matters);
  });

  it('§3 falls back when nothing is open on the move', () => {
    const model = buildInspectPopout(
      inspectInput({ content: fullContent({ unresolved: undefined }) }),
    );
    expect(getInspectSection(model, 'unresolved')?.body).toBe(INSPECT_EMPTY_BODY.unresolved);
  });

  it('§4 falls back when the position could not be determined', () => {
    const model = buildInspectPopout(inspectInput({ content: fullContent({ sits: undefined }) }));
    expect(getInspectSection(model, 'sits')?.body).toBe(INSPECT_EMPTY_BODY.sits);
  });

  it('a present body is trimmed but otherwise verbatim', () => {
    const model = buildInspectPopout(
      inspectInput({ content: fullContent({ says: '  Trimmed claim text.  ' }) }),
    );
    expect(getInspectSection(model, 'says')?.body).toBe('Trimmed claim text.');
  });

  it('resolveSectionBody (via _debug) covers every section id without throwing', () => {
    const handoff = buildInspectPopout(inspectInput()).handoff;
    for (const id of INSPECT_SECTION_ORDER) {
      expect(() => _debug.resolveSectionBody(id, fullContent(), handoff)).not.toThrow();
      expect(() => _debug.resolveSectionBody(id, {}, handoff)).not.toThrow();
    }
  });

  it('every §7 fallback string is non-empty', () => {
    for (const value of Object.values(INSPECT_EMPTY_BODY)) {
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

// ── 8. No raw snake_case in any rendered string (RULE-001) ─────

describe('QOL-032 inspectPopoutModel — no internal-code leak (RULE-001)', () => {
  /** Collects every user-facing string a built model can render. */
  function renderedStrings(model: ReturnType<typeof buildInspectPopout>): string[] {
    const out: string[] = [];
    for (const section of model.sections) {
      out.push(section.title, section.accessibilityLabel, section.body);
    }
    out.push(model.handoff.chipLabel, model.handoff.frame);
    if (model.handoff.disabledReason) out.push(model.handoff.disabledReason);
    return out;
  }

  it('no section title carries a snake_case identifier', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const id of INSPECT_SECTION_ORDER) {
      expect({ id, snake: snake.test(INSPECT_SECTION_TITLE[id]) }).toEqual({ id, snake: false });
    }
  });

  it('no section accessibility label carries a snake_case identifier', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const id of INSPECT_SECTION_ORDER) {
      expect({ id, snake: snake.test(INSPECT_SECTION_ACCESSIBILITY_LABEL[id]) }).toEqual({
        id,
        snake: false,
      });
    }
  });

  it('no rendered string carries a snake_case identifier — every stage', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const stage of [...ALL_POINT_LIFECYCLE_STATES, null]) {
      const model = buildInspectPopout(inspectInput({ stage }));
      for (const value of renderedStrings(model)) {
        expect({ stage, value, snake: snake.test(value) }).toEqual({
          stage,
          value,
          snake: false,
        });
      }
    }
  });

  it('no rendered string echoes a raw multi-token PointLifecycleState code', () => {
    // The genuine RULE-001 leak shape is a snake_case code
    // (`source_requested`, `quote_requested`, `synthesis_ready`, …). Single
    // dictionary-word states (`open`, `sourced`, `narrowed`) are excluded —
    // they are indistinguishable from legitimate plain-language copy and
    // are caught instead by the snake_case scan above.
    const snakeCaseStates = ALL_POINT_LIFECYCLE_STATES.filter((s) => s.includes('_'));
    expect(snakeCaseStates.length).toBeGreaterThan(0);
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const model = buildInspectPopout(inspectInput({ stage }));
      for (const value of renderedStrings(model)) {
        for (const code of snakeCaseStates) {
          expect({ stage, code, leaks: value.includes(code) }).toEqual({
            stage,
            code,
            leaks: false,
          });
        }
      }
    }
  });

  it('no rendered string echoes a raw multi-token InspectSectionId', () => {
    // `next_move` / `evidence_detail` are snake_case ids — an unambiguous
    // internal-code shape. The single-word ids (`says`, `matters`, `sits`,
    // `flags`) are dictionary words that legitimately appear in plain copy
    // ("What this move says") and are covered by the snake_case scan.
    const snakeCaseIds = INSPECT_SECTION_ORDER.filter((id) => id.includes('_'));
    expect(snakeCaseIds.length).toBeGreaterThan(0);
    const model = buildInspectPopout(inspectInput());
    for (const value of renderedStrings(model)) {
      for (const id of snakeCaseIds) {
        expect({ id, leaks: value.includes(id) }).toEqual({ id, leaks: false });
      }
    }
  });

  it('every §7 fallback body is plain language — no snake_case', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const [key, value] of Object.entries(INSPECT_EMPTY_BODY)) {
      expect({ key, snake: snake.test(value) }).toEqual({ key, snake: false });
    }
  });
});

// ── 9. Doctrine ban-list — no verdict / truth copy ─────────────

const BANNED = [
  'winner',
  'loser',
  'won',
  'lost',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'correct',
  'incorrect',
  'true',
  'false',
];

function hitsBanned(s: string, token: string): boolean {
  const lower = s.toLowerCase();
  // Short everyday words need a word boundary to avoid false hits.
  if (['won', 'lost', 'true', 'false'].includes(token)) {
    return new RegExp(`\\b${token}\\b`).test(lower);
  }
  return lower.includes(token);
}

describe('QOL-032 inspectPopoutModel — doctrine ban-list', () => {
  it('no section title or accessibility label carries a verdict token', () => {
    for (const id of INSPECT_SECTION_ORDER) {
      for (const token of BANNED) {
        expect(hitsBanned(INSPECT_SECTION_TITLE[id], token)).toBe(false);
        expect(hitsBanned(INSPECT_SECTION_ACCESSIBILITY_LABEL[id], token)).toBe(false);
      }
    }
  });

  it('no suggested-move chip label or frame carries a verdict token', () => {
    for (const stage of [...ALL_POINT_LIFECYCLE_STATES, null]) {
      const move = getInspectSuggestedMove(stage);
      for (const token of BANNED) {
        expect(hitsBanned(move.chipLabel, token)).toBe(false);
        expect(hitsBanned(move.frame, token)).toBe(false);
      }
    }
  });

  it('no §7 fallback body carries a verdict token', () => {
    for (const value of Object.values(INSPECT_EMPTY_BODY)) {
      for (const token of BANNED) {
        expect(hitsBanned(value, token)).toBe(false);
      }
    }
  });

  it('the settled banner + archived reason carry no verdict token', () => {
    for (const token of BANNED) {
      expect(hitsBanned(INSPECT_SETTLED_BANNER, token)).toBe(false);
      expect(hitsBanned(INSPECT_ARCHIVED_HANDOFF_REASON, token)).toBe(false);
    }
  });

  it('§3 "What is unresolved" describes the MOVE, never the person', () => {
    // The §3 title + a11y label must not carry a person-attribution label.
    const personLabels = ['liar', 'troll', 'bot', 'astroturfer', 'bad faith'];
    for (const token of personLabels) {
      expect(INSPECT_SECTION_TITLE.unresolved.toLowerCase()).not.toContain(token);
      expect(INSPECT_SECTION_ACCESSIBILITY_LABEL.unresolved.toLowerCase()).not.toContain(token);
    }
  });
});

// ── 10. Determinism + purity ───────────────────────────────────

describe('QOL-032 inspectPopoutModel — determinism', () => {
  it('buildInspectPopout is idempotent for identical input', () => {
    const input = inspectInput({ stage: 'rebutted' });
    expect(JSON.stringify(buildInspectPopout(input))).toBe(
      JSON.stringify(buildInspectPopout(input)),
    );
  });

  it('buildInspectPopout does not mutate its input', () => {
    const input = inspectInput({ stage: 'sourced' });
    const snapshot = JSON.stringify(input);
    buildInspectPopout(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('two equivalent inputs produce deep-equal models', () => {
    expect(buildInspectPopout(inspectInput({ stage: 'open' }))).toEqual(
      buildInspectPopout(inspectInput({ stage: 'open' })),
    );
  });

  it('getInspectSection returns null for a model that somehow lacks an id', () => {
    // Defensive — a hand-built model with a trimmed section list.
    const partial = {
      sections: [],
      handoff: buildInspectPopout(inspectInput()).handoff,
      showsSettledBanner: false,
    };
    expect(getInspectSection(partial, 'says')).toBeNull();
  });

  it('_debug exposes the two internal tables + the body resolver', () => {
    expect(_debug.INSPECT_SUGGESTED_MOVE).toBeDefined();
    expect(_debug.STAGE_EMPHASIZED_SECTION).toBeDefined();
    expect(typeof _debug.resolveSectionBody).toBe('function');
  });
});
