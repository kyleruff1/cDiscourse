# Implementation Plan — CDiscourse

Staged build order. Each stage is independently shippable and verifiable. Do not skip verification before moving to the next stage.

---

## Stage 0 — Project Bootstrap

**Goal**: Working Expo project with TypeScript, linting, and CI scripts.

### Steps
1. Initialize Expo project in `debate-constitution-app/` using the blank TypeScript template.
2. Install Expo Router v3.
3. Configure NativeWind (Tailwind for React Native).
4. Set up ESLint + Prettier with TypeScript rules.
5. Configure Jest + React Native Testing Library.
6. Create `.gitignore` covering `node_modules`, `.env`, `.expo`, `dist`, Supabase secrets.
7. Create `.env.example` with all required env var keys (no real values).
8. Initialize `git` repository with initial commit.
9. Add `package.json` scripts: `start`, `ios`, `android`, `typecheck`, `lint`, `test`.

### Verification
```bash
npm run typecheck     # Zero errors
npm run lint          # Zero errors
npm run test          # Zero failures (no tests yet, exits cleanly)
npx expo start        # Dev server starts; no crash
```

### Critical files
- `app.json`
- `tsconfig.json`
- `babel.config.js`
- `package.json`
- `.env.example`
- `.gitignore`

---

## Stage 1 — Constitution / Rules Engine

**Goal**: The deterministic rules engine as a pure TypeScript module with full test coverage. This is the app's core — it must be solid before any UI or database work.

### Steps
1. Create `src/lib/constitution/types.ts` — TypeScript types for `ConstitutionSchema`, `ArgumentType`, `TransitionMatrix`, `Flag`, `ValidationResult`.
2. Create `src/lib/constitution/v1.ts` — Constitution v1.0.0 as a typed constant (no DB call; JSON-serializable).
3. Create `src/lib/constitution/engine.ts` — pure functions:
   - `validateTransition(parentType, childType, constitution)`
   - `validateDepth(depth, constitution)`
   - `validateBodyLength(body, constitution)`
   - `validateTags(tags, constitution)`
   - `validateEvidenceLinks(links, argType, constitution)`
   - `runDeterministicChecks(arg, parentArg | null, constitution) → Flag[]`
4. Write tests in `__tests__/engine.test.ts` and `__tests__/transitions.test.ts` covering:
   - All valid transitions (should pass)
   - All invalid transitions (should produce `INVALID_TRANSITION` flag)
   - Root-level non-CLM (should produce `INVALID_ROOT_TYPE`)
   - Depth exceeded
   - Body length bounds
   - Missing evidence source for EVD
   - CLR not ending in `?`
   - Tag excess / duplicates

### Verification
```bash
npm run test                    # All engine tests pass
npm run typecheck               # Zero errors
```

### Critical files
- `src/lib/constitution/types.ts`
- `src/lib/constitution/v1.ts`
- `src/lib/constitution/engine.ts`
- `__tests__/engine.test.ts`
- `__tests__/transitions.test.ts`

---

## Stage 2 — Database & Auth

**Goal**: Supabase project configured locally and in the cloud, with all tables, RLS policies, and constitution seed data.

### Steps
1. Initialize Supabase local dev: `npx supabase init`.
2. Write migration `0001_initial_schema.sql`: all tables from architecture.md (`profiles`, `constitution_versions`, `rooms`, `room_members`, `arguments`, `flags`).
3. Write migration `0002_rls_policies.sql`: full RLS for all tables.
4. Write migration `0003_constitution_seed.sql`: insert constitution v1.0.0 JSON into `constitution_versions`.
5. Write `supabase/seed.sql` with dev test data (2 users, 1 room, a few arguments).
6. Create `src/lib/supabase.ts` using `@supabase/supabase-js`; reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env`.
7. Implement `authStore.ts` (Zustand): `signIn`, `signUp`, `signOut`, `session`, `user`.
8. Build Auth screens: `(auth)/login.tsx`, `(auth)/signup.tsx`.
9. Wire root layout `app/_layout.tsx` to gate navigation on session.

### Verification
```bash
npx supabase start              # Local Supabase running
npx supabase db push            # Migrations applied cleanly
npx supabase db test            # Schema + RLS tests pass
npm run typecheck               # Zero errors
# Manual: sign up, sign in, sign out on simulator
```

### Critical files
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_rls_policies.sql`
- `supabase/migrations/0003_constitution_seed.sql`
- `supabase/seed.sql`
- `src/lib/supabase.ts`
- `src/stores/authStore.ts`
- `app/(auth)/login.tsx`
- `app/(auth)/signup.tsx`

---

## Stage 3 — Room & Argument Data Layer

**Goal**: Full CRUD for rooms and arguments via typed Supabase queries; Realtime subscription working.

### Steps
1. Create `src/lib/types.ts` — domain model types mirroring DB schema (`Room`, `Argument`, `Flag`, `Profile`).
2. Create `src/hooks/useRoom.ts` — fetches room + members, handles loading/error.
3. Create `src/hooks/useArgumentTree.ts` — fetches argument tree for a room, builds parent→children map, subscribes to Realtime channel for live updates.
4. Create `src/stores/roomStore.ts` — Zustand store for rooms list, current room, optimistic updates.
5. Implement create-room flow: `app/(app)/rooms/new.tsx` form + insert.
6. Implement argument insert: takes `{ roomId, parentId, type, side, body, tags, evidence }`, runs `runDeterministicChecks()` client-side first (reject violations, confirm warnings), then inserts.
7. Wire Realtime: on new argument insert from another user, patch the tree store.

### Verification
```bash
npm run typecheck
npm run test                    # All existing tests still pass
# Manual: create room → insert root CLM → insert RBT → verify tree renders live on second device/simulator
# Manual: attempt invalid transition (e.g. SYN→CLM) → verify rejection with correct rule ID
```

### Critical files
- `src/lib/types.ts`
- `src/hooks/useRoom.ts`
- `src/hooks/useArgumentTree.ts`
- `src/stores/roomStore.ts`
- `app/(app)/rooms/new.tsx`
- `app/(app)/rooms/[id]/index.tsx`

---

## Stage 4 — Core UI Components

**Goal**: Full argument tree UI: collapsible tree, compose drawer, flags panel.

### Steps
1. `ArgumentNode.tsx` — renders one argument with type badge, side indicator, body, author, tags, flag count. Collapsible children.
2. `ArgumentTree.tsx` — renders recursively from root; uses `FlashList` for virtualization on long trees.
3. `ComposeDrawer.tsx` — bottom sheet (Expo's `@gorhom/bottom-sheet`). Given a parent argument:
   - Shows allowed reply types per constitution transition matrix.
   - Body text input with character counter and length validation.
   - Tag multi-select from constitution registry.
   - Evidence link input (for EVD type).
   - Real-time flag preview as user types (deterministic only, no AI here).
   - Submit button disabled while violations exist.
4. `FlagsPanel.tsx` — collapsible accordion per argument showing all flags (source, severity, message, authoritative badge, dismissed state).
5. `RoomCard.tsx` — room list item for home screen.
6. Home screen `app/(app)/index.tsx` — lists user's rooms.
7. Room detail screen `app/(app)/rooms/[id]/index.tsx` — resolution header + `ArgumentTree`.

### Verification
```bash
npm run typecheck
npm run test                    # All tests pass
# Manual UI walkthrough:
#   - Create room
#   - Submit CLM
#   - Submit valid RBT to CLM
#   - Attempt INVALID_TRANSITION → see inline error
#   - Submit EVD without source → see violation
#   - Submit CLR not ending in ? → see warning + confirm step
#   - Submit valid EVD → see it appear in tree
#   - View Flags Panel for an argument
```

### Critical files
- `src/components/ArgumentNode.tsx`
- `src/components/ArgumentTree.tsx`
- `src/components/ComposeDrawer.tsx`
- `src/components/FlagsPanel.tsx`
- `src/components/RoomCard.tsx`

---

## Stage 5 — Edge Functions & AI Moderation

**Goal**: Server-side authoritative rules enforcement and AI flag generation via Edge Functions.

### Steps
1. Create `supabase/functions/moderate-argument/index.ts`:
   - Invoked by client after argument insert (or via Supabase DB webhook on `arguments` INSERT).
   - Loads constitution version from DB.
   - Runs `runDeterministicChecks()` server-side (same engine, authoritative write to `flags`).
   - If AI enabled: calls Anthropic Claude with a structured prompt requesting topic-relevance and type-fit assessments.
   - Parses AI response into `flags` rows with `authoritative = false`.
   - Returns flag summary.
2. Create `supabase/functions/check-topic/index.ts`:
   - On-demand; returns debate maturity summary for a room.
3. Set `ANTHROPIC_API_KEY` as Supabase Edge Function secret (CLI: `supabase secrets set`).
4. Never expose `ANTHROPIC_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in any client-side code or `.env` committed to git.
5. Update client: after argument insert, call `moderate-argument` Edge Function; display returned AI flags in Flags Panel.

### AI Prompt Design Principles
- Pass the resolution, argument type, parent body (if any), and argument body.
- Ask for structured JSON output only (no prose).
- Ask separately: "Is this on topic? (yes/no + confidence 0-1)" and "Does the body match the declared type? (yes/no + confidence 0-1 + reason)".
- Apply confidence thresholds from constitution before creating flags.
- Instruct the model: "Do not judge truth or falsity. Do not recommend deletion. Report only."

### Verification
```bash
npx supabase functions serve moderate-argument   # Local serve
# Manual: submit argument → check flags table for AI flags
# Verify: AI flags have authoritative = false
# Verify: ANTHROPIC_API_KEY is not present in any client bundle (grep check)
grep -r "ANTHROPIC_API_KEY" app/ src/           # Must return zero matches
npm run typecheck
npm run test
```

### Critical files
- `supabase/functions/moderate-argument/index.ts`
- `supabase/functions/check-topic/index.ts`

---

## Stage 6 — Polish, Constitution Viewer, and Profile

**Goal**: Constitution viewer, profile screen, room lifecycle management.

### Steps
1. `ConstitutionViewer` screen/component — renders human-readable constitution from the version pinned to the current room.
2. Profile screen — user stats, side history.
3. Room status transitions (open → closed → archived) controlled by room creator.
4. `SYN` type only available when parent thread is closed (enforced by engine + DB check).
5. Argument soft-delete (author can retract; body replaced with `[retracted]`, flags cleared).
6. Explore screen — list public rooms.
7. Error boundary + loading skeleton components.
8. Accessibility: ensure all interactive elements have `accessibilityLabel`.

### Verification
```bash
npm run typecheck
npm run lint
npm run test
# Manual: full debate flow from room creation to closed + SYN
# Manual: verify SYN rejected while thread open
# Manual: retract argument → verify children still visible with [retracted] parent
```

---

## Dependency Policy

1. **Check existing dependencies first**. Never install a package that is already in `package.json`.
2. **Expo-compatible packages**: use `npx expo install <package>` to get the Expo-compatible version. Do not use `npm install` for RN packages.
3. **Non-Expo/pure-JS packages** (e.g., Zustand, date-fns): use `npm install`.
4. **Supabase Edge Function deps**: import from `esm.sh` or `deno.land/x`; do not use `npm:` imports unless the Deno version supports it.
5. **No package without a clear stage assignment** — every dependency must serve a currently active stage.

---

## Security Notes

| Risk | Mitigation |
|---|---|
| Supabase service role key exposed | Never in client code; Edge Functions only; Supabase secrets CLI |
| Anthropic API key exposed | Never in client code; Edge Function secret only |
| Anon key abused | RLS policies are the primary guard; anon key exposure alone is not a breach |
| Arbitrary argument inserts | RLS `author_id = auth.uid()` check; Edge Function re-validates all deterministic rules |
| SQL injection | Only parameterized queries via Supabase JS client; no raw SQL from client |
| Argument body XSS | Body rendered as plain text on mobile; no `dangerouslySetInnerHTML` |
| Constitution tampering | `constitution_versions` write-protected by RLS (service role only) |
| Depth bomb (deeply nested tree) | `maxDepth` enforced both client-side and in Edge Function |

---

## Staged Build Summary

| Stage | Deliverable | Key Verification |
|---|---|---|
| 0 | Expo + tooling bootstrap | `typecheck`, `lint`, `test` pass; dev server starts |
| 1 | Rules engine + tests | All engine tests pass; 100% transition matrix coverage |
| 2 | DB schema + auth | Migrations apply; RLS tests pass; sign-in/out works |
| 3 | Room + argument data layer | CRUD works; Realtime live update works |
| 4 | Core UI | Full debate flow in UI; all flag types surfaced |
| 5 | Edge Functions + AI flags | AI flags stored; key grep confirms no client exposure |
| 6 | Polish + lifecycle | Full flow from creation to archived room |
