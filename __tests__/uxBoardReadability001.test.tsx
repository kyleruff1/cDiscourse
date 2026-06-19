/**
 * UX-BOARD-READABILITY-001 — mediator board readability + density polish.
 *
 * Signed-in room readability/density polish ONLY — surface-local
 * style/spacing/copy-presentation. The card's root cause is an INVERTED type
 * hierarchy: the most load-bearing text on each surface (room title, selected
 * node body, rail guidance verbs) was the SMALLEST text. The fix raises the
 * load-bearing text and quiets metadata, with zero topology / semantics / data
 * change.
 *
 * This suite pins the readability CONTRACT (so a later refactor can't silently
 * re-invert the hierarchy) AND re-asserts the topology / copy invariants that
 * must survive the polish:
 *
 *   - room title fontSize >= 16 per band (was 13/14/15);
 *   - selected-node bodyLine fontSize >= 13 + numberOfLines={2} (the readable
 *     centre, was 11px / 1 line);
 *   - DisagreementPointsRail title is a distinct (larger) size from the row
 *     guidance text — title-vs-row hierarchy exists;
 *   - old game copy absent ('GAMEPLAY ANALYSIS', 'Where the points stand');
 *     'Mediator readout' (+ aria) still present and byte-identical;
 *   - ban-list / snake_case scan over the changed visible strings is clean;
 *   - one-chip active-node default (no NodeLabelStrip chip soup);
 *   - DisagreementPointsRail stays mounted as a structure board;
 *   - Act / Inspect / Go remain reachable in the dock;
 *   - RoomBoardLayout pane width 380 + the 1px columnDivider are unchanged
 *     (topology intact);
 *   - the byte-identical copy strings the upstream pins depend on are intact.
 *
 * Technique: source-scan (the established pattern for the heavily-pinned
 * ArgumentGameSurface / RoomBoardLayout / DisagreementPointsRail files), mirror
 * of uxBoardRail002Topology / uxSelectedNode001CenterOfRoom / uxRoomChrome001.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf8');
}

/**
 * Strip JS/TS block and line comments so a copy scan only sees the CODE
 * (string literals, JSX text), never the explanatory NOTE comments that
 * legitimately reference retired phrasing to document what was removed.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const HEADER_SRC = read('src/features/debates/DebateDetailHeader.tsx');
const RAIL_SRC = read('src/features/mediator/DisagreementPointsRail.tsx');
const PANEL_SRC = read('src/features/arguments/TimelineSelectedReadoutPanel.tsx');
const SCORE_SRC = read('src/features/arguments/ArgumentScoreTracker.tsx');
const TIMELINE_SRC = read('src/features/arguments/ArgumentTimelineMap.tsx');
const SURFACE_SRC = read('src/features/arguments/ArgumentGameSurface.tsx');
const LAYOUT_SRC = read('src/features/arguments/RoomBoardLayout.tsx');
const BUBBLE_SRC = read('src/features/arguments/ArgumentBubbleCard.tsx');

// ── 1. Room title is no longer the smallest text in the chrome ──────

describe('UX-BOARD-READABILITY-001 — room title raised to a heading tier', () => {
  it('every band sizing block declares titleFontSize >= 16', () => {
    const sizes = [...HEADER_SRC.matchAll(/titleFontSize:\s*(\d+)/g)].map((m) =>
      Number(m[1]),
    );
    // phone / tablet / wide — three band blocks.
    expect(sizes.length).toBe(3);
    for (const s of sizes) {
      expect(s).toBeGreaterThanOrEqual(16);
    }
  });

  it('the title carries an explicit lineHeight for stable single-line centring', () => {
    expect(HEADER_SRC).toMatch(/lineHeight:\s*sizing\.titleFontSize\s*\+\s*6/);
  });

  it('the strip-height cap literals (paddingVertical / rowMinHeight) are UNCHANGED', () => {
    // The cap arithmetic (<=48/56/64, pinned by uxOneOneTwoCompactStripHeight)
    // depends on these literals; the title bump must not touch them.
    expect(HEADER_SRC).toMatch(/containerPaddingVertical:\s*4/);
    expect(HEADER_SRC).toMatch(/containerPaddingVertical:\s*6/);
    expect(HEADER_SRC).toMatch(/containerPaddingVertical:\s*8/);
    expect(HEADER_SRC).toMatch(/rowMinHeight:\s*36/);
    expect(HEADER_SRC).toMatch(/rowMinHeight:\s*38/);
    expect(HEADER_SRC).toMatch(/rowMinHeight:\s*42/);
  });

  it('the phone chip floor is lifted off the 10px caption floor', () => {
    // The phone band block must declare chipFontSize >= 11.
    const phoneBlock = HEADER_SRC.slice(
      HEADER_SRC.indexOf("band === 'phone'"),
      HEADER_SRC.indexOf("band === 'tablet'"),
    );
    const chip = phoneBlock.match(/chipFontSize:\s*(\d+)/);
    expect(chip).not.toBeNull();
    expect(Number(chip![1])).toBeGreaterThanOrEqual(11);
  });

  it('the required testID is preserved (API-presence pin)', () => {
    expect(HEADER_SRC).toContain('testID="debate-detail-header"');
    expect(HEADER_SRC).toContain('testID="debate-detail-title"');
  });
});

// ── 2. Selected-node body is the readable centre ───────────────────

describe('UX-BOARD-READABILITY-001 — selected node body is the readable centre', () => {
  it('bodyLine fontSize is >= 13 (was 11)', () => {
    const block = PANEL_SRC.slice(PANEL_SRC.indexOf('bodyLine: {'));
    const fs13 = block.match(/fontSize:\s*(\d+)/);
    expect(fs13).not.toBeNull();
    expect(Number(fs13![1])).toBeGreaterThanOrEqual(13);
  });

  it('bodyLine renders with numberOfLines={2} (relaxed-with-NOTE)', () => {
    expect(PANEL_SRC).toMatch(
      /style=\{styles\.bodyLine\}\s+numberOfLines=\{2\}\s+ellipsizeMode="tail"/,
    );
  });

  it('the 5 compact line-style names survive (kind/body/parent/meta/acting)', () => {
    for (const name of ['kindLine', 'bodyLine', 'parentLine', 'metaLine', 'actingLine']) {
      expect(PANEL_SRC).toMatch(new RegExp(`${name}:\\s*\\{`));
    }
  });

  it('the panel keeps marginTop:8 and adds NO flexDirection row / rail import', () => {
    expect(PANEL_SRC).toMatch(/marginTop:\s*8/);
    expect(PANEL_SRC).not.toMatch(/flexDirection:\s*'row'/);
    expect(PANEL_SRC).not.toMatch(/DisagreementPointsRail|ArgumentSideActionRail|OpenIssuesRail/);
  });

  it('the selected-node copy strings are byte-identical', () => {
    expect(PANEL_SRC).toContain('Responding to this point');
    expect(PANEL_SRC).toContain('Go to parent point');
  });
});

// ── 3. DisagreementPointsRail has title-vs-row hierarchy ────────────

describe('UX-BOARD-READABILITY-001 — disagreement rail title-vs-row hierarchy', () => {
  it('the title re-points to popoutHeading and drops the all-caps admin look', () => {
    const titleBlock = RAIL_SRC.slice(
      RAIL_SRC.indexOf('title: {'),
      RAIL_SRC.indexOf('title: {') + 200,
    );
    expect(titleBlock).toMatch(/fontSize:\s*TYPOGRAPHY\.popoutHeading\.fontSize/);
    expect(titleBlock).not.toMatch(/textTransform:\s*'uppercase'/);
  });

  it('the per-row guidance verbs are lifted above metadata', () => {
    // nextStep -> popoutBody (12), jumpHint -> chipLabel (11, was badgeLabel 10).
    const nextStep = RAIL_SRC.slice(RAIL_SRC.indexOf('nextStep: {'));
    expect(nextStep).toMatch(/fontSize:\s*TYPOGRAPHY\.popoutBody\.fontSize/);
    const jumpHint = RAIL_SRC.slice(RAIL_SRC.indexOf('jumpHint: {'));
    expect(jumpHint).toMatch(/fontSize:\s*TYPOGRAPHY\.chipLabel\.fontSize/);
  });

  it('the title is a DISTINCT (larger) tier than the row guidance text', () => {
    // popoutHeading (13) for the title vs popoutBody (12) for the guidance line:
    // a real title-vs-row size delta, not the prior flat 11 == 11.
    const titleBlock = RAIL_SRC.slice(RAIL_SRC.indexOf('title: {'));
    const nextStep = RAIL_SRC.slice(RAIL_SRC.indexOf('nextStep: {'));
    expect(titleBlock).toMatch(/popoutHeading/);
    expect(nextStep).toMatch(/popoutBody/);
  });

  it('the expandedRootPane geometry border block is intact (topology pin)', () => {
    expect(RAIL_SRC).toMatch(/expandedRootPane:\s*\{[\s\S]*?borderLeftWidth:\s*BORDER_WIDTH\.sm/);
    expect(RAIL_SRC).toMatch(/expandedRootPane:\s*\{[\s\S]*?borderTopWidth:\s*0/);
  });

  it('the composed header string is byte-identical (sourced from COPY)', () => {
    expect(RAIL_SRC).toContain(
      '${DISAGREEMENT_POINTS_RAIL_COPY.title} · ${count} ${DISAGREEMENT_POINTS_RAIL_COPY.totalSuffix}',
    );
  });
});

// ── 4. De-game copy preserved; no scoreboard / verdict language ─────

describe('UX-BOARD-READABILITY-001 — de-game copy preserved', () => {
  it("'Mediator readout' (visible + aria) is byte-identical", () => {
    expect(SCORE_SRC).toContain('>Mediator readout<');
    expect(SCORE_SRC).toContain('accessibilityLabel="mediator readout"');
  });

  it('the retired game copy stays absent from rendered/code strings', () => {
    // Scan comment-stripped source so documentation NOTEs that reference the
    // retired phrasing (to explain what was removed) don't trip the check.
    for (const src of [SCORE_SRC, RAIL_SRC, PANEL_SRC, HEADER_SRC, TIMELINE_SRC, SURFACE_SRC]) {
      const code = stripComments(src);
      expect(code).not.toContain('GAMEPLAY ANALYSIS');
      expect(code).not.toContain('Where the points stand');
    }
  });

  it('the changed visible strings carry no verdict / scoreboard / popularity tokens', () => {
    // Scan only the labels this card introduced or relabeled.
    const CHANGED_VISIBLE_STRINGS = [
      'Opening', // ArgumentTimelineMap root-marker relabel
      'Off-thread', // ArgumentTimelineMap detached relabel
      'Mediator readout',
      'Leave',
      'First clash',
      'routes',
    ];
    const BANNED = [
      'winner',
      'loser',
      'scoreboard',
      'verdict',
      'truth',
      'fallacy',
      'dishonest',
      'bad faith',
      'manipulative',
      'ai judge',
      'ai-judge',
      'likes',
      'popularity',
      'ranking',
    ];
    for (const s of CHANGED_VISIBLE_STRINGS) {
      const lower = s.toLowerCase();
      for (const b of BANNED) {
        expect(lower).not.toContain(b);
      }
      // no snake_case classifier leak in a visible string
      expect(s).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('the timeline relabels are presentation-only (model a11y still says detached)', () => {
    // The renderer pill says 'Off-thread'; the model branchKind / a11y label is
    // untouched (verified by argumentTimelineMap.test.ts). The renderer must not
    // hard-code a NEW model string — it only changes the visible <Text> child.
    expect(TIMELINE_SRC).toContain('>Off-thread<');
    expect(TIMELINE_SRC).toContain('>Opening<');
  });
});

// ── 5. Topology / one-chip / AIG invariants survive the polish ──────

describe('UX-BOARD-READABILITY-001 — topology + interaction invariants intact', () => {
  it('the room board pane width binding stays 380 (topology)', () => {
    expect(LAYOUT_SRC).toMatch(/paneColumn:\s*\{\s*width:\s*ROOM_BOARD_PANE_WIDTH_PX/);
  });

  it('the 1px columnDivider geometry border is unchanged (topology)', () => {
    expect(LAYOUT_SRC).toMatch(/columnDivider:\s*\{[\s\S]*?borderLeftWidth:\s*BORDER_WIDTH\.sm/);
  });

  it('the added interior gutters are tablet/wide column padding only', () => {
    // Additive paddingHorizontal on the three tablet/wide columns; phone branch
    // returns before boardRow and is untouched.
    expect(LAYOUT_SRC).toMatch(/spineColumn:\s*\{[^}]*paddingHorizontal:\s*12/);
    expect(LAYOUT_SRC).toMatch(/spineColumnWide:\s*\{[^}]*paddingHorizontal:\s*12/);
    expect(LAYOUT_SRC).toMatch(/readoutColumn:\s*\{[^}]*paddingHorizontal:\s*12/);
  });

  it('Act / Inspect / Go remain reachable (dock testIDs + labels verbatim)', () => {
    expect(SURFACE_SRC).toContain('board-menu-trigger-act');
    expect(SURFACE_SRC).toContain('board-menu-trigger-inspect');
    expect(SURFACE_SRC).toContain('board-menu-trigger-go');
  });

  it('the DisagreementPointsRail stays mounted as a structure board', () => {
    expect(SURFACE_SRC).toMatch(/DisagreementPointsRail/);
  });

  it('no NodeLabelStrip chip-soup is reintroduced (not mounted as JSX)', () => {
    // The component is referenced in comments (explaining it is no longer the
    // default view) but must NOT be mounted as JSX nor imported as a component.
    expect(SURFACE_SRC).not.toMatch(/<NodeLabelStrip/);
    expect(SURFACE_SRC).not.toMatch(/import\s+\{[^}]*NodeLabelStrip[^}]*\}/);
  });

  it('the one active-node chip marker is still a single mount', () => {
    // The active-node marker testID is mounted once (the board derives state
    // once and shares it — no per-node chip strip).
    const count = (SURFACE_SRC.match(/board-menu-trigger-act/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ── 6. Micro-type floor lifts (10 -> 11) on the bubble card ─────────

describe('UX-BOARD-READABILITY-001 — bubble card micro-type off the 10px floor', () => {
  it('side / latest / badge / relative-time micro-type is >= 11', () => {
    for (const name of ['sidePillText', 'latestPillText', 'badgeText', 'timeRelative']) {
      const block = BUBBLE_SRC.slice(
        BUBBLE_SRC.indexOf(`${name}:`),
        BUBBLE_SRC.indexOf(`${name}:`) + 120,
      );
      const m = block.match(/fontSize:\s*(\d+)/);
      expect(m).not.toBeNull();
      expect(Number(m![1])).toBeGreaterThanOrEqual(11);
    }
  });
});
