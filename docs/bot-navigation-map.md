# CDiscourse — Bot Navigation Map

_Stage 6.1.0 — 2026-05-16_

## Purpose

Defines stable `accessibilityLabel` values and test hook identifiers for use by Claude Code skills (`argument-fixture-author`, `argument-counter-runner`) and any future automated testing.

Labels are matched to `accessibilityLabel` props in the React Native UI where practical.

---

## Navigation

| Label | Component | Notes |
|---|---|---|
| `nav-arguments` | Arguments tab | TAB_LABELS.arguments |
| `nav-account` | Account tab | TAB_LABELS.account |
| `nav-debug` | Debug tab | Dev only |

---

## Room-Level Actions

| Label | Component | Notes |
|---|---|---|
| `button-start-argument` | Start argument button | In action bar |
| `button-invite` | Invite chip | In room toolbar |
| `button-tree-view` | Thread view toggle | In room toolbar |
| `button-timeline-view` | Tracks view toggle | In room toolbar |

---

## Per-Argument Actions

| Label | Component | Notes |
|---|---|---|
| `button-reply` | Reply button on ArgumentNode | Opens inline composer |
| `button-counter` | Future: counter chip | Opens composer with challenge move |
| `button-add-receipts` | Future: receipts chip | Opens composer with evidence move |
| `button-concede` | Future: concede chip | Opens composer with concession move |
| `button-clarify` | Future: clarify chip | Opens composer with clarification move |
| `button-branch-off` | Future: branch button | Shows branch notice |

---

## Form Inputs

| Label | Component | Notes |
|---|---|---|
| `input-room-title` | Room title field | In CreateDebateForm |
| `input-main-claim` | Resolution/claim field | In CreateDebateForm |
| `input-counterclaim` | Future: counter field | In CreateDebateForm (planned) |
| `input-body` | Composer body input | In ArgumentComposer |
| `input-email-or-name` | Invite email/name | In InvitePanel |

---

## Composer Move Chips

| Label | Move kind | Notes |
|---|---|---|
| `chip-move-challenge` | challenge_parent | ConversationMoveNavigator |
| `chip-move-clarify` | ask_clarification | ConversationMoveNavigator |
| `chip-move-receipts` | add_evidence | ConversationMoveNavigator |
| `chip-move-concede` | concede_or_narrow | ConversationMoveNavigator |
| `chip-move-synthesize` | synthesize_thread | ConversationMoveNavigator |

---

## Composer Qualifier Chips

| Label | Qualifier | Notes |
|---|---|---|
| `chip-qualifier-fact` | Fact axis | Challenge axis sub-picker |
| `chip-qualifier-logic` | Logic axis | Challenge axis sub-picker |
| `chip-qualifier-scope` | Scope axis | Challenge axis sub-picker |
| `chip-qualifier-receipts` | Evidence axis | Challenge axis sub-picker |

---

## Panels and Badges

| Label | Component | Notes |
|---|---|---|
| `panel-validation-preview` | ComposerValidationPanel | Shows errors/warnings |
| `badge-resting-status` | Future: status badge | GameRestingStatus display |

---

## Timeline Lanes

| Label | Track kind | Notes |
|---|---|---|
| `timeline-core-lane` | core | ArgumentTrack kind='core' |
| `timeline-counter-lane` | counter | ArgumentTrack kind='counter' |
| `timeline-receipts-lane` | receipts | ArgumentTrack kind='receipts' |
| `timeline-tangent-lane` | tangent | ArgumentTrack kind='tangent' |

---

## Usage in Skills

The `argument-counter-runner` skill references these labels when describing manual browser walk steps. Future automated tests may use `accessibilityLabel` queries.

Labels are intentionally stable — they should not change between stages unless a component is removed entirely.
