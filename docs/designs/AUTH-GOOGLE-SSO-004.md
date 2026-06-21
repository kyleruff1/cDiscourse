# AUTH-GOOGLE-SSO-004 — OAuth profile provisioning / metadata coalescing

**Status:** Design draft
**Epic:** Auth foundation — Google SSO lane (#745 → #746 → #747 → #748)
**Release:** Pre-launch auth hardening (GATE-C lane)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/747

> Sibling lane docs: `docs/designs/AUTH-GOOGLE-SSO-READINESS-001.md` (§ Lane C + § 8 implementation map, the #747 row), `docs/designs/AUTH-GOOGLE-SSO-INDEX.md` (§ Provisioning), `docs/designs/AUTH-FOUNDATION-PROVISIONING-001.md`, `docs/adr/AUTH-GOOGLE-SSO-ADR-001.md` (§ Same-email handling, decisions §8/§9). This card is **design only** — no production code, no migration applied, no provider call, no Supabase mutation.

---

## Goal (one paragraph)

A Google first-sign-in already produces exactly one `public.profiles` row, because provisioning is keyed to the `auth.users` insert by the `handle_new_user()` trigger (`supabase/migrations/20260516000001_initial_schema.sql:37-53`), and the trigger is provider-independent: `ON CONFLICT (id) DO NOTHING` + the `profiles.id` primary key make it idempotent on retry/refresh. The **one real gap** is the display name: the trigger reads only `NEW.raw_user_meta_data ->> 'display_name'` (line 45), but a Google identity carries the human name under `full_name` / `name` (and component parts `given_name` / `family_name`), so a Google user lands with a **NULL `display_name`**. This card formalizes a **single, focused server-side fix**: a NEW migration that `CREATE OR REPLACE`s `handle_new_user()` to *coalesce* the display name across the known metadata keys, with an email-local-part fallback and a stable generic last resort — preserving the email/password path byte-for-byte (`display_name` stays the first-priority source) and preserving every security property (`SECURITY DEFINER`, pinned `search_path`, `ON CONFLICT (id) DO NOTHING`, no service-role, no RLS change). A pure-TS twin (`coalesceProviderDisplayName`) is the unit-testable executable specification that the migration mirrors and that #748's optional client self-heal can reuse. Doctrine shaping this design: Supabase Auth remains the identity owner (`cdiscourse-doctrine` §6/§8); provisioning never enumerates (the conflict target is `id`, never email); no service-role ever touches the client; the fix introduces **no truth/verdict/person-judgment surface** — display name is identity plumbing, not gameplay (`cdiscourse-doctrine` §1).

---

## Mapping table (the provisioning surface, behavior, and proposed fix)

| Provisioning seam | Current behavior | Google metadata covered? | Missing-field behavior (today) | Idempotency behavior | Same-email risk | Service-role risk | RLS risk | Proposed fix | Migration required? | GATE-C? | Tests |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `handle_new_user()` trigger — display name | reads `raw_user_meta_data ->> 'display_name'` only (`initial_schema.sql:45`) | **No** — Google name lands under `full_name`/`name`/`given_name`+`family_name`, not `display_name` | Google user gets a **NULL** `display_name` (row still created) | `ON CONFLICT (id) DO NOTHING` + PK on `profiles.id` → at most one row, never re-clobbered | **None** — conflict target is `id` (the `auth.users` uuid), never email | None — trigger is `SECURITY DEFINER` server-side; client never inserts | None — `profiles` RLS untouched; no policy DROP/ALTER | NEW migration `CREATE OR REPLACE handle_new_user()` to coalesce `display_name → full_name → name → given+family → email-local → generic` | **Yes** | **Yes** (migration-bearing → merge=apply) | static migration scan (`__tests__/authGoogleDisplayNameCoalesceMigration.test.ts`) + pure-TS twin unit tests (`__tests__/coalesceProviderDisplayName.test.ts`) |
| `handle_new_user()` trigger — profile row creation | `INSERT … (id, display_name, role) VALUES (NEW.id, …, 'user') ON CONFLICT (id) DO NOTHING` (`initial_schema.sql:44-46`) | **Yes** (provider-independent; fires on any `auth.users` insert) | row always created (id-keyed) | idempotent (unchanged) | none | none | none | **No change** — already correct for OAuth | No (preserve verbatim except the value expression) | n/a | covered by the static scan asserting `ON CONFLICT (id) DO NOTHING` is preserved |
| client profile read — `accountApi.fetchOwnProfile(userId)` | `from('profiles').select('id, display_name, role, created_at')`; maps `PGRST116` → `not_found` (`accountApi.ts:50-67`) | n/a (read path) | returns `not_found`; **no self-heal** | n/a | none | none (anon key only) | reads under "profiles: authenticated can read all" (`rls_policies.sql:56-59`) | **No change in this card** — documented as the #748 self-heal seam (see § #748 seam note) | No | No | no new test in this card; #748 owns the self-heal test |
| same-email identity linking | decided at hosted config time in **#745**; honored here | n/a (config-time) | n/a | n/a | bounded by ADR: **never takeover, never enumerate**; "distinct" safe default until #745 records the mode | none | none | **No change** — documented behavior only (see § Same-email) | No | No (config decision is #745's GATE-C, operator-run) | no client-unit test (operator-smoke-verified per readiness §9); ADR-shape note only |

---

## Data model

**No new table, no new column, no schema change to `public.profiles`.** `profiles.display_name` is already `text` and **NULLABLE with no length CHECK** (`initial_schema.sql:27`) — that is correct and is preserved (the coalesce + `left(…, N)` cap is applied in the function body, not as a column constraint).

The only changed *object* is the function body of `public.handle_new_user()`, replaced via `CREATE OR REPLACE FUNCTION` in a NEW migration. The existing trigger `on_auth_user_created` (`initial_schema.sql:51-53`) is **not** touched — `CREATE OR REPLACE FUNCTION` swaps the body in place and the existing trigger keeps pointing at the same function, so no `DROP TRIGGER` / `CREATE TRIGGER` is needed.

### Pure-TS spec type (the twin)

```ts
// src/features/auth/coalesceProviderDisplayName.ts

/** The auth-metadata keys this coalescer reads. Mirrors what handle_new_user()
 *  reads from raw_user_meta_data. Provider-independent: email/password sets
 *  `display_name`; Google sets `full_name`/`name`/`given_name`/`family_name`. */
export interface ProviderDisplayMetadata {
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
}

/** The doctrine-safe generic last resort — only reached when email is absent.
 *  Plain neutral noun; no judgement word, no truth/verdict implication. */
export const GENERIC_DISPLAY_NAME_FALLBACK = 'Member';

/** Hard cap mirrors the app-side display-name edit cap (ContactInfoSection
 *  DISPLAY_NAME_MAX = 60). Applied AFTER coalescing + normalization. */
export const DISPLAY_NAME_DB_CAP = 60;
```

---

## API / interface contracts

### 1. The new `handle_new_user()` body (exact final SQL — drop-in for the implementer)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
BEGIN
  -- Coalesce a display name across the known auth-metadata shapes.
  -- Priority (each candidate trimmed, inner whitespace collapsed, empty -> NULL):
  --   1. display_name  (email/password path; MUST stay first to preserve current behavior)
  --   2. full_name     (Google OIDC standard claim)
  --   3. name          (Google OIDC standard claim)
  --   4. given_name + family_name (handles either or both present)
  --   5. email local-part (split before '@')
  --   6. generic fallback 'Member' (only reached if email is absent)
  v_display_name := COALESCE(
    nullif(btrim(regexp_replace(NEW.raw_user_meta_data ->> 'display_name', '\s+', ' ', 'g')), ''),
    nullif(btrim(regexp_replace(NEW.raw_user_meta_data ->> 'full_name',    '\s+', ' ', 'g')), ''),
    nullif(btrim(regexp_replace(NEW.raw_user_meta_data ->> 'name',         '\s+', ' ', 'g')), ''),
    nullif(btrim(regexp_replace(
      concat_ws(' ',
        nullif(btrim(NEW.raw_user_meta_data ->> 'given_name'),  ''),
        nullif(btrim(NEW.raw_user_meta_data ->> 'family_name'), '')
      ), '\s+', ' ', 'g')), ''),
    nullif(btrim(split_part(NEW.email, '@', 1)), ''),
    'Member'
  );

  -- Cap to the app-side edit limit (ContactInfoSection DISPLAY_NAME_MAX = 60).
  v_display_name := left(v_display_name, 60);

  INSERT INTO public.profiles (id, display_name, role)
  VALUES (NEW.id, v_display_name, 'user')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
```

Notes the implementer must not "improve away":
- **`display_name` candidate is first.** This is the email/password path's key (`authApi.ts:108` sets `data: { display_name }`). Keeping it first means existing email/password signups resolve their name identically to today — the only behavioral delta is for rows whose `display_name` is NULL/empty (i.e. Google, and the email path's `displayName ?? ''` empty case).
- **`ON CONFLICT (id) DO NOTHING` is preserved verbatim.** This is the idempotency + no-clobber spine. Do not change it to `DO UPDATE`.
- **`SECURITY DEFINER` and `SET search_path = public` are preserved verbatim.** `split_part`, `concat_ws`, `regexp_replace`, `btrim`, `nullif`, `left` are all `pg_catalog` builtins; with `search_path = public` they still resolve (builtins are always on the path), and pinning prevents search-path injection. `NEW.email` reads the trigger row's own column (no `auth.` table read added → no need to widen `search_path` to `public, auth`).
- **No new GRANT/REVOKE.** The function's executor and privileges are unchanged; `CREATE OR REPLACE` preserves ownership and ACLs.

### 2. The pure-TS twin signature (the tested spec)

```ts
// src/features/auth/coalesceProviderDisplayName.ts
export function coalesceProviderDisplayName(
  metadata: ProviderDisplayMetadata | null | undefined,
  email: string | null | undefined,
): string;
```

Contract (mirrors the SQL exactly):
1. Normalize each candidate: trim outer whitespace, collapse inner runs of whitespace to a single space (`/\s+/g → ' '`), then treat the empty string as absent.
2. Return the first non-empty of: `display_name`, `full_name`, `name`, `concat_ws(' ', given_name, family_name)` (each part trimmed; if both absent the concat is empty → skipped), email local-part (`email.split('@')[0]`, normalized), then the constant `GENERIC_DISPLAY_NAME_FALLBACK` (`'Member'`).
3. Cap the result to `DISPLAY_NAME_DB_CAP` (60) characters (`result.slice(0, 60)`).
4. The function never throws and never returns an empty string (the generic fallback guarantees a non-empty value).

Documented in the file header: *"Shared executable spec mirrored by migration `20260620000001_auth_google_oauth_display_name_coalesce.sql`'s `handle_new_user()`; reusable by #748's optional client `profiles` self-heal under the `id = auth.uid()` RLS policy."*

---

## File changes

- **new file:** `supabase/migrations/20260620000001_auth_google_oauth_display_name_coalesce.sql` — the `CREATE OR REPLACE FUNCTION public.handle_new_user()` migration above, with a header comment documenting: append-only (never edits `20260516000001`), the coalesce priority, the `auth.users`/`auth.email` dependency note, and the "merge = apply (GATE-C)" reminder. **~45-60 lines** incl. header + SQL.
- **new file:** `src/features/auth/coalesceProviderDisplayName.ts` — the pure-TS twin + the two exported constants + the `ProviderDisplayMetadata` interface. Pure (no React, no Supabase, no fetch). **~50-70 lines** incl. doc header.
- **new file:** `__tests__/authGoogleDisplayNameCoalesceMigration.test.ts` — static text-scan of the new `.sql`, mirroring the `argRoom002Migration.test.ts` idiom (strip comment-only lines into `sqlOnly`, regex-assert structure + negative assertions). **~70-90 lines.**
- **new file:** `__tests__/coalesceProviderDisplayName.test.ts` — pure-TS unit tests covering every card-required case (see Test plan). **~90-120 lines.**
- **modified file:** `src/features/auth/index.ts` — add a re-export of `coalesceProviderDisplayName` + constants if the auth barrel re-exports public auth helpers (verify the file's existing export style first; if it only re-exports a curated subset, follow that convention — this is a 1-3 line change, optional if the barrel is not the import surface #748 will use).
- **modified file:** `docs/core/current-status.md` — add the card's Phase-framing / completion note + the new test count after the implementer runs the suite (the implementer owns this; named here so it is not forgotten).
- **modified file:** `CLAUDE.md` "Current stage" line — bump only on stage completion per `test-discipline`; a single card does not bump it unless the operator declares a stage close. (Named for completeness; likely **no change** for one card.)
- **deleted files:** none.

> The `20260516000001_initial_schema.sql` migration is **NOT** edited (it is applied; editing an applied migration is a hard doctrine violation — `cdiscourse-doctrine` §8). The new function body fully supersedes the old one at apply time via `CREATE OR REPLACE`.

---

## Edge cases

The implementer must handle (and the tests must cover) these:

- **Empty `raw_user_meta_data` `{}` AND email present** → all metadata candidates absent → email local-part wins. (Twin: `coalesceProviderDisplayName({}, 'jane@example.com')` → `'jane'`.)
- **Empty metadata AND email absent/empty** → generic fallback `'Member'`. (Defensive: a Google OAuth user effectively always has a verified email, so step 6 is a true last resort, not an expected Google outcome — call this out in the doc + test comment.)
- **`display_name` present (email/password path)** → wins over everything; existing behavior is byte-identical. Including the email-path empty case `display_name: ''` → falls through to the next candidate (today it would have stored `''`; the new behavior stores a better non-empty value — a strict improvement, documented as the one intended behavioral delta for the email path).
- **Only `full_name`** (typical Google) → `full_name` wins.
- **Only `name`** (some Google configs) → `name` wins.
- **`given_name` only / `family_name` only / both** → `concat_ws(' ', …)` drops the NULL/empty part so "Jane" / "Doe" / "Jane Doe" all resolve correctly with no stray leading/trailing space.
- **Whitespace-only candidate** (e.g. `full_name: '   '`) → normalized to empty → skipped. (Both SQL `nullif(btrim(...), '')` and the TS twin.)
- **Inner-whitespace collapse** (e.g. `'Jane   Q.   Doe'`) → `'Jane Q. Doe'`.
- **Over-cap name** (e.g. a 90-char `full_name`) → `left(…, 60)` / `.slice(0, 60)`; assert the result length is exactly 60 and matches the app-side `DISPLAY_NAME_MAX`.
- **Concurrent edits / retries** — two near-simultaneous `auth.users` inserts for the same `id` cannot happen (the uuid is the PK of `auth.users`). A trigger re-fire or a race between the trigger and a future #748 self-heal is absorbed by `ON CONFLICT (id) DO NOTHING` — the first writer wins, the second is a no-op (never clobbers a user-edited name). Assert (static scan) that `ON CONFLICT (id) DO NOTHING` is present.
- **Offline / network failure** — n/a to the trigger (it runs inside the `auth.users` insert transaction server-side). The client read path's network failure is already handled in `accountApi` (`network_error`) and is out of scope here.
- **Permission-denied paths** — n/a: the trigger is `SECURITY DEFINER` and runs as the function owner; no caller-permission branch.
- **Doctrine-constraint edge case** — *"what if a Google `full_name` contains a banned/judgement word?"* The coalescer does **not** filter content of a user's own name (filtering a person's real name would be both wrong and a censorship surface); display name is identity, not a gameplay string subject to the §1 ban-list. The §1 ban-list governs system-emitted gameplay/verdict strings, not a user's chosen/provider-supplied name. The **only** literal this card *emits* is `'Member'`, which is a plain neutral noun (asserted by the migration scan + twin test to be ban-list-clean).
- **`raw_user_meta_data` is NULL** (unusual but possible) → `NULL ->> 'key'` yields NULL → all metadata candidates absent → email-local or generic. (TS twin: `metadata` is `null`/`undefined` → treat as no candidates.)

---

## Test plan

Per `test-discipline`: tests are part of "done", not a follow-up. Two new suites; both are jest-runnable with **no Supabase/Docker** (the SQL is verified by static scan, the logic by the twin).

### (a) Static migration scan — `__tests__/authGoogleDisplayNameCoalesceMigration.test.ts`

Mirrors `__tests__/argRoom002Migration.test.ts` (read into `migSrc`, strip comment-only lines into `sqlOnly`, regex-assert). Cases:
- **happy structure:** `sqlOnly` matches `CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)`, `SECURITY DEFINER`, `SET search_path = public`, `RETURNS trigger`, `LANGUAGE plpgsql`.
- **each coalesce field present:** `sqlOnly` contains `'display_name'`, `'full_name'`, `'name'`, `'given_name'`, `'family_name'`, `split_part(NEW.email, '@', 1)`, and the generic literal `'Member'`, in a single `COALESCE(...)`.
- **priority order:** `display_name` index < `full_name` index < `name` index < `given_name` index < `split_part` index (string-position assertions, like argRoom002's Class-3 ordering test).
- **normalization present:** `sqlOnly` matches `regexp_replace(` and `nullif(btrim(` and `left(` with the cap `60`.
- **idempotency preserved:** `sqlOnly` matches `ON CONFLICT \(id\) DO NOTHING`.
- **no schema drift (negative):** `sqlOnly` does NOT match `ALTER TABLE public\.profiles`, does NOT match `DROP TRIGGER`, does NOT match `CREATE TRIGGER` (the trigger is reused, not recreated).
- **doctrine negatives:** `sqlOnly` does NOT match `DROP POLICY`, does NOT match `service_role`, does NOT match `DISABLE ROW LEVEL SECURITY`, and does NOT contain any secret-shaped literal (`sk-`, `sb_secret_`, `Bearer`, `SERVICE_ROLE`).
- **append-only:** the file exists at its slot; its 14-digit stamp `20260620000001` does not collide with any other migration (readdir loop, like argRoom002's collision test).
- **generic literal is ban-list-clean:** the only emitted literal `'Member'` matched against the doctrine ban-list (`winner/loser/liar/true/false/correct/dishonest/bad faith/...`) → no hit.

### (b) Pure-TS twin unit tests — `__tests__/coalesceProviderDisplayName.test.ts`

Each card-required case → one assertion:

| Case | Input | Expected |
|---|---|---|
| `full_name` only | `{ full_name: 'Jane Doe' }`, `'jane@x.com'` | `'Jane Doe'` |
| `name` only | `{ name: 'Jane' }`, `'jane@x.com'` | `'Jane'` |
| `display_name` wins over all | `{ display_name: 'JD', full_name: 'Jane Doe', name: 'Jane' }`, `'jane@x.com'` | `'JD'` |
| given + family fallback | `{ given_name: 'Jane', family_name: 'Doe' }`, `'jane@x.com'` | `'Jane Doe'` |
| given-only | `{ given_name: 'Jane' }`, `'jane@x.com'` | `'Jane'` |
| family-only | `{ family_name: 'Doe' }`, `'jane@x.com'` | `'Doe'` |
| email fallback | `{}`, `'jane.q@example.com'` | `'jane.q'` |
| empty metadata + no email → generic | `{}`, `null` | `'Member'` |
| null metadata → email or generic | `null`, `'jane@x.com'` | `'jane'`; and `null, null` → `'Member'` |
| whitespace normalization | `{ full_name: '  Jane   Q.  Doe ' }`, `null` | `'Jane Q. Doe'` |
| whitespace-only skipped | `{ full_name: '   ', name: 'Jane' }`, `null` | `'Jane'` |
| length cap | `{ full_name: 'A'.repeat(90) }`, `null` | length `=== 60`, `=== 'A'.repeat(60)` |
| never empty | (any input incl. `null,null`) | result `.length > 0` |
| never throws | `coalesceProviderDisplayName(undefined, undefined)` | does not throw; returns `'Member'` |
| cap constant parity | — | `DISPLAY_NAME_DB_CAP === 60` (the value the migration's `left()` uses + the app's `DISPLAY_NAME_MAX`) |

### Doctrine ban-list assertion

The twin test imports the project ban-list pattern (or inlines the standard list per the `test-discipline` ban-list idiom) and asserts `GENERIC_DISPLAY_NAME_FALLBACK` contains none of the banned tokens. The migration scan does the same on the emitted `'Member'` literal. (No other user-facing string is introduced by this card.)

---

## Dependencies (cards / docs / files)

- **Assumes #741 (CLOSED) + #743 ADR (Accepted):** the provider-independent provisioning model and the same-email rule (never takeover, never enumerate, "distinct" safe default) are ratified upstream (`AUTH-GOOGLE-SSO-ADR-001.md:34-45`).
- **Reads existing `public.handle_new_user()`** at `supabase/migrations/20260516000001_initial_schema.sql:37-53` (the function this card `CREATE OR REPLACE`s) — **does not edit it**.
- **Reuses the app-side cap** `DISPLAY_NAME_MAX = 60` from `src/features/account/ContactInfoSection.tsx:48` — the migration's `left(…, 60)` and the twin's `DISPLAY_NAME_DB_CAP` MUST stay equal to it.
- **Reuses the existing RLS grant** `profiles: users can insert own` (`WITH CHECK (id = auth.uid())`, `rls_policies.sql:62-65`) + the UPDATE policy (`rls_policies.sql:69-73`) — **only as documentation** of the #748 self-heal seam; this card does not exercise them.
- **Blocked-for-live-verification on #745** (hosted Google provider config, operator GATE-C): the migration is unit/scan-tested without live OAuth, but the *acceptance* assertion "a real Google sign-in lands with a populated `display_name`" can only be observed after #745 enables the hosted provider. The card ships its code + tests now; the live confirmation is operator-run post-#745.
- **Blocks/feeds #748** (invite redemption through Google): #748's optional client self-heal can import `coalesceProviderDisplayName` to populate `display_name` in its `.upsert({ id, display_name }, { onConflict: 'id' })` so the client and server compute the same name. This card creates that shared spec.

---

## Risks

- **Migration-bearing → merge = apply (the dominant risk).** Merging this PR auto-applies the migration to the remote DB via the Supabase GitHub integration (`MEMORY.md`: "Supabase merge auto-deploy"). So the **merge itself is the deploy** and is operator-gated (GATE-C). The reviewer applies heightened verification per `.claude/agents/roadmap-reviewer.md` § "Migration-bearing card verification": `npx supabase db reset --linked=false` when Docker is available, else heightened textual review against the four named issue classes. The implementer must NOT apply the migration remotely from the card.
- **`CREATE OR REPLACE FUNCTION` semantics:** the existing trigger keeps pointing at the function — verify that the new body's signature (`RETURNS trigger`, no args) is identical to the original so the replace is in-place. If the implementer accidentally changes the signature, Postgres errors on replace (caught at apply time / db reset).
- **`search_path` and `NEW.email`:** `NEW.email` is a column on the trigger's own `auth.users` row (no cross-schema read), so `SET search_path = public` is sufficient — do NOT widen to `public, auth` (that would be unnecessary surface). Builtins (`split_part`, etc.) resolve regardless of `search_path`. If the implementer mistakenly references `auth.users` directly, the scan test's negative assertions + a db-reset would flag it.
- **Email-path empty-string behavior delta:** today an email/password user who signed up with an empty `displayName` gets `display_name = ''`; under this fix they get the email-local-part (or `'Member'`). This is a strict improvement but IS a behavioral change to the email path — documented above and in the migration header so the reviewer is not surprised.
- **Existing tests touching `handle_new_user`:** none found in the repo for the trigger body (the existing migration has no companion body-scan test). The two new test files are additive; no existing test is expected to need updating. If a broader migration-inventory test exists, the new file's stamp must be added to its expected set (verify at implementation time).
- **`left()` on multibyte names:** `left(text, n)` counts characters, not bytes, so a 60-char cap on accented/CJK names is correct and matches JS `.slice(0, 60)` (UTF-16 code units differ from Postgres characters for astral-plane chars, an extreme edge; acceptable for a display-name cap and not worth surrogate-pair handling — note it in the twin test comment).

---

## Out of scope

Explicitly NOT in this card (reduces scope creep):

- **No client `profiles` self-heal implementation** — the missing-profile `.upsert` belongs to #748; this card only *documents* the seam + the RLS that permits it.
- **No "Continue with Google" UI / `signInWithOAuth` wrapper** — that is #746.
- **No invite/redirect resume wiring** — that is #748.
- **No hosted Google provider config / secret / redirect allow-list / same-email identity-linking mode** — that is #745 (operator GATE-C). This card does not set, read, or assert any hosted config.
- **No Facebook / Apple** (`AUTH-FACEBOOK-SSO-001-DEFERRED.md`).
- **No avatar / `raw_user_meta_data ->> 'avatar_url'` / `picture` provisioning** — the app uses a deterministic `InitialsAvatar` (no stored avatar URL); Google's `picture` claim is intentionally ignored. (Named because it is the obvious adjacent metadata field; v1 does not store it.)
- **No `email` column on `profiles`** — email stays in `auth.users` (read via `auth.getUser()`); no email copy into `profiles`, so no enumeration surface is created.
- **No `DO UPDATE` upsert in the trigger** — keep `DO NOTHING`; never clobber a user-edited name.
- **No new RLS policy, no GRANT/REVOKE change, no service-role usage.**

---

## Doctrine self-check

Walking the relevant skills and asserting each is respected:

**`cdiscourse-doctrine`:**
- **§1 no truth/verdict labels; score never blocks posting:** this card touches identity provisioning only — no gameplay, scoring, strength band, or verdict string is introduced. The single emitted literal is `'Member'` (plain neutral noun, ban-list-clean, test-asserted). Display name is not a gameplay string subject to the §1 ban-list, and the coalescer deliberately does NOT filter a user's own name.
- **§4 AI moderator limits:** no AI is invoked anywhere; the trigger is pure SQL. No truth value, no authoritative flag, no client AI call.
- **§5 rules engine sacred:** the deterministic engine (`src/domain/constitution/engine.ts`) is untouched; the pure-TS twin is a separate, side-effect-free helper that does not import the engine, Supabase, React, or fetch.
- **§6 secrets policy:** no secret literal anywhere; no `SERVICE_ROLE`/`ANTHROPIC_API_KEY` in `src/` or the migration (scan-asserted). `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` stays at zero matches.
- **§7 no AI calls from the production app:** none added.
- **§8 Supabase conventions:** RLS never disabled (scan negative); the new migration is sequentially numbered (`20260620000001`) and **never edits** the applied `20260516000001`; `handle_new_user` stays `SECURITY DEFINER` with pinned `search_path`. Constitution/flags/arguments conventions are not touched.
- **§9 plain language:** no internal validation code is surfaced; `'Member'` is plain prose.
- **§10 v1 scope guards:** no voting/winner, no realtime editing, **no OAuth/social-login UI is built here** (this is the server provisioning fix for an OAuth path whose config + UI live in #745/#746); no public API, no push, no search.

**`test-discipline`:**
- Pure-TS twin has a unit test for every public function + every card-required case incl. failure/edge cases (empty, null, whitespace, cap). Migration verified by static scan (the established idiom for SQL that jest cannot execute). Ban-list assertion present. Test count goes up (two new suites). No `.skip`/`.only`/`console.log`.

**`supabase-edge-contract` (data/RLS doctrine):**
- No service-role in client (the only write path is the server-side `SECURITY DEFINER` trigger). Migration discipline followed (new file, append-only, `CREATE OR REPLACE`, no edit of applied migration). RLS preserved (no policy DROP/ALTER/DISABLE). The conflict target is `id`, never email → no enumeration. No Edge Function added (the trigger is the existing server seam; no new function is needed).

**Same-email (ADR §Same-email handling):**
- This card adds **no** same-email logic — the conflict target is the `auth.users` uuid (`id`), so provisioning carries no takeover risk and discloses nothing about whether an email exists. The link-vs-distinct mode is #745's config decision; this card honors the "distinct, no-takeover, no-enumeration" safe default by construction (id-keyed insert) and is operator-smoke-verified post-#745, not jest-claimable.

---

## Same-email / identity-linking documented behavior

Per the ADR (`AUTH-GOOGLE-SSO-ADR-001.md:39-45`) and the readiness map:
- **The actual behavior is owned by Supabase Auth**, configured at hosted-config time in **#745** (link identities under one user, OR distinct identities). This card does not change it.
- **The conflict target in `handle_new_user` is `profiles.id` = the `auth.users` uuid, never email.** Therefore, regardless of the #745 linking mode: if Supabase *links* a Google identity to an existing user, the existing `profiles.id` row already exists and `ON CONFLICT (id) DO NOTHING` leaves the user's edited `display_name` intact (no clobber); if Supabase creates a *distinct* user, a new uuid → a new `profiles` row with the coalesced Google name. In neither case does the trigger take over an email/password account or reveal that an email already exists.
- **Until #745 records the mode**, downstream (this card included) treats "distinct, no-takeover, no-enumeration" as the safe default. The live assertion of the chosen mode is the operator's post-#745 smoke, not a jest test.

---

## #748 client-self-heal seam note

This card does NOT implement a self-heal, but documents the seam precisely for #748:

- **Read seam:** `src/features/account/accountApi.ts:50-67` — `fetchOwnProfile(userId)` is the only client `from('profiles').select(...)`; it maps `PGRST116` (no rows) → `not_found`. Consumed by `useAccountProfile` (`src/features/account/useAccountProfile.ts:22-33`).
- **The self-heal #748 can add (NOT in this card):** in the `not_found` branch, a pure client-side idempotent upsert under the **existing** anon key + RLS — `supabase.from('profiles').upsert({ id: uid, display_name: coalesceProviderDisplayName(userMetadata, email) }, { onConflict: 'id' })` — permitted by `profiles: users can insert own` (`WITH CHECK (id = auth.uid())`, `rls_policies.sql:62-65`) and the UPDATE policy (`rls_policies.sql:69-73`). **No service-role, no new migration, no RPC, no Edge Function** (this corrects `AUTH-FOUNDATION-PROVISIONING-001.md:29`, which overstated that any client `profiles` insert is "out of bounds"; the `auth.uid()`-scoped grant already exists and is safe — see readiness §Lane C material correction).
- **Why reuse the twin:** importing `coalesceProviderDisplayName` keeps the client self-heal and the server trigger computing the *same* display name from the same metadata, so a self-heal can never diverge from the trigger's result.
- **GATE-C status of #748's self-heal:** **NOT** GATE-C (client-only, existing RLS) — it becomes GATE-C only if #748 turns out to need an Edge/RLS change (default expectation: it does not).

---

## Operator steps (if any)

This is **GATE-C** and **merge = apply**:

1. **Do NOT apply the migration from this card** — the implementer commits the migration + TS + tests on the feature branch only; no `db push`.
2. **Reviewer (heightened, migration-bearing):** `npx supabase db reset --linked=false` when Docker is available (proves `handle_new_user` replaces cleanly and the trigger still fires), else the heightened textual review against the four OPS-001 issue classes per `.claude/agents/roadmap-reviewer.md`.
3. **Operator, on merge:** merging the PR to `main` auto-applies the migration to the remote DB via the Supabase GitHub integration (`MEMORY.md` "Supabase merge auto-deploy"). **The merge is the deploy** — gate it accordingly. No separate `npx supabase db push --linked` is needed for the registered migration path; if a manual apply is preferred, it is `npx supabase db push --linked` after review.
4. **Operator, post-#745 live confirmation:** after the hosted Google provider is enabled (#745), perform a real Google sign-in against `dev-cdiscourse.netlify.app` and confirm the new `profiles` row has a populated, sensible `display_name` (the `full_name` value, capped at 60) and that exactly one row exists (no duplicate on refresh/retry). This is the acceptance observation that jest cannot make.

---

## Implementer note (AUTH-GOOGLE-SSO-004, 2026-06-20)

**Email/password empty-string delta — confirmed REACHABLE in practice (no behavior changed).** The signup display-name field is labeled "Display name (optional)" (`AuthScreen.tsx:192`); the signup validator requires only email + password (`authApi.ts:22-26` `validateAuthInput`); `AuthScreen.tsx:58` passes `displayName.trim() || undefined`; and `authApi.ts:108` then stores `data: { display_name: displayName ?? '' }`. So a user who signs up by email/password and leaves the optional name blank lands with `raw_user_meta_data.display_name = ''` today — the empty-string delta the design flagged is an actual reachable path, not just theoretical. Under the old trigger that `''` was stored as `profiles.display_name = ''`; under the new coalescing `handle_new_user()` the `''` normalizes to NULL and falls through to the email local-part (or `'Member'` if email is absent). This is the single intended (strict-improvement) behavioral delta for the email/password path; a non-empty `display_name` resolves byte-identically to today. The finding is also recorded in the migration header comment. **No signup-form behavior was changed** (out of scope per the card).
