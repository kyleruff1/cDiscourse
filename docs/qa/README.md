# CDiscourse — QA gate index

Two levels of release gate, run in order:

- **L0 — MVP smoke:** `../mvp-smoke-test.md`. Proves the app boots and the core
  loop works (auth, debate create/join, tree, composer). Run first.
- **L1 — ASP journey gate:** `journey-gate-j1-j10.md`. Scripts the Design Pass's
  ten core user journeys (J1–J10) against the shipped ASP surfaces, and pairs
  each with its automated jest coverage. Card QA-001 (#692).

The L1 gate is **conditionally green**: seven journeys are automatable today;
J5, J8, and the audio half of J6 are **BLOCKED ON VOICE-ADR-002 (#863)** and are
documented as unarmed. The executable manifest is
`../../__tests__/journeyGateCoverageMap.test.ts`.
