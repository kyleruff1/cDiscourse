/**
 * UX-001.3 — oneBox mode list reconciliation tests (Q2).
 *
 * Pins the brief's mode list against the implementation:
 *  - 13 BoxTypes (12 from QOL-030 + offer_concession from UX-001.3).
 *  - 14 canonical modes from the brief reduce to 13 BoxTypes + 2
 *    header-chip variants of `respond` (Reply and Challenge).
 *  - The new `offer_concession` ActEntry exists, routes to the
 *    `'resolve'` group, opens the `offer_concession` BoxType, and is
 *    a candidate for `node` targets.
 *  - actEntryToQuickAction handles the new entry without throwing.
 *  - The new BoxType has a schema in SCHEMA_BY_TYPE (forced_list).
 *  - BOX_TYPE_LABEL has a plain-English entry for it.
 */
import fs from 'fs';
import path from 'path';
import {
  ALL_BOX_TYPES,
  renderSchema,
  NO_TARGET,
} from '../src/features/arguments/oneBox/boxModel';
import {
  ALL_ACT_ENTRY_IDS,
  _debug,
  actEntryToQuickAction,
} from '../src/features/arguments/oneBox/actPopoutModel';

// OneBox.tsx value-imports ArgumentComposer (AsyncStorage chain), so
// pure-TS tests source-scan BOX_TYPE_LABEL instead of value-importing
// it. Mirrors the pattern in oneBoxCopyBanList.test.ts.
const ONEBOX_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'arguments', 'oneBox', 'OneBox.tsx'),
  'utf8',
);

function parseBoxTypeLabels(): Map<string, string> {
  const map = new Map<string, string>();
  // Match every line of the form `boxType: 'Plain label',` inside
  // BOX_TYPE_LABEL = Object.freeze({ ... }).
  const m = ONEBOX_SRC.match(/BOX_TYPE_LABEL[^=]*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
  if (!m) return map;
  const block = m[1];
  const lineRe = /^\s*([a-z_]+):\s*'([^']+)'/gm;
  let lm;
  while ((lm = lineRe.exec(block)) !== null) {
    map.set(lm[1], lm[2]);
  }
  return map;
}

describe('UX-001.3 — BoxType count and offer_concession presence', () => {
  it('exposes 13 BoxTypes', () => {
    expect(ALL_BOX_TYPES).toHaveLength(13);
  });

  it('includes offer_concession in ALL_BOX_TYPES', () => {
    expect(ALL_BOX_TYPES).toContain('offer_concession');
  });

  it('still includes every QOL-030 BoxType', () => {
    const qol030Types = [
      'root_claim',
      'respond',
      'respond_to_concession',
      'respond_to_evidence',
      'add_evidence',
      'ask_source',
      'ask_quote',
      'clarify',
      'narrow',
      'confirm',
      'synthesize',
      'branch_tangent',
    ];
    for (const t of qol030Types) {
      expect(ALL_BOX_TYPES).toContain(t);
    }
  });
});

describe('UX-001.3 — offer_concession schema', () => {
  it('renderSchema(offer_concession) returns the forced_list shape with concession_list', () => {
    const schema = renderSchema('offer_concession', NO_TARGET);
    expect(schema.kind).toBe('forced_list');
    expect([...schema.sections]).toEqual(['concession_list']);
    expect(schema.hasFreeBody).toBe(false);
    expect(schema.configuresRoom).toBe(false);
  });

  it('mirrors the receiver-side respond_to_concession schema shape', () => {
    const author = renderSchema('offer_concession', NO_TARGET);
    const receiver = renderSchema('respond_to_concession', NO_TARGET);
    expect(author.kind).toBe(receiver.kind);
    expect([...author.sections]).toEqual([...receiver.sections]);
    expect(author.hasFreeBody).toBe(receiver.hasFreeBody);
  });
});

describe('UX-001.3 — BOX_TYPE_LABEL for offer_concession (source scan)', () => {
  const labels = parseBoxTypeLabels();

  it('has a plain-English label "Offer concessions"', () => {
    expect(labels.get('offer_concession')).toBe('Offer concessions');
  });

  it('has a label for every BoxType', () => {
    for (const t of ALL_BOX_TYPES) {
      expect(labels.has(t)).toBe(true);
      expect((labels.get(t) ?? '').length).toBeGreaterThan(0);
    }
  });
});

describe('UX-001.3 — offer_concession ActEntry', () => {
  it('is in ALL_ACT_ENTRY_IDS', () => {
    expect(ALL_ACT_ENTRY_IDS).toContain('offer_concession');
  });

  it('routes to the resolve group with opensBoxType = offer_concession', () => {
    const def = _debug.ACT_ENTRY_DEFINITIONS.offer_concession;
    expect(def.group).toBe('resolve');
    expect(def.opensBoxType).toBe('offer_concession');
    expect(def.kind).toBe('box_opening');
    expect(def.argumentType).toBe('concession');
  });

  it('appears in the node-target candidate list', () => {
    const nodeCandidates = _debug.CANDIDATES_BY_TARGET_KIND.node;
    expect(nodeCandidates).toContain('offer_concession');
  });
});

describe('UX-001.3 — actEntryToQuickAction handles offer_concession', () => {
  it('returns null for offer_concession (no shipped preset; OneBox owns the form)', () => {
    expect(actEntryToQuickAction('offer_concession')).toBeNull();
  });

  it('still returns the right preset for the existing entries', () => {
    expect(actEntryToQuickAction('challenge')).toBe('challenge');
    expect(actEntryToQuickAction('add_evidence')).toBe('evidence');
    expect(actEntryToQuickAction('reply')).toBeNull();
  });
});

describe('UX-001.3 — engine gate is unchanged for non-typed entries', () => {
  // Pin the engine-gate doctrine: offer_concession's argumentType is
  // `concession`, which the existing Constitution accepts as a valid
  // child of `claim` / `rebuttal` / `counter_rebuttal` (the engine
  // table is unchanged in UX-001.3). We assert structurally that the
  // entry HAS an argumentType, so the engine gate applies — it must
  // be filtered out for unsupported parent types.
  it('has a non-null argumentType (engine gate applies)', () => {
    const def = _debug.ACT_ENTRY_DEFINITIONS.offer_concession;
    expect(def.argumentType).not.toBeNull();
    expect(def.argumentType).toBe('concession');
  });
});

describe('UX-001.3 — header-chip variants of respond', () => {
  it('the existing reply ActEntry remains a respond box opener', () => {
    expect(_debug.ACT_ENTRY_DEFINITIONS.reply.opensBoxType).toBe('respond');
  });

  it('the existing challenge ActEntry remains a respond box opener', () => {
    expect(_debug.ACT_ENTRY_DEFINITIONS.challenge.opensBoxType).toBe('respond');
  });

  it('the two map to the same BoxType — they are presentation variants', () => {
    const reply = _debug.ACT_ENTRY_DEFINITIONS.reply;
    const challenge = _debug.ACT_ENTRY_DEFINITIONS.challenge;
    expect(reply.opensBoxType).toBe(challenge.opensBoxType);
  });
});
