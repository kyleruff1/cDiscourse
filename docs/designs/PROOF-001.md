# PROOF-001 — proof_items + proof_relations tables, RLS, and JSONB back-fill (migration)

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 / Argument Surface Pivot — Evidence backend lane (M-ASP-3, Phase P3)
**Release:** M-ASP-3
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/888
**Migration-bearing:** yes — merge auto-applies (Supabase GitHub integration). Docker unavailable ⇒ reviewer runs the OPS-001 heightened four-issue-class textual review. The migration SQL is written **verbatim** below (the #882 precedent) so the review is trivially auditable.

---

## Orchestrator ruling applied (2026-07-09) — MAXIMALLY-CONSERVATIVE / SELECT-only write posture

This is a **selection** of the design's own documented alternative (§Orchestrator-authored
brief ledger → "Operator-deferred review"), **not a redesign**. The operator chose the
maximally-conservative circles (#859) posture over the mixed QOL-042 posture in the verbatim
SQL body below. The verbatim SQL body is **retained unchanged as the record of the mixed
alternative**; the *implemented* migration file adjusts it exactly as follows:

**Dropped from the verbatim SQL (write machinery — ALL writes move to the PROOF-003 Edge
Function, service-role, Round 2):**
- `proof_items_insert_own_move` — the direct-RLS INSERT policy.
- `proof_items_soft_delete_own` — the direct-RLS soft-delete UPDATE policy.
- `proof_relations_insert_own_proof` — the direct-RLS INSERT policy.
- `can_attach_proof_item(...)` + `can_relate_proof_item(...)` — the two write-gate helpers
  (their only callers were the dropped INSERT policies).
- `proof_items_soft_delete_only()` trigger function + `trg_proof_items_soft_delete_only`
  trigger. **Flagged as the one adjustment beyond a pure policy/helper drop:** the trigger is
  a write-path guard whose sole purpose was to constrain the (now-removed) authenticated
  soft-delete UPDATE. With no authenticated write path it is inert, and — because a BEFORE
  UPDATE trigger fires for **every** role including service-role — leaving it would actively
  BLOCK the PROOF-003 service-role soft-delete / `broken`/`primary_present` status writes the
  ruling routes to that Edge. Dropping it is therefore the necessary completion of "both
  tables ship SELECT-only RLS; ALL writes belong to PROOF-003", and matches the #859 SELECT-
  only precedent (which carries no immutability trigger because it guards no write). No new
  SQL was invented; comment/header prose that described the removed objects was updated to
  describe the SELECT-only posture.

**Unchanged (exactly as designed):** both `create table` bodies, all CHECK constraints
(6-kind `kind`, 5-status `source_chain_status`, `risk`, `relation`), all indexes, both
`enable row level security` statements, both **SELECT** policies (room-visible via the single
`is_argument_visible_in_circle(...)` call — canonical + #882 circle arm), the pgcrypto
dependency documentation, and the entire back-fill lane + fidelity contract.

**Resulting policy inventory:** `proof_items` = SELECT only (1 policy); `proof_relations` =
SELECT only (1 policy). No INSERT / UPDATE / DELETE policy on either table; RLS enabled on both;
no helper, no trigger. PROOF-003 (service-role Edge) owns insert, relation-insert,
soft-delete/detach, and privileged status.

**R2 confirmations (verified against the initial schema, cited in the migration header):**
`added_by`/`created_by` → `public.profiles(id)` matches the house convention
(`arguments.author_id` → `public.profiles(id)`, `20260516000001_initial_schema.sql:185`; and
`concession_items.author_id` → `public.profiles(id)`,
`20260522000012_qol_041_concession_acceptance.sql:86`). The back-fill fold module
(`scripts/proof-backfill/proofItemRowFromArtifact.ts`) is a **single shared module** imported
by BOTH the runner (via `backfillProofItemsCore.ts`) and the fidelity parity test.

**R3 (unchanged):** the `kind` CHECK ships the 6 infra-free kinds; the `marker_id` column is
deferred entirely (MARK-001). Storage kinds (`screenshot`/`file`) remain deferred to
SEC-PROOF-001.

---

## Goal (one paragraph)

Evidence artifacts today live only inside a JSONB snapshot on each argument row
(`arguments.client_validation->'attachedEvidence'`). The dedicated relational
home for evidence — "path c" in `docs/evidence-object-model.md §Follow-up` and
the Design Pass §8 `proof_items` / `proof_relations` spec — was designed but
never built. PROOF-001 ships **only the data layer**: two new, RLS-protected,
**empty** tables plus a dry-run back-fill script. `proof_items` is the artifact
table (a strict superset of `EvidenceArtifactKind`); `proof_relations` is the
claim↔proof graph that lets one receipt back several claims and powers
`answers_request` auto-resolution of evidence debts. PROOF-002 (the proof
drawer UI) and PROOF-003 (the attach-proof Edge Function) build on these
tables. The design is shaped by three doctrine constraints: **evidence is never
proof-of-truth** (`evidence-doctrine` — the tables carry a source-chain *status*,
never a verdict, and a client can never mint `primary_present`/`broken`); **RLS
is on everywhere and never over-permissive** (`supabase-edge-contract` §4 — the
over-permissive-INSERT failure mode is the single biggest risk on a new-table
migration); and **the anti-amplification separation is preserved** (nothing here
touches point standing / engagement credit — the tables are inert storage).

---

## Data model

Two new tables. All identifiers, kinds, and status vocabularies are **internal**
(never rendered raw — the read path maps them through the existing
`ReceiptChipContract` copy, which is already ban-list-asserted). The word
"proof" in table/column names is internal and exempt from the box-copy ban-list;
user-facing copy still says *Source / Receipts* (issue acceptance criterion).

### `public.proof_items` — the artifact record (per-artifact, superset of EvidenceArtifact)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | pgcrypto (Supabase default; documented, not `create extension`-ed — the #859 precedent) |
| `debate_id` | `uuid` NOT NULL → `public.debates(id)` on delete cascade | room scope; every proof belongs to exactly one room |
| `argument_id` | `uuid` NOT NULL → `public.arguments(id)` on delete cascade | the move the proof is attached to (the author's own move-or-draft) |
| `added_by` | `uuid` NOT NULL → `public.profiles(id)` on delete cascade | attribution; `profiles.id = auth.uid()` in this repo, so `added_by = auth.uid()` is the RLS ownership predicate |
| `kind` | `text` NOT NULL, CHECK ∈ 6-kind set (below) | **narrowed** — storage/marker kinds deferred (Design Decision 2) |
| `label` | `text` NOT NULL default `''` | plain-language label (`EvidenceArtifact.label`); user content, scanned in rendered UI, never at input |
| `url` | `text` NULL | present for `kind='url'` |
| `source_text` | `text` NULL | present for `kind='source_text'` |
| `quote` | `text` NULL | verbatim quote |
| `referenced_argument_id` | `uuid` NULL → `public.arguments(id)` on delete set null | present for `kind='prior_move'` |
| `source_chain_status` | `text` NOT NULL default `'unverified'`, CHECK ∈ 5-status set | `EvidenceArtifact.sourceChainStatus`; **excludes** `no_source` (aggregate-only, never a per-artifact value) |
| `risk` | `text` NOT NULL default `'unknown'`, CHECK ∈ `low/medium/high/unknown` | `EvidenceArtifact.risk`; back-fill leaves `'unknown'` |
| `created_at` | `timestamptz` NOT NULL default `now()` | |
| `deleted_at` | `timestamptz` NULL | soft-delete tombstone (never hard-deleted) |

**Deferred columns (NOT shipped this card — Design Decisions 1 & 2):**
- `storage_path text` — for `screenshot`/`file` kinds; added by **SEC-PROOF-001**
  together with the `proof-files` bucket + EXIF/size hardening, in the same
  migration that widens the kind CHECK.
- `marker_id uuid → timestamp_markers(id)` — for `voice_excerpt`/`timestamp`
  kinds; added by **MARK-001** together with the `timestamp_markers` table
  (P3.5), so the FK has a real referent from day one.

Both deferred columns exist **only** to serve deferred kinds; shipping them now
would be a dead column (`storage_path` always NULL) or an FK to a non-existent
table (`marker_id`). The append-only rule makes "add the column with its kind
later" strictly cleaner (Design Decisions 1 & 2 justify this at length).

**`kind` CHECK (shipped this card — 6 values, no external dependency):**
```
kind in ('url','quote','source_text','note','prior_move','external_ref')
```
**`source_chain_status` CHECK (5 values — `no_source` excluded):**
```
source_chain_status in ('unverified','source_no_quote','source_and_quote','broken','primary_present')
```
**`risk` CHECK:** `risk in ('low','medium','high','unknown')`

### `public.proof_relations` — the claim↔proof graph

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `debate_id` | `uuid` NOT NULL → `public.debates(id)` on delete cascade | room scope |
| `proof_item_id` | `uuid` NOT NULL → `public.proof_items(id)` on delete cascade | the receipt |
| `claim_argument_id` | `uuid` NOT NULL → `public.arguments(id)` on delete cascade | the claim it backs / contradicts / contextualizes / answers |
| `relation` | `text` NOT NULL, CHECK ∈ 4-relation set | |
| `created_by` | `uuid` NOT NULL → `public.profiles(id)` on delete cascade | attribution / RLS ownership |
| `created_at` | `timestamptz` NOT NULL default `now()` | |
| UNIQUE | `(proof_item_id, claim_argument_id, relation)` | one relation-kind per (proof, claim) pair |

**`relation` CHECK:** `relation in ('supports','contradicts','contextualizes','answers_request')`

`proof_relations` has **no** `deleted_at` (per the Design Pass columns): a
relation is an additive fact and becomes inert when its `proof_item` is
soft-deleted. `answers_request` is the row PROOF-003 / EV-003 read to
auto-resolve an evidence debt.

### TypeScript surface — none new

PROOF-001 adds **no** new TS types. The read-time shape stays `EvidenceArtifact`
(`src/features/evidence/evidenceModel.ts`); the adapter signature is stable
across the (b→c) transition (per the EV-001 doc). A future PROOF-002 row-reader
maps a `proof_items` row → `EvidenceArtifact` and feeds the **unchanged**
`summarizeArtifactsForReceiptChip`. This card writes zero production TS.

---

## Evidence-model reality audit (load-bearing)

Grounded by reading `src/features/evidence/evidenceModel.ts` and
`docs/evidence-object-model.md`. Findings that shaped the design:

1. **`EvidenceArtifactKind` has 7 values, not 6.** The EV-001 doc lists six;
   QOL-036 added a seventh (`payment_screenshot`). The live union is:
   `url | quote | source_text | dataset | screenshot_redacted | manual_citation
   | payment_screenshot`. Any back-fill fold table must cover all **seven**.

2. **`SourceChainStatus` per-artifact never returns `no_source`.**
   `deriveSourceChainStatus` returns only `unverified / source_no_quote /
   source_and_quote`; `no_source` is aggregate-only; `broken` / `primary_present`
   are override-only (admin / future automation). ⇒ the stored column CHECK
   **omits `no_source`** and the client INSERT WITH CHECK restricts to the three
   derivable statuses. Only a service-role Edge (a future `set-source-chain-status`
   admin function) may set `broken`/`primary_present` — encoding the
   evidence-doctrine rule *"only an admin can mark a chain primary_source"* at the
   DB boundary.

3. **`buildEvidenceArtifacts` is the authoritative classifier and it only ever
   emits `unverified / source_no_quote / source_and_quote` and `risk='unknown'`.**
   So every back-filled row lands in exactly the client-writable envelope — the
   back-fill needs no privileged status.

4. **The back-fill never needs a storage or marker kind.** The JSONB snapshot
   carries no binary and no timestamp marker — `screenshot_redacted` is a *flag +
   label*, not a stored image (EV-001: "stores the flag + redaction state, not the
   binary"). So the classifier's outputs fold entirely into the **non-storage,
   non-marker** kinds. This is the fact that makes narrowing the kind CHECK
   (Design Decision 2) fully compatible with the back-fill. The honest fold given
   the shipped 6-kind CHECK:

   | `EvidenceArtifactKind` (source) | `proof_items.kind` (folded) | rationale |
   |---|---|---|
   | `url` | `url` | 1:1 |
   | `quote` | `quote` | 1:1 |
   | `source_text` | `source_text` | 1:1 |
   | `dataset` | `url` | a dataset *is* an inspectable URL; the dataset flavour is lost, the URL is faithful |
   | `screenshot_redacted` | `note` | no binary on back-fill; becomes a textual note carrying the label |
   | `manual_citation` | `note` | a citation is a textual note |
   | `payment_screenshot` | **(deferred — not written)** | carries a structured `payment` sub-object with no path-c column this card; recorded in the dry-run report as excluded, left in JSONB |

5. **`ReceiptChipContract.kinds` carries the original `EvidenceArtifactKind`,
   not the folded kind.** (Confirmed at `evidenceModel.ts:379`.) This is the
   crux of the fidelity contract: the chip's **copy-bearing and doctrine-bearing
   fields** (`label`, `helper`, `tone`, `invitesFollowup`,
   `showsSourceChainPressure`, `status`, `count`) are derived from
   `source_chain_status` (worst-status-wins) + count **only** — they are provably
   invariant under kind-folding. The `kinds` glyph array is the *only* field the
   fold changes. See "Back-fill design → fidelity contract."

6. **Corpus density is a live-DB fact, not a fixture fact.** No committed fixture
   under `fixtures/` carries `attachedEvidence` (grep: zero). The JSONB
   attachments only exist on real corpus rows in the linked DB. ⇒ the back-fill's
   authoritative count is the dry-run report against the linked DB (acceptance
   criterion); the fidelity parity test uses **inline** fixtures constructed to
   exercise every kind→fold→status path, not scraped corpus JSONB. Estimated
   shape: evidence attachments are sparse (evidence-type moves + a minority of
   sourced rebuttals), likely low hundreds of artifacts across corpus rooms — but
   the dry-run number governs, not this estimate.

---

## Policy landscape

The three helpers this migration composes through, all SECURITY DEFINER STABLE
`SET search_path = public`, all pre-applied and granted to `authenticated`:

- **`public.is_argument_visible(arg_id, viewer_id)`** (COV-004,
  `20260630000001`) — the canonical arguments-visibility helper. Mirrors the
  arguments SELECT arms (admin / author-of-active-arg / posted-active-arg in
  active-public-or-participant debate). Used by `concession_items` /
  `concession_acceptances` / `move_reactions` SELECT policies so their visibility
  inheritance from `public.arguments` is explicit.

- **`public.is_argument_visible_in_circle(arg_id, viewer_id)`** (PRIVATE-GROUPS-002
  `20260702000001`, wired live by #882 `20260709000001`) — **already OR-composes**
  `is_argument_visible(...)` (its first branch is a call, never re-inlined) **plus**
  the circle-member arm. ⇒ **a single call to `is_argument_visible_in_circle`
  gives room-visibility *including* the #882 circle arm** — exactly what the issue
  asks for ("SELECT room-visible via the shipped visibility helpers incl. the
  #882 circle arm"). PROOF-001's SELECT policies call **this** helper, not the raw
  canonical one, so circle-room members can read proof rows on a circle room's
  arguments the moment PROOF-002 flips.

- **`public.is_debate_participant(debate_id, user_id)`** (`20260516000006`) —
  definer membership check; the write-gate spine (QOL-042 precedent).

Write-posture precedents surveyed:
- **circles (#859)** — SELECT-only, *no* authenticated write policy (all writes
  service-role Edge). The maximally-conservative posture for a new table.
- **`argument_room_links` (QOL-042)** — the **mixed** posture PROOF-001 follows:
  direct-RLS INSERT gated by `created_by = auth.uid() AND
  is_debate_participant(...)`, soft-remove-only UPDATE gated by `created_by =
  auth.uid() OR is_moderator_or_admin()` **plus a BEFORE-UPDATE immutability
  trigger** that rejects any change except the soft-delete column, and **no**
  DELETE policy. This is the exact idiom PROOF-001 reuses for `proof_items`.

The house rule (circles §Doctrine, COV-004) is emphatic: **every cross-table
read inside a policy goes through a SECURITY DEFINER STABLE helper; no raw
cross-table subquery in any policy.** PROOF-001 honors this — the two new write
helpers (`can_attach_proof_item`, `can_relate_proof_item`) encapsulate all
cross-table reads; the policy bodies are scalar comparisons + helper calls only.

---

## The migration SQL (verbatim)

File: `supabase/migrations/20260710000001_proof_001_proof_items_and_relations.sql`
(timestamp strictly after the highest applied, `20260709000001`). **One
additive migration** — the issue Scope says "One additive migration"; the tables
are FK-coupled (`proof_relations → proof_items`) so a single self-contained file
applies atomically and gives the Supabase Preview check one chokepoint (Design
Decision — see §Design decisions "One file vs two").

```sql
-- ============================================================
-- Migration: 20260710000001_proof_001_proof_items_and_relations
-- Card: PROOF-001 (#888) — proof_items + proof_relations tables + RLS.
-- Epic: PRODUCT-REDIRECT-001 / Argument Surface Pivot (M-ASP-3, Phase P3).
-- Canonical spec: Design Pass Output 8 (data model) + docs/evidence-object-model.md
--   Follow-up (path c). Design: docs/designs/PROOF-001.md.
--
-- Sequential after 20260709000001_asp_circles_rls_001_circle_read_arm.sql
--   (highest applied timestamp at build time).
--
-- ── What this migration does (strictly additive) ────────────
--   Creates TWO new, RLS-enabled, EMPTY tables: proof_items (the evidence
--   path-c artifact table, a strict superset of EvidenceArtifactKind) and
--   proof_relations (the claim<->proof graph). Adds two SECURITY DEFINER
--   write-gate helpers, one soft-delete immutability trigger, and the SELECT /
--   INSERT / soft-delete policies. ZERO existing rows are touched; ZERO
--   existing objects are dropped or edited. No read-path flips (the evidence
--   adapter keeps reading JSONB until PROOF-002). Both tables are empty until
--   PROOF-002/003 (client attach) or the operator-gated back-fill writes them,
--   so behaviour for every existing room is bit-for-bit unchanged.
--
-- ── Extension dependency (OPS-001 Class 4) ──────────────────
--   gen_random_uuid() requires pgcrypto. Supabase enables pgcrypto by default
--   in the public schema; every prior migration in this repo relies on the
--   same default (circles, argument_room_invites, concession_items). Per
--   OPS-001 Class 4 the dependency is DOCUMENTED here, not asserted with a
--   create-extension statement (the #859 precedent).
--
-- ── Doctrine encoded by this migration ──────────────────────
--   - Evidence is never proof-of-truth (evidence-doctrine). A proof_items row
--     carries a source-chain STATUS, never a verdict. The status CHECK omits
--     'no_source' (aggregate-only); the INSERT WITH CHECK restricts an
--     authenticated caller to the three derivable statuses
--     ('unverified','source_no_quote','source_and_quote'). A caller can NEVER
--     mint 'primary_present' / 'broken' from the client — those are reserved
--     for a future service-role admin Edge (set-source-chain-status), matching
--     "only an admin can mark a chain primary_source".
--   - Anti-amplification separation preserved: these tables are INERT storage.
--     No point-standing / engagement-credit column, no trigger that writes any
--     score. Standing moves only when a later MOVE does something the
--     point-standing engine already grades (untouched here).
--   - RLS is ENABLED on both tables; nothing is disabled (cdiscourse-doctrine
--     §8 / supabase-edge-contract §4). Every cross-table read inside a policy
--     goes through a SECURITY DEFINER STABLE helper (no raw cross-table
--     subquery in any policy) — the COV-004 / circles anti-recursion pattern.
--   - Room-visible SELECT composes through is_argument_visible_in_circle, which
--     itself OR-composes the canonical is_argument_visible (never re-inlined) +
--     the #882 circle arm. So visibility exactly inherits the arguments policy,
--     circle arm included.
--   - Soft-delete only (deleted_at). No hard-delete path; no DELETE policy on
--     either table. The proof_items_soft_delete_only trigger makes every
--     non-deleted column immutable to an authenticated caller (QOL-042 idiom),
--     so a client cannot rewrite kind / status / label after insert.
--   - kind / relation / status vocabularies contain no verdict or person
--     token (ban-list asserted by the scan suite). Table/column names carry
--     'proof' (internal, exempt from the box-copy ban-list); user-facing copy
--     is unchanged and still says Source / Receipts.
--
-- ── OPS-001 four-class compliance (Docker-less heightened review) ──
--   Class 1 (ambiguous column): NO policy body contains a subquery — every
--     cross-table read lives inside a SECURITY DEFINER helper whose columns are
--     fully qualified. Every column in every USING / WITH CHECK body is
--     table-qualified (proof_items.* / proof_relations.*). No same-name column
--     is referenced bare.
--   Class 2 (type mismatch): every FK column is uuid, referencing a uuid PK
--     (debates.id / arguments.id / profiles.id / proof_items.id). All CHECK
--     comparisons are text<->text literal. auth.uid() is uuid, compared to
--     uuid added_by / created_by. No text<->uuid, no int<->bigint.
--   Class 3 (statement order): proof_items CREATE TABLE -> ENABLE RLS ->
--     indexes -> can_attach_proof_item helper -> soft-delete trigger fn +
--     trigger -> proof_items policies; THEN proof_relations CREATE TABLE (its
--     FK to proof_items now exists) -> ENABLE RLS -> indexes ->
--     can_relate_proof_item helper (reads proof_items + arguments, both exist)
--     -> proof_relations policies. Every object exists before it is referenced;
--     RLS is enabled before any policy is created on its table.
--   Class 4 (function/extension deps): pgcrypto documented above. Referenced
--     pre-applied helpers: is_argument_visible_in_circle (20260702000001, granted
--     to authenticated), is_debate_participant (20260516000006, granted),
--     is_moderator_or_admin (initial schema). auth.uid() from the Supabase auth
--     schema (present by default). New helpers/grants are CREATED in this file
--     before use. No COMMENT ON ... ON storage.* (all COMMENT targets are
--     public.* objects this migration role owns).
-- ============================================================

-- ============================================================
-- 1. public.proof_items — the evidence path-c artifact record
-- ============================================================
create table if not exists public.proof_items (
  id                      uuid        primary key default gen_random_uuid(),
  debate_id               uuid        not null references public.debates(id)   on delete cascade,
  argument_id             uuid        not null references public.arguments(id) on delete cascade,
  added_by                uuid        not null references public.profiles(id)  on delete cascade,
  -- Narrowed kind vocabulary (Design Decision 2): storage kinds
  -- (screenshot/file) are deferred to SEC-PROOF-001 with the proof-files bucket
  -- + EXIF/size hardening; marker kinds (voice_excerpt/timestamp) are deferred
  -- to MARK-001 with the timestamp_markers table. Each defers WITH the column it
  -- needs (storage_path / marker_id), widening this CHECK in its own migration.
  kind                    text        not null
                            check (kind in ('url','quote','source_text','note','prior_move','external_ref')),
  label                   text        not null default '',
  url                     text,
  source_text             text,
  quote                   text,
  -- Present for kind='prior_move'. FK exists now (arguments); no producer until
  -- PROOF-003, but it needs no new infrastructure so it ships with integrity.
  referenced_argument_id  uuid        references public.arguments(id) on delete set null,
  -- Per-artifact source-chain status. 'no_source' is OMITTED (aggregate-only,
  -- never a per-artifact value). 'broken'/'primary_present' are stored-but-
  -- admin-only: the INSERT WITH CHECK forbids an authenticated caller from
  -- setting them; a future service-role set-source-chain-status Edge may.
  source_chain_status     text        not null default 'unverified'
                            check (source_chain_status in
                              ('unverified','source_no_quote','source_and_quote','broken','primary_present')),
  risk                    text        not null default 'unknown'
                            check (risk in ('low','medium','high','unknown')),
  created_at              timestamptz not null default now(),
  -- Soft-delete only. Never hard-deleted by the app.
  deleted_at              timestamptz
);

alter table public.proof_items enable row level security;

create index if not exists proof_items_argument
  on public.proof_items (argument_id) where deleted_at is null;
create index if not exists proof_items_debate_created
  on public.proof_items (debate_id, created_at);

comment on table public.proof_items is
  'PROOF-001 (#888): the evidence path-c artifact table (Design Pass Output 8; supersedes the client_validation->attachedEvidence JSONB snapshot per docs/evidence-object-model.md Follow-up). A per-artifact record; kind is a strict superset of EvidenceArtifactKind (storage + marker kinds deferred to SEC-PROOF-001 / MARK-001). RLS enabled. SELECT room-visible via is_argument_visible_in_circle (canonical + #882 circle arm). INSERT direct-RLS by the move author-participant, restricted to the three client-derivable source-chain statuses. Soft-delete own via the immutability-trigger idiom; broken/primary_present are service-role/admin-only. Inert storage: emits no point-standing delta.';
comment on column public.proof_items.source_chain_status is
  'PROOF-001: per-artifact source-chain status (advisory, never a truth label). Excludes no_source (aggregate-only). broken/primary_present are admin-only: the authenticated INSERT WITH CHECK forbids them; a future service-role set-source-chain-status Edge may set them.';
comment on column public.proof_items.deleted_at is
  'PROOF-001: soft-delete tombstone. Set via the soft-delete UPDATE policy; the proof_items_soft_delete_only trigger makes every other column immutable to an authenticated caller. Never hard-deleted.';

-- ── write-gate helper: caller authored the target argument, the row's
--    debate_id matches the argument's debate, and the caller is a live
--    participant. SECURITY DEFINER so the arguments read does not recurse
--    through the arguments SELECT policy; fully-qualified columns (Class 1).
create or replace function public.can_attach_proof_item(
  p_argument_id uuid,
  p_debate_id   uuid,
  p_user_id     uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.arguments a
    where a.id        = p_argument_id
      and a.author_id = p_user_id
      and a.debate_id = p_debate_id
  ) and public.is_debate_participant(p_debate_id, p_user_id);
$$;

comment on function public.can_attach_proof_item(uuid, uuid, uuid) is
  'PROOF-001: true iff p_user_id authored p_argument_id, that argument belongs to p_debate_id (debate_id consistency — blocks cross-room proof rows), and p_user_id is a live participant. SECURITY DEFINER STABLE, fully-qualified columns. The proof_items INSERT WITH CHECK gate (own-move-or-draft + participant).';

revoke all on function public.can_attach_proof_item(uuid, uuid, uuid) from public;
grant execute on function public.can_attach_proof_item(uuid, uuid, uuid) to authenticated;

-- ── soft-delete immutability trigger (QOL-042 link_columns_immutable idiom):
--    an authenticated UPDATE may ONLY set deleted_at (NULL -> non-NULL). Any
--    other column change is rejected — a client cannot rewrite kind / status /
--    label / url after insert, so 'primary_present' can never be smuggled in
--    via UPDATE.
create or replace function public.proof_items_soft_delete_only()
returns trigger
language plpgsql
as $$
begin
  if new.id                     is distinct from old.id
     or new.debate_id           is distinct from old.debate_id
     or new.argument_id         is distinct from old.argument_id
     or new.added_by            is distinct from old.added_by
     or new.kind                is distinct from old.kind
     or new.label               is distinct from old.label
     or new.url                 is distinct from old.url
     or new.source_text         is distinct from old.source_text
     or new.quote               is distinct from old.quote
     or new.referenced_argument_id is distinct from old.referenced_argument_id
     or new.source_chain_status is distinct from old.source_chain_status
     or new.risk                is distinct from old.risk
     or new.created_at          is distinct from old.created_at then
    raise exception
      'proof_items: only deleted_at may change after a proof item is created'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.proof_items_soft_delete_only() is
  'PROOF-001 BEFORE-UPDATE guard on proof_items: only deleted_at may change after insert. Enforces immutability of kind / source_chain_status / label / url so a client soft-delete cannot double as a status-tamper. A future service-role status-override Edge (set-source-chain-status) will relax this in its own migration (documented forward dependency).';

drop trigger if exists trg_proof_items_soft_delete_only on public.proof_items;
create trigger trg_proof_items_soft_delete_only
  before update on public.proof_items
  for each row
  execute function public.proof_items_soft_delete_only();

-- ── proof_items SELECT — room-visible (canonical + #882 circle arm) ──
drop policy if exists proof_items_select_room_visible on public.proof_items;
create policy proof_items_select_room_visible
  on public.proof_items
  for select
  to authenticated
  using (
    proof_items.deleted_at is null
    and public.is_argument_visible_in_circle(proof_items.argument_id, auth.uid())
  );

-- ── proof_items INSERT — the move author-participant attaches to their own
--    move-or-draft; only the three client-derivable statuses; added_by = self.
drop policy if exists proof_items_insert_own_move on public.proof_items;
create policy proof_items_insert_own_move
  on public.proof_items
  for insert
  to authenticated
  with check (
    proof_items.added_by = auth.uid()
    and proof_items.deleted_at is null
    and proof_items.source_chain_status in ('unverified','source_no_quote','source_and_quote')
    and public.can_attach_proof_item(proof_items.argument_id, proof_items.debate_id, auth.uid())
  );

-- ── proof_items UPDATE — soft-delete own (or admin). The immutability trigger
--    restricts the effective change to deleted_at.
drop policy if exists proof_items_soft_delete_own on public.proof_items;
create policy proof_items_soft_delete_own
  on public.proof_items
  for update
  to authenticated
  using (proof_items.added_by = auth.uid() or public.is_moderator_or_admin())
  with check (proof_items.added_by = auth.uid() or public.is_moderator_or_admin());

-- proof_items DELETE: no policy. Soft-delete only — a hard delete is impossible
-- through PostgREST for an authenticated caller.

-- ============================================================
-- 2. public.proof_relations — the claim<->proof graph
-- ============================================================
create table if not exists public.proof_relations (
  id                 uuid        primary key default gen_random_uuid(),
  debate_id          uuid        not null references public.debates(id)      on delete cascade,
  proof_item_id      uuid        not null references public.proof_items(id)  on delete cascade,
  claim_argument_id  uuid        not null references public.arguments(id)    on delete cascade,
  relation           text        not null
                       check (relation in ('supports','contradicts','contextualizes','answers_request')),
  created_by         uuid        not null references public.profiles(id)     on delete cascade,
  created_at         timestamptz not null default now(),
  unique (proof_item_id, claim_argument_id, relation)
);

alter table public.proof_relations enable row level security;

create index if not exists proof_relations_proof_item
  on public.proof_relations (proof_item_id);
create index if not exists proof_relations_claim_argument
  on public.proof_relations (claim_argument_id);

comment on table public.proof_relations is
  'PROOF-001 (#888): the claim<->proof graph (Design Pass Output 8) — one receipt can back several claims; the answers_request relation powers evidence-debt auto-resolution (EV-003 / PROOF-003). RLS enabled. SELECT visible iff the claim argument is room-visible (is_argument_visible_in_circle). INSERT direct-RLS: the caller owns the proof_item and both proof + claim are in the same room and the caller is a participant. Additive-only: no deleted_at (a relation is inert when its proof_item is soft-deleted); no UPDATE/DELETE policy.';

-- ── write-gate helper: caller owns the (non-deleted) proof_item, the proof and
--    the claim are both in p_debate_id, and the caller is a live participant.
create or replace function public.can_relate_proof_item(
  p_proof_item_id     uuid,
  p_claim_argument_id uuid,
  p_debate_id         uuid,
  p_user_id           uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.proof_items  pi
    join public.arguments    a on a.id = p_claim_argument_id
    where pi.id         = p_proof_item_id
      and pi.added_by   = p_user_id
      and pi.deleted_at is null
      and pi.debate_id  = p_debate_id
      and a.debate_id   = p_debate_id
  ) and public.is_debate_participant(p_debate_id, p_user_id);
$$;

comment on function public.can_relate_proof_item(uuid, uuid, uuid, uuid) is
  'PROOF-001: true iff p_user_id owns the non-deleted proof_item, the proof_item and the claim argument both belong to p_debate_id, and p_user_id is a live participant. SECURITY DEFINER STABLE, fully-qualified columns. The proof_relations INSERT gate.';

revoke all on function public.can_relate_proof_item(uuid, uuid, uuid, uuid) from public;
grant execute on function public.can_relate_proof_item(uuid, uuid, uuid, uuid) to authenticated;

-- ── proof_relations SELECT — visible iff the claim argument is room-visible ──
drop policy if exists proof_relations_select_room_visible on public.proof_relations;
create policy proof_relations_select_room_visible
  on public.proof_relations
  for select
  to authenticated
  using (
    public.is_argument_visible_in_circle(proof_relations.claim_argument_id, auth.uid())
  );

-- ── proof_relations INSERT — caller owns the proof, same-room claim, participant.
drop policy if exists proof_relations_insert_own_proof on public.proof_relations;
create policy proof_relations_insert_own_proof
  on public.proof_relations
  for insert
  to authenticated
  with check (
    proof_relations.created_by = auth.uid()
    and public.can_relate_proof_item(
          proof_relations.proof_item_id,
          proof_relations.claim_argument_id,
          proof_relations.debate_id,
          auth.uid())
  );

-- proof_relations UPDATE / DELETE: no policy. Additive facts only.
```

---

## API / interface contracts

No Edge Function, no client wrapper, no RPC exposed to `authenticated` beyond
the two write-gate helpers (which are policy internals). The contracts other
cards call:

- **PROOF-002 (drawer UI)** reads `proof_items` / `proof_relations` via the
  normal PostgREST client, gated by the SELECT policies above. It maps a
  `proof_items` row → `EvidenceArtifact` and feeds the **unchanged**
  `summarizeArtifactsForReceiptChip`. Read-path flip is PROOF-002's job, behind a
  JSONB fallback — NOT this card.
- **PROOF-003 (attach Edge)** writes rows. It may use **either** the direct-RLS
  `authenticated` INSERT path (fast, non-storage attach — the WITH CHECK gate is
  already correct) **or** a service-role client (bypasses RLS; required for
  storage kinds once SEC-PROOF-001 lands, and for setting `added_by` to a non-
  caller). The tables' policies are forward-correct for both.
- **`can_attach_proof_item(argument_id, debate_id, user_id) → boolean`** and
  **`can_relate_proof_item(proof_item_id, claim_argument_id, debate_id, user_id)
  → boolean`** — SECURITY DEFINER STABLE policy helpers; `authenticated`-granted;
  the write gates.

---

## Design decisions (explicit)

### 1. `marker_id` — DEFER the column (add in MARK-001) ✅

`timestamp_markers` does not exist (P3.5). Verdict: **defer the column entirely.**
Rationale: (a) the only kinds that populate `marker_id` are `voice_excerpt` /
`timestamp`, both of which I also defer from the kind CHECK — so there is **no
shipped kind that can produce a value** for the column; a column with no producer
is dead weight. (b) Adding it later is a new migration regardless (append-only),
and **MARK-001 is its natural home** — that card creates `timestamp_markers`, so
it can add `proof_items.marker_id uuid → timestamp_markers(id)` with a real FK and
referential integrity from the first row. (c) Shipping an FK-less `uuid` now would
either dangle without integrity or force a *second* later migration to add the FK
(which needs valid targets — messy). **Deferral is strictly cleaner** and honors
"never edit an applied migration" without penalty.

### 2. Storage kinds — NARROW the kind CHECK now (Option A) ✅

Two options were on the table: (A) ship a **narrowed** 6-kind CHECK
(`url, quote, source_text, note, prior_move, external_ref`) and widen it in the
infra cards; (B) ship all 10 kinds now with storage kinds Edge-rejected until
SEC-PROOF-001. Verdict: **Option A (narrow now).** Rationale: (a) a narrowed CHECK
is a **real DB safety boundary** — even a buggy or hostile client with the
direct-RLS INSERT physically cannot create a `screenshot`/`file` row (no
`storage_path`, no EXIF/size hardening) or a `voice_excerpt`/`timestamp` row (no
markers table); defense-in-depth beats "an Edge Function is supposed to reject
it." (b) The back-fill **never** needs a deferred kind (reality-audit finding 4 —
the classifier's outputs fold entirely into the 6 shipped kinds). (c) Widening
later is a clean one-line `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` new
migration each infra card already owns (SEC-PROOF-001 widens to
`screenshot`/`file`; MARK-001 to `voice_excerpt`/`timestamp`). Shipping Option B
would create a CHECK that *permits values no safe code path can produce* — a
latent footgun. `prior_move` / `external_ref` are included now because they need
**no new column or infra** (`prior_move` uses the shipped `referenced_argument_id`
FK to `arguments`; `external_ref` uses `url`/`label`), so including them saves
PROOF-003 a widening migration for the two kinds it will produce first.

### 3. Write-posture split — mixed, tightly constrained (QOL-042 idiom) ✅

The issue delegates the exact split. Verdict:

| Operation | Path | Gate |
|---|---|---|
| `proof_items` SELECT | direct-RLS | `is_argument_visible_in_circle(argument_id)` (needed now for PROOF-002) |
| `proof_items` INSERT | **direct-RLS** | `added_by = self` + status ∈ {3 derivable} + `can_attach_proof_item` (own-move-or-draft + participant) |
| `proof_items` soft-delete (UPDATE) | **direct-RLS** | `added_by = self OR admin` + immutability trigger (only `deleted_at` changes) |
| `proof_items` `broken`/`primary_present` status override | **Edge / service-role only** | future `set-source-chain-status` admin Edge (relaxes the trigger in its own migration) |
| `proof_items` storage-kind attach | **Edge only** (deferred) | SEC-PROOF-001 (EXIF/size hardening) |
| `proof_items` hard delete | **none** | soft-delete only |
| `proof_relations` SELECT | direct-RLS | `is_argument_visible_in_circle(claim_argument_id)` |
| `proof_relations` INSERT | **direct-RLS** | `created_by = self` + `can_relate_proof_item` (owns proof + same-room claim + participant) |
| `proof_relations` UPDATE/DELETE | **none** | additive facts only |

Justified against `supabase-edge-contract`: the skill's hard rule is "no direct
insert into **`public.arguments`** from the client" — it is specific to
`arguments`. `proof_items` is not `arguments`; a proof attach is a **caller-owned
write to the author's own move**, structurally identical to the sanctioned
direct-RLS writes on `concession_items`, `move_reactions`, `point_tags`, and
`argument_room_links` (QOL-042). The *privileged* aspects — the storage binary
(EXIF risk) and the `primary_present`/`broken` status (admin-only per
evidence-doctrine) — are the exact writes routed to Edge / service-role. This is
the "Edge-only where the spec says so" arm, drawn at the doctrine boundary rather
than blanket-Edge (which would make the "proof at the edge of the flow" fast path
impossible and add a dead migration for PROOF-003 to add the INSERT policy). It is
also strictly *more* conservative than concession_items (which has no
immutability trigger) because the immutability trigger + status restriction close
the two doctrine-tamper vectors.

### 4. One migration file, not two

The issue Scope says "One additive migration"; the Design Pass §P3 slicing sketch
said "2 migrations." Verdict: **one file.** The tables are FK-coupled
(`proof_relations → proof_items`), so one self-contained file applies atomically,
gives the Supabase Preview check a single chokepoint, and keeps the ordering
guarantees (Class 3) trivially inspectable in one read. Logged as an interpretive
decision (issue binds; the sketch is superseded).

### 5. `added_by` / `created_by` FK target = `profiles` (per Design Pass)

The Design Pass specifies `added_by → profiles`, `created_by → profiles`. In this
repo `profiles.id = auth.users.id` (1:1), so `added_by = auth.uid()` is the
correct ownership predicate against a `profiles` FK. Flagged for the implementer
to confirm against the `concession_items` FK target (if that table FKs
`auth.users` for attribution, mirror it for consistency — both are uuid, so it is
a naming/consistency choice, not a Class-2 type issue).

### 6. Back-fill fidelity via a jest parity test (see Back-fill design)

### 7. Rollback honesty (see Rollout)

---

## Four-issue-class self-check (pre-answering the Docker-less review)

- **Class 1 — ambiguous column in subquery.** No policy body contains a
  subquery; every cross-table read is inside a SECURITY DEFINER helper with fully
  qualified columns (`a.id`, `a.author_id`, `a.debate_id`, `pi.id`,
  `pi.added_by`, `pi.debate_id`). Every column in every USING / WITH CHECK body
  is table-qualified (`proof_items.*` / `proof_relations.*`). **No 42702 risk.**
- **Class 2 — type mismatch.** Every FK is `uuid → uuid` PK; every CHECK is
  `text` literal comparison; `auth.uid()` (uuid) compares to `uuid` columns. No
  `text↔uuid`, no `int↔bigint`. **No implicit-cast surprise.**
- **Class 3 — implicit ordering.** `proof_items` table → ENABLE RLS → indexes →
  `can_attach_proof_item` → trigger fn + trigger → `proof_items` policies; THEN
  `proof_relations` table (FK target now exists) → ENABLE RLS → indexes →
  `can_relate_proof_item` (reads `proof_items` + `arguments`, both exist) →
  `proof_relations` policies. RLS enabled before any policy on its table; every
  `drop policy if exists` targets only a NEW name on its own table (no-op first
  apply). No DROP of any pre-existing object. **No forward reference.**
- **Class 4 — function / extension deps.** `gen_random_uuid()` → pgcrypto
  (Supabase default; documented in the header, not `create extension`-ed —
  #859 precedent). `is_argument_visible_in_circle`, `is_debate_participant`,
  `is_moderator_or_admin` are pre-applied and granted (cited by migration +
  line). `auth.uid()` from the Supabase `auth` schema (default). New helpers are
  created + granted before their policies reference them. No
  `COMMENT ON ... ON storage.*` (all COMMENT targets are `public.*`). **No 42501,
  no missing dep.**

---

## Back-fill design

**Location:** `scripts/proof-backfill/` — a **new sibling dir**, deliberately NOT
`scripts/ops/` (which carries an exact recursive `.sql`-count test + header-
ownership rule). Any SQL the script *emits* is a runtime artifact written under
`out/` (already untracked) — never a committed `.sql` under `scripts/ops/`.

**Files:**
- `scripts/proof-backfill/backfillProofItems.js` — the runner (Node).
- `scripts/proof-backfill/proofItemRowFromArtifact.js` (or a `.ts` consumed via
  the repo's script runner) — the pure fold: `EvidenceArtifact → proof_items row`
  (applies the fold table from reality-audit finding 4). This module is imported
  by BOTH the runner and the fidelity parity test, so the test proves the exact
  code the back-fill runs.

**Behaviour:**
1. **Dry-run is the default** (fail-closed). The live write requires **both**
   `--apply` on the CLI **and** an explicit env flag (e.g.
   `PROOF_BACKFILL_APPLY=true`) — the `.env.engagement-intelligence` + `--pilot`
   idiom. Absent either, the script reads + classifies + reports + emits SQL, and
   **writes nothing** (asserted by test).
2. **Read + classify.** Select `public.arguments` rows carrying a non-empty
   `client_validation->'attachedEvidence'` (the exact JSONB path — confirmed:
   `submit-argument` stores `client_validation` verbatim, and the composer's
   `attached_evidence` payload lands there). For each, build the
   `BuildEvidenceArtifactsInput` (`argumentId`, `addedByUserId` = the row's
   `author_id`, `createdAt`, `attachments`) and run **the real
   `buildEvidenceArtifacts`** (imported from `src/features/evidence/evidenceModel.ts`
   — reuse the authoritative classifier, never a re-implementation).
3. **Fold to rows.** Map each `EvidenceArtifact` to a `proof_items` row via
   `proofItemRowFromArtifact` (the fold table). `payment_screenshot` artifacts are
   **excluded** (no path-c column this card) and counted separately.
4. **Dry-run report shape** (single committable Markdown under
   `docs/testing-runs/` or printed; SQL to `out/`):
   - arguments scanned (carrying `attachedEvidence`)
   - attachments found / artifacts classified (non-empty)
   - breakdown by **source `EvidenceArtifactKind`** (pre-fold) and by **folded
     `proof_items.kind`** (post-fold)
   - breakdown by `source_chain_status`
   - `payment_screenshot` artifacts **deferred** (count)
   - `proof_items` rows that WOULD be written + a redacted sample INSERT
   - **`writesPerformed: 0`** (asserted)
5. **Live path (operator-gated).** With `--apply` + env, the reviewed SQL is
   applied via the CLI DML lane (`supabase db query --linked` executes DML — the
   documented lane) OR a service-role client sourced from operator-secrets env
   (never committed, never logged). Service-role/DML bypasses RLS, so the back-
   fill can set `added_by` to the *original* author across many authors (the
   authenticated INSERT policy is for the client fast-path, not the back-fill).
   `added_by` FKs `profiles(id)`; the author already has a profile row.

**Fidelity contract (the load-bearing deliverable):**
`__tests__/proofBackfillFidelity.test.ts` proves, over inline fixtures that
exercise **every** kind→fold→status path:
- **Path A (JSONB):** `buildEvidenceArtifacts(input) →
  summarizeArtifactsForReceiptChip(artifacts) → chipA`.
- **Path B (rows):** `artifacts → proofItemRowFromArtifact[] → reconstruct
  EvidenceArtifact-shaped objects from rows → summarizeArtifactsForReceiptChip →
  chipB`.
- **Assert exact equality** on the copy-bearing + doctrine-bearing fields:
  `label`, `helper`, `tone`, `invitesFollowup`, `showsSourceChainPressure`,
  `status`, `count`. These derive from `source_chain_status` (worst-status-wins)
  + count only, so they are **provably invariant** under kind-folding (which is
  why fidelity holds despite the fold).
- **Assert the fold is deterministic + total** — every one of the 7
  `EvidenceArtifactKind` values maps to a CHECK-valid `proof_items.kind` (or is
  the documented `payment_screenshot` deferral), and re-running the fold is
  identical.
- **Document the one divergence:** `ReceiptChipContract.kinds` carries the
  *original* `EvidenceArtifactKind`; after folding, the reconstructed `kinds` may
  differ (e.g. `screenshot_redacted` → `note`). This never changes the status-
  derived copy, and PROOF-002 keeps a JSONB provenance fallback, so per-kind
  glyph parity (if ever required) is available from the JSONB — not lost.

---

## File changes

- **new:** `supabase/migrations/20260710000001_proof_001_proof_items_and_relations.sql`
  — the two tables + two helpers + trigger + policies (verbatim above). ~230 SQL
  lines incl. header/comments.
- **new:** `__tests__/proofItemsRlsScan.test.ts` — the #882-pattern
  `fs.readFileSync` scan over the migration text, with negative controls. ~40
  tests. (See Test plan.)
- **new:** `__tests__/proofBackfillFidelity.test.ts` — the fidelity parity test.
  ~15–20 tests.
- **new:** `scripts/proof-backfill/backfillProofItems.js` — dry-run-default
  runner (~150 lines).
- **new:** `scripts/proof-backfill/proofItemRowFromArtifact.js` (or `.ts`) — the
  pure fold shared by runner + fidelity test (~60 lines).
- **new (optional):** `__tests__/proofBackfillRunner.test.ts` — asserts dry-run
  writes nothing, refuses live without flag+env, emits no secrets, uses the real
  `buildEvidenceArtifacts`. ~10 tests. (May be folded into the fidelity suite.)
- **modified:** `docs/core/current-status.md` — add the PROOF-001 Phase-framing
  section (patterns PROOF-002/003 consume: the two tables, the visibility-helper
  composition, the write-posture split, the fold table) + the confirmed test
  count.
- **modified:** `CLAUDE.md` "Current stage" line — bump on stage completion (per
  test-discipline; the implementer confirms the count first).
- **no change:** `src/features/evidence/evidenceModel.ts`, `submit-argument`, any
  render surface (non-goals: no read-path flip, no Edge, no UI).

---

## Edge cases

- **Empty inputs.** Both tables ship empty; the SELECT policies return nothing;
  no existing room changes. Back-fill on a room with no `attachedEvidence` → zero
  rows, reported.
- **Malformed JSONB.** `buildEvidenceArtifacts` already drops empty attachments
  (stable indices) and truncates labels to 120; the back-fill inherits that. A
  row whose `attachedEvidence` is not an array → skip + count as skipped, never
  throw.
- **`payment_screenshot` artifact.** Excluded from the write (no path-c column);
  counted as deferred in the report; stays in JSONB. Not a fidelity break — the
  read path keeps the JSONB fallback.
- **Cross-room proof attempt.** A participant of room X inserting a `proof_items`
  row with `debate_id = X` but `argument_id` pointing to room Y's argument is
  rejected: `can_attach_proof_item` requires `a.debate_id = p_debate_id`.
- **Non-author attach.** A participant attaching proof to *someone else's* move is
  rejected (`a.author_id = p_user_id`). Attaching a *relation* to someone else's
  claim is allowed (`contradicts`/`contextualizes`) as long as the caller owns the
  proof_item and the claim is same-room — matched by `can_relate_proof_item`.
- **Status tamper via UPDATE.** Blocked by `proof_items_soft_delete_only` (only
  `deleted_at` may change).
- **Client tries `primary_present`/`broken` on INSERT.** Rejected by the INSERT
  WITH CHECK status restriction. Only a future service-role Edge may set them.
- **Un-delete.** `proof_items_select_room_visible` hides `deleted_at IS NOT NULL`;
  the trigger permits `deleted_at` NULL→non-NULL and (technically) non-NULL→NULL,
  but the SELECT hides deleted rows regardless. If strict no-undelete is desired,
  the implementer may tighten the trigger to reject a non-NULL→NULL transition
  (noted, non-blocking).
- **Concurrent duplicate relation.** `UNIQUE(proof_item_id, claim_argument_id,
  relation)` rejects the second insert (23505) — the client treats it as
  idempotent.
- **Circle-room proof.** SELECT composes through `is_argument_visible_in_circle`,
  so a live circle member reads proof rows on a circle room's arguments (AC parity
  with #882) the moment PROOF-002 flips; a non-member sees nothing.

---

## Test plan

Baseline (orchestrator-provided): **944 suites / 33,563 tests** — the implementer
must capture the live `Test Suites: … / Tests: …` line + exit 0 before and after,
and cross-check against `current-status.md` (per test-discipline). Expected delta:
**+2 to +3 suites, ≈ +55–70 tests.**

1. **`__tests__/proofItemsRlsScan.test.ts`** — mirror
   `circleReadArmRlsScan.test.ts` exactly (`fs.readFileSync` over the migration;
   **every safety scan paired with a negative control that plants the violation**):
   - file presence + timestamp prefix `> 20260709000001`.
   - both tables `enable row level security`; migration never `disable row level
     security`.
   - `proof_items` has SELECT + INSERT + UPDATE(soft-delete) to `authenticated`;
     **no** `for delete` policy; `proof_relations` has SELECT + INSERT only, **no**
     UPDATE/DELETE.
   - SELECT bodies call `is_argument_visible_in_circle(...)` (canonical + circle
     arm); assert **no** raw `select ... from public.arguments`/`debates` subquery
     in any policy body (+ negative control planting one).
   - INSERT WITH CHECK bodies: `added_by = auth.uid()` / `created_by = auth.uid()`
     present; `source_chain_status in ('unverified','source_no_quote',
     'source_and_quote')` present (assert `primary_present`/`broken` **absent**
     from the INSERT body + negative control).
   - kind CHECK is exactly the 6-kind set; assert `screenshot`/`file`/
     `voice_excerpt`/`timestamp` **absent** from the CHECK (defer proof) + negative
     control; status CHECK omits `no_source`.
   - Class-1: no bare sensitive column in any body (qualification scan + negative
     control).
   - Class-4: helpers created before policies; new `grant execute` present for the
     two new helpers; `is_argument_visible_in_circle` / `is_debate_participant`
     referenced but **not** redefined.
   - **Ban-list:** no person-labeling verdict token anywhere in the migration
     text; no boolean-ambiguous token (`true`/`false`/`correct`) inside any policy
     body; kind + relation + status vocabularies are verdict-free (+ negative
     control).
2. **`__tests__/proofBackfillFidelity.test.ts`** — the parity contract (above):
   Path-A vs Path-B chip equality on copy/doctrine fields; fold determinism +
   totality over all 7 kinds; the documented `kinds` divergence; `payment_
   screenshot` deferral.
3. **`__tests__/proofBackfillRunner.test.ts`** (or folded in) — dry-run writes
   nothing; refuses live without `--apply` + env; report shape has the required
   sections + `writesPerformed: 0`; no secret/JWT/service-key literal in the source
   or output; imports the real `buildEvidenceArtifacts`.

No Docker DB reset available; the scan suite is the migration's chokepoint
contract (the #882 lane). No RN/UI test (no UI this card). No Edge test (no Edge).

---

## Dependencies (cards / docs / files)

- **Assumes COV-004 (`20260630000001`)** — `is_argument_visible` exists and is the
  canonical arguments-visibility spine.
- **Assumes PRIVATE-GROUPS-002 (`20260702000001`) + ASP-CIRCLES-RLS-001 #882
  (`20260709000001`)** — `is_argument_visible_in_circle` exists, is granted, and
  OR-composes canonical + circle; the SELECT policies call it directly.
- **Assumes `is_debate_participant` (`20260516000006`)** and
  `is_moderator_or_admin` (initial schema).
- **Reads** `src/features/evidence/evidenceModel.ts` at `buildEvidenceArtifacts`
  + `summarizeArtifactsForReceiptChip` + `ReceiptChipContract` (the fidelity
  anchor).
- **Blocks PROOF-002** (drawer reads these tables) and **PROOF-003** (attach Edge
  writes them) — this card unblocks both.
- **Forward dependency it hands off:** SEC-PROOF-001 (adds `storage_path` +
  widens kind CHECK to `screenshot`/`file` + `proof-files` bucket); MARK-001 (adds
  `marker_id` FK + widens kind CHECK to `voice_excerpt`/`timestamp`); a future
  `set-source-chain-status` admin Edge (relaxes the immutability trigger to allow a
  service-role `broken`/`primary_present` status change).

---

## Risks

- **RLS on new tables is THE risk; over-permissive INSERT is the failure mode.**
  Mitigation: the INSERT gates are tightly scoped (`added_by = self`, own-move-or-
  draft via a definer helper, debate_id consistency, participant, status
  restricted to the three derivable values), the scan suite asserts each with a
  negative control, and the migration is written verbatim for the heightened
  review. The immutability trigger closes the UPDATE-tamper vector.
- **The kind CHECK vocabulary must pass ban-lists** for any future user-visible
  echo. Mitigation: kinds/relations/statuses are all verdict-free; the scan suite
  asserts it; table/column names carry `proof` (internal, exempt).
- **`profiles` vs `auth.users` FK-target for `added_by`.** Minor: both uuid, no
  Class-2 issue; the implementer confirms against `concession_items` for
  consistency. Flagged in Design Decision 5.
- **Back-fill importing a TS model from a JS/Node script.** The runner must reach
  the real `buildEvidenceArtifacts` (ts-node / the repo's script transpile path /
  a jest-proven twin). The fidelity test imports the TS directly, so the *contract*
  is proven even if the runner uses a transpile shim — but the implementer must
  ensure the runner and the test share the **same** fold module.
- **Preview-check-only apply (Docker unavailable locally).** The reviewer's
  heightened review + the scan suite are the guardrails; the four-class self-check
  above pre-answers each class. Post-merge, the operator verifies table + policy
  presence on the linked DB.
- **Stale test baseline.** The orchestrator-provided baseline (944/33,563) differs
  from the stale CLAUDE.md line (1805/70); the implementer must capture the live
  count, and the reviewer cross-checks `current-status.md` H2 against the review
  file (the POSTRUN-UX001 lesson).

---

## Out of scope

- No UI (PROOF-002), no Edge Function (PROOF-003).
- **No read-path flip** — the evidence adapter keeps reading JSONB until PROOF-002
  flips it with a fallback. This card changes zero render behaviour.
- No markers (`marker_id` / `timestamp_markers` — MARK-001, P3.5).
- No storage (`storage_path` / `proof-files` bucket / EXIF hardening —
  SEC-PROOF-001).
- No `payment` sub-object column (stays in JSONB; excluded from back-fill).
- No `set-source-chain-status` admin Edge (`broken`/`primary_present` remain
  unsettable this card).
- **No live back-fill execution** — dry-run only; the live write is operator-gated.
- No point-standing / anti-amplification change (the tables are inert storage).
- No v1-scope violation (no voting, search, push, OAuth, public API).

---

## Doctrine self-check

- **cdiscourse-doctrine §1–3 (no truth labels / heat / popularity):** `proof_items`
  carries a source-chain *status*, never a verdict; the status CHECK omits
  `no_source` and forbids client `primary_present`/`broken`; no popularity /
  engagement column; the tables emit no point-standing delta. Kinds / relations /
  statuses are verdict-free (scan-asserted).
- **cdiscourse-doctrine §4 (AI limits):** no AI, no classifier write; the back-fill
  uses the deterministic `buildEvidenceArtifacts`, not a provider.
- **cdiscourse-doctrine §6–7 (secrets / no AI calls in app):** no secret in the
  migration or scripts; the back-fill's service-role/DML path is operator-gated,
  never committed, never logged; no Anthropic/xAI/X call.
- **cdiscourse-doctrine §8 (Supabase conventions):** RLS enabled on both tables,
  never disabled; new (never edited) migration; soft-delete only (`deleted_at`), no
  hard-delete path.
- **evidence-doctrine:** engagement credit vs factual standing untouched (inert
  storage); source-chain status is advisory; `primary_present` is admin-only
  (encoded in the INSERT WITH CHECK + immutability trigger); no popularity-shaped
  kind; no person-attribution field.
- **supabase-edge-contract §4 / write posture:** no service-role in client; the
  no-direct-insert rule is specific to `public.arguments` (not `proof_items`); the
  direct-RLS writes are caller-owned and tightly gated; privileged writes (storage,
  admin status) routed to Edge/service-role; every cross-table policy read goes
  through a SECURITY DEFINER helper.
- **Score never blocks posting:** nothing here gates `submit-argument`; the tables
  are read/written independently of the argument insert.

---

## Operator steps

1. **Merge → auto-apply.** The Supabase GitHub integration applies
   `20260710000001_proof_001_proof_items_and_relations.sql` on merge to `main`
   (config.toml-registered migrations auto-apply). No manual `db push` unless the
   integration is unavailable — then: `npx supabase db push --linked`.
2. **Post-merge verification (linked DB):** confirm both tables + all six policies
   + two helpers + the trigger are present:
   ```
   npx supabase db query --linked "select tablename, policyname, cmd from pg_policies where tablename in ('proof_items','proof_relations') order by tablename, cmd;"
   npx supabase db query --linked "select to_regclass('public.proof_items'), to_regclass('public.proof_relations');"
   ```
   Expect: `proof_items` = SELECT/INSERT/UPDATE (3), `proof_relations` = SELECT/
   INSERT (2); both tables non-null.
3. **Back-fill dry-run (linked DB, zero writes):**
   `node scripts/proof-backfill/backfillProofItems.js` → review the classification
   counts + the emitted SQL under `out/`.
4. **Live back-fill (operator-gated, only after review):**
   `PROOF_BACKFILL_APPLY=true node scripts/proof-backfill/backfillProofItems.js
   --apply` (or apply the reviewed SQL via `supabase db query --linked`).
5. PROOF-002 / PROOF-003 are unblocked.

## Rollback honesty

**Merge = deploy (auto-apply); revert-merge does NOT un-apply the migration.**
Once applied, the two tables + helpers + trigger exist on the linked DB. Reverting
the PR removes the file from the tree but leaves the DB objects in place (Supabase
does not run down-migrations). Because the card is **purely additive and the
tables ship empty**, leaving the objects in place is harmless (no read-path reads
them yet). If a true removal is ever required, it is a **forward drop migration**
(`drop table if exists public.proof_relations; drop table if exists
public.proof_items; drop function ...`) — never an edit to the applied file. The
safest posture: leave the empty additive objects in place; only PROOF-002 flips a
read path, and it does so behind a JSONB fallback.

---

## Orchestrator-authored brief ledger

This design was authored against an orchestrator-relayed issue (#888), not a
hand-validated operator brief. Interpretation map:

- **From the binding issue (#888):** scope (one additive migration), the two
  delegated decisions (marker_id, storage kinds), the write-posture split mandate,
  the ban-list + zero-behaviour-change acceptance criteria, the #882 scan pattern.
- **From the Design Pass Output 8 (design-only, operator-reviewed 2026-07-04):**
  the `proof_items` / `proof_relations` column shapes, kind/relation vocabularies,
  index list, the "RLS as proof_items" relation posture.
- **From a pre-launch codebase survey (this session):** the live 7-value
  `EvidenceArtifactKind` (not 6), the `no_source`-omission fact, the fold table,
  the `is_argument_visible_in_circle` single-call composition, the QOL-042
  immutability-trigger idiom, zero committed evidence fixtures.
- **Resolved by orchestrator/designer default (flag for operator review):**
  (a) **one migration file** vs the Design Pass's "2 migrations" sketch — chose one
  (issue-binding + atomic). (b) **`added_by → profiles`** per Design Pass — confirm
  vs `concession_items`. (c) The **strict immutability trigger** (only `deleted_at`
  mutable) rather than allowing a client status edit — chose strict; the future
  status-override Edge relaxes it. (d) Including `prior_move`/`external_ref` in the
  shipped CHECK (no infra dependency) to save PROOF-003 a widening migration.
- **Operator-deferred review:** the write-posture split (direct-RLS INSERT vs
  blanket-Edge) is the one place a product call could differ — if the operator
  prefers the maximally-conservative circles posture (SELECT-only, all writes
  service-role Edge), the INSERT/UPDATE policies + the two write helpers are
  dropped and PROOF-003 owns all writes. Everything else (tables, SELECT policy,
  CHECKs, back-fill) is unchanged.
