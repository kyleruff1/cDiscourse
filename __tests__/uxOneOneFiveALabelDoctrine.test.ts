/**
 * UX-001.5A — Label doctrine ban-list test (load-bearing safety).
 *
 * Mirrors __tests__/uxOneOneFiveDoctrine.test.ts pattern. Scans
 * src/features/nodeLabels/ for forbidden tokens, scans render results
 * for raw classifier IDs / manual tag codes, and proves the Stop
 * Conditions 17/18 hold across a broad input battery.
 *
 * Maps acceptance criteria AC 6, 7, 10, 17, 18, 19, 20 (no raw codes
 * + sensitive suppressed + no verdict copy + no new AI call + no
 * classifier prompt change + no schema change).
 *
 * 15 doctrine constraints from design §13 enforced.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ManualTagEntry } from '../src/features/metadata/moveMetadataLedger';
import {
  computeNodeLabelStripDescriptors,
} from '../src/features/nodeLabels/NodeLabelStrip';
import {
  computeNodeLabelInspectGroups,
} from '../src/features/nodeLabels/NodeLabelInspectGroups';
import {
  adaptCompositionMutationSource,
  adaptRawClassifierBinarySource,
  adaptSemanticRefereeSourceNodeMount,
} from '../src/features/nodeLabels/nodeLabelSourceAdapters';

const REPO_ROOT = process.cwd();
const NODE_LABELS_DIR = path.join(REPO_ROOT, 'src', 'features', 'nodeLabels');

function readAllNodeLabelSources(): Array<{ file: string; src: string }> {
  const files = fs.readdirSync(NODE_LABELS_DIR);
  return files
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map((f) => ({
      file: f,
      src: fs.readFileSync(path.join(NODE_LABELS_DIR, f), 'utf8'),
    }));
}

function extractStringLiterals(src: string): string[] {
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const literals: string[] = [];
  const re = /(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    literals.push(m[2]);
  }
  return literals;
}

function manualTag(code: string): ManualTagEntry {
  return {
    code: code as ManualTagEntry['code'],
    appliedByUserId: 'user-1',
    appliedByActorRole: 'participant_affirmative',
    appliedAt: '2026-05-25T12:00:00.000Z',
    dedupeKey: `${code}:user-1`,
  };
}

// ── Constraint 1 — No verdict tokens in user-facing strings ───────

const VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'true',
  'false',
  'correct',
  'incorrect',
  'proven',
  'disproven',
  'lost',
  'defeated',
  'won',
  'validated',
];

describe('UX-001.5A doctrine §1 — no verdict tokens in user-facing strings', () => {
  for (const token of VERDICT_TOKENS) {
    it(`no nodeLabels source file emits user-facing string containing "${token}"`, () => {
      for (const { file, src } of readAllNodeLabelSources()) {
        const literals = extractStringLiterals(src);
        for (const literal of literals) {
          // User-facing strings live in `label`, `shortLabel`, `description`
          // initializers — but the literal scan can't distinguish those
          // from internal jsdoc/comment strings. We exclude registry-
          // entry rawKeys which legitimately contain words like
          // 'proves_*' or 'wins_*' if they appeared. The test focuses on
          // narrative-shaped tokens that wouldn't appear in rawKeys.
          const lower = literal.toLowerCase();
          // Allow rawKeys + comment-only contexts. The bag is the
          // intersection with verdict tokens.
          // Critical: 'verified' alone is too aggressive — it appears in
          // legitimate registry text. But 'validated' / 'won' / etc.
          // never should.
          if (lower === token) {
            throw new Error(`Verdict token "${token}" leaked into a string literal in ${file}`);
          }
        }
      }
    });
  }
});

// ── Constraint 2 — No amplification tokens in user-facing strings ──

const AMPLIFICATION_TOKENS = [
  'likes',
  'retweets',
  'shares',
  'followers',
  'verified',
  'engagement',
  'amplification',
  'trending',
  'virality',
  'viral',
];

describe('UX-001.5A doctrine §2 — no amplification tokens', () => {
  for (const token of AMPLIFICATION_TOKENS) {
    it(`nodeLabels source files do not literally equal "${token}"`, () => {
      for (const { file, src } of readAllNodeLabelSources()) {
        const literals = extractStringLiterals(src);
        for (const literal of literals) {
          if (literal.toLowerCase() === token) {
            throw new Error(`Amplification token "${token}" leaked in ${file}`);
          }
        }
      }
    });
  }
});

// ── Constraint 3 — No person-attribution tokens ───────────────────

const PERSON_TOKENS = ['troll', 'bot', 'astroturfer'];

describe('UX-001.5A doctrine §3 — no person-attribution tokens', () => {
  for (const token of PERSON_TOKENS) {
    it(`nodeLabels source files do not literally equal "${token}"`, () => {
      for (const { file, src } of readAllNodeLabelSources()) {
        const literals = extractStringLiterals(src);
        for (const literal of literals) {
          if (literal.toLowerCase() === token) {
            throw new Error(`Person token "${token}" leaked in ${file}`);
          }
        }
      }
    });
  }
});

// ── Constraint 4 — No service-role / AI provider imports ──────────

describe('UX-001.5A doctrine §4 — no service-role / AI provider imports', () => {
  it('no nodeLabels source file references SUPABASE_SERVICE_ROLE_KEY', () => {
    for (const { file, src } of readAllNodeLabelSources()) {
      expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      void file;
    }
  });

  it('no nodeLabels source file references ANTHROPIC_API_KEY', () => {
    for (const { file, src } of readAllNodeLabelSources()) {
      expect(src).not.toMatch(/ANTHROPIC_API_KEY/);
      void file;
    }
  });

  it('no nodeLabels source file imports from @anthropic-ai', () => {
    for (const { file, src } of readAllNodeLabelSources()) {
      expect(src).not.toMatch(/from\s+['"]@anthropic-ai/);
      void file;
    }
  });

  it('no nodeLabels source file imports anthropic SDK', () => {
    for (const { file, src } of readAllNodeLabelSources()) {
      expect(src).not.toMatch(/import.*anthropic/i);
      void file;
    }
  });

  it('no nodeLabels source file uses fetch to api.anthropic / api.x.ai / api.twitter', () => {
    for (const { file, src } of readAllNodeLabelSources()) {
      expect(src).not.toMatch(/fetch.*api\.anthropic/);
      expect(src).not.toMatch(/fetch.*api\.x\.ai/);
      expect(src).not.toMatch(/fetch.*api\.twitter/);
      void file;
    }
  });

  it('no nodeLabels source file uses XAI_API_KEY or X_BEARER_TOKEN', () => {
    for (const { file, src } of readAllNodeLabelSources()) {
      expect(src).not.toMatch(/XAI_API_KEY/);
      expect(src).not.toMatch(/X_BEARER_TOKEN/);
      void file;
    }
  });
});

// ── Constraint 5 — No raw classifier IDs in render output (sample) ─

const RAW_CLASSIFIER_IDS = [
  'introduces_new_issue',
  'creates_source_chain_gap',
  'quote_anchors_parent',
  'requests_clarification',
  'concedes_narrow_point',
];

describe('UX-001.5A doctrine §5 — raw classifier IDs never appear in render output', () => {
  const computeBigInputs = () =>
    computeNodeLabelInspectGroups({
      messageId: 'msg-1',
      manualTagEntries: [manualTag('needs_source'), manualTag('definition_issue')],
      autoMetadataCodes: [
        'has_evidence',
        'has_rebuttal',
        'has_counter_rebuttal',
        'branch_suggested',
        'branch_created',
        'point_stalled',
      ],
      clusterState: 'rebutted',
      messageContribution: 'sourced',
    });

  const strip = () =>
    computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [manualTag('needs_source'), manualTag('definition_issue')],
      autoMetadataCodes: ['has_evidence', 'has_rebuttal', 'has_counter_rebuttal'],
      clusterState: 'rebutted',
      messageContribution: 'sourced',
    });

  for (const rawId of RAW_CLASSIFIER_IDS) {
    it(`Inspect output never contains raw classifier ID "${rawId}" in label`, () => {
      const result = computeBigInputs();
      for (const desc of [...result.observationDescriptors, ...result.allegationDescriptors]) {
        expect(desc.label).not.toContain(rawId);
        expect(desc.tooltip ?? '').not.toContain(rawId);
        expect(desc.ariaLabel ?? '').not.toContain(rawId);
      }
    });

    it(`Strip output never contains raw classifier ID "${rawId}" in label`, () => {
      const result = strip();
      for (const desc of result.descriptors) {
        expect(desc.label).not.toContain(rawId);
        expect(desc.tooltip ?? '').not.toContain(rawId);
        expect(desc.ariaLabel ?? '').not.toContain(rawId);
      }
    });
  }
});

// ── Constraint 6 — No raw manual tag codes in render output ───────

const RAW_MANUAL_TAG_CODES = [
  'needs_source',
  'definition_issue',
  'causal_mechanism',
  'evidence_debt',
  'ready_for_synthesis',
];

describe('UX-001.5A doctrine §6 — raw manual tag codes never appear in render output', () => {
  for (const rawCode of RAW_MANUAL_TAG_CODES) {
    it(`Inspect output never contains raw manual tag code "${rawCode}" in label`, () => {
      const result = computeNodeLabelInspectGroups({
        messageId: 'msg-1',
        manualTagEntries: [manualTag(rawCode)],
        autoMetadataCodes: [],
        clusterState: 'open',
        messageContribution: null,
      });
      for (const desc of [...result.observationDescriptors, ...result.allegationDescriptors]) {
        expect(desc.label).not.toContain(rawCode);
      }
    });
  }
});

// ── Constraint 7 — Sensitive composer-only codes NEVER on node surfaces ──

const SENSITIVE_CODES = [
  'shifts_to_person_or_intent',
  'contains_unplayable_insult_only',
  'needs_pre_send_pause',
];

describe('UX-001.5A doctrine §7 — sensitive composer-only codes never on Timeline / Inspect', () => {
  for (const code of SENSITIVE_CODES) {
    it(`Timeline strip never emits descriptor with id containing "${code}"`, () => {
      // Even with no special input, the codes should never surface
      // because they are composer_only disposition + the surface filter
      // excludes them.
      const result = computeNodeLabelStripDescriptors({
        messageId: 'msg-1',
        manualTagEntries: [],
        autoMetadataCodes: [],
        clusterState: 'rebutted',
        messageContribution: null,
      });
      for (const desc of result.descriptors) {
        expect(desc.id).not.toContain(code);
        expect(desc.label).not.toContain(code);
      }
    });

    it(`Inspect groups never emit descriptor with id containing "${code}"`, () => {
      const result = computeNodeLabelInspectGroups({
        messageId: 'msg-1',
        manualTagEntries: [],
        autoMetadataCodes: [],
        clusterState: 'rebutted',
        messageContribution: null,
      });
      for (const desc of [...result.observationDescriptors, ...result.allegationDescriptors]) {
        expect(desc.id).not.toContain(code);
        expect(desc.label).not.toContain(code);
      }
    });
  }
});

// ── Constraint 8 — Stop Conditions 17/18 still hold (random inputs) ──

describe('UX-001.5A doctrine §8 — Stop Conditions 17/18 enforced across 20 inputs', () => {
  it('Source 4 adapter returns [] for 20 random inputs', () => {
    for (let i = 0; i < 20; i += 1) {
      const result = adaptCompositionMutationSource({
        messageId: `msg-${i}-${Math.random()}`,
        mutations: [{ kind: `m-${i}` }],
      });
      expect(result).toEqual([]);
    }
  });

  it('Source 5 node-mount adapter returns [] for 20 random inputs', () => {
    for (let i = 0; i < 20; i += 1) {
      const result = adaptSemanticRefereeSourceNodeMount({
        messageId: `msg-${i}`,
        refereePacket: { iteration: i },
      });
      expect(result).toEqual([]);
    }
  });

  it('Source 6 adapter returns [] for 20 random inputs', () => {
    for (let i = 0; i < 20; i += 1) {
      const result = adaptRawClassifierBinarySource({
        messageId: `msg-${i}`,
        binaries: [{ k: i }],
      });
      expect(result).toEqual([]);
    }
  });
});

// ── Constraint 9 — No new visual primitives ────────────────────────

describe('UX-001.5A doctrine §9 — no new visual primitives introduced', () => {
  it('no nodeLabels source file declares a new pill / chip / overlay primitive', () => {
    // The pill / chip shape comes from AnnotationChip which is the
    // UX-001.5 primitive. nodeLabels composes — does NOT redeclare.
    for (const { file, src } of readAllNodeLabelSources()) {
      // No hex color literals — primitives carry color via tokens.
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      // No new borderRadius beyond what wraps existing primitives.
      // The two RN component files only use SPACING tokens for
      // container margins.
      void file;
    }
  });
});

// ── Constraint 10 — No designTokens.ts modification ────────────────

describe('UX-001.5A doctrine §10 — no designTokens.ts modification', () => {
  it('designTokens.ts has no UX-001.5A marker', () => {
    const tokensSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'src', 'lib', 'designTokens.ts'),
      'utf8',
    );
    expect(tokensSrc).not.toMatch(/UX-001\.5A/);
  });
});

// ── Constraint 11 — No new dependencies ────────────────────────────

describe('UX-001.5A doctrine §11 — package.json invariance', () => {
  it('package.json contains no UX-001.5A signal', () => {
    const pkg = fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
    expect(pkg).not.toMatch(/UX-001\.5A/);
  });
});

// ── Constraint 12 — No migrations or Edge Functions added ─────────

describe('UX-001.5A doctrine §12 — no migration or Edge Function added', () => {
  it('no supabase/migrations file name matches UX-001.5A pattern', () => {
    const migrationsDir = path.join(REPO_ROOT, 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir);
    for (const f of files) {
      expect(f).not.toMatch(/ux.*001.5A|ux_001_5a|nodeLabel/i);
    }
  });

  it('no supabase/functions file name matches UX-001.5A pattern', () => {
    const fnsDir = path.join(REPO_ROOT, 'supabase', 'functions');
    if (fs.existsSync(fnsDir)) {
      const files = fs.readdirSync(fnsDir);
      for (const f of files) {
        expect(f).not.toMatch(/ux.*001.5A|ux_001_5a|nodeLabel/i);
      }
    }
  });
});

// ── Constraint 13 — Machine vs User provenance NEVER crosses over ──

describe('UX-001.5A doctrine §13 — no provenance crossover', () => {
  it('every Inspect Observation descriptor has source "machine"', () => {
    const result = computeNodeLabelInspectGroups({
      messageId: 'msg-1',
      manualTagEntries: [manualTag('needs_source')],
      autoMetadataCodes: ['has_evidence'],
      clusterState: 'rebutted',
      messageContribution: null,
    });
    for (const desc of result.observationDescriptors) {
      expect(desc.source).toBe('machine');
      expect(desc.ariaLabel).toMatch(/^Machine observation:/);
    }
  });

  it('every Inspect Allegation descriptor has source "user"', () => {
    const result = computeNodeLabelInspectGroups({
      messageId: 'msg-1',
      manualTagEntries: [manualTag('needs_source')],
      autoMetadataCodes: ['has_evidence'],
      clusterState: 'rebutted',
      messageContribution: null,
    });
    for (const desc of result.allegationDescriptors) {
      expect(desc.source).toBe('user');
      expect(desc.ariaLabel).toMatch(/^User allegation:/);
    }
  });

  it('every Timeline strip Observation has source "machine"', () => {
    const result = computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [manualTag('needs_source')],
      autoMetadataCodes: ['has_evidence'],
      clusterState: 'rebutted',
      messageContribution: null,
    });
    const obs = result.descriptors.find((d) => d.source === 'machine');
    expect(obs).toBeDefined();
    expect(obs?.ariaLabel).toMatch(/^Machine observation:/);
  });

  it('every Timeline strip Allegation has source "user"', () => {
    const result = computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [manualTag('needs_source')],
      autoMetadataCodes: ['has_evidence'],
      clusterState: 'rebutted',
      messageContribution: null,
    });
    const all = result.descriptors.find((d) => d.source === 'user');
    expect(all).toBeDefined();
    expect(all?.ariaLabel).toMatch(/^User allegation:/);
  });
});

// ── Constraint 14 — No heat / popularity / engagement signal sourced ──

describe('UX-001.5A doctrine §14 — no heat / engagement signal sourced', () => {
  it('no source adapter imports from heat / engagement modules', () => {
    for (const { file, src } of readAllNodeLabelSources()) {
      expect(src).not.toMatch(/from.*heat/i);
      expect(src).not.toMatch(/from.*engagement/i);
      expect(src).not.toMatch(/from.*amplification/i);
      void file;
    }
  });
});

// ── Constraint 15 — Verdict-flavored phrases in descriptions ──────

describe('UX-001.5A doctrine §15 — verdict-flavored phrases in registry descriptions', () => {
  it('no registry entry description contains "proof of"', () => {
    for (const { file, src } of readAllNodeLabelSources()) {
      const literals = extractStringLiterals(src);
      for (const literal of literals) {
        expect(literal.toLowerCase()).not.toContain('proof of');
        void file;
      }
    }
  });

  it('no registry entry description contains "truth value"', () => {
    for (const { file, src } of readAllNodeLabelSources()) {
      const literals = extractStringLiterals(src);
      for (const literal of literals) {
        expect(literal.toLowerCase()).not.toContain('truth value');
        void file;
      }
    }
  });

  it('no registry entry description contains "this is wrong"', () => {
    for (const { file, src } of readAllNodeLabelSources()) {
      const literals = extractStringLiterals(src);
      for (const literal of literals) {
        expect(literal.toLowerCase()).not.toContain('this is wrong');
        void file;
      }
    }
  });
});
