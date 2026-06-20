# AUTH-FOUNDATION-PROVISIONING-001 — Design-first idempotent app-profile provisioning, provider-independent

> Status: closing design doc for issue #741. This is the DESIGN deliverable the card defaults to. It ratifies the existing trigger-based model and specifies the missing-profile / same-email handling. No code, migration, or Edge Function is changed by this card. Where a future implementation would need a server write, it is enumerated and marked GATE-C (§4, §6). This is the dedicated standalone expansion of section 3 of `docs/designs/AUTH-FOUNDATION-INDEX.md`.

## 0. Goal

Guarantee that first-authentication by ANY method — email/password today, Google tomorrow — reliably yields exactly one `public.profiles` row, idempotently, with no client service-role and no account enumeration. Because the model keys off the `auth.users` insert (not off any provider), it is provider-independent by construction.

## 1. The eight required questions, answered

### Q1. Where is the profile created?

Server-side, by a database trigger on `auth.users`. `public.handle_new_user()` is defined `SECURITY DEFINER` with a pinned `SET search_path = public` (`supabase/migrations/20260516000001_initial_schema.sql:37-49`) and is fired by `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW` (`:51-53`). This is the single creation point.

### Q2. Does email/password create a profile?

Yes. The trigger fires on the `auth.users` insert that email/password signup produces. The client's `signUpWithEmailPassword` passes only `data: { display_name }` into auth metadata (`src/features/auth/authApi.ts:104-111`, specifically the `options.data` at `:108`); the trigger reads `NEW.raw_user_meta_data ->> 'display_name'` and writes the profile row (`migration:44-45`). The client performs no profile insert.

### Q3. Client vs server?

Server. The client MUST NOT insert profiles and MUST NOT use a service-role key. No `insert('profiles')` exists in the client today; the only client involvement is passing `display_name` as auth metadata (`authApi.ts:108`).

### Q4. Missing-profile handling

Specified fallback for the case where a session exists but no `public.profiles` row is found (trigger raced, historical/manually-created `auth.users` row, etc.):

- **Read-time self-heal, idempotent, never client-service-role.** On the first signed-in read, if the profile lookup returns no row, the safe design is a server-side self-heal that re-runs the same idempotent upsert the trigger performs (`INSERT … ON CONFLICT (id) DO NOTHING`) keyed to the caller's own `auth.uid()`.
- Two acceptable implementations, both server-side: (a) an idempotent `SECURITY DEFINER` RPC the signed-in client may call (the function itself enforces `id = auth.uid()`), or (b) an Edge Function that performs the upsert. Neither grants the client a direct `profiles` insert and neither ships a service-role key to the client.
- The client-only fallback of "INSERT a profile from the app" is explicitly rejected: it would require either a broad RLS insert policy or a service-role key in the client. Both are out of bounds.
- **This self-heal does not exist in code today.** It is a design specification. If/when implemented it is a GATE-C follow-up (see §4) and belongs to the provisioning-impl card (#747), not to this design card.

### Q5. Idempotent upsert

Keep `ON CONFLICT (id) DO NOTHING` (`migration:46`). Any added self-heal path must use the same `ON CONFLICT (id) DO NOTHING` so a retry, a refresh, or a race between the trigger and the self-heal can never produce a duplicate row. `public.profiles.id` is the PRIMARY KEY referencing `auth.users(id)` (`migration:25-26`), so the conflict target is well-defined and at most one row per user can ever exist.

### Q6. Same-email handling

When a Google identity and an existing email/password account share an email:

- **Foundation rule:** Supabase Auth remains the identity owner. Provisioning does NOT auto-merge identities in any way that could enable account takeover. The profile row is keyed to `auth.users(id)` (`migration:26`), so identity ownership is Supabase's, not the app's.
- Account-linking semantics (whether a Google sign-in attaches to an existing email/password `auth.users` row, and under what verification) are **finalized in the Google ADR / provisioning cards (#743 and #747)**, not here.
- A likely real work item for #747: a Google identity carries the display name under `full_name` / `name` metadata keys rather than `display_name`, so the trigger's `raw_user_meta_data ->> 'display_name'` may yield NULL for a Google user. This is a provisioning-impl concern, flagged but not solved here.

### Q7. No enumeration

Provisioning and any missing-profile path must not reveal whether an email/account exists. No differential error between "profile missing" and "profile present"; plain copy only. The existing auth error mapping already collapses Supabase messages into non-revealing classes (`src/features/auth/authApi.ts:43-62`) and the redirect-error copy is plain (`REDIRECT_INVALID_MESSAGE`, `authApi.ts:13`). Any future self-heal must return the same outcome shape regardless of pre-existing state.

### Q8. No service-role in client

Reasserted as an invariant. The trigger is the only privileged path and it lives in the database (`SECURITY DEFINER`, `migration:40`). The client never imports a service-role key. The invite path already follows this rule — its wrappers "NEVER import a service-role key and NEVER insert directly" (`src/features/invites/inviteApi.ts:224-227`). Guard/test posture: a doctrine grep (`grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` per `CLAUDE.md`) must return zero matches, and any self-heal RPC/Edge added later must be covered by a test asserting it enforces `id = auth.uid()` and is reachable without service-role.

## 2. Why this is provider-independent

The model keys off the `auth.users` insert via `AFTER INSERT ON auth.users` (`migration:51-53`). Email/password and a future Google identity both produce an `auth.users` row, so both fire the same trigger and yield exactly one profile. No branch of the provisioning logic inspects the provider. The only provider-specific nuance is the metadata key for the display name (Q6), which is a downstream impl detail.

## 3. Invariants

- Server-side provisioning only (DB trigger; optionally a server self-heal). No client profile insert. (`migration:37-53`)
- No service-role in client. (`inviteApi.ts:224-227`; `CLAUDE.md` security table)
- RLS preserved on `public.profiles`; the trigger runs `SECURITY DEFINER` with pinned `search_path`. (`migration:40-41`)
- Exactly one profile per user — PRIMARY KEY + `ON CONFLICT (id) DO NOTHING`. (`migration:25-26`, `:46`)
- No enumeration; plain, non-differential copy. (`authApi.ts:43-62`)

## 4. GATE-C note for the eventual server write

The DESIGN in this card is NOT GATE-C. IF the missing-profile self-heal (Q4) is later implemented as a new migration / RPC / Edge Function / db write, that IMPLEMENTATION is GATE-C and migration-bearing: it requires heightened reviewer verification per the roadmap-reviewer template (`npx supabase db reset --linked=false` when Docker is available, else heightened textual review against the four named issue classes). Service-role, if used at all, stays in the Edge layer, never the client. That work belongs to #747; this card delivers the design only.

## 5. Tests

No pure model is added by this design card, so no new unit test is required here. If #747 adds a pure missing-profile decision helper, unit-test it; a migration-bearing follow-up requires the `db reset` verification noted in §4.

## 6. Acceptance-bullet evidence map

| Acceptance bullet | Satisfied by |
|---|---|
| Provisioning design doc/section answers all 8 questions with file:line citations | §1 Q1–Q8, each citing `migration:37-53`, `authApi.ts:104-111`, `inviteApi.ts:224-227` |
| Model is provider-independent (works for email/pw and future Google because it keys off the `auth.users` insert) | §2 (trigger `AFTER INSERT ON auth.users`, `migration:51-53`) |
| Missing-profile self-heal specified as idempotent + service-role-free on the client; if it needs a server/Edge/migration change, that change is enumerated + marked GATE-C with a deploy note | §1 Q4 + §4 (GATE-C, migration-bearing, deferred to #747) |
| Same-email behavior documented with explicit deferral of merge semantics to the Google ADR/provisioning cards | §1 Q6 (defers merge to #743/#747) |
| No-enumeration and no-client-service-role stated as invariants with a test/guard plan | §1 Q7, Q8; §3 invariants; §1 Q8 guard/test posture |
