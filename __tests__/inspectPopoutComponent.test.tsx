/**
 * QOL-032 — InspectPopout component contract (node & evidence detail).
 *
 * QOL-032 design §8 test plan, the component slice. InspectPopout is the
 * RENDERING of `buildInspectPopout` on the QOL-030 chassis — the
 * seven-section content itself is delegated to `inspectPopoutModel.test.ts`;
 * this suite asserts the RENDER contract:
 *
 *  - the fixed seven-section set is always rendered (one row per section),
 *  - the §3.3 stage-emphasised section renders first + expanded,
 *  - the read-only contract — Inspect exposes NO posting / editing
 *    affordance (no TextInput, no onChangeText, no submit, no compose
 *    callback); its single action is the §5 hand-off chip,
 *  - the §5 hand-off chip closes Inspect and opens the Act popout at the
 *    named entry (design §4 / §5),
 *  - the §7 edge cases — node with no evidence, own node (identical render),
 *    archived room (chip disabled), semantic flags absent, prev/next
 *    wrap-disabled at the ends,
 *  - the doctrine ban-list + chassis a11y.
 *
 * Follows the repo's `.tsx` UI-test discipline (`actPopoutComponent.test.tsx`
 * / `goPopoutComponent.test.tsx` / `chimeInGovernanceControl.test.tsx`): the
 * repo deliberately avoids runtime react-test-renderer (the pinned renderer
 * is held away from @testing-library's peer). The load-bearing render
 * decisions are exercised through the pure `inspectPopoutModel`, the
 * component is value-imported (proving it loads + type-checks), and the
 * component WIRING — chassis use, the no-write doctrine, the hand-off
 * closure, reduce-motion threading, the traversal controls — is asserted by
 * a static source-scan. `.tsx` extension matches the sibling popout tests.
 */
import * as fs from 'fs';
import * as path from 'path';
import { InspectPopout } from '../src/features/arguments/oneBox/InspectPopout';
import {
  buildInspectPopout,
  getInspectSection,
  INSPECT_SECTION_ORDER,
  INSPECT_SETTLED_BANNER,
  INSPECT_ARCHIVED_HANDOFF_REASON,
  type BuildInspectPopoutInput,
  type InspectSectionContent,
} from '../src/features/arguments/oneBox/inspectPopoutModel';
import { ALL_POINT_LIFECYCLE_STATES } from '../src/features/lifecycle';
import type { PointLifecycleState } from '../src/features/lifecycle';

const ONEBOX_DIR = path.join(process.cwd(), 'src', 'features', 'arguments', 'oneBox');
const INSPECT_POPOUT_SRC = fs.readFileSync(path.join(ONEBOX_DIR, 'InspectPopout.tsx'), 'utf8');

/**
 * Strips block + line comments so an import-purity scan inspects real CODE
 * only — a doctrine comment that names a forbidden primitive must not
 * register as a usage. Same helper shape as `goPopoutComponent.test.tsx`.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const INSPECT_POPOUT_CODE = stripComments(INSPECT_POPOUT_SRC);

// ── Fixture helpers (mirror inspectPopoutModel.test.ts) ────────

/** Plain-language section content with every field populated. */
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

/** A `buildInspectPopout` input with sensible defaults. */
function inspectInput(over: Partial<BuildInspectPopoutInput> = {}): BuildInspectPopoutInput {
  return {
    stage: 'stage' in over ? (over.stage ?? null) : 'open',
    content: over.content ?? fullContent(),
    isArchivedRoom: over.isArchivedRoom,
  };
}

// ── 1. The component value-imports + chassis use ───────────────

describe('QOL-032 InspectPopout — chassis use', () => {
  it('the component module loads and exports InspectPopout', () => {
    // Value-importing the component proves it mounts the chassis + the
    // model without a runtime error and type-checks against both.
    expect(typeof InspectPopout).toBe('function');
  });

  it('stands on the QOL-030 Popout chassis (does not re-implement it)', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/import\s*\{\s*Popout\s*\}\s*from\s*'\.\/Popout'/);
    expect(INSPECT_POPOUT_CODE).toMatch(/<Popout/);
  });

  it('titles the popout "Inspect"', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/title="Inspect"/);
  });

  it('does not redefine the chassis primitives (no local Popout/PopoutEntry decl)', () => {
    // QOL-032 must not fork the chassis — only consume it.
    expect(INSPECT_POPOUT_CODE).not.toMatch(/function\s+Popout\s*\(/);
    expect(INSPECT_POPOUT_CODE).not.toMatch(/function\s+PopoutEntry\s*\(/);
    expect(INSPECT_POPOUT_CODE).not.toMatch(/function\s+PopoutGroup\s*\(/);
  });

  it('builds its content from buildInspectPopout (the QOL-032 pure model)', () => {
    // The component CONSUMES the model — it must not re-author the §3.2 /
    // §3.3 section logic.
    expect(INSPECT_POPOUT_CODE).toMatch(/buildInspectPopout\(/);
  });

  it('threads reduce-motion into the chassis (accessibility)', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/reduceMotionOverride=\{reduceMotionOverride\}/);
  });

  it('reuses the chassis padded hit-slop for its own controls', () => {
    // The section-expand, hand-off, and traversal controls are QOL-032's
    // own; they must clear the 44px target via the chassis hit-slop.
    expect(INSPECT_POPOUT_CODE).toMatch(/PADDED_HIT_SLOP/);
    expect(INSPECT_POPOUT_CODE).toMatch(/from\s*'\.\/PopoutEntry'/);
  });
});

// ── 2. The fixed section set always renders (design §3.2) ──────

describe('QOL-032 InspectPopout — the fixed section set renders', () => {
  it('renders one section row per model section — all 7', () => {
    // The component maps model.sections → InspectSectionRow 1:1.
    expect(INSPECT_POPOUT_CODE).toMatch(/model\.sections\.map\(/);
    expect(INSPECT_POPOUT_CODE).toMatch(/<InspectSectionRow/);
    const model = buildInspectPopout(inspectInput());
    expect(model.sections).toHaveLength(7);
  });

  it('every section row carries a stable per-section testID', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/inspect-popout-section-/);
  });

  it('the section set the component renders is complete for every stage', () => {
    // The component renders whatever buildInspectPopout returns; the model
    // guarantees the full set — re-asserted here at the render boundary.
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const model = buildInspectPopout(inspectInput({ stage }));
      expect(model.sections.map((s) => s.id).sort()).toEqual(
        [...INSPECT_SECTION_ORDER].sort(),
      );
    }
  });

  it('a collapsed section is never removed — the row stays, only the body hides', () => {
    // The component keeps every InspectSectionRow mounted; only the body
    // <View> is gated on isExpanded. A collapsed section is still in the
    // list (design §3.3 "read-only detail is never hidden").
    expect(INSPECT_POPOUT_CODE).toMatch(/isExpanded\s*\?/);
    // The section body is conditionally rendered; the row is not.
    expect(INSPECT_POPOUT_CODE).toMatch(/inspect-popout-section-body-/);
  });

  it('each section keys off its stable id (no index keys)', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/key=\{section\.id\}/);
  });
});

// ── 3. The §3.3 emphasised section renders first + expanded ────
//
// QOL-032 design §3.3 — the stage-emphasised section is pulled to the top
// and expanded by default. The model orders + flags it; the component
// seeds its per-section expand state from `isExpandedByDefault`.

describe('QOL-032 InspectPopout — stage emphasis at the render boundary', () => {
  it('seeds the default expand state from the model isExpandedByDefault', () => {
    // The emphasised section opens expanded; the rest collapsed.
    expect(INSPECT_POPOUT_CODE).toMatch(/isExpandedByDefault/);
  });

  it('renders the emphasised section at slot 0 — every §3.3 stage', () => {
    // The component renders model.sections in order; the model puts the
    // emphasised section first. Re-asserted across every stage.
    const EXPECTED: Record<PointLifecycleState, string> = {
      open: 'says',
      answered: 'says',
      rebutted: 'unresolved',
      clarified: 'unresolved',
      source_requested: 'unresolved',
      quote_requested: 'unresolved',
      sourced: 'evidence_detail',
      narrowed: 'matters',
      conceded: 'matters',
      confirmed: 'next_move',
      synthesis_ready: 'next_move',
      moved_on_by_affirmative: 'sits',
      moved_on_by_negative: 'sits',
      ignored_by_affirmative: 'sits',
      ignored_by_negative: 'sits',
      ignored_by_both: 'sits',
      exhausted: 'sits',
      branch_recommended: 'sits',
      archived_or_resolved: 'says',
    };
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const model = buildInspectPopout(inspectInput({ stage }));
      expect({ stage, top: model.sections[0].id }).toEqual({
        stage,
        top: EXPECTED[stage],
      });
    }
  });

  it('the emphasised row gets a leading marker (text + weight, not color)', () => {
    // Design + accessibility: emphasis is shape/weight, never color alone.
    expect(INSPECT_POPOUT_CODE).toMatch(/section\.isEmphasized/);
    expect(INSPECT_POPOUT_CODE).toMatch(/sectionTitleEmphasized/);
  });

  it('an emphasised section is also expanded by default (model invariant held)', () => {
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const model = buildInspectPopout(inspectInput({ stage }));
      const emphasised = model.sections.find((s) => s.isEmphasized);
      expect(emphasised?.isExpandedByDefault).toBe(true);
    }
  });

  it('a stale popout re-derives on a stage change (useMemo on stage)', () => {
    // The component re-runs buildInspectPopout via a useMemo keyed on
    // stage; a stage change while open re-derives the section order.
    expect(INSPECT_POPOUT_CODE).toMatch(/useMemo\(/);
    const before = buildInspectPopout(inspectInput({ stage: 'open' }));
    const after = buildInspectPopout(inspectInput({ stage: 'sourced' }));
    expect(before.sections[0].id).not.toBe(after.sections[0].id);
  });
});

// ── 4. Read-only contract — NO posting / editing affordance ────
//
// QOL-032 design §3.1 / §9 — Inspect is STRICTLY READ-ONLY. The component
// renders detail; it never composes, posts, or edits a body. Its single
// action is the §5 hand-off chip, which hands off to the Act popout.

describe('QOL-032 InspectPopout — read-only contract', () => {
  it('renders no text-input affordance (no body editing)', () => {
    expect(INSPECT_POPOUT_CODE).not.toMatch(/<TextInput/);
    expect(INSPECT_POPOUT_CODE).not.toMatch(/onChangeText/);
    expect(INSPECT_POPOUT_CODE).not.toMatch(/editable/);
  });

  it('exposes no compose / post / submit affordance', () => {
    expect(INSPECT_POPOUT_CODE).not.toMatch(/onSelectBoxType/);
    expect(INSPECT_POPOUT_CODE).not.toMatch(/submit-argument/);
    expect(INSPECT_POPOUT_CODE).not.toMatch(/\bonSubmit\b/);
    expect(INSPECT_POPOUT_CODE).not.toMatch(/\bonCompose\b/);
  });

  it('the ONLY action prop is the §5 hand-off — onHandoffToAct', () => {
    // Inspect understands; Act does. The single bridge is onHandoffToAct.
    expect(INSPECT_POPOUT_CODE).toMatch(/onHandoffToAct/);
  });

  it('takes no onDirectAction / onRoleChange prop (those are Act’s)', () => {
    // Direct actions + role changes belong to the Act popout (QOL-031);
    // Inspect must not carry them.
    expect(INSPECT_POPOUT_CODE).not.toMatch(/onDirectAction/);
    expect(INSPECT_POPOUT_CODE).not.toMatch(/onRoleChange/);
  });

  it('the body section rows are read-only detail blocks (Text, not inputs)', () => {
    // Each section body is a <Text>; no interactive input element.
    expect(INSPECT_POPOUT_CODE).toMatch(/sectionBodyText/);
  });

  it('Inspect never opens the box itself — it only hands off to Act', () => {
    // The hand-off CLOSES Inspect; the host opens Act. Inspect opens no box.
    expect(INSPECT_POPOUT_CODE).toMatch(/onHandoffToAct\(/);
    // No box-type / composer-preset vocabulary leaks into Inspect.
    expect(INSPECT_POPOUT_CODE).not.toMatch(/quickActionToPreset|MoveDraftPatch/);
  });
});

// ── 5. Hand-off — the §5 chip closes Inspect, opens Act ────────
//
// QOL-032 design §4 / §5 — the §5 "Suggested next move" chip is the single
// bridge. Pressing it closes Inspect and opens the Act popout at the
// named ActEntryId.

describe('QOL-032 InspectPopout — hand-off to Act (design §4 / §5)', () => {
  it('the hand-off handler fires onHandoffToAct with the model ActEntryId', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/onHandoffToAct\(model\.handoff\.actEntryId\)/);
  });

  it('the hand-off handler then closes Inspect (the understand→do hand-off)', () => {
    // Design §4 — "closes Inspect and opens the Act popout". The handler
    // calls onClose right after the hand-off.
    const handler = INSPECT_POPOUT_CODE.slice(
      INSPECT_POPOUT_CODE.indexOf('handleHandoff'),
      INSPECT_POPOUT_CODE.indexOf('handleHandoff') + 320,
    );
    expect(handler).toMatch(/onHandoffToAct\(/);
    expect(handler).toMatch(/onClose\(\)/);
  });

  it('the hand-off chip renders inside the §5 next_move section only', () => {
    // The chip is passed to the §5 section row, null to every other row.
    expect(INSPECT_POPOUT_CODE).toMatch(/section\.id === 'next_move' \? handoffChip : null/);
  });

  it('the chip is a Pressable with a button role + accessibility label', () => {
    const chipBlock = INSPECT_POPOUT_CODE.slice(
      INSPECT_POPOUT_CODE.indexOf('inspect-popout-handoff-chip') - 600,
      INSPECT_POPOUT_CODE.indexOf('inspect-popout-handoff-chip') + 60,
    );
    expect(chipBlock).toMatch(/accessibilityRole="button"/);
    expect(chipBlock).toMatch(/accessibilityLabel=/);
  });

  it('a disabled hand-off never invokes the handler', () => {
    // The handler early-returns when the hand-off is disabled; the chip
    // also drops its onPress.
    expect(INSPECT_POPOUT_CODE).toMatch(/if \(model\.handoff\.isDisabled\) return/);
    expect(INSPECT_POPOUT_CODE).toMatch(/handoff\.isDisabled \? undefined : handleHandoff/);
  });

  it('the chip carries a trailing arrow — the hand-off signalled by shape', () => {
    // Color-independent affordance: the → marks the hand-off.
    expect(INSPECT_POPOUT_CODE).toMatch(/handoffChipArrow/);
  });

  it('the chip ActEntryId is the model hand-off target for every stage', () => {
    // The chip opens Act at exactly the model-named entry.
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const model = buildInspectPopout(inspectInput({ stage }));
      expect(typeof model.handoff.actEntryId).toBe('string');
      expect(model.handoff.actEntryId.length).toBeGreaterThan(0);
    }
  });
});

// ── 6. Settled banner — archived / resolved node (design §3.3) ─

describe('QOL-032 InspectPopout — settled banner (design §3.3)', () => {
  it('renders the settled banner only when the model raises the flag', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/model\.showsSettledBanner \?/);
    expect(INSPECT_POPOUT_CODE).toMatch(/inspect-popout-settled-banner/);
  });

  it('the banner copy comes from the model — INSPECT_SETTLED_BANNER', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/INSPECT_SETTLED_BANNER/);
  });

  it('only an archived_or_resolved node raises the banner flag', () => {
    for (const stage of ALL_POINT_LIFECYCLE_STATES) {
      const model = buildInspectPopout(inspectInput({ stage }));
      expect(model.showsSettledBanner).toBe(stage === 'archived_or_resolved');
    }
  });

  it('the banner states the argument is settled — never declares a winner', () => {
    expect(INSPECT_SETTLED_BANNER.toLowerCase()).toContain('settled');
    const verdict = ['winner', 'loser', 'won', 'lost', 'correct'];
    for (const token of verdict) {
      expect(INSPECT_SETTLED_BANNER.toLowerCase()).not.toContain(token);
    }
  });
});

// ── 7. Edge cases — design §7 ──────────────────────────────────

describe('QOL-032 InspectPopout — edge cases (design §7)', () => {
  it('node with no evidence — §E renders "No evidence attached", not hidden', () => {
    // The section set stays stable; §E shows the fallback line.
    const model = buildInspectPopout(
      inspectInput({ content: fullContent({ evidenceDetail: undefined }) }),
    );
    expect(model.sections).toHaveLength(7);
    expect(getInspectSection(model, 'evidence_detail')?.body).toBe('No evidence attached.');
  });

  it('semantic flags absent — §6 renders "No semantic flags", never a raw code', () => {
    const model = buildInspectPopout(
      inspectInput({ content: fullContent({ semanticFlags: [] }) }),
    );
    expect(getInspectSection(model, 'flags')?.body).toBe('No semantic flags.');
  });

  it('own node — Inspect render is IDENTICAL (read-only applies to everyone)', () => {
    // Design §7: "there is no own-node special case (unlike Act)". The
    // component has no viewer-role / own-bubble prop — its render is
    // role-agnostic.
    expect(INSPECT_POPOUT_CODE).not.toMatch(/own_bubble|ownBubble|isOwnNode|viewerRole/);
    // Two builds with the same inputs are deep-equal — there is no branch
    // that could make an "own node" render differently.
    const a = buildInspectPopout(inspectInput({ stage: 'open' }));
    const b = buildInspectPopout(inspectInput({ stage: 'open' }));
    expect(a).toEqual(b);
  });

  it('archived room — only the §5 hand-off chip is disabled; Inspect still works', () => {
    const model = buildInspectPopout(inspectInput({ isArchivedRoom: true }));
    // The chip is disabled with the settled reason.
    expect(model.handoff.isDisabled).toBe(true);
    expect(model.handoff.disabledReason).toBe(INSPECT_ARCHIVED_HANDOFF_REASON);
    // Every section is still present + populated.
    expect(model.sections).toHaveLength(7);
    for (const section of model.sections) {
      expect(section.body.length).toBeGreaterThan(0);
    }
  });

  it('archived room — the disabled chip renders its reason under the chip', () => {
    // The component shows the disabledReason text when the chip is disabled.
    expect(INSPECT_POPOUT_CODE).toMatch(/handoff\.isDisabled && handoff\.disabledReason/);
    expect(INSPECT_POPOUT_CODE).toMatch(/handoffDisabledReason/);
  });

  it('prev/next disabled at the root — no wrap (design §7, IX-003)', () => {
    // The `‹ prev` control is enabled only when hasPrev && onPrev exist.
    expect(INSPECT_POPOUT_CODE).toMatch(
      /prevEnabled\s*=\s*hasPrev === true && typeof onPrev === 'function'/,
    );
    // A disabled control drops its onPress (cannot be invoked → no wrap).
    expect(INSPECT_POPOUT_CODE).toMatch(/prevEnabled \? handlePrev : undefined/);
  });

  it('prev/next disabled at the latest move — no wrap (design §7, IX-003)', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(
      /nextEnabled\s*=\s*hasNext === true && typeof onNext === 'function'/,
    );
    expect(INSPECT_POPOUT_CODE).toMatch(/nextEnabled \? handleNext : undefined/);
  });

  it('the traversal handlers no-op when the end is reached', () => {
    // handlePrev / handleNext are guarded — calling them at an end does
    // nothing (the structural guarantee that there is no wrap).
    expect(INSPECT_POPOUT_CODE).toMatch(/if \(prevEnabled && onPrev\) onPrev\(\)/);
    expect(INSPECT_POPOUT_CODE).toMatch(/if \(nextEnabled && onNext\) onNext\(\)/);
  });

  it('the traversal row renders both controls with a testID', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/inspect-popout-prev/);
    expect(INSPECT_POPOUT_CODE).toMatch(/inspect-popout-next/);
    expect(INSPECT_POPOUT_CODE).toMatch(/inspect-popout-traversal/);
  });
});

// ── 8. Accessibility — every control is a labelled 44px target ─

describe('QOL-032 InspectPopout — accessibility', () => {
  it('every section header is a Pressable with a button role + expanded state', () => {
    const headerBlock = INSPECT_POPOUT_CODE.slice(
      INSPECT_POPOUT_CODE.indexOf('inspect-popout-section-header') - 700,
      INSPECT_POPOUT_CODE.indexOf('inspect-popout-section-header') + 60,
    );
    expect(headerBlock).toMatch(/accessibilityRole="button"/);
    expect(headerBlock).toMatch(/accessibilityState=\{\{ expanded: isExpanded \}\}/);
  });

  it('the section header uses the model verbose accessibility label', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/accessibilityLabel=\{section\.accessibilityLabel\}/);
  });

  it('the traversal controls carry a button role + a disabled state', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/accessibilityLabel="Inspect the previous move"/);
    expect(INSPECT_POPOUT_CODE).toMatch(/accessibilityLabel="Inspect the next move"/);
    expect(INSPECT_POPOUT_CODE).toMatch(/accessibilityState=\{\{ disabled: !prevEnabled \}\}/);
    expect(INSPECT_POPOUT_CODE).toMatch(/accessibilityState=\{\{ disabled: !nextEnabled \}\}/);
  });

  it('every interactive row carries a minimum 44px target', () => {
    // The section header + traversal buttons set minHeight 44; the chassis
    // hit-slop pads any visually-smaller control.
    expect(INSPECT_POPOUT_CODE).toMatch(/minHeight: 44/);
  });

  it('the caret + marker glyphs are hidden from assistive tech (label carries meaning)', () => {
    // The expand caret + emphasis marker are decorative — the role/state +
    // label already convey them to a screen reader.
    expect(INSPECT_POPOUT_CODE).toMatch(/accessibilityElementsHidden/);
    expect(INSPECT_POPOUT_CODE).toMatch(/importantForAccessibility="no"/);
  });

  it('open / collapsed state is carried by a text caret (shape, not color)', () => {
    expect(INSPECT_POPOUT_CODE).toMatch(/isExpanded \? '▾' : '▸'/);
  });

  it('all visible text is wrapped in <Text> (no raw strings in <View>)', () => {
    // The literal copy the component renders (caret, marker, arrow,
    // prev/next labels) is inside <Text>.
    expect(INSPECT_POPOUT_CODE).toMatch(/<Text[^>]*>\s*‹ prev/);
    expect(INSPECT_POPOUT_CODE).toMatch(/next ›\s*<\/Text>/);
  });
});

// ── 9. No-write doctrine (design §9) ───────────────────────────

describe('QOL-032 InspectPopout — no-write doctrine', () => {
  it('imports no Supabase client', () => {
    expect(/from ['"][^'"]*supabase/.test(INSPECT_POPOUT_CODE)).toBe(false);
  });

  it('performs no network call', () => {
    expect(/\bfetch\(/.test(INSPECT_POPOUT_CODE)).toBe(false);
    expect(/\bXMLHttpRequest\b/.test(INSPECT_POPOUT_CODE)).toBe(false);
  });

  it('imports no AI provider', () => {
    expect(/anthropic|openai|x\.ai/i.test(INSPECT_POPOUT_CODE)).toBe(false);
  });

  it('does not write to public.arguments or bypass submit-argument', () => {
    expect(/submit-argument/.test(INSPECT_POPOUT_CODE)).toBe(false);
    expect(/\.insert\(|\.update\(|\.delete\(/.test(INSPECT_POPOUT_CODE)).toBe(false);
  });

  it('does not use the service role anywhere', () => {
    expect(/SERVICE_ROLE|service_role/.test(INSPECT_POPOUT_CODE)).toBe(false);
  });

  it('does not import a router (Inspect hands off — it triggers no route change)', () => {
    expect(/from ['"][^'"]*(react-navigation|expo-router)/.test(INSPECT_POPOUT_CODE)).toBe(false);
  });

  it('reads no wall clock (deterministic render projection)', () => {
    expect(/Date\.now\(\)/.test(INSPECT_POPOUT_CODE)).toBe(false);
  });

  it('does not import an icon library (uses <Text> glyphs)', () => {
    expect(INSPECT_POPOUT_CODE).not.toMatch(/from ['"]@expo\/vector-icons/);
    expect(INSPECT_POPOUT_CODE).not.toMatch(/react-native-vector-icons/);
  });
});

// ── 10. Doctrine ban-list — every authored string is clean ─────

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
];

function hitsBanned(s: string, token: string): boolean {
  const lower = s.toLowerCase();
  // `won` / `lost` need a word boundary to avoid false hits.
  if (token === 'won' || token === 'lost') {
    return new RegExp(`\\b${token}\\b`).test(lower);
  }
  return lower.includes(token);
}

describe('QOL-032 InspectPopout — doctrine ban-list scan', () => {
  it('no rendered <Text> literal carries a verdict token', () => {
    // The component authors a handful of literal strings (prev/next labels,
    // glyphs); scan every <Text>…</Text> literal.
    const textLiterals = (INSPECT_POPOUT_SRC.match(/<Text[^>]*>([^<{][^<]*)<\/Text>/g) ?? []).join(
      ' ',
    );
    for (const token of BANNED) {
      expect(hitsBanned(textLiterals, token)).toBe(false);
    }
  });

  it('no accessibilityLabel literal carries a verdict token', () => {
    const a11y = (INSPECT_POPOUT_SRC.match(/accessibilityLabel=["'`][^"'`]+["'`]/g) ?? []).join(' ');
    for (const token of BANNED) {
      expect(hitsBanned(a11y, token)).toBe(false);
    }
  });

  it('the model-supplied section copy carries no verdict token (every stage)', () => {
    // The component renders model strings verbatim — re-scan them here at
    // the render boundary across every stage.
    for (const stage of [...ALL_POINT_LIFECYCLE_STATES, null]) {
      const model = buildInspectPopout(inspectInput({ stage }));
      for (const section of model.sections) {
        for (const token of BANNED) {
          expect(hitsBanned(section.title, token)).toBe(false);
          expect(hitsBanned(section.accessibilityLabel, token)).toBe(false);
          expect(hitsBanned(section.body, token)).toBe(false);
        }
      }
      for (const token of BANNED) {
        expect(hitsBanned(model.handoff.chipLabel, token)).toBe(false);
        expect(hitsBanned(model.handoff.frame, token)).toBe(false);
      }
    }
  });

  it('no rendered string carries a snake_case identifier (RULE-001)', () => {
    // The model strings are plain language; the component adds only glyph
    // + prev/next literals. Scan the rendered model strings.
    const snake = /[a-z]_[a-z]/i;
    for (const stage of [...ALL_POINT_LIFECYCLE_STATES, null]) {
      const model = buildInspectPopout(inspectInput({ stage }));
      for (const section of model.sections) {
        expect(snake.test(section.title)).toBe(false);
        expect(snake.test(section.body)).toBe(false);
        expect(snake.test(section.accessibilityLabel)).toBe(false);
      }
    }
  });
});
