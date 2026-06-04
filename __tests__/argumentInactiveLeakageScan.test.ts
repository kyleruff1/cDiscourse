/**
 * ADMIN-ARGS-INACTIVE-001 — Leakage scan.
 *
 * Two contracts under test:
 *
 *   1. Handler source scan: the Edge handler newly authored by this card
 *      MUST NOT log `body` / `reason` / `Authorization` / `payload` at any
 *      `console.log` site. The Edge `console.error` calls log `<event>`
 *      + `error.message` only (never the request body / reason).
 *
 *   2. UI render contract: `inactive_reason` (the admin-only free text)
 *      MUST NEVER appear on a user-facing argument surface. This is the
 *      §10a sensitive-composer-only doctrine binding. The scan is a
 *      strict source-file scan: the user-facing surface source files
 *      must NOT reference `inactiveReason` at all.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

describe('ADMIN-ARGS-INACTIVE-001 — handler source scan', () => {
  const handlerSrc = readFileSync(
    join(ROOT, 'supabase/functions/admin-users/index.ts'),
    'utf8',
  );

  it('Edge handler source does not console.log the request body', () => {
    expect(handlerSrc).not.toMatch(/console\.log\([^)]*\bbody\b/);
  });

  it('Edge handler source does not console.log the inactive reason', () => {
    expect(handlerSrc).not.toMatch(/console\.log\([^)]*\breason\b/);
  });

  it('Edge handler source does not console.log the Authorization header', () => {
    expect(handlerSrc).not.toMatch(/console\.log\([^)]*\bAuthorization\b/);
  });

  it('Edge handler source does not console.log the payload object', () => {
    expect(handlerSrc).not.toMatch(/console\.log\([^)]*\bpayload\b/);
  });

  it('inactive handlers do not log argumentId at info level', () => {
    // Restrict to the ADMIN-ARGS-INACTIVE-001 handler section.
    const start = handlerSrc.indexOf('ADMIN-ARGS-INACTIVE-001 — per-argument inactive');
    expect(start).toBeGreaterThan(-1);
    const block = handlerSrc.slice(start);
    expect(block).not.toMatch(/console\.log\([^)]*argumentId/);
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — UI never references inactiveReason on user-facing surfaces (§10a)', () => {
  // The full list of user-facing argument render surfaces enumerated in
  // the design § 7 § 10a-binding "Forbidden surfaces" list. The leakage
  // scan asserts NONE of these files reference `inactiveReason` at all.
  const USER_FACING_FILES = [
    'src/features/arguments/ArgumentTreeScreen.tsx',
    'src/features/arguments/ArgumentBubbleStack.tsx',
    'src/features/arguments/ArgumentTimelineScreen.tsx',
    'src/features/debates/ConversationGalleryScreen.tsx',
    'src/features/debates/ConversationMiniTimeline.tsx',
    'src/features/arguments/ArgumentReplySidecar.tsx',
    'src/features/arguments/TimelineSelectedReadoutPanel.tsx',
    'src/features/arguments/TimelineNodePopover.tsx',
    'src/features/nodeLabels/NodeLabelStrip.tsx',
    'src/features/nodeAnnotations/AnnotationChipStrip.tsx',
    'src/features/metadata/MetadataDiffInspector.tsx',
    'src/features/evidence/EvidenceDebtChip.tsx',
    'src/features/argumentScore/ArgumentScoreTracker.tsx',
    'src/features/debates/DebateListScreen.tsx',
  ];

  for (const rel of USER_FACING_FILES) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) {
      // Skip files that don't exist in this repo snapshot — the leakage
      // contract is "if a file exists, it must not contain inactiveReason."
      it.skip(`${rel} (file not present)`, () => undefined);
      continue;
    }
    it(`${rel} does not reference inactiveReason`, () => {
      const text = readFileSync(abs, 'utf8');
      expect(text).not.toMatch(/inactiveReason/);
      expect(text).not.toMatch(/inactive_reason/);
    });
  }
});

describe('ADMIN-ARGS-INACTIVE-001 — AdminArgumentsTab renders the inactive chip but NOT the reason', () => {
  const tab = readFileSync(
    join(ROOT, 'src/features/admin/AdminArgumentsTab.tsx'),
    'utf8',
  );

  it('renders the Inactive chip / Active chip', () => {
    expect(tab).toMatch(/label="Inactive"/);
    expect(tab).toMatch(/label="Active"/);
  });

  it('renders the inactiveAt timestamp but NOT the inactiveReason free text', () => {
    // It references `inactiveAt` (allowed) but never reads inactiveReason
    // into a Text node. The reason is reserved for an admin row-detail
    // affordance (out of scope for this card; future cards).
    expect(tab).toMatch(/r\.inactiveAt/);
    expect(tab).not.toMatch(/r\.inactiveReason/);
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — direct-URL focus path leaks nothing for non-admins', () => {
  // The non-admin SELECT policy + the SQL predicate at the four
  // argumentsApi list functions excludes inactive rows. A focus URL
  // (`/debate/<id>?focus=<arg>`) flows through these loaders. The
  // belt-and-braces pure-TS filter in conversationGalleryModel +
  // roomContractModel + botRoomPolicyModel is the third layer.
  it('argumentsApi.ts all four list functions include .is("inactive_at", null)', () => {
    const text = readFileSync(
      join(ROOT, 'src/features/arguments/argumentsApi.ts'),
      'utf8',
    );
    const matches = text.match(/\.is\('inactive_at',\s*null\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it('conversationGalleryModel buildGallery filter excludes inactive rows', () => {
    const text = readFileSync(
      join(ROOT, 'src/features/debates/conversationGalleryModel.ts'),
      'utf8',
    );
    expect(text).toMatch(/m\.inactiveAt\s*\?\?\s*null/);
  });

  it('roomContractModel filters exclude inactive rows', () => {
    const text = readFileSync(
      join(ROOT, 'src/features/debates/roomContractModel.ts'),
      'utf8',
    );
    expect(text).toMatch(/a\.inactiveAt\s*\?\?\s*null/);
  });
});
