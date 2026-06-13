# ARG-ROOM Visibility / Invite slate — index (2026-06-13)

**Run code:** `ARG-ROOM-VISIBILITY-INVITE-SLATE-2026-06-13` · **Baseline:** `main @ f85ced2` · **Release:** 6.7
**Roadmap:** `docs/roadmap-expansions/2026-06-13-public-private-argument-room-invites-roadmap.md` (binding matrix, build-on-shipped inventory, divergence ledger, dependency DAG).

Argument-room creation with **public/private visibility, one direct email invite, and a capacity cap** (private 1v1 = 2; public capped at 5). Built ON shipped primitives — QOL-038 #207, QOL-039 #208, QOL-040 #209, GAME-004 #141, GAME-005 #142, AUTH-CALLBACK-CONSUMER-001 #607/#608 — none rebuilt.

## Binding creation matrix

| Visibility | Direct invites | Reserved seat | Open slots | Total capacity | Valid? |
|---|---|---|---|---|---|
| Private | 0 | 0 | 0 | 2 | No — private requires one invite |
| Private | 1 | 1 | 0 | 2 | Yes (default) |
| Public | 0 | 0 | 4 | 5 | Yes |
| Public | 1 | 1 | 3 | 5 | Yes |
| any | 2+ | — | — | — | No — max one direct invite |

## Card map

| Card | Issue | Design doc | Review | Pri / Effort / Risk | Lane | Status |
|---|---|---|---|---|---|---|
| ARG-ROOM-ADR-001 | [#611](https://github.com/kyleruff1/cDiscourse/issues/611) | [ADR-001](./ARG-ROOM-ADR-001-VISIBILITY-CAPACITY-INVITE-DOCTRINE.md) | [review](../reviews/ARG-ROOM-ADR-001-design-review.md) | P0 / S / Med | docs-only ADR | Designed + reviewed |
| ARG-ROOM-001 | [#612](https://github.com/kyleruff1/cDiscourse/issues/612) | [001](./ARG-ROOM-001-CREATION-MATRIX-AND-MODEL.md) | [review](../reviews/ARG-ROOM-001-design-review.md) | P0 / M / Low | pure TS | Designed + reviewed |
| ARG-ROOM-002 | [#613](https://github.com/kyleruff1/cDiscourse/issues/613) | [002](./ARG-ROOM-002-BACKEND-VISIBILITY-CAPACITY-INVITES.md) | [review](../reviews/ARG-ROOM-002-design-review.md) | P0 / XL / High | migration+RLS+Edge · **GATE-C** | Implemented — `feat/ARG-ROOM-002-backend-enforcement`, pending GATE-C merge/deploy |
| ARG-ROOM-003 | [#614](https://github.com/kyleruff1/cDiscourse/issues/614) | [003](./ARG-ROOM-003-CREATE-ROOM-UX.md) | [review](../reviews/ARG-ROOM-003-design-review.md) | P0 / L / Med | UI | Designed + reviewed |
| ARG-ROOM-004 | [#615](https://github.com/kyleruff1/cDiscourse/issues/615) | [004](./ARG-ROOM-004-INVITE-ACCEPTANCE-AND-EMAIL-TRANSPORT.md) | [review](../reviews/ARG-ROOM-004-design-review.md) | P0 / L / High | orchestration + return-path · **GATE-C** | Implemented — `feat/ARG-ROOM-004-invite-acceptance-email`, DORMANT (both transport gates OFF), pending GATE-C merge/deploy. Seam: orchestration runs in `room-notifications` `handleInvite` (create-argument-room is contractually branch-free), triggered post-create |
| ARG-ROOM-005 | [#616](https://github.com/kyleruff1/cDiscourse/issues/616) | (later) | (later) | P1 / L / High | pure model + read-only UI | Filed |
| ARG-ROOM-006 | [#617](https://github.com/kyleruff1/cDiscourse/issues/617) | (later) | (later) | P1 / M / Med | UI + `manage-room-invite` | Filed |
| ARG-ROOM-007 | [#618](https://github.com/kyleruff1/cDiscourse/issues/618) | (later) | (later) | P1 / S / Low | pure copy + ban-list | Filed |

All eight on **Project #1** — Phase=Backlog, Release=6.7, Epic=Rules UX (ARG-ROOM-004 = Interaction).

## Build order

ADR-001 → 001 → 002 *(GATE-C)* → {003, 005, 007} → {004 *(GATE-C)*, 006}.

## Key reconciliation

Public cap **6 → 5** (GAME-005 `publicSeatModel.ts:62`). Recorded in ADR-001; enforced in ARG-ROOM-002; surfaced in ARG-ROOM-005. See roadmap §4 divergence ledger.
