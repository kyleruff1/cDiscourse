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

---

## EV-003 — evidence debt tracker

EV-003 adds the **obligation axis**. EV-001 modelled the evidence
*artifact* (existence / source-chain) and EV-002 gave it an inspection
surface plus a way to *ask*. EV-003 closes the ask loop: it tracks
whether a source/quote/receipt/context request was ever answered.

`src/features/evidence/evidenceDebtModel.ts` is a pure-TS,
render-time-derived model — no React, no Supabase, no network, no
`Date.now()` (the staleness clock is injected). It imports **nothing**
from `src/features/pointStanding/` and **nothing** from the constitution
validator.

### The debt record

An `EvidenceDebt` is a **structural obligation marker** — *"a source was
asked for and is owed"*. It is never a verdict: an open debt means "this
point lacks X", never "this point is wrong"; a resolved debt is
"settled", never "proven". The record carries `nodeId` (the asked-about
node — the request move's parent), `requestArgumentId`, `debtKind`,
`status`, `requestedByUserId`, `requestedAt`, `resolvedByNodeId` /
`resolvedAt` when resolved, `ageDays`, and `isStale`.

`EvidenceDebtKind` (5, exhaustive): `source` · `quote` · `receipt` ·
`context` · `primary_record`. Deliberately **not** suffixed `_needed` —
the point-standing module's axis-debt types are a different model and
EV-003 never aliases them.

`EvidenceDebtStatus` (8): `requested` · `supplied` · `challenged` ·
`accepted_by_participant` · `accepted_by_both` · `unresolved` · `stale` ·
`branched`. Every value is an *obligation* observation. `OPEN_EVIDENCE_
DEBT_STATUSES` = `requested / challenged / unresolved / stale`;
`branched` is excluded (the obligation is relocated, not ignored).

### Render-time derivation

`deriveEvidenceDebts(input)` derives every debt in a room from its
argument rows:

- **Opening rule.** A move opens a debt iff it carries a recognised
  request tag code (`source_request` / `quote_request` →
  `source` / `quote`, plus three reserved codes `receipt_request` /
  `context_request` / `primary_record_request` that the QOL-030
  `ask_source` box and EV-004 will emit). No request tag → no debt — a
  move that just expresses disagreement opens nothing. One debt per
  request move; id = `<requestArgumentId>:debt`.
- **Resolution scan.** Later moves in the requested subtree are scanned:
  an answering move attaching the matching artifact kind → `supplied`;
  a QOL-037 `accept` response → `accepted_by_participant` →
  `accepted_by_both` (two distinct primaries); a `dispute_applicability`
  / `request_source` response → `challenged` (including a reopen after
  `accepted_by_both`); a `split_branch` off the node → `branched`; an
  explicit `source_declined` / `request_evaded` tag → `unresolved`.
- **Close-condition by kind.** A `quote` debt is not discharged by a
  bare URL with no quote; a `primary_record` debt only by an artifact an
  admin marked `primary_present`. This is the one place EV-003 reads
  EV-001's `sourceChainStatus` — strictly as a close-condition named by
  the debt's own kind, never as a generic shortcut.
- **Staleness.** A still-`requested` debt past `STALE_DEBT_THRESHOLD_DAYS`
  (7) becomes `stale` — a re-label, advisory only, never auto-acts.

### Roll-ups and chip copy

`getNodeEvidenceDebtSummary` / `getRoomEvidenceDebtSummary` are pure
roll-ups; `summarizeEvidenceDebtChip` / `getNodeEvidenceDebtChip` build
the `EvidenceDebtChipContract`. The node chip shows the worst status
when several debts attach (`challenged > unresolved > stale >
requested > branched > supplied > accepted_by_participant >
accepted_by_both`). All chip / status-line copy is plain English —
locked, ban-list-asserted (no `proof` / `true` / `winner` / `case
closed` / amplification / person-attribution tokens; `settled` is used
at discharge).

### Consumers

- **`EvidenceDebtChip`** renders the obligation chip on the timeline
  node beside the EV-002 receipt chip — a node can show both axes at
  once. Non-pressable status indicator; self-hides on a node with no
  debt.
- **`ArgumentGameSurface`** derives the room debts once per render
  (reusing the EV-002 artifact map + the tag map — no new fetch) and
  threads a per-node summary into the timeline popover.
- **The conversation gallery** card carries an `evidenceDebtSummary`;
  an open debt is the authoritative `source_chain_fight` signal and
  drives the "Evidence requested" / "Source still owed" card signals.
  A room whose source requests all resolved is kept out of the
  source-trail lane (the precision fix the tag-count heuristic could
  not make).

### Doctrine

A debt is **advisory** — it never enters `evaluateArgumentDraft`, is
never a flag, never disables Post; a node with five open debts is just
as postable-onto as one with none. EV-003 emits **no**
`PointStandingDelta` and never reads heat / engagement / view counts.
v1 is render-time-derived: **no migration, no `evidence_debt` table,
no Edge Function, no `submit-argument` change** — a debt is visible
exactly when its rows are, gated by the existing `public.arguments`
RLS. A future persistence card would store rows of the `EvidenceDebt`
shape and backfill via this same derivation.

---

## QOL-036 — Payment / screenshot evidence metadata

QOL-036 is an **additive extension** of the EV-001 `EvidenceArtifact`. It
lets a payment / transfer screenshot be attached as a *structured* object
instead of being pasted as un-disputable free text into the argument body.
It adds **one kind, one optional nested sub-object, supporting sub-types,
and redaction helpers** — every existing `EvidenceArtifact` field keeps its
name, type, and meaning, and every existing consumer (EV-002, EV-003,
EV-005, `ReceiptChip`, the timeline contract) compiles and behaves
identically. Design: `docs/designs/QOL-036.md`.

### The `payment` sub-object

`EvidenceArtifact` gains an optional `payment?: PaymentEvidenceMetadata`,
present only when `kind === 'payment_screenshot'` (the seventh
`EvidenceArtifactKind`). `PaymentEvidenceMetadata` fields:

| Field | Type | Notes |
|---|---|---|
| `confidence` | `EvidenceConfidence` | **Pinned** to `'user_asserted'`. The only value the type carries. A payment screenshot is a user's assertion, never a system-proven fact. |
| `platform` | `string?` | Generic label ("a payment app"). Never a required brand. Max 48. |
| `paidAt` | `string?` | ISO-8601 date as asserted. Stored **verbatim** — never parsed into a `Date`, never validated as "correct". |
| `amount` | `EvidenceAmount?` | `{ value, currency }`. Negative `value` clamps to 0; `NaN`/non-finite drops the amount. |
| `payer` / `payee` | `PaymentParty?` | A **redacted** `{ displayToken, roleLabel? }` — never a raw account number. |
| `noteText` | `string?` | The memo on the record. Max 280. |
| `claimedApplicability` | `ClaimedApplicability?` | The **claimed** side only — `{ statement, periodLabel?, obligationRef? }`. |
| `hasScreenshotImage` | `boolean?` | True when an image exists. QOL-036 stores the flag + redaction state, **not the binary** (upload is a deferred card). |
| `redactionConfirmed` | `boolean?` | The submitter affirmed the record is redacted before attaching. |

### Doctrine

- **Existence ≠ applicability.** A payment screenshot proves *at most that a
  payment object exists* — never what it was *for*. `amount` / `paidAt` /
  `noteText` / `claimedApplicability` are **separate axes** so a dispute
  (QOL-037) can target one precisely. QOL-036 stores only the *claimed*
  side; the *disputed* side and the applicability *status* are QOL-037's,
  added additively on a dispute record, never by mutating this object.
- **A payment object is inert.** It carries no truth value and emits **no**
  `PointStandingDelta`. `evidenceModel.ts` imports nothing from
  `src/features/pointStanding/`. Standing moves only when a later *move*
  does something the point-standing engine already grades.
- **No raw financial account data — ever.** `payer`/`payee` carry only a
  redacted display token. The adapter runs `findRawAccountDataFields` over
  every payment field; if any field carries a card / account / routing /
  IBAN digit shape it **strips the whole `payment` sub-object** and
  downgrades the kind to `screenshot_redacted` — a missing screenshot beats
  a leaked account number. Raw account data is rejected at the model
  boundary, never masked-and-stored.

### Redaction helpers

- `detectRawAccountData(text)` — conservative digit-run heuristic. Flags a
  12–19 digit run (card / account, tolerating spaces / hyphens between
  groups), an IBAN-shaped token, and a 9-digit routing-number run adjacent
  to a bank keyword. Over-redacts deliberately — a false positive only
  over-masks a benign long number; a false negative leaks PII.
- `findRawAccountDataFields(payment)` — throw-free guard; returns the
  offending dotted field path(s) (`noteText`, `payer.displayToken`, …), or
  `[]` when clean. The QOL-030 box calls it before post to show an inline
  warning; the adapter calls it to decide degradation.
- `redactPaymentParty(rawText, roleLabel?)` — masks any account-data run to
  `•••• ` + last 4 and returns a `PaymentParty`. Role-only inputs
  ("the landlord") pass through. The QOL-030 box calls it on the
  payer/payee fields before building the metadata value.

### Adapter behaviour (`buildEvidenceArtifacts`)

Non-payment attachments are byte-for-byte unchanged. With a `payment`
input the adapter: (1) counts a payment-only attachment as **non-empty**
(it is no longer dropped); (2) classifies the kind as `payment_screenshot`
unless an explicit `kind` wins; (3) runs the redaction guard and strips +
downgrades on raw account data; (4) **pins `confidence` to
`'user_asserted'`** regardless of input; (5) runs the existing EV-001
source-chain table over `(url, sourceText, quote)` only — a payment object
alone yields `unverified` and never auto-promotes to `source_and_quote` /
`primary_present` (a payment screenshot is an artifact, not a primary-
source chain); (6) leaves `risk` at `'unknown'`.

### `add_evidence` box field contract (for QOL-030)

QOL-036 ships the *data the box binds to*, not a `.tsx` component. The
QOL-030 `renderSchema('add_evidence', …)` lays out: amount value (numeric,
non-negative), amount currency (≤8), paid-at date (date picker, ISO-8601,
no "is this correct?" check), payer / payee (text → `redactPaymentParty`,
≤48, redacted on blur), note text (≤280), claimed-applicability statement
(≤160) + period label (≤32, advisory only), screenshot-attached toggle
(sets `hasScreenshotImage`), redaction-confirmed checkbox (required when an
image is attached — the box blocks post if unconfirmed). `confidence` is
not a field — it is shown as read-only helper text ("Marked as: your
assertion"). The box surfaces the `findRawAccountDataFields` warning near
submit; even if ignored, the adapter degrades safely.

### Display

A payment artifact flows through the **already-shipped EV-001 display
path** unchanged — it contributes its `kind` to the receipt chip's `kinds`
array and a label, and **never a status upgrade**. `getPaymentEvidenceLabel`
returns the locked plain-language label "Payment record";
`summarizePaymentEvidence` builds a one-line, redaction-safe summary
("Payment record — $120 on 2026-03-03, noted 'practice space'"), omitting
absent fields and re-redacting defensively. Every QOL-036 system-generated
string is plain English, ban-list-asserted — no `proof` / `true` /
`winner` / `case closed`, no amplification or person-attribution token.

### Persistence

Adapter-only, per EV-001's path (b): **no migration, no
`argument_evidence_artifacts` table, no Edge Function, no `submit-argument`
change**. The `payment` sub-object rides inside the existing
`client_validation` / `server_validation` JSONB snapshot, gated by the
existing `public.arguments` RLS. Threading `payment` into the
`submit-argument` request is a downstream wiring step owned by the QOL-030
box submit path or the EV-001 path-(c) persistence card — QOL-036 is
consumable as a pure model today.

## QOL-037 — the applicability axis

QOL-037 adds a **third independent status axis** to an evidence object —
*applicability* — and the structured response flow that drives it. It is
implemented as the pure-TS model `src/features/evidence/evidenceApplicabilityModel.ts`
plus `evidenceApplicabilityCopy.ts`, the `RespondToEvidenceForm` /
`ApplicabilityChip` RN components, and a minimal advisory `submit-argument`
pass-through. Render-time-derived — **no migration, no `evidence_applicability`
table, no new RLS policy**.

### The three axes — separable by design

An evidence object carries three status axes that are computed independently
and **never read each other**:

| Axis | Type | Owner | Question it answers |
|---|---|---|---|
| Existence / source-chain | `SourceChainStatus` | EV-001 / EV-002 | Does an inspectable record exist, and how anchored is its trail? |
| Obligation (evidence debt) | `EvidenceDebtStatus` | EV-003 | Has a source / quote / receipt / context been *asked for* and is it still owed? |
| **Applicability** | **`ApplicabilityStatus`** | **QOL-037** | Does the evidence apply to *what the submitter says it applies to* (which month / which obligation)? |

These never collapse: a payment object can be `source_and_quote` (the
screenshot is inspectable) **and** `applicability_disputed` (we disagree
about which month it covers) at the same time — a clear source trail does not
settle applicability. A payment object can reach `applicability_supported`
without ever becoming `primary_present` — applicability is supported by
argument and corroborating *moves*, not by the source chain reaching a
primary record. Heat / popularity feeds none of the three; none of the three
is a truth label.

### The structured evidence-response choice set

The QOL-030 `respond_to_evidence` box renders a **closed set of seven**
choices. The set is locked — no UI surface may add an eighth; a new
evidence-response kind is a new card.

| Choice id | Label | Clarification required | Applicability transition | Notes |
|---|---|---|---|---|
| `accept` | "Accept evidence" | no | none | the only zero-clarification choice; an `accept` of a contested point *by the disputing party* resolves an open dispute to `applicability_supported` |
| `accept_with_caveat` | "Accept with caveat" | yes | none | a reservation, not an applicability dispute — it never flips the status |
| `dispute_date` | "Dispute the date" | yes | none | a separate axis (QOL-036's date field) — never touches `ApplicabilityStatus` |
| `dispute_amount` | "Dispute the amount" | yes | none | a separate axis (QOL-036's amount field) — never touches `ApplicabilityStatus` |
| `dispute_applicability` | "Dispute what it applies to" | yes | `applicability_undisputed → applicability_disputed` | the only choice that drives the applicability axis |
| `request_source` | "Ask for the source" | (seeded — EV-002 preset) | none | reuses EV-002's `ASK_SOURCE_PRESET_BODY`; opens an EV-003 `source` debt |
| `request_clarification` | "Ask for clarification" | yes | none | routes to a `clarification_request` move |

The **required-clarification rule** (`validateEvidenceResponseDraft`): a
`respond_to_evidence` draft is structurally valid iff the choice is `accept`,
or the trimmed clarification body is at least `MIN_CLARIFICATION_CHARS` (12).
`request_source` satisfies it via its seeded body. This is a **validation**
gate — it may disable the Post button (always with a visible plain-language
reason), exactly like a forced-list item field. It is *not* a score gate;
score never blocks.

### The applicability status ladder

```
applicability_undisputed ──dispute_applicability──▶ applicability_disputed
        ▲                                                  │
        │                              a corroborating move (an accept of the
        │                              contested point by the disputing party,
        │                              or a later evidence move that resolves it)
        │                                                  ▼
        └────────────────────────────────────────  applicability_supported
```

`deriveApplicabilityStatus` walks the chronological `EvidenceResponseRecord`
history for one evidence object and returns the derived status. `undisputed`
is **not** a truth claim — it only means no dispute is open. `supported` means
"better supported than when the dispute opened" — never "proven". The model
has deliberately **no** `applicability_disproven` / truth-negative value. A
record with an unknown `choice` (a future client) is ignored, not crashed.

### Persistence — advisory, render-time-derived

QOL-037 adds **no** `evidence_applicability` table. The `evidenceResponse`
block (choice + clarification + target artifact id) rides inside the existing
`client_validation` / `server_validation` JSONB snapshot — the same surface
QOL-036's `payment` object uses. The one Edge Function touch is a **minimal
advisory pass-through**: `submit-argument` copies an optional `evidence_response`
block verbatim into that snapshot — it never validates it, never hard-blocks
on it, never branches the insert path on it. The applicability status is then
render-time-derivable: the client reads `evidenceResponse` blocks off the
argument rows it already fetches. No service-role, no new insert path, RLS
untouched. **Operator step:** `npx supabase functions deploy submit-argument
--linked` so the function passes the new optional field through (backward-
compatible — an older client that omits it is unaffected).
