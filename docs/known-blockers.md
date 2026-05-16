# CDiscourse — Known Blockers

Active issues that prevent full local validation as of 2026-05-16.

---

## 1. Docker Unavailable — Supabase Local Not Validated

**Status:** Blocking local DB validation  
**Impact:** Cannot run `npx supabase start`, `npx supabase db reset`, or `npx supabase db lint`

Migrations 0001–0005 are written and syntactically correct but have not been applied to any database instance. Edge Functions cannot be tested end-to-end locally.

**Resolution (when Docker Desktop is running):**
```bash
npx supabase start
npx supabase db reset
npx supabase db status
npx supabase db lint
```

---

## 2. No Linked Remote Supabase Project

**Status:** Blocking deployment  
**Impact:** Cannot deploy Edge Functions or push migrations to staging/prod

`npx supabase link` has not been run. No project-ref is configured.

**Resolution:**
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push --linked
npx supabase functions deploy submit-argument
```

---

## 3. npm Install Peer Dependency Caveats

**Status:** Informational  
**Impact:** `npm install` may fail with peer dependency conflicts involving `jest-expo` and React 19

Try without the flag first:
```bash
npm install <package>
```

If conflicts occur, use:
```bash
npm install <package> --legacy-peer-deps
```

Do not use `--force` — it can silently corrupt dependency resolution.

---

## 4. Deno Mirror Risk for Edge Functions

**Status:** Informational  
**Impact:** Edge Function URL imports may break if a mirror goes down or a URL-pinned version is removed

All Edge Function dependencies are imported by URL in `supabase/functions/`. There is no Deno lock file. If an import URL breaks:

1. Confirm the URL is still valid
2. Pin to a specific version tag in the import URL (e.g., `@1.2.3`)
3. Use `esm.sh` or `deno.land/x` as fallback mirrors

Imports to watch: `zod` (used in `supabase/functions/_shared/validationSchemas.ts`).

---

## 5. `.env` Not Created

**Status:** Expected — not a bug  
**Impact:** App will not connect to Supabase without local `.env`

`.env` is gitignored and must be created manually. Copy from `.env.example`:
```bash
cp .env.example .env
# Fill in real values (NEVER commit the filled file)
```

Required keys:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon/publishable key only — never service role)
