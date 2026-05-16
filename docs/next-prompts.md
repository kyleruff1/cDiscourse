# CDiscourse — Next Prompts

The next three recommended session prompts, in order. Run `npm run checkpoint` first to confirm the current stage.

---

## Prompt 1 — Stage 5.1: Navigation + Auth Screens

> Implement Stage 5.1: set up Expo Router navigation and Auth screens.
>
> Install and configure Expo Router with file-based routing under `app/`. Create sign-in (`app/(auth)/sign-in.tsx`) and sign-up (`app/(auth)/sign-up.tsx`) screens wired to Supabase email+password auth (`src/lib/supabase.ts` is already initialized). Add an auth guard that redirects unauthenticated users to sign-in. No OAuth, no social login (v1 constraint). Run `npm run typecheck && npm run lint && npm run test` before finishing.

---

## Prompt 2 — Stage 5.2: Home Screen + Debate Room

> Implement Stage 5.2: Home screen (debate list) and Debate Room screen.
>
> Home screen lists debates the authenticated user participates in, fetched from the Supabase `debates` table with typed queries. Debate Room screen shows the resolution header and a scrollable argument tree. Build `ArgumentNode` (single node with type badge, body, depth indent) and `ArgumentTree` (recursive renderer). No realtime subscriptions yet. Run `npm run typecheck && npm run lint && npm run test` before finishing.

---

## Prompt 3 — Stage 5.3: Argument Submission Drawer

> Implement Stage 5.3: Compose Drawer for argument submission.
>
> Build a `ComposeDrawer` bottom-sheet component with argument type selector and body input. Use `evaluateArgumentDraft` from `src/domain/constitution/evaluateArgumentDraft.ts` to show allowed reply types and inline validation errors. On submit, call the `submit-argument` Edge Function via `src/lib/edgeFunctions.ts`. Display returned AI flags as non-authoritative, dismissible banners. Run `npm run typecheck && npm run lint && npm run test` before finishing.
