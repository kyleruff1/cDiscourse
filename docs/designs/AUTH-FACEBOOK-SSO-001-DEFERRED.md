# AUTH-FACEBOOK-SSO-001 — Facebook SSO: DEFERRED (post-launch only)

> **Status:** DEFERRED — post-launch only. **No setup, no UI, no secrets, no provider config now.**
> This document is the deliverable for issue #749. The card exists solely to record the deferral
> and its blocking preconditions so the decision is captured and not silently lost. It changes
> no config, enables no provider, ships no UI, and contains no secret.
>
> **Lane:** downstream of the provider-agnostic foundation (`docs/designs/AUTH-FOUNDATION-INDEX.md`)
> and the Google-only launch lane (`docs/designs/AUTH-GOOGLE-SSO-INDEX.md`). Facebook is **not** in
> either lane today.

---

## 1. Disposition

Facebook social sign-in is **DEFERRED to post-launch** and is intentionally **NOT built now**.
There is no active implementation work associated with this card. The card is filed purely to:

1. record the deferral decision, and
2. capture the preconditions that must be met before any Facebook work begins,

so that the deferral is durable and reviewable rather than an undocumented gap.

The sole acceptance bullet on #749 — “The card is filed as DEFERRED/post-launch with explicit
preconditions and no active work” — is satisfied by this record. No production code, hosted/provider
config, secret, migration, RLS/Edge change, native dependency, OAuth secret, or runtime/behavior
change is required to satisfy it; all of those belong to the eventual GATE-C build, which this card
explicitly does **not** action.

## 2. Current repo evidence (the no-active-work posture)

Verified read-only at drafting time:

- **No Facebook code anywhere.** `grep -rin "facebook|1877F2" src/` returns zero matches.
- **No OAuth initiation anywhere.** `grep -rn "signInWithOAuth" src/` returns zero matches; the
  live auth path is email/password only (`src/features/auth/authApi.ts` — `signUp` and
  `signInWithEmailPassword`).
- **No `[auth.external.facebook]` provider block.** The only OAuth provider block in
  `supabase/config.toml` is the **disabled** `[auth.external.apple]` block
  (`supabase/config.toml:359-372`, `enabled = false`, secret via `env(...)`). The name `facebook`
  appears in the repo only inside the provider-name comment (`supabase/config.toml:356-358`).
- **The reference design shows a Facebook button** at
  `.tmp/slate002-ref/redesign-zip/handoff/structure/03-mobile-flow.md:43-48`. That is **intent /
  inspiration only** — it is **not** a build trigger, and its styling/copy are **not** to be lifted.

## 3. Blocking preconditions (ALL required before any Facebook work begins)

Facebook SSO is **BLOCKED** until **all** of the following hold:

1. **Launch is complete.** The product has shipped to its launch environment.
2. **Google SSO is stable in production.** The Google lane (`docs/designs/AUTH-GOOGLE-SSO-INDEX.md`,
   #743–#748) is live, exercised, and stable in prod — Facebook reuses the same foundation, so a
   shaky Google path is a hard stop.
3. **The operator re-approves Facebook specifically.** A general “add social login” approval does
   **not** authorize Facebook; the operator must explicitly green-light Facebook as a distinct
   provider, with its own scope and review.

Until all three are true, no Facebook design, UI, config, or secret work is in scope.

## 4. Non-goals (now)

Explicitly out of scope while this card is deferred:

- No Facebook provider config (no `[auth.external.facebook]` block enabled, hosted or local).
- No “Continue with Facebook” UI button or any visible Facebook affordance.
- No Facebook client id / client secret anywhere (repo, client, or hosted) now.
- No operator runbook for Facebook now.
- No code, no tests, no migration, no Edge/RLS change now.

## 5. GATE-C posture (when eventually built) + mandatory future review

When Facebook is eventually approved and built, it is **GATE-C** and **operator-gated**:

- It requires hosted provider config + client id/secret stored as **Supabase secrets only**
  (never in repo/client), plus a hosted redirect allow-list change — identity-/deploy-bearing,
  operator console access required, **never self-approved** (per
  `docs/core/pipeline-governance-contract.md`). **Claude does not run it.**
- Any future review that re-opens Facebook **MUST** cover, at minimum:
  - **Facebook app review** (Meta’s app-review process for the requested permissions/scopes),
  - **Privacy policy** obligations tied to the Facebook Login / data-deletion requirements, and
  - **Provider configuration** (OAuth client, redirect URIs to the Supabase callback
    `https://<ref>.supabase.co/auth/v1/callback`, consent screen, secret handling).

## 6. Reuse of the provider-agnostic foundation (when eventually built)

Facebook, when built, **reuses the existing foundation lane** rather than inventing a parallel path:

- Redirect allow-list inventory — #739 (`docs/designs/AUTH-FOUNDATION-INDEX.md` §1).
- Provider-ready Sign In UI slot — #740 (`AUTH-FOUNDATION-INDEX.md` §2). Note: the foundation UI
  card reserves **no** Facebook button; a Facebook affordance is added only when this card is
  un-deferred.
- Provider-independent profile provisioning — #741 (`AUTH-FOUNDATION-INDEX.md` §3). The
  `public.handle_new_user()` trigger fires for any `auth.users` insert and is provider-independent;
  any Facebook-specific display-name metadata mapping would follow the same pattern the Google lane
  uses in #747.
- Invite/room intent continuity through auth redirects — #742 (`AUTH-FOUNDATION-INDEX.md` §4).

Supabase Auth remains the **identity owner**; Facebook would be an external provider, never a
replacement IdP. The deterministic submission gate and all seat/invite/capacity rules are unaffected.

## 7. Doctrine compliance

- **Secrets policy** (cdiscourse-doctrine §6): no Facebook secret exists now; when built, the client
  secret lives only as a Supabase secret, never in repo/client. No service-role in client.
- **Identity ownership:** Supabase Auth stays the identity owner; email/password remains a
  first-class path.
- **v1 scope note (cdiscourse-doctrine §10):** the “no OAuth / social login” v1 guard was
  narrowly amended by ADR #743 to add **Google only** for launch
  (`docs/designs/AUTH-GOOGLE-SSO-INDEX.md:6`). **Facebook is not covered by that amendment** and
  remains fully excluded; this deferral record introduces no Facebook capability.

## 8. No-copied-reference-slogans note

No user-facing copy is authored here. The reference package’s Facebook button styling and copy
(`.tmp/slate002-ref/redesign-zip/handoff/structure/03-mobile-flow.md:43-48`) are inspiration only
and are **not** reproduced. When Facebook is eventually built, its affordance label uses plain,
original wording (or the conventional provider label), not lifted marketing copy.

## 9. Cross-references

- Google-only launch lane: `docs/designs/AUTH-GOOGLE-SSO-INDEX.md` — §“Facebook deferred”
  (`:42-43`).
- Provider-agnostic foundation: `docs/designs/AUTH-FOUNDATION-INDEX.md` — §6 “Facebook deferred”
  (`:56-58`).
- ADR ratifying Google-only-for-launch scope change: #743.
- This card: #749.
