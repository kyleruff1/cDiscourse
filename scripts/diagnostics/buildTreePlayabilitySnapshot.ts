/**
 * AN-003 §5 — Tree playability snapshot generator (dev / debug only).
 *
 * Operator-invoked. Builds a room's already-shipped lifecycle-mapped
 * argument tree from a JSON fixture, computes the AN-003
 * `TreePlayabilityDiagnostics` record, renders the dev/debug Markdown via
 * the shipped `renderTreePlayabilityMarkdown`, and writes it to the
 * gitignored `artifacts/diagnostics/tree-playability/` tree.
 *
 * This script RE-DERIVES NOTHING. It calls the shipped builders
 * (`buildArgumentTimelineMap`, `buildPointLifecycleMap`,
 * `buildExhaustionTimeoutInputFromLifecycle` + `deriveExhaustionTimeoutAdvisory`,
 * `getTimelineEvidenceContract`, `buildMoveMetadataLedger`,
 * `buildTimelineNodeActionDockModel`) and the shipped AN-003 pure functions
 * (`computeTreePlayabilityDiagnostics`, `renderTreePlayabilityMarkdown`).
 *
 * Authored in TypeScript so it imports the real model APIs with full
 * type-checking. It is compiled to the gitignored
 * `artifacts/diagnostics/tree-playability-build/` directory by
 * `tsconfig.diagnostics.json` (the `diagnostics:tree-playability:build`
 * npm script) and then run under bare `node` — the imported closure is
 * verified React-Native-free (AN-003 §5).
 *
 * NEVER:
 *   - calls AI (Anthropic / xAI / OpenAI / X)
 *   - calls Supabase / network
 *   - uses a service-role key or any secret
 *   - writes anywhere except the gitignored `artifacts/diagnostics/` tree
 *
 * `console` output is intentional — operator-facing CLI output is the
 * purpose of this script, consistent with the other `scripts/` tools.
 */

/* eslint-disable no-console */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  buildArgumentTimelineMap,
  type ArgumentMessageInput,
  type ArgumentTimelineMapModel,
} from '../../src/features/arguments/argumentGameSurfaceModel';
import {
  buildMoveMetadataLedger,
  type ManualTagEntry,
} from '../../src/features/metadata';
import {
  buildPointLifecycleMap,
  buildExhaustionTimeoutInputFromLifecycle,
  deriveExhaustionTimeoutAdvisory,
  type ExhaustionTimeoutAdvisory,
  type PointLifecycleMap,
} from '../../src/features/lifecycle';
import { buildSideTurnSequence } from '../../src/features/lifecycle/pointLifecycleClusters';
import {
  buildEvidenceArtifacts,
  getTimelineEvidenceContract,
  summarizeArtifactsForReceiptChip,
  type EvidenceArtifact,
  type EvidenceAttachmentInput,
  type SourceChainStatus,
  type TimelineEvidenceContract,
} from '../../src/features/evidence/evidenceModel';
import {
  buildTimelineNodeActionDockModel,
  type TimelineNodeActionDockModel,
} from '../../src/features/arguments/timelineNodeActionDockModel';
import {
  computeTreePlayabilityDiagnostics,
  renderTreePlayabilityMarkdown,
} from '../../src/features/analytics/treePlayabilityDiagnostics';

// ── CLI flags ──────────────────────────────────────────────────

interface CliFlags {
  fixturePath: string | null;
  useBuiltinFixture: boolean;
  dry: boolean;
  roomLabel: string;
}

function parseFlags(argv: ReadonlyArray<string>): CliFlags {
  const flags: CliFlags = {
    fixturePath: null,
    useBuiltinFixture: false,
    dry: false,
    roomLabel: 'fixture room',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry') {
      flags.dry = true;
    } else if (arg === '--fixture-builtin') {
      flags.useBuiltinFixture = true;
    } else if (arg === '--fixture') {
      flags.fixturePath = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--room-label') {
      flags.roomLabel = argv[i + 1] ?? flags.roomLabel;
      i += 1;
    }
  }
  return flags;
}

// ── Built-in deep-tree fixture ─────────────────────────────────

/**
 * An in-repo deep-tree fixture (one root + several branches: a long
 * rebuttal chain, an answered exchange, a source-requested exchange, a
 * concession exchange, and an evidence-backed exchange). It does NOT
 * import the test suite's fixtures — the test suite's fixtures stay
 * test-only per `test-discipline`. This is a small, deterministic
 * fixture authored inline for operator convenience.
 *
 * Note on branch depth: `buildArgumentTimelineMap` assigns
 * `branchRootMessageId` in a bottom-up pass, so a LINEAR rebuttal chain
 * fragments into per-node clusters rather than one deep cluster. AN-003's
 * branch-overload flag is cluster-internal depth, so this fixture reports
 * a shallow per-cluster depth even though absolute `node.depth` reaches
 * 9. That is the shipped clustering behavior — the script wires the real
 * builders and re-derives nothing. The model's own branch-overload path
 * is covered by `__tests__/treePlayabilityDiagnostics.test.ts`; an
 * operator who needs an overload snapshot supplies a `--fixture` whose
 * tree shape produces a deep single cluster.
 *
 * All ids and timestamps are synthetic. No PII, no real user.
 */
function builtinFixture(): ArgumentMessageInput[] {
  const debateId = 'fixture-debate';
  const baseTime = Date.parse('2026-05-19T09:00:00.000Z');
  const at = (offsetMinutes: number): string =>
    new Date(baseTime + offsetMinutes * 60_000).toISOString();

  const messages: ArgumentMessageInput[] = [];
  let ordinal = 0;
  const push = (
    id: string,
    parentId: string | null,
    side: 'affirmative' | 'negative',
    argumentType: string,
    body: string,
  ): void => {
    messages.push({
      id,
      debateId,
      parentId,
      authorId: side === 'affirmative' ? 'user-aff' : 'user-neg',
      argumentType,
      side,
      body,
      status: 'published',
      createdAt: at(ordinal),
      updatedAt: at(ordinal),
      isBot: false,
    });
    ordinal += 1;
  };

  // Root thesis.
  push('m-root', null, 'affirmative', 'thesis', 'The room resolution opening claim.');

  // Branch A — a long rebuttal chain (absolute depth reaches 9).
  let parent = 'm-root';
  for (let depth = 1; depth <= 9; depth += 1) {
    const id = `m-a-${depth}`;
    const side: 'affirmative' | 'negative' = depth % 2 === 0 ? 'affirmative' : 'negative';
    const type = depth % 2 === 0 ? 'counter_rebuttal' : 'rebuttal';
    push(id, parent, side, type, `Branch A rebuttal at depth ${depth}.`);
    parent = id;
  }

  // Branch B — a shallow answered exchange off the root.
  push('m-b-1', 'm-root', 'negative', 'rebuttal', 'Branch B challenge to the root.');
  push('m-b-2', 'm-b-1', 'affirmative', 'clarification_request', 'Branch B clarification.');

  // Branch C — a source-requested exchange (evidence debt).
  push('m-c-1', 'm-root', 'negative', 'rebuttal', 'Branch C: where is the source for this?');
  push('m-c-2', 'm-c-1', 'affirmative', 'clarification_request', 'Branch C asks for the source.');

  // Branch D — a concession exchange (resolved point).
  push('m-d-1', 'm-root', 'negative', 'rebuttal', 'Branch D narrow challenge.');
  push('m-d-2', 'm-d-1', 'affirmative', 'concession', 'Branch D: I concede the narrow point.');

  // Branch E — a small evidence-backed exchange.
  push('m-e-1', 'm-root', 'negative', 'rebuttal', 'Branch E challenge.');
  messages.push({
    id: 'm-e-2',
    debateId,
    parentId: 'm-e-1',
    authorId: 'user-aff',
    argumentType: 'evidence',
    side: 'affirmative',
    body: 'Branch E evidence node.',
    status: 'published',
    createdAt: at(ordinal),
    updatedAt: at(ordinal),
    isBot: false,
    attachedEvidence: [
      { url: 'https://example.org/report', sourceText: 'Example report', quote: 'A cited quote.' },
    ],
  });
  ordinal += 1;

  return messages;
}

// ── Fixture loading ────────────────────────────────────────────

function loadFixture(flags: CliFlags): { messages: ArgumentMessageInput[]; label: string } {
  if (flags.fixturePath) {
    const resolved = path.resolve(process.cwd(), flags.fixturePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Fixture file not found: ${resolved}`);
    }
    const raw = fs.readFileSync(resolved, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`Fixture must be a JSON array of ArgumentMessageInput: ${resolved}`);
    }
    return {
      messages: parsed as ArgumentMessageInput[],
      label: flags.roomLabel !== 'fixture room' ? flags.roomLabel : path.basename(resolved),
    };
  }
  // No --fixture: use the built-in deep-tree fixture (also the --fixture-builtin path).
  return {
    messages: builtinFixture(),
    label: flags.roomLabel !== 'fixture room' ? flags.roomLabel : 'built-in deep tree',
  };
}

// ── Model wiring ───────────────────────────────────────────────

/**
 * Build the per-message `EvidenceArtifact[]` map via EV-001's
 * `buildEvidenceArtifacts`. Mirrors EV-002's `buildArtifactsByMessageId`
 * (`src/features/arguments/argumentGameSurfaceEvidence.ts`) — replicated
 * here as a deep `evidenceModel` call so the diagnostics tsconfig never
 * has to compile the evidence barrel (which re-exports `.tsx` components).
 * Re-derives nothing — `buildEvidenceArtifacts` is the shipped builder.
 */
function buildArtifactsByMessageId(
  messages: ReadonlyArray<ArgumentMessageInput>,
): Map<string, ReadonlyArray<EvidenceArtifact>> {
  const out = new Map<string, ReadonlyArray<EvidenceArtifact>>();
  for (const m of messages) {
    const raw = (m.attachedEvidence ?? []) as ReadonlyArray<EvidenceAttachmentInput>;
    if (raw.length === 0) {
      out.set(m.id, []);
      continue;
    }
    out.set(
      m.id,
      buildEvidenceArtifacts({
        argumentId: m.id,
        addedByUserId: m.authorId || 'unknown',
        createdAt: m.createdAt,
        attachments: raw,
      }),
    );
  }
  return out;
}

/**
 * Build the four models AN-003 consumes from a room fixture, then compute
 * + render. RE-DERIVES NOTHING — every model comes from a shipped builder.
 */
function buildSnapshot(
  messages: ArgumentMessageInput[],
  roomLabel: string,
): { markdown: string; timelineMap: ArgumentTimelineMapModel; lifecycleMap: PointLifecycleMap } {
  // 1. Timeline surface model (the room's argument tree).
  const timelineMap = buildArgumentTimelineMap({
    messages,
    currentUserId: null,
  });

  // 2. EV-001 artifacts per message, then the LIFE-001 lifecycle map.
  const artifactsByMessageId = buildArtifactsByMessageId(messages);
  const lifecycleMap = buildPointLifecycleMap({
    timelineMap,
    artifactsByMessageId,
  });

  // 3. META-001 metadata ledger (deterministic — pass an explicit clock).
  const manualTagsByMessageId = new Map<string, ReadonlyArray<ManualTagEntry>>();
  const metadataLedger = buildMoveMetadataLedger({
    timelineMap,
    lifecycleMap,
    artifactsByMessageId,
    manualTagsByMessageId,
    detectedAt: '2026-05-19T09:00:00.000Z',
  });

  // 4. EV-001 contract lookup — the same `getTimelineEvidenceContract`-backed
  //    function the room shell uses.
  const argumentTypeById = new Map<string, string | null | undefined>();
  for (const m of messages) argumentTypeById.set(m.id, m.argumentType);
  const evidenceContractFor = (messageId: string): TimelineEvidenceContract | null => {
    const artifacts = artifactsByMessageId.get(messageId) ?? [];
    return getTimelineEvidenceContract(argumentTypeById.get(messageId), artifacts);
  };

  // 5. GAME-001 advisory per cluster id, via the shipped adapter +
  //    deriver. Keyed by cluster id (= branchRootMessageId) per AN-003 §R3.
  const sideTurnSequence = buildSideTurnSequence(timelineMap.nodes);
  const artifactStatusByMessageId = new Map<string, SourceChainStatus>();
  for (const [mid, artifacts] of artifactsByMessageId.entries()) {
    if (!artifacts || artifacts.length === 0) continue;
    artifactStatusByMessageId.set(mid, summarizeArtifactsForReceiptChip(artifacts).status);
  }
  const nodeOrdinalById = new Map<string, number>();
  for (const node of timelineMap.nodes) nodeOrdinalById.set(node.messageId, node.ordinal);
  const roomMoveCount = timelineMap.nodes.length;
  const exhaustionAdvisoryByClusterId = new Map<string, ExhaustionTimeoutAdvisory>();
  for (const [clusterId, summary] of lifecycleMap.byCluster.entries()) {
    const clusterMembers = timelineMap.nodes.filter(
      (n) => summary.messageIds.includes(n.messageId),
    );
    const advisory = deriveExhaustionTimeoutAdvisory(
      buildExhaustionTimeoutInputFromLifecycle({
        clusterSummary: summary,
        clusterMembers,
        sideTurnSequence,
        artifactStatusByMessageId,
        roomMoveCountAtEvaluation: roomMoveCount,
        clusterRootOrdinal: nodeOrdinalById.get(summary.rootMessageId) ?? 1,
      }),
    );
    exhaustionAdvisoryByClusterId.set(clusterId, advisory);
  }

  // 6. SC-004 dock-model builder bound to the canonical participant actor.
  const dockModelForNode = (messageId: string): TimelineNodeActionDockModel | null =>
    buildTimelineNodeActionDockModel({
      target: { kind: 'node', messageId },
      actor: 'other',
      timelineMap,
      lifecycleMap,
      metadataLedger,
      evidenceContractFor,
    });

  // 7. AN-003 — compute + render (the shipped, tested pure functions).
  const diagnostics = computeTreePlayabilityDiagnostics({
    timelineMap,
    lifecycleMap,
    exhaustionAdvisoryByClusterId,
    evidenceContractFor,
    dockModelForNode,
  });
  const markdown = renderTreePlayabilityMarkdown(diagnostics, {
    roomLabel,
    generatedAtLabel: new Date().toISOString(),
  });

  return { markdown, timelineMap, lifecycleMap };
}

// ── Output ─────────────────────────────────────────────────────

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function labelSlug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'room'
  );
}

function writeSnapshot(markdown: string, roomLabel: string): string {
  const outDir = path.resolve(
    process.cwd(),
    'artifacts',
    'diagnostics',
    'tree-playability',
  );
  fs.mkdirSync(outDir, { recursive: true });
  const fileName = `${timestampSlug()}-${labelSlug(roomLabel)}-tree-playability.md`;
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, markdown, 'utf8');
  return outPath;
}

// ── Entry point ────────────────────────────────────────────────

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  let fixture: { messages: ArgumentMessageInput[]; label: string };
  try {
    fixture = loadFixture(flags);
  } catch (err) {
    console.error(`[tree-playability] ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }

  const { markdown, timelineMap, lifecycleMap } = buildSnapshot(
    fixture.messages,
    fixture.label,
  );

  console.log(
    `[tree-playability] room "${fixture.label}" — `
    + `${timelineMap.nodes.length} messages, ${lifecycleMap.byCluster.size} clusters`,
  );

  if (flags.dry) {
    console.log('[tree-playability] --dry: printing snapshot, writing nothing.');
    console.log('');
    console.log(markdown);
    return;
  }

  const outPath = writeSnapshot(markdown, fixture.label);
  console.log(`[tree-playability] snapshot written: ${outPath}`);
  console.log('[tree-playability] (gitignored — never committed)');
}

if (require.main === module) {
  main();
}

export { buildSnapshot, builtinFixture, parseFlags };
