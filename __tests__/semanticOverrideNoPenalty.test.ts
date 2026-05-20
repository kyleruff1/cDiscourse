/**
 * MCP-015 — Semantic override no-penalty / no-score / no-flag guard.
 *
 * Overriding is NEVER a penalty. This file proves — by object-key assertion
 * over every produced shape, by an export-name scan, and by a source-text
 * scan — that the override model carries no `delta` / `score` / `penalty` /
 * `block` / `flag` field and no moderation linkage.
 */

import * as fs from 'fs';
import * as path from 'path';

import * as semanticOverride from '../src/features/semanticOverride';
import {
  buildSemanticOverrideRecord,
  toSemanticOverrideMetadataEvent,
  toAnswersParentMetadataEvent,
  evaluateSemanticOverridePrompt,
  bumpRepeatedOverrideSignal,
  emptyRepeatedOverrideSignal,
} from '../src/features/semanticOverride';
import type {
  SemanticOverridePrompt,
  SemanticOverrideRecord,
} from '../src/features/semanticOverride';

// ── The forbidden field set ───────────────────────────────────────

/**
 * Any of these keys on a produced shape would turn the override into a
 * penalty / score / moderation surface — forbidden by MCP-010 §3.2 and the
 * MCP-015 acceptance criterion.
 */
const FORBIDDEN_FIELDS = [
  'delta',
  'score',
  'penalty',
  'penalized',
  'block',
  'blocked',
  'flag',
  'flagged',
  'winner',
  'loser',
  'truthValue',
  'moderation',
  'demerit',
  'strike',
];

function expectNoForbiddenKeys(obj: object, label: string): void {
  const keys = Object.keys(obj).map((k) => k.toLowerCase());
  for (const forbidden of FORBIDDEN_FIELDS) {
    expect({ label, key: forbidden, present: keys.includes(forbidden) }).toEqual({
      label,
      key: forbidden,
      present: false,
    });
  }
}

// ── Sample shapes ─────────────────────────────────────────────────

function samplePrompt(): SemanticOverridePrompt {
  return evaluateSemanticOverridePrompt({
    packet: {
      packetVersion: 'mcp-semantic-referee-v0',
      promptVersion: 'mcp-semantic-referee-prompt-v0',
      modelVersion: 'mock-model-0',
      provider: 'mock',
      authoritative: false,
      inputHash: 'h',
      contentHash: 'h',
      roomId: 'room-1',
      binaries: [
        {
          classifierId: 'responds_to_parent',
          value: 0,
          confidence: 'low',
          reasonCode: 'parent_continuity_redirects_topic',
        },
      ],
      routeSuggestion: 'mainline',
      frictionSuggestion: 'none',
      scoreHints: {
        continuityCredit: 0,
        evidencePressure: 0,
        branchHygiene: 0,
        synthesisReadiness: 0,
        sourceChainDebt: 0,
        unresolvedRedirectRisk: 0,
      },
    },
    viewerActorRole: 'participant_affirmative',
    repeatedSignal: emptyRepeatedOverrideSignal('room-1'),
  });
}

function sampleRecord(): SemanticOverrideRecord {
  return buildSemanticOverrideRecord({
    prompt: samplePrompt(),
    messageId: 'msg-1',
    clusterId: 'cluster-1',
    chosenLane: 'tangent',
    assertsAnswersParent: true,
    originalRouteSuggestion: 'mainline',
    overriddenByUserId: 'user-1',
    overriddenByActorRole: 'participant_affirmative',
    at: '2026-05-20T10:00:00.000Z',
  });
}

// ── Schema-shape guards ───────────────────────────────────────────

describe('semantic override no-penalty — produced shapes carry no penalty field', () => {
  it('SemanticOverridePrompt has no delta / score / penalty / block / flag key', () => {
    expectNoForbiddenKeys(samplePrompt(), 'SemanticOverridePrompt');
  });

  it('SemanticOverrideRecord has no delta / score / penalty / block / flag key', () => {
    expectNoForbiddenKeys(sampleRecord(), 'SemanticOverrideRecord');
  });

  it('the projected lane MetadataEvent has no delta / score / penalty / block / flag key', () => {
    expectNoForbiddenKeys(
      toSemanticOverrideMetadataEvent(sampleRecord()),
      'lane MetadataEvent',
    );
  });

  it('the projected answers_parent MetadataEvent has no delta / score / penalty / block / flag key', () => {
    const event = toAnswersParentMetadataEvent(sampleRecord());
    expect(event).not.toBeNull();
    expectNoForbiddenKeys(event as object, 'answers_parent MetadataEvent');
  });

  it('the RepeatedOverrideSignal has exactly roomId / overrideCountThisRoom / softenCopy', () => {
    const signal = bumpRepeatedOverrideSignal(emptyRepeatedOverrideSignal('room-1'));
    expect(Object.keys(signal).sort()).toEqual(
      ['overrideCountThisRoom', 'roomId', 'softenCopy'].sort(),
    );
  });

  it('bumpRepeatedOverrideSignal produces no persisted / profile / cross-room / score field', () => {
    const signal = bumpRepeatedOverrideSignal(emptyRepeatedOverrideSignal('room-1'));
    expectNoForbiddenKeys(signal, 'RepeatedOverrideSignal');
    const keys = Object.keys(signal).map((k) => k.toLowerCase());
    for (const banned of ['persisted', 'profile', 'userid', 'total', 'aggregate']) {
      expect(keys.includes(banned)).toBe(false);
    }
  });
});

// ── Export-name scan ──────────────────────────────────────────────

describe('semantic override no-penalty — no penalty-shaped export name', () => {
  it('the semanticOverride model exports nothing named flag / score / penalty / delta / block', () => {
    for (const name of Object.keys(semanticOverride)) {
      const lower = name.toLowerCase();
      for (const token of ['flag', 'score', 'penalty', 'delta', 'block']) {
        expect({ name, token, hit: lower.includes(token) }).toEqual({
          name,
          token,
          hit: false,
        });
      }
    }
  });
});

// ── Source-text scan ──────────────────────────────────────────────

describe('semantic override no-penalty — no flags API in the model source', () => {
  const SO_DIR = path.join(__dirname, '..', 'src', 'features', 'semanticOverride');

  function stripCommentsAndStrings(src: string): string {
    let out = src;
    out = out.replace(/\/\*[\s\S]*?\*\//g, '');
    out = out.replace(/\/\/[^\n]*/g, '');
    out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
    out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
    out = out.replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``');
    return out;
  }

  for (const file of ['overrideRecordModel.ts', 'overrideTriggerModel.ts']) {
    it(`${file} references no flags API / public.flags`, () => {
      const code = stripCommentsAndStrings(
        fs.readFileSync(path.join(SO_DIR, file), 'utf8'),
      );
      expect(code.includes('public.flags')).toBe(false);
      expect(/\bflags\b/i.test(code)).toBe(false);
      expect(/\binsertFlag\b/i.test(code)).toBe(false);
    });
  }
});
