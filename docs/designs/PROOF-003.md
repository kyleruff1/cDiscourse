# PROOF-003 — attach-proof Edge Function (post-hoc attach, JWT-scoped)

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 / Argument Surface Pivot — Evidence backend lane (M-ASP-3, Phase P3)
**Release:** M-ASP-3
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/890
**Deploy-bearing:** YES — a NEW Edge Function. It MUST be registered in
`supabase/config.toml` **in the same PR** or the Supabase GitHub integration
silently never deploys it (the #509 lesson). A jest scan asserts the
registration block exists (see Test plan → registration scan).
**Migration-bearing:** NO (default design). The tables already exist (PROOF-001,
merged) and `room_notifications.type` already permits `evidence_supplied`. An
OPTIONAL client-key idempotency alternative would add a migration — flagged, not
chosen (see Design decision 6).

---

## Goal (one paragraph)

Attaching a receipt to an *already-posted* move — J7: "proof attached to the past
move, not to your next reply" — needs a **server-authoritative write path**.
PROOF-001 shipped `proof_items` / `proof_relations` **SELECT-only** (the operator's
maximally-conservative ruling: RLS carries no INSERT/UPDATE policy, no write-gate
helper, and the soft-delete immutability trigger was **dropped**), so **this Edge
Function is the SOLE write path** for both tables, using the service-role client.
Because RLS gives no write backstop and the DB trigger is gone, `attach-proof`
**owns** every guarantee the dropped machinery used to provide: participant/scope
gating, the kind vocabulary, the per-move cap, tombstone/field immutability, and
the evidence-doctrine rule that a client can never mint `broken` / `primary_present`.
The design is shaped by three doctrine constraints: **evidence is never
proof-of-truth** (`evidence-doctrine` — status is derived server-side and restricted
to the three client-derivable values, never a verdict); **no service-role in the
client, no direct client insert into a gated table** (`supabase-edge-contract` —
the client calls this function, which validates then writes via service-role); and
**score never blocks posting** (this function never touches `submit-argument`,
never gates a post, emits no `PointStandingDelta`). It also fires the **existing**
`evidence_supplied` notification (never a parallel mechanism) when a proof answers
a source request.

---

## Problem & scope

**In scope (v1 action set):**
- `POST attach-proof` with two actions:
  - **`attach`** — write one `proof_items` row for the caller's own move/draft,
    plus an OPTIONAL `proof_relations` row (`supports` / `contradicts` /
    `contextualizes` / `answers_request`) in the same call.
  - **`detach`** — soft-delete the caller's own `proof_items` row (`deleted_at` set;
    content fields never touched).
- Server-derived `source_chain_status` restricted to `{unverified,
  source_no_quote, source_and_quote}`.
- `answers_request` → fire the **existing** `evidence_supplied` notification path.
- Idempotent double-attach and double-relate.
- `config.toml` registration (`verify_jwt = true`) in the same PR.
- Typed client wrapper in `src/lib/edgeFunctions.ts` (anon key + caller JWT only).

**Out of scope (explicit — see § Out of scope):** admin status-set
(`broken`/`primary_present`), storage-kind attach (SEC-PROOF-001), markers
(MARK-001), the drawer UI (PROOF-002), the read-path flip (PROOF-002), any change
to `submit-argument` or any existing function, and any DB migration.

---

## The Edge contract (the PROOF-002 seam — request / response / errors / caps VERBATIM)

> This section is the **shared seam** that the concurrently-designed PROOF-002
> drawer consumes. It is authoritative. PROOF-002 must code against the shapes and
> codes here verbatim.

**Invocation:** `supabase.functions.invoke('attach-proof', { body })` →
`POST /functions/v1/attach-proof`. `verify_jwt = true`. `Content-Type:
application/json`. The body is a **discriminated union on `action`**, validated by a
zod `.strict()` schema (unknown keys → 422).

### Request — `action: "attach"`

```jsonc
{
  "action": "attach",
  "debateId": "<uuid>",            // REQUIRED — room scope (must equal the move's debate_id)
  "argumentId": "<uuid>",          // REQUIRED — the CALLER'S OWN move or draft the proof attaches to
  "kind": "url" | "quote" | "source_text" | "note" | "prior_move" | "external_ref",
  "label": "<string, <=120>",      // OPTIONAL, default "" (short plain-language title)
  "url": "<string, <=2048>",       // REQUIRED iff kind in {url, external_ref}; http/https only
  "sourceText": "<string, <=8000>",// REQUIRED iff kind == source_text; OPTIONAL note body for kind==note
  "quote": "<string, <=4000>",     // REQUIRED iff kind == quote
  "referencedArgumentId": "<uuid>",// REQUIRED iff kind == prior_move; must be same-room + caller-visible
  "relation": {                    // OPTIONAL — attach + relate in one round-trip
    "claimArgumentId": "<uuid>",   //   REQUIRED — the same-room claim/request the proof relates to
    "kind": "supports" | "contradicts" | "contextualizes" | "answers_request"
  }
}
```

**There is deliberately NO `sourceChainStatus` field and NO `risk` field.** The
Edge derives status (condition (ii)); `.strict()` makes a smuggled
`sourceChainStatus` a 422. `risk` is always written `'unknown'` (back-fill parity).

### Request — `action: "detach"`

```jsonc
{
  "action": "detach",
  "debateId": "<uuid>",            // REQUIRED — room scope (for the log + participant re-check)
  "proofItemId": "<uuid>"          // REQUIRED — must be a caller-owned, non-deleted proof_items row
}
```

### Response — `attach` success (200)

```jsonc
{
  "ok": true,
  "proofItem": {
    "id": "<uuid>",
    "debateId": "<uuid>",
    "argumentId": "<uuid>",
    "kind": "url",
    "label": "",
    "url": "https://…" | null,
    "sourceText": null,
    "quote": null,
    "referencedArgumentId": null,
    "sourceChainStatus": "unverified" | "source_no_quote" | "source_and_quote",
    "risk": "unknown",
    "createdAt": "<iso-8601>",
    "deletedAt": null
  },
  "relation": null | {
    "id": "<uuid>",
    "proofItemId": "<uuid>",
    "claimArgumentId": "<uuid>",
    "relation": "answers_request",
    "createdAt": "<iso-8601>"
  },
  "idempotent": false,             // true when an identical existing proof was returned (no new row)
  "relationIdempotent": false,     // true when the relation already existed (UNIQUE hit)
  "debtSignalEmitted": false       // true iff a NEW answers_request relation fired evidence_supplied
}
```

### Response — `detach` success (200)

```jsonc
{
  "ok": true,
  "proofItemId": "<uuid>",
  "deletedAt": "<iso-8601>",
  "idempotent": false              // true when the row was ALREADY soft-deleted (no-op success)
}
```

### Error shape (house standard — `_shared/http.ts`)

Every error is `{ "error": "<code>", "message"? | "reason"? | "detail"? }` with a
stable HTTP status. **No stack traces, no service-role details, no row that the
caller cannot already see.**

| # | Guard (in order) | Status | `error` code | Notes |
|---|---|---|---|---|
| 1 | method not POST | 405 | `method_not_allowed` | `methodNotAllowed()` |
| 2 | missing `Authorization` | 401 | `unauthorized` | `unauthorized()` |
| 3 | body not JSON | 400 | `bad_request` (detail `invalid_json`) | `badRequest('invalid_json')` |
| 4 | schema fail: unknown key / bad `action` / bad enum / missing per-kind field / over-length | 422 | `validation_failed` + `issues[]` | `.strict()` + `.refine()` per-kind |
| 5 | `getUser()` fails | 401 | `unauthorized` | defense-in-depth (config drift) |
| 6a | target argument not caller-visible / missing | 404 | `argument_not_found` | **no-oracle** — caller-scoped RLS read → null; identical to nonexistent |
| 6b | caller is not the author of the target | 403 | `not_your_move` | authz on a **visible** row (not an existence leak) |
| 6c | `argument.debate_id !== body.debateId` | 400 | `debate_argument_mismatch` | cross-room block |
| 6d | caller not a live participant | 403 | `not_a_participant` | `is_debate_participant` false |
| 7a | `kind` not in the attachable subset (storage/marker kind) | 400 | `kind_not_supported` | `screenshot`/`file`/`voice_excerpt`/`timestamp` deferred |
| 7b | relation target not same-room / not visible | 404 | `claim_not_found` | **no-oracle** (caller-scoped read) |
| 7c | `prior_move` `referencedArgumentId` not same-room / not visible | 404 | `referenced_argument_not_found` | **no-oracle** |
| 8 | ≥ 8 non-deleted proofs already on the move | 409 | `proof_cap_reached` | Q9 cap; message plain-language |
| D1 | (detach) proof not caller-visible / missing | 404 | `proof_not_found` | **no-oracle** |
| D2 | (detach) proof visible but not caller-owned | 403 | `not_your_proof` | authz on a visible row |
| 9 | any write failure | 500 | `internal_error` | swallowed detail; structured log only |

**No-oracle contract (AC "no existence oracle beyond room visibility"):** every
"not found" code (6a, 7b, 7c, D1) comes from a **caller-scoped (RLS) read** — a row
the caller cannot see is indistinguishable from a nonexistent one. The two
authorization codes that CAN be distinguished (`not_your_move`, `not_your_proof`)
are only ever returned on rows the caller **can** see (room-visible), so they leak
no existence information beyond what room visibility already grants — exactly the
`request-argument-deletion` precedent (`not_argument_author` on a visible row).

### Caps (Design Pass Q9 + body-size)

| Cap | Value | Where enforced |
|---|---|---|
| Proofs per move | **8** (non-deleted) | `MAX_PROOFS_PER_MOVE` in `_shared/proofAttach.ts`; guard 8 |
| `label` length | ≤ 120 | zod schema |
| `url` length | ≤ 2048 (http/https) | zod schema |
| `quote` length | ≤ 4000 | zod schema |
| `sourceText` length | ≤ 8000 | zod schema |
| relations per attach call | ≤ 1 (a single optional object, not an array) | zod schema (`.strict()`) |

The per-move cap is an **advisory UX cap**, not a security boundary (see Risks →
cap race). Body-size caps are hard (schema-rejected).

---

## Reviewer-condition enforcement (BINDING — from the PROOF-001 heightened review)

With the DB immutability trigger dropped and both tables SELECT-only, the Edge
logic is the SOLE enforcer of two invariants. This section states **exactly how
each is enforced in code** and how each is test-pinned.

### Condition (i) — tombstone / field immutability (replaces the dropped `proof_items_soft_delete_only` trigger)

1. **Immutable-by-construction.** The function exposes exactly TWO write actions:
   `attach` (a single `INSERT`) and `detach` (a soft-delete `UPDATE`). **There is no
   action that edits proof content.** Consequently every immutable column
   (`kind`, `label`, `url`, `source_text`, `quote`, `referenced_argument_id`,
   `source_chain_status`, `risk`, `added_by`, `debate_id`, `argument_id`,
   `created_at`) physically cannot change after insert — no code path issues an
   UPDATE that touches them.
2. **Detach writes only `deleted_at`.** The detach `UPDATE` payload object is
   **exactly** `{ deleted_at: <iso> }` — nothing else. This is the code-level
   replacement for the dropped trigger. A jest source-scan asserts the detach
   update object contains only `deleted_at` (with a negative control that plants a
   second key).
3. **No resurrection, no un-delete.** `detach` on an already-`deleted_at` row
   returns idempotent success **without re-writing**. **No action ever sets
   `deleted_at = null`.** A jest scan asserts the string `deleted_at: null` (and
   any `.update({ deleted_at: null …})`) never appears in `index.ts` write paths.
4. **Service-role is the sole writer + no DB backstop.** Because service-role
   bypasses RLS and the trigger is gone, these Edge guarantees are the ONLY
   enforcement. The design makes each explicit and test-pins it (Test plan §2).

### Condition (ii) — only admin/privileged flows set `broken` / `primary_present`

1. **The client cannot send a status.** The `attach` schema has no
   `sourceChainStatus` field; `.strict()` turns a smuggled one into a 422.
2. **The Edge derives status** via the pure `deriveProofSourceChainStatus(...)` in
   `_shared/proofAttach.ts`, which **mirrors the authoritative
   `deriveSourceChainStatus` in `src/features/evidence/evidenceModel.ts`** and
   returns ONLY `unverified | source_no_quote | source_and_quote`. It can never
   return `broken` / `primary_present`.
3. **No write path emits the privileged values.** A jest scan asserts
   `primary_present` / `broken` never appear in any write object in `index.ts`
   (they may appear only inside an explanatory comment), with a negative control.
4. **Privileged status-set is DEFERRED, not implemented here.** Setting
   `broken` / `primary_present` is a future service-role admin Edge
   (`set-source-chain-status`, the PROOF-001 forward dependency). **PROOF-002 never
   sets those**, so deferring the privileged action entirely is acceptable and is
   the strictest possible posture: this function sets them *nowhere*, which is a
   superset of "only admin flows set them."

---

## Design decisions (explicit)

### 1. Minimal v1 action set = `attach` + `detach`; admin status-set DEFERRED

PROOF-002 (the drawer) needs to (a) attach a receipt to a past move, optionally
relating it to a claim/request, and (b) remove a receipt it just attached. It does
**not** set `broken`/`primary_present` and does **not** upload storage kinds. So the
v1 action set is exactly `attach` + `detach`. `admin status-set` and `storage
attach` are deferred to their own cards (they need admin-gating / bucket signing
that would bloat this card and are unused by PROOF-002). Deferring is the
condition-(ii)-strict choice (see above).

### 2. Service-role writer + caller-scoped reads (the SELECT-only consequence)

RLS is SELECT-only, so the write **must** use `createServiceClient()` (there is no
authenticated INSERT/UPDATE policy). But **reads that decide authorization use the
caller-scoped client** (`createCallerClient(auth)`), because RLS-scoped reads give
the no-oracle property for free (invisible row → null → `*_not_found`), exactly as
`request-argument-deletion` does. Specifically:
- **Identity:** `callerClient.auth.getUser()` → `callerId` (defense-in-depth even
  though `verify_jwt = true`).
- **Target-move read (guard 6):** `callerClient.from('arguments').select('id,
  author_id, debate_id, status').eq('id', argumentId).maybeSingle()` → null ⇒
  `argument_not_found`; `author_id !== callerId` ⇒ `not_your_move`; `debate_id !==
  body.debateId` ⇒ `debate_argument_mismatch`.
  - **Own-draft caveat:** if the arguments SELECT policy does not surface the
    author's *own* draft (status `draft`) to the caller-scoped client, the Edge
    falls back to a **tightly-scoped service-role read keyed on `id = argumentId
    AND author_id = callerId`** — used ONLY to resolve the caller's own move/draft,
    so it can never reveal a row the caller does not own (no-oracle preserved). The
    implementer confirms the arguments SELECT policy's author-own-draft behavior
    (COV-004 `is_argument_visible`) and picks the caller-scoped read when it
    suffices.
- **Participant check (guard 6d):** `callerClient.rpc('is_debate_participant', {
  p_debate_id: debateId })` — `p_user_id` defaults to `auth.uid()` = caller
  (`20260516000006`, granted to `authenticated`).
- **Relation / prior_move target reads (guards 7b/7c):** caller-scoped
  `from('arguments').select('id, debate_id')` → null ⇒ the relevant `*_not_found`;
  `debate_id !== debateId` ⇒ same `*_not_found` (same-room required).
- **Writes:** `createServiceClient()` for the `proof_items` INSERT, the optional
  `proof_relations` INSERT, and the `room_notifications` INSERT.

### 3. Guard ladder ORDER (auth → participant → scope → kind → caps → idempotency)

Fail-closed, cheapest-and-most-generic first, distinct honest codes, no existence
oracle beyond room visibility (see the error table). Order: **method → auth header
→ JSON → schema(.strict) → identity(getUser) → target-move visibility(6a) →
authorship(6b) → debate consistency(6c) → participant(6d) → kind vocabulary(7a) →
relation/prior_move target(7b/7c) → cap(8) → idempotency dedup → write**. Every
guard runs BEFORE any write.

### 4. `answers_request` debt-flip rides the EXISTING `evidence_supplied` mechanism

**Grounding (load-bearing):** the notification is **Edge-emitted, not a DB
trigger.** `submit-argument/index.ts` (the QOL-040 block, ~L629–L767) classifies a
just-inserted move and, on `evidence_supplied`, does a **service-role INSERT into
`public.room_notifications`** with `type='evidence_supplied'`, `recipient_id`,
`debate_id`, `argument_id`, `room_title`, `meta:{}` for every room primary
(side ∈ {affirmative, negative}) except the author. `evidence_supplied` is already
a permitted `room_notifications.type` CHECK value (`20260524000014`), so **no
migration is needed.**

**Equally load-bearing — evidence debt is NOT a persisted row.**
`src/features/evidence/evidenceDebtModel.ts` is a **render-time derivation** ("no
`evidence_debt` table, no migration" — its own header). A debt's status is a pure
function of the request move + later answering moves. **There is nothing to
UPDATE.** So the "debt flip" for a post-hoc attach is precisely two things, and the
design does exactly (and only) these — never a parallel mechanism:

1. **Persist the durable answer fact.** When `relation.kind === 'answers_request'`,
   write the `proof_relations` row with `relation='answers_request'` and
   `claim_argument_id = relation.claimArgumentId` (the specific source-request /
   claim argument). This names **exactly one** target — satisfying "flips exactly
   the targeted open debt" (no broadcast). A future read-model maps it to the
   deterministic debt id `<claimArgumentId>:debt`.
2. **Fire the existing signal.** Emit the `evidence_supplied` notification via the
   **same** service-role `room_notifications` INSERT shape `submit-argument` uses —
   recipients = room primaries except the caller; `argument_id = body.argumentId`
   (the caller's move that now carries the answering proof); `type =
   'evidence_supplied'`; `room_title = debate.title.slice(0,200)`; `meta = { via:
   'attach_proof' }`. **Best-effort** (try/catch swallow), never blocks the attach,
   fired **only** on a NEW `answers_request` relation (not on an idempotent re-hit),
   and never self-notifies. `debtSignalEmitted` in the response reflects this.

**Honest boundary (do NOT overclaim):** the *visible* debt chip flips to `supplied`
only when the **read model** consumes `proof_relations`/`proof_items` into the
derivation. Today `deriveEvidenceDebts` reads per-move artifact lists + *later*
moves — it does not read `proof_relations`, and a post-hoc proof on the challenged
node is not a "later move." So the derived chip does **not** auto-flip from this
attach. Wiring the derivation to consume `answers_request` is a **read-model change
owned by PROOF-002 / a later EV card** (a documented forward dependency), NOT
PROOF-003. PROOF-003 delivers the durable fact + the user-facing signal; that is
the whole of "riding the existing mechanism."

### 5. Idempotency key = natural content-tuple dedup (no migration)

`proof_items` has no natural unique key and PROOF-001 shipped no idempotency column.
To make **double-attach idempotent-safe without a migration**, the Edge dedupes an
attach by a **natural content tuple** among the move's `deleted_at is null` rows:

```
idempotencyKey(row) = hash(
  argument_id, added_by, kind,
  coalesce(url,''), coalesce(source_text,''), coalesce(quote,''),
  coalesce(referenced_argument_id,''), label
)
```

Before inserting, the Edge does a service-role SELECT of the move's non-deleted
proofs and, if a row with the same tuple exists, **returns it with `idempotent:
true` and inserts nothing** (and does not count it against the cap). Attaching the
identical receipt to the same move twice IS a duplicate, so collapsing it is
doctrine-honest. The **relation** is independently idempotent via the shipped
`UNIQUE(proof_item_id, claim_argument_id, relation)`: a duplicate insert raises
`23505`; the Edge catches it, re-selects the existing relation, and returns it with
`relationIdempotent: true` (and does NOT re-fire the notification). The pure
key-builder lives in `_shared/proofAttach.ts` and is unit-tested directly.

**Flagged alternative (NOT chosen — would make the card migration-bearing):** add
`proof_items.client_attach_id uuid` + a partial unique index `(argument_id,
client_attach_id) WHERE deleted_at IS NULL`, and dedupe on a client-supplied UUID
(the `submit-argument` `client_submission_id` idiom). Cleaner for genuinely-distinct
identical content, but it converts PROOF-003 into a migration-bearing card
(heightened review). **Operator decision deferred** — the natural-tuple design
ships unless the operator prefers explicit client-key idempotency.

### 6. `config.toml` registration in the same PR + `verify_jwt = true`

The #509 hazard (unregistered function dir silently never deploys) is the named
risk. The registration block is added in the same PR, immediately before
`[edge_runtime]`, and a jest scan asserts it (Test plan §3). Block (mirrors the
`create-argument-room` / `manage-circle` house style):

```toml
# PROOF-003 (#890) — attach-proof. Post-hoc evidence attach to an already-posted
# move (J7). verify_jwt = true: every call requires a valid JWT. The function
# ALSO validates the JWT via createCallerClient + getUser (defense-in-depth) to
# resolve the caller id, then gates participant + own-move scope + kind vocabulary
# + the 8-per-move cap BEFORE any write. Because PROOF-001 shipped proof_items /
# proof_relations SELECT-only (no authenticated write policy, no immutability
# trigger), this function's service-role client is the ONLY writer for both
# tables and OWNS: tombstone/field immutability (attach = INSERT only; detach
# writes ONLY deleted_at; never un-deletes) and the evidence-doctrine rule that a
# client can never set broken/primary_present (status is derived server-side,
# restricted to the three client-derivable values). On an answers_request
# relation it fires the EXISTING evidence_supplied room_notifications path (no
# parallel mechanism). Registration here is what makes it auto-deploy on merge
# (the Supabase GitHub integration keys off the root [functions.*] blocks).
[functions.attach-proof]
verify_jwt = true
```

### 7. Client wrapper = anon key + caller JWT only (`supabase.functions.invoke`)

The wrapper in `src/lib/edgeFunctions.ts` mirrors `reactToMove` / `submitArgumentDraft`
(idempotent JWT-scoped write, never throws, `{ ok, data } | { ok, error, status }`).
It holds NO service-role key and mirrors `MAX_PROOFS_PER_MOVE` as an exported const
(the `ADMIN_BULK_INACTIVE_ID_CAP` precedent) for client-side pre-checks.

---

## Data model

**No new tables, no migration (default design).** PROOF-003 writes the PROOF-001
tables verbatim. The columns this function sets:

`proof_items` (INSERT): `debate_id`, `argument_id`, `added_by = callerId`, `kind`,
`label`, `url|source_text|quote|referenced_argument_id` (per kind), `source_chain_status`
(derived ∈ 3 values), `risk = 'unknown'`. `id`/`created_at` default; `deleted_at`
NULL. (UPDATE on detach): `deleted_at` ONLY.

`proof_relations` (INSERT, optional): `debate_id`, `proof_item_id`,
`claim_argument_id`, `relation`, `created_by = callerId`. Idempotent via the shipped
UNIQUE.

`room_notifications` (INSERT, optional, best-effort): `recipient_id`, `debate_id`,
`argument_id`, `type='evidence_supplied'`, `room_title`, `meta`.

### TypeScript / pure-contract surface (new)

`supabase/functions/_shared/proofAttach.ts` (pure — no Deno, no network; jest-importable
like `_shared/evidenceAnnotationEligibility.ts`):

```ts
export const ATTACHABLE_PROOF_KINDS = ['url','quote','source_text','note','prior_move','external_ref'] as const;
export type AttachableProofKind = typeof ATTACHABLE_PROOF_KINDS[number];

export const DERIVABLE_SOURCE_CHAIN_STATUSES = ['unverified','source_no_quote','source_and_quote'] as const;
export type DerivableSourceChainStatus = typeof DERIVABLE_SOURCE_CHAIN_STATUSES[number];

export const MAX_PROOFS_PER_MOVE = 8;
export const PROOF_LABEL_MAX = 120;
export const PROOF_URL_MAX = 2048;
export const PROOF_QUOTE_MAX = 4000;
export const PROOF_SOURCE_TEXT_MAX = 8000;

export interface ProofAttachFields {
  kind: AttachableProofKind;
  label: string;
  url?: string | null;
  sourceText?: string | null;
  quote?: string | null;
  referencedArgumentId?: string | null;
}

/** True + null message when the per-kind required fields are present; else a code. */
export function validateKindFields(f: ProofAttachFields): { ok: true } | { ok: false; issue: string };

/** Mirror of evidenceModel.deriveSourceChainStatus — returns ONLY the 3 derivable values. */
export function deriveProofSourceChainStatus(f: ProofAttachFields): DerivableSourceChainStatus;

/** Deterministic natural-content idempotency key (Design decision 5). */
export function proofIdempotencyKey(argumentId: string, addedBy: string, f: ProofAttachFields): string;
```

`src/lib/edgeFunctions.ts` additions (client types + `attachProof` / `detachProof`
wrappers + `MAX_PROOFS_PER_MOVE` mirror). No production TS beyond the wrapper.

---

## File changes

- **new:** `supabase/functions/attach-proof/index.ts` — the Edge Function
  (Deno.serve, CORS/method/auth ladder, zod `.strict()` discriminated union,
  getUser, the guard ladder, service-role writes, notification emit). ~260–320
  lines incl. header.
- **new:** `supabase/functions/_shared/proofAttach.ts` — pure contract module
  (kind vocab, attachable subset, per-kind field validation, status derivation,
  caps, idempotency-key builder). ~120–150 lines. Imported by `index.ts` AND the
  jest contract test.
- **modified:** `supabase/config.toml` — add the `[functions.attach-proof]` block
  (Design decision 6) immediately before `[edge_runtime]`. ~14 lines.
- **modified:** `src/lib/edgeFunctions.ts` — add `AttachProofPayload` /
  `DetachProofPayload` / result types + `attachProof()` / `detachProof()` wrappers
  + `MAX_PROOFS_PER_MOVE` mirror const. ~90 lines.
- **new:** `__tests__/attachProofContract.test.ts` — imports the pure
  `_shared/proofAttach.ts` for real branch coverage. ~28 tests.
- **new:** `__tests__/attachProofEdge.test.ts` — source-scan over `index.ts` +
  `config.toml` (mirrors `createArgumentRoomEdge.test.ts`), incl. the registration
  scan + condition-(i)/(ii) scans + no-oracle/no-secret scans. ~34 tests.
- **new:** `__tests__/attachProofClient.test.ts` — wrapper unit test (mock
  `supabase.functions.invoke`). ~10 tests.
- **modified:** `docs/core/current-status.md` — add the PROOF-003 Phase-framing
  section (the contract seam, the two conditions, the notification reuse) + the
  confirmed test count.
- **modified:** `CLAUDE.md` "Current stage" line — the implementer bumps it only
  after capturing the live count (test-discipline).
- **no change:** `submit-argument`, any existing function, `evidenceModel.ts`,
  `evidenceDebtModel.ts`, any migration, any UI (all non-goals).

---

## API / interface contracts (for other files)

- **PROOF-002 (drawer UI)** calls `attachProof()` / `detachProof()` from
  `src/lib/edgeFunctions.ts` and codes against the Edge contract section verbatim.
  It reads back rows via the PROOF-001 SELECT policies.
- **`attachProof(payload) → Promise<AttachProofOutcome>`** and
  **`detachProof(payload) → Promise<DetachProofOutcome>`** — `{ ok:true; data } |
  { ok:false; error; status }`, never throw (the `reactToMove` idiom).
- **`_shared/proofAttach.ts`** exports the pure contract (kinds, caps, status
  derivation, idempotency key) — the single source of truth shared by the Edge and
  the tests.

---

## Edge cases

- **Empty label / optional fields.** `label` defaults `''`; optional per-kind
  fields absent is fine unless the kind requires them (7b/422).
- **Over-cap (8 proofs).** 9th non-deleted attach → 409 `proof_cap_reached`. An
  idempotent re-hit of an existing proof does NOT count and returns 200.
- **Double-attach (identical content).** Returns the existing proof, `idempotent:
  true`, no new row.
- **Double-relate (same proof + claim + relation).** `UNIQUE` 23505 → caught →
  existing relation returned, `relationIdempotent: true`, notification NOT re-fired.
- **Cross-room proof.** `argument.debate_id !== debateId` → 400
  `debate_argument_mismatch`. Relation/prior_move targets in another room → 404
  `*_not_found` (same-room required).
- **Non-author attach.** Attaching to someone else's move → 403 `not_your_move`.
  Attaching a *relation* (`contradicts`/`contextualizes`) targeting someone else's
  same-room claim is allowed **as long as the caller owns the proof_item** — the
  proof is always on the caller's own move; the relation may point at any same-room
  claim.
- **Client sends `sourceChainStatus` / `risk`.** `.strict()` → 422
  `validation_failed`. Status is derived; risk is always `'unknown'`.
- **Client sends `kind: 'screenshot'` / `'file'` / `'voice_excerpt'` / `'timestamp'`.**
  400 `kind_not_supported` (deferred to SEC-PROOF-001 / MARK-001).
- **Detach an already-deleted proof.** Idempotent success, `idempotent: true`, no
  write (no resurrection).
- **Detach someone else's proof.** Visible-but-not-owned → 403 `not_your_proof`;
  invisible/missing → 404 `proof_not_found` (no-oracle).
- **Un-delete attempt.** Impossible — no action sets `deleted_at = null` (scan-pinned).
- **`answers_request` with no matching open debt.** Still writes the relation +
  fires the notification (the relation is an additive fact; the read-model decides
  whether a debt exists). Never errors on "no debt found."
- **Offline / network failure.** The wrapper returns `{ ok:false, error:{error:'network_error'}, status:503 }`
  (the `reactToMove` idiom); the drawer shows a retry, never a crash. Retrying is
  safe (idempotent).
- **Notification insert fails.** Swallowed (best-effort); the attach still returns
  200 with `debtSignalEmitted: false`.
- **Concurrent duplicate relation.** UNIQUE handles it (idempotent).

---

## Test plan

Baseline (orchestrator-provided): **947 suites / 33,623 tests** — the implementer
captures the live `Test Suites: … / Tests: …` line + exit 0 before and after and
cross-checks `current-status.md` (test-discipline; the POSTRUN-UX001 gate-timeout
rule: re-run with `; echo "EXIT: $?"` if truncated). Expected delta: **+3 suites,
≈ +70 tests.**

### §1 — `__tests__/attachProofContract.test.ts` (pure module, real branch coverage)

Imports `../supabase/functions/_shared/proofAttach` directly (the
`annotateEvidenceEdgeFunction` precedent).
- `validateKindFields`: each kind's required field present → ok; missing → the
  right issue code; storage/marker kinds are not in `ATTACHABLE_PROOF_KINDS`.
- `deriveProofSourceChainStatus`: returns ONLY `unverified|source_no_quote|
  source_and_quote` across every kind + field combination; **never**
  `broken`/`primary_present` (assert the return is always in
  `DERIVABLE_SOURCE_CHAIN_STATUSES`); parity spot-checks vs
  `evidenceModel.deriveSourceChainStatus`.
- `proofIdempotencyKey`: deterministic + total; identical fields → identical key;
  a changed field → a different key; `deleted`-irrelevant.
- Caps constants: `MAX_PROOFS_PER_MOVE === 8`; length caps match the schema.

### §2 — `__tests__/attachProofEdge.test.ts` (source-scan; mirrors `createArgumentRoomEdge.test.ts`)

`fs.readFileSync` over `supabase/functions/attach-proof/index.ts`. **Every safety
scan paired with a negative control** where feasible.
- **Standard shape:** `Deno.serve`, CORS on OPTIONS, `methodNotAllowed` on non-POST,
  `unauthorized()` when no `Authorization`, zod `.strict()` `safeParse` before
  reading the body shape, `createCallerClient` + `auth.getUser()`.
- **Guard ladder / codes present + ordered:** each of `argument_not_found`,
  `not_your_move`, `debate_argument_mismatch`, `not_a_participant`,
  `kind_not_supported`, `claim_not_found`, `referenced_argument_not_found`,
  `proof_cap_reached`, `proof_not_found`, `not_your_proof` appears; participant
  check via `is_debate_participant`.
- **No-oracle:** the "not found" branches derive from a caller-scoped read (assert
  `createCallerClient` read precedes the not-found return; assert the function does
  not branch on a service-role existence probe for those codes).
- **Condition (i):** the detach `UPDATE` object contains ONLY `deleted_at`
  (negative control plants a second key); no `deleted_at: null` anywhere; no
  content-field UPDATE anywhere; the only write verbs are the `proof_items` INSERT,
  the `proof_relations` INSERT, the detach `deleted_at` UPDATE, and the
  `room_notifications` INSERT.
- **Condition (ii):** no `sourceChainStatus` key in the request schema; status set
  from `deriveProofSourceChainStatus(...)`; `primary_present`/`broken` never in a
  write object (negative control).
- **Idempotency:** the content-tuple dedup SELECT precedes the INSERT; the relation
  path catches `23505` / treats duplicate as idempotent.
- **Notification reuse:** inserts into `room_notifications` with
  `type: 'evidence_supplied'`; recipients exclude the caller; fired only on a NEW
  `answers_request` relation; wrapped in try/catch (best-effort).
- **Secret discipline:** no `console.log`; no console line contains `authorization`
  / `service_role`; no literal `SERVICE_ROLE_KEY` (uses `createServiceClient`).
- **Ban-list:** no verdict/person token in any user-visible `message`.

### §3 — registration scan (the #509 hazard — in the same test file)

`fs.readFileSync` over `supabase/config.toml`:
- asserts `[functions.attach-proof]` block exists AND the next non-comment line is
  `verify_jwt = true`;
- asserts `supabase/functions/attach-proof/index.ts` exists on disk;
- **negative control:** a bogus name (`[functions.attach-proof-nope]`) is NOT
  present (guards against a copy-paste that registers the wrong dir).

### §4 — `__tests__/attachProofClient.test.ts` (wrapper unit test)

Mocks `supabase.functions.invoke`: success → `{ ok:true, data }`; function error
with `context.json()` → `{ ok:false, error, status }`; `FunctionsFetchError` → 503;
empty data → 500; `MAX_PROOFS_PER_MOVE` mirror equals the shared constant.

No Docker DB reset (Deno Edge unloadable by jest — the source-scan + pure module
are the contract, the house pattern). Runtime happy/refused paths are the operator's
post-deploy smoke (Rollout).

---

## Dependencies (cards / docs / files)

- **Assumes PROOF-001 (#888, merged `2cf98f0`)** — `proof_items` / `proof_relations`
  exist SELECT-only with the CHECK vocabularies + the `UNIQUE(proof_item_id,
  claim_argument_id, relation)` this design relies on for relation idempotency.
- **Reads** `src/features/evidence/evidenceModel.ts` at `deriveSourceChainStatus`
  (the status-derivation `_shared/proofAttach.ts` mirrors) — do not re-invent.
- **Mirrors** `supabase/functions/submit-argument/index.ts` QOL-040
  `evidence_supplied` block for the notification shape (the existing mechanism).
- **Uses** `is_debate_participant` (`20260516000006`, granted `authenticated`) and
  the arguments SELECT policy (`is_argument_visible` / `is_argument_visible_in_circle`)
  for no-oracle reads.
- **Uses** `public.room_notifications` (`20260524000014`) — `evidence_supplied` is
  already a valid `type` (no migration).
- **Pairs with PROOF-002** on one bundle branch — PROOF-003 OWNS the Edge contract
  seam; PROOF-002 consumes it and owns the drawer + any read-path flip.
- **Hands off (forward dependency):** the read-model change that makes the derived
  debt chip flip from a `proof_relations.answers_request` row (PROOF-002 / a later
  EV card); the `set-source-chain-status` admin Edge (`broken`/`primary_present`);
  SEC-PROOF-001 (storage kinds); MARK-001 (marker kinds).

---

## Risks

- **Merge = deploy of a NEW function; the registration miss is the named hazard
  (#509).** Mitigation: the `config.toml` block ships in the same PR and the §3
  registration scan (with a negative control) fails CI if it is absent. Post-merge,
  the operator confirms deploy with a 401 probe (Rollout).
- **Service-role is the SOLE writer with NO DB backstop** (SELECT-only RLS + dropped
  trigger). Every guard — participant, scope, kind, cap, immutability, status
  restriction — lives in Edge code. This is the direct consequence of the operator's
  maximally-conservative PROOF-001 ruling. Mitigation: the pure-module tests (§1)
  carry real branch coverage for the deterministic guards, and the source-scan (§2)
  pins the ladder + the two reviewer conditions; there is no silent RLS/ trigger
  fallback to lean on, so the tests ARE the contract.
- **Cap race.** Two concurrent attaches can each read 7 and both insert → 9. The
  8-per-move cap is an advisory UX cap, not a security/doctrine boundary, so a small
  transient over-count is acceptable. A hard cap would need a DB
  count-trigger/constraint (deferred). Flagged, non-blocking.
- **Natural-tuple idempotency is content-fuzzy.** Two deliberately-distinct attaches
  with byte-identical content collapse to one. Doctrine-honest (an identical receipt
  on the same move IS a duplicate). If the operator wants exact client-key
  idempotency, Design decision 5's migration alternative is the path (converts the
  card to migration-bearing).
- **Derived debt does NOT auto-flip from a post-hoc attach.** The visible chip flips
  only when the read-model consumes `proof_relations` — a forward dependency, NOT
  this card. The design is explicit so the implementer/reviewer do not expect a
  chip change from `attach-proof` alone.
- **Deno Edge is unloadable by jest.** The Edge glue is contract-tested by
  source-scan (house pattern); the deterministic logic lives in the pure `_shared`
  module with real coverage. Runtime paths are operator smoke.
- **Own-draft RLS visibility.** If the arguments SELECT policy hides the author's own
  draft from the caller-scoped read, guard 6a would wrongly 404 a legitimate own
  draft. Mitigation: the tightly-scoped service-role fallback keyed on `author_id =
  callerId` (Design decision 2). The implementer confirms the policy behavior and
  picks the caller-scoped read when it suffices.

---

## Out of scope

- **No admin status-set** (`broken` / `primary_present`) — deferred to a future
  `set-source-chain-status` admin Edge. This function sets them nowhere.
- **No storage-kind attach** (`screenshot`/`file`) — SEC-PROOF-001 (bucket + EXIF/size
  hardening + kind-CHECK widen). `kind_not_supported` until then.
- **No marker kinds** (`voice_excerpt`/`timestamp`) — MARK-001.
- **No drawer UI, no read-path flip, no derived-debt read-model change** — PROOF-002
  / later EV card.
- **No change to `submit-argument` or any existing function.**
- **No DB migration** (default design; the client-key idempotency alternative is the
  only path that would add one, and it is not chosen).
- **No point-standing / anti-amplification change** — this function emits no
  `PointStandingDelta`, never gates a post, never touches engagement/ factual-standing
  scoring.
- **No v1-scope violation** (no voting, search, push, OAuth, public API).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels / score never blocks posting):** the
  function writes a source-chain *status* (advisory), never a verdict; it never
  gates `submit-argument` or any post; error `message`s are ban-list-scanned.
- **cdiscourse-doctrine §3 (popularity ≠ evidence):** no like/view/follower input;
  the notification carries no engagement metric.
- **cdiscourse-doctrine §4 (AI limits):** no AI call anywhere in this function; status
  is a deterministic mirror of the existing classifier.
- **cdiscourse-doctrine §6–7 (secrets / no AI in app):** no secret in code or
  response; `createServiceClient` (no literal `SERVICE_ROLE_KEY`); no
  `Authorization`/service-role logging; no Anthropic/xAI/X call.
- **cdiscourse-doctrine §8 (Supabase conventions):** RLS stays enabled + SELECT-only;
  soft-delete only (`deleted_at`), no hard delete; no migration edits.
- **evidence-doctrine (status advisory; `primary_present` admin-only; engagement vs
  factual standing separate):** status derived, restricted to the 3 client-derivable
  values; `broken`/`primary_present` never written (condition (ii)); no score delta;
  `answers_request` fires the existing engagement-neutral notification, not a
  standing change.
- **supabase-edge-contract (no service-role in client; standard Edge shape; caller
  own-row check):** the client wrapper is anon+JWT only; the function follows the
  house guard ladder; writes go through the narrowest correct client after
  validation; caller-scoped reads give the no-oracle property.
- **doctrine §10a (Observations vs Allegations):** no node-label mutation here; the
  proof is user-attached content, not a machine Observation on another's node.

---

## Operator steps

1. **Merge → auto-deploy.** The Supabase GitHub integration deploys
   `attach-proof` on merge to `main` **because** `[functions.attach-proof]` is in
   `config.toml`. No manual deploy if the integration is healthy; otherwise:
   `npx supabase functions deploy attach-proof --linked`.
2. **Registration verified (post-merge):** confirm the function is live —
   `npx supabase functions list --linked` shows `attach-proof`.
3. **401 unauthenticated probe:** `curl -s -o /dev/null -w '%{http_code}' -X POST
   <project>/functions/v1/attach-proof -H 'content-type: application/json' -d '{}'`
   → expect `401` (verify_jwt gate).
4. **Authed smoke (spec):** with a bot JWT (`.env.bot-tests`), attach a `url` proof
   to the caller's own move → 200 with `proofItem`; re-run identical → 200
   `idempotent: true`; attach with `relation.kind='answers_request'` → 200
   `debtSignalEmitted: true` + an `evidence_supplied` row in `room_notifications`;
   `detach` the proof → 200; re-`detach` → 200 `idempotent: true`; attach a 9th →
   409 `proof_cap_reached`; attach to another user's move → 403 `not_your_move`;
   attach `kind:'screenshot'` → 400 `kind_not_supported`.
5. **No migration** to run (default design). IF the operator chose the client-key
   idempotency alternative (Design decision 5), THEN also `npx supabase db push
   --linked` for the added `client_attach_id` column + partial unique index.

---

## Orchestrator-authored brief ledger

Authored against an orchestrator-relayed issue (#890) + the merged PROOF-001 design
on `main`, not a hand-validated operator brief. Interpretation map:

- **From the binding issue (#890):** the scope (new function + config.toml same PR),
  the caps (8/move, body-size), the answers_request debt-flip + evidence_supplied
  reuse mandate, the distinct-honest-codes / no-oracle AC, the idempotent-double-attach
  AC, "zero changes to existing functions."
- **From the PROOF-001 merged design + its operator ruling:** the SELECT-only write
  posture (so this Edge is the sole writer, service-role), the dropped-trigger fact
  (so the Edge owns immutability), the 6-kind CHECK + 5-status CHECK + relation
  UNIQUE, the `is_argument_visible_in_circle` visibility spine.
- **From the reviewer-imposed condition (PROOF-001 heightened review):** conditions
  (i) tombstone/field immutability and (ii) admin-only `broken`/`primary_present` —
  the § "Reviewer-condition enforcement" states exactly how each is enforced + pinned.
- **From a pre-launch codebase survey (this session):** the notification is
  **Edge-emitted** (not a DB trigger) in `submit-argument`; the evidence debt is
  **render-derived** (no `evidence_debt` table to UPDATE) — the two facts that shape
  Design decision 4; the `_shared` pure-module jest pattern; the
  `is_debate_participant(p_debate_id, p_user_id DEFAULT auth.uid())` signature; the
  `room_notifications.type` CHECK already permitting `evidence_supplied`; the
  `create-argument-room` guard-ladder + no-oracle precedent; the `reactToMove` client
  wrapper idiom.
- **Resolved by orchestrator/designer default (flag for operator review):**
  (a) **natural-content-tuple idempotency** vs the client-key column — chose the
  no-migration natural key (Design decision 5); the migration alternative is flagged.
  (b) **`argument_id = body.argumentId`** (the supplying move) on the
  `evidence_supplied` notification rather than the `claimArgumentId`. (c) `note` kind
  carries its title in `label` and optional body in `sourceText`. (d) `detach` is
  own-only (no admin-detach in v1).
- **Operator-deferred review:** the idempotency strategy (Design decision 5) and
  whether `detach` should also permit an admin/moderator (deferred to own-only for
  v1) are the two places a product call could differ. Everything else follows the
  binding issue + the PROOF-001 ruling.
