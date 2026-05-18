# Evidence object model (EV-001)

_Last updated: 2026-05-18 (Release 6.6 — EV-001 lands in Build)._

EV-001 promotes evidence from a transient composer field into a first-class,
addressable gameplay object: `EvidenceArtifact`. EV-002 (source-chain
popover), EV-003 (evidence debt tracker), and EV-004 (rule symmetry) all
read this model — EV-001 ships the data layer only, not the UI.

Doctrine anchor: **missing evidence hard-blocks only `argument_type =
'evidence'` posts.** Ordinary replies remain postable. The
`EVIDENCE_SOURCE_REQUIRED` rule in `src/domain/constitution/evaluateArgumentDraft.ts`
already encodes this contract; EV-001 adds tests that pin the behaviour but
does not edit the rule.

## Public surface

All exports live in `src/features/evidence/evidenceModel.ts` (re-exported by
`src/features/evidence/index.ts`). Pure TypeScript. No React, no Supabase,
no network.

### Types

- `EvidenceArtifact` — the typed record. v1 produces this from the adapter
  at read time; a later persistence card (path c, see below) would store
  rows of this shape.
- `EvidenceArtifactKind` — six values: `'url'`, `'quote'`, `'source_text'`,
  `'dataset'`, `'screenshot_redacted'`, `'manual_citation'`. Popularity,
  follower count, "verified", retweet count, virality — none are kinds.
- `SourceChainStatus` — six values: `'no_source'`, `'unverified'`,
  `'source_no_quote'`, `'source_and_quote'`, `'broken'`, `'primary_present'`.
  `'no_source'` is **aggregate-only** (per-artifact derivation never returns
  it); `'broken'` and `'primary_present'` are reserved for admin /
  future-automated overrides.
- `EvidenceRisk` — four values: `'low'`, `'medium'`, `'high'`, `'unknown'`.
  v1 leaves every adapter-produced artifact at `'unknown'`; EV-003 will
  populate this field with a real classifier.
- `EvidenceAttachmentInput` — adapter input shape, mirrors the
  `attached_evidence` JSONB payload already produced by the composer.
- `BuildEvidenceArtifactsInput` — full adapter input including
  `argumentId`, `addedByUserId`, `createdAt`, the attachment array, and an
  optional `overrides` map for tests / future admin tooling.
- `ReceiptChipContract` — the chip display contract (plain-language `label`,
  `helper`, `tone`, `invitesFollowup`, `showsSourceChainPressure`, plus
  `status`, `kinds`, `count`). EV-002 consumes this verbatim.
- `TimelineEvidenceContract` — the timeline-node display contract
  (`rendersAsEvidenceNode`, `rendersSourceChainRing`,
  `accessibilityLabelSuffix`, embedded `receiptChip`). VG-001 / VG-002
  / SC-002 renderers will consume this.

### Helpers

- `classifyEvidenceKind(att)` — pure: derives the kind from populated
  fields (explicit kind wins; URL on dataset allowlist → `dataset`; URL
  → `url`; sourceText → `source_text`; quote-only → `source_text`;
  all-blank → `manual_citation`).
- `deriveSourceChainStatus(att)` — pure: runs the (url / sourceText /
  quote) decision table. Never returns `'no_source'`, `'broken'`, or
  `'primary_present'` — those are aggregate-only or override-only.
- `buildEvidenceArtifacts(input)` — adapter: turns a raw attachment array
  into typed artifacts. Deterministic ids (`<argumentId>:evidence:<index>`)
  that stay stable across reads, with empty entries dropped (and indices
  preserved, not renumbered).
- `summarizeArtifactsForReceiptChip(artifacts)` — pure: returns the
  `ReceiptChipContract`. Empty array → the `no_source` form; otherwise
  worst-status wins (`broken` > `unverified` > `source_no_quote` >
  `source_and_quote` > `primary_present`).
- `getTimelineEvidenceContract(argumentType, artifacts)` — pure: returns
  the `TimelineEvidenceContract`. Evidence-type nodes always render as
  evidence nodes; non-evidence nodes only decorate when artifacts exist.

### Enumeration constants

`ALL_EVIDENCE_ARTIFACT_KINDS`, `ALL_SOURCE_CHAIN_STATUSES`,
`ALL_EVIDENCE_RISKS` are frozen arrays exported so tests + EV-002 popover
copy can iterate the unions exhaustively.

## What the adapter does NOT do

- It does not read Supabase.
- It does not call any AI provider.
- It does not auto-promote any artifact to `'primary_present'`.
- It does not auto-decide `'broken'` — that requires an explicit override.
- It does not sanitise free-text user content (`label`, `sourceText`,
  `quote`). Bad-faith user text is a moderation concern, not the model's.
- It does not split a single attachment with multiple URLs; one
  `EvidenceAttachmentInput` produces one artifact.

## Status decision table

| URL present | sourceText present | quote present | derived status         |
| :---------: | :----------------: | :-----------: | ---------------------- |
|     no      |        no          |      no       | (no artifact emitted)  |
|     yes     |        no          |      no       | `source_no_quote`      |
|     no      |        yes         |      no       | `source_no_quote`      |
|     yes     |        yes         |      no       | `source_no_quote`      |
|     yes     |        no          |      yes      | `source_and_quote`     |
|     no      |        yes         |      yes      | `source_and_quote`     |
|     yes     |        yes         |      yes      | `source_and_quote`     |
|     no      |        no          |      yes      | `unverified`           |

## Receipt chip copy

The chip strings are the locked v1 contract. EV-002 / EV-004 cross-link
to these via tests, not by sharing source.

| status              | label                  | helper                                                                                | tone        |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------- | ----------- |
| `no_source`         | "No source yet"        | "Nothing has been attached to back this move. Asking for a source is a good move."   | `info`      |
| `unverified`        | "Receipt attached"     | "An excerpt is attached. Pointing to a source would strengthen it."                  | `info`      |
| `source_no_quote`   | "Source attached"      | "A source is attached. A quote from it would tighten the trail."                     | `info`      |
| `source_and_quote`  | "Source and quote"     | "A source and a verbatim quote are attached."                                        | `neutral`   |
| `primary_present`   | "Primary source"       | "The trail reaches a primary record."                                                | `neutral`   |
| `broken`            | "Source trail is weak" | "The chain dead-ends, cycles, or contradicts itself. Ask for a stronger source."     | `attention` |

Forbidden tokens in any system-generated string (enforced by test):
`winner`, `loser`, `correct`, `incorrect`, `true`, `false`, `liar`,
`dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`,
`troll`, `bot`, `astroturfer`, `verdict`, `proof`, `proven`, `disproven`.

## Tests

`__tests__/evidenceModel.test.ts` (64 tests):

- Shape + enum coverage (including the explicit "no popularity-shaped
  kinds" anti-amplification anchor).
- `deriveSourceChainStatus` — the 8-row decision table plus the
  "never returns no_source" regression over every populated single-field
  / multi-field combination.
- `classifyEvidenceKind` — explicit-kind passthrough, dataset allowlist,
  fallbacks, whitespace handling.
- `buildEvidenceArtifacts` — empty / one / multi-attachment paths,
  empty-entry dropping with stable indices, overrides shallow-merge,
  label-fallback chain (explicit → hostname → sourceText prefix →
  "Attached evidence"), 120-char truncation with ellipsis, determinism,
  whitespace trimming.
- `summarizeArtifactsForReceiptChip` — every status, worst-status-wins
  with multiple artifacts, unique-preserving kinds, defensive guard for
  an unexpected aggregate-only status on a single artifact.
- Ban-list — verdict / person tokens are absent from every chip label /
  helper / timeline accessibility suffix across every status and every
  argument-type.
- `getTimelineEvidenceContract` — evidence-type vs non-evidence
  decoration rules, null/undefined argumentType handling, the
  source-and-quote and primary-source suffix paths, broken-fallback
  suffix.
- Doctrine anchor (the central EV-001 commitment): ordinary rebuttal
  without evidence remains postable (no `evidence_required` flag);
  explicit evidence-type post without artifacts is blocked by
  `EVIDENCE_SOURCE_REQUIRED`; attaching a URL unblocks it; tagging a
  non-evidence reply with the `evidence` tag also requires a source.

100% line coverage and 97.4% branch coverage of `evidenceModel.ts` (the
uncovered branches are defensive guards that are unreachable through the
public API).

## What EV-001 does NOT change

- No new Supabase migration.
- No new Edge Function.
- No change to `src/lib/constitution/engine.ts`.
- No change to `src/domain/constitution/evaluateArgumentDraft.ts` or
  `src/domain/constitution/types.ts`.
- No change to `supabase/functions/submit-argument/index.ts`.
- No change to `ArgumentComposer.tsx`, `ArgumentTimelineMap.tsx`, or any
  other rendering surface — those wires belong to EV-002+.
- No `.env*` change, no new dependency, no service-role reference.

## Follow-up (path c — operator-gated, NOT EV-001)

After EV-003 stabilises the artifact shape, a follow-up card may:

- Add `public.argument_evidence_artifacts` (`id`, `argument_id` FK,
  `kind`, `label`, `url`, `source_text`, `quote`, `source_chain_status`,
  `risk`, `added_by_user_id`, `created_at`) with RLS mirroring `arguments`
  visibility.
- Back-fill from existing
  `arguments.client_validation->'attachedEvidence'` JSONB using
  `buildEvidenceArtifacts` as the authoritative classifier.
- Insert artifact rows from `submit-argument` alongside the argument
  insert.
- Add `set-source-chain-status` admin Edge Function for moderators to
  mark `broken` / `primary_present`.

The adapter signature stays stable across the (b) → (c) transition;
read-time code does not change, only the source it reads from.

---

## How EV-002 consumes the model

EV-002 — the source-chain popover — sits on top of EV-001 and never
re-derives any of the locked surface. Its dispatch model
`src/features/evidence/sourceChainPopoverModel.ts` maps every
`SourceChainStatus` (read straight from `ReceiptChipContract.status`) to
one `SourceChainPopoverAction` plus the popover headline + helper. The
chip strings (`"No source yet"`, `"Receipt attached"`, `"Source attached"`,
`"Source and quote"`, `"Primary source"`, `"Source trail is weak"`) come
out of `RECEIPT_CHIP_COPY` here verbatim — EV-002 does not fork copy.

Preset bodies that the popover seeds into the composer are frozen in
`src/features/evidence/sourceChainPresetCopy.ts` (`ASK_SOURCE_PRESET_BODY`,
`ASK_QUOTE_PRESET_BODY`, `ASK_STRONGER_SOURCE_PRESET_BODY`). Every preset
is question-shaped, uses *trail / inspection* language, and is asserted
against the doctrine ban-list (no verdict, no popularity, no person
labels) in `__tests__/sourceChainPopoverModel.test.ts`.

The popover is inspection-only. No new persistence, no new Edge Function,
no migration, no `submit-argument` change. Authors never see an "ask"
CTA on their own moves (`isOwnMessage === true` hides every ask
affordance); observers see the CTA visible but disabled with the locked
helper `"Join a side to ask"`.
