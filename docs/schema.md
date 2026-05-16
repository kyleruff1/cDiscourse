# Database Schema — CDiscourse

All tables live in the `public` schema. `auth.users` is Supabase-managed. Migrations are in `supabase/migrations/`.

---

## Table Summary

| Table | Purpose | Key design notes |
|---|---|---|
| `profiles` | Extended user data | 1-1 with `auth.users`; auto-created on signup via trigger |
| `constitution_versions` | Versioned debate constitutions | Append-only; rooms pin to a version at creation |
| `constitution_rules` | Individual rules within a constitution | `code` is the stable engine identifier; `params` is rule-specific JSON config |
| `tag_definitions` | Argument tag registry | Global; restricted per argument type via `allowed_argument_types` |
| `flag_definitions` | Flag type registry | Global; `severity` governs UI treatment |
| `debates` | Debate rooms | Pins `constitution_id` at creation; immutable after first argument |
| `debate_participants` | Debate membership | Composite PK; side immutable after first argument |
| `arguments` | Argument tree nodes | Recursive via `parent_id`; soft-delete via `status = deleted` |
| `argument_tags` | Argument ↔ tag junction | Validated against `tag_definitions.allowed_argument_types` |
| `argument_flags` | Flags on arguments | Source column distinguishes rule engine, AI, user reports, moderator |
| `topic_satisfaction_checks` | Topic relevance assessments | Append-only; inserted by Edge Functions |
| `moderation_reviews` | Moderator decision log | Append-only; audit trail for flag resolution |
| `audio_submissions` | Audio recordings + transcript lifecycle | Linked to Storage; transcript status progresses via Edge Function |

---

## ERD (Text)

```
auth.users
    │ 1:1 (trigger)
    ▼
profiles ◄──────────────────────── debates.created_by
    │                                    │
    │                               constitution_versions ◄── constitution_rules
    │                                    │
    ├── debate_participants.user_id      │
    │                                    ▼
    ├── arguments.author_id ◄──── debates (id)
    │       │                          │
    │       │ (parent_id self-ref)      ├── debate_participants
    │       │                          │
    │       ├── argument_tags           └── audio_submissions
    │       │       │
    │       │       └── tag_definitions
    │       │
    │       └── argument_flags
    │               │
    │               ├── flag_definitions
    │               ├── constitution_rules (rule_code)
    │               │
    │               └── moderation_reviews
    │
    └── topic_satisfaction_checks
```

---

## Table Detail

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `display_name` | text | Nullable; set from signup metadata |
| `role` | text | `'user' \| 'moderator' \| 'admin'`; default `'user'` |
| `created_at` | timestamptz | Default `now()` |

Auto-created by `handle_new_user()` trigger on `auth.users INSERT`.

---

### `constitution_versions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Fixed sentinel UUID for v1: `c1d00001-0000-0000-0000-000000000001` |
| `slug` | text UNIQUE | URL-safe: `constitution-v1` |
| `version` | text | Semantic version: `1.0.0` |
| `title` | text | Human-readable name |
| `body_md` | text | Full constitution document in Markdown |
| `active` | boolean | Only one should be true at a time; new debates use the active version |
| `created_at` | timestamptz | |

**Design**: rows are immutable after publication. To update the constitution, insert a new version and set `active = true` on it, `false` on the old one. Existing debates are unaffected.

---

### `constitution_rules`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `constitution_id` | uuid FK | → `constitution_versions(id)` ON DELETE CASCADE |
| `code` | text UNIQUE | Stable identifier used by the rules engine (e.g. `transition_claim`) |
| `title` | text | |
| `description` | text | |
| `rule_type` | text | `transition \| topic_satisfaction \| evidence \| civility \| structure \| rate_limit \| length \| review` |
| `severity` | text | `info \| warning \| review \| blocking` |
| `params` | jsonb | Rule-specific config. Schema varies by `rule_type` (see below) |
| `enabled` | boolean | Disabled rules are skipped by the engine |

**`params` schema by `rule_type`:**
```
transition:         { from_type, allowed_reply_types[], flag_code }
structure:          { types_requiring_parent[], allowed_root_types[], flag_code }
evidence:           { applies_to_types[], min_links, flag_code }
length:             { min_chars, max_chars, short_flag_code, long_flag_code }
civility:           { flag_code, patterns[] }
topic_satisfaction: { method, threshold, flag_code, off_topic_threshold, off_topic_flag_code }
rate_limit:         { max_per_hour, per_debate, flag_code }
```

---

### `tag_definitions`

| Column | Type | Notes |
|---|---|---|
| `code` | text PK | Stable identifier (e.g. `evidence`, `scope_challenge`) |
| `label` | text | Display name |
| `description` | text | |
| `category` | text | `argument_type \| epistemic \| procedural \| general` |
| `allowed_argument_types` | text[] | Empty = unrestricted; non-empty = only these argument types may carry this tag |
| `enabled` | boolean | |

**Seeded tags**: `claim`, `rebuttal`, `counter_rebuttal`, `evidence`, `source_request`, `clarification`, `concession`, `synthesis`, `scope_challenge`

---

### `flag_definitions`

| Column | Type | Notes |
|---|---|---|
| `code` | text PK | Stable identifier (e.g. `off_topic`, `invalid_transition`) |
| `label` | text | |
| `description` | text | |
| `severity` | text | `info \| warning \| review \| blocking` |
| `default_status` | text | Initial status when flag is created: `open \| needs_review \| confirmed \| dismissed` |
| `auto_review_threshold` | numeric | If AI confidence ≥ this, flag auto-promotes to `needs_review`. Nullable. |
| `enabled` | boolean | |

**Seeded flags**: `off_topic`, `weak_topic_satisfaction`, `missing_parent`, `invalid_transition`, `unsupported_factual_claim`, `evidence_required`, `civility_risk`, `ad_hominem_possible`, `duplicate_argument_possible`, `excessive_length`, `unclear_claim`, `needs_moderator_review`

---

### `debates`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `created_by` | uuid FK | → `profiles(id)` ON DELETE RESTRICT |
| `title` | text | |
| `resolution` | text | The falsifiable proposition (e.g. "UBI reduces long-term poverty") |
| `description` | text | |
| `status` | text | `draft → open → locked → archived` |
| `constitution_id` | uuid FK | → `constitution_versions(id)` ON DELETE RESTRICT; pinned at creation |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-stamped by trigger |

**Status lifecycle**: Only `open` debates accept new arguments. `locked` = readable but no new posts. `archived` = read-only historical record.

---

### `debate_participants`

| Column | Type | Notes |
|---|---|---|
| `debate_id` | uuid FK | → `debates(id)` ON DELETE CASCADE |
| `user_id` | uuid FK | → `profiles(id)` ON DELETE CASCADE |
| `side` | text | `affirmative \| negative \| observer \| moderator` |
| `joined_at` | timestamptz | |
| PK | | `(debate_id, user_id)` |

---

### `arguments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `debate_id` | uuid FK | → `debates(id)` ON DELETE CASCADE |
| `parent_id` | uuid FK | → `arguments(id)` ON DELETE SET NULL; NULL for root |
| `author_id` | uuid FK | → `profiles(id)` ON DELETE RESTRICT |
| `argument_type` | text | `thesis \| claim \| rebuttal \| counter_rebuttal \| evidence \| clarification_request \| concession \| synthesis` |
| `side` | text | `affirmative \| negative \| neutral` |
| `body` | text | Main argument text |
| `depth` | int | 0 = root; bounded by constitution `max_depth` rule |
| `status` | text | `draft → posted`; soft-delete via `hidden` or `deleted` |
| `client_validation` | jsonb | Snapshot of client-side rules engine result at submit time (not authoritative) |
| `server_validation` | jsonb | Summary of server-side check (canonical flags are in `argument_flags`) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-stamped by trigger |

**Indexes**: `debate_id`, `parent_id`, `author_id`, `status = posted` (partial)

**Soft-delete**: Set `status = deleted`. Body can be replaced with `[retracted]`. Children retain their `parent_id` (which is SET NULL on delete) and remain visible.

---

### `argument_tags`

| Column | Type | Notes |
|---|---|---|
| `argument_id` | uuid FK | → `arguments(id)` ON DELETE CASCADE |
| `tag_code` | text FK | → `tag_definitions(code)` ON DELETE RESTRICT |
| `created_by` | uuid FK | → `profiles(id)` |
| `created_at` | timestamptz | |
| PK | | `(argument_id, tag_code)` |

---

### `argument_flags`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `debate_id` | uuid FK | → `debates(id)` ON DELETE CASCADE |
| `argument_id` | uuid FK | → `arguments(id)` ON DELETE CASCADE |
| `flag_code` | text FK | → `flag_definitions(code)` |
| `rule_code` | text FK? | → `constitution_rules(code)` ON DELETE SET NULL; NULL for user/moderator flags |
| `source` | text | `client_rules \| server_rules \| semantic_adapter \| user_report \| moderator` |
| `confidence` | numeric | 0–1; NULL for deterministic sources |
| `status` | text | `open → needs_review → confirmed \| dismissed` |
| `payload` | jsonb | Extra structured data from the source (e.g. matched terms, raw AI response excerpt) |
| `created_by` | uuid FK? | NULL for automated sources |
| `resolved_by` | uuid FK? | Set when status transitions to confirmed/dismissed |
| `created_at` | timestamptz | |
| `resolved_at` | timestamptz? | |

**Invariant**: rows are never deleted. Use `status = dismissed`.

---

### `topic_satisfaction_checks`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `debate_id` | uuid FK | → `debates(id)` |
| `argument_id` | uuid FK | → `arguments(id)` |
| `parent_argument_id` | uuid FK? | → `arguments(id)`; for contextual checks |
| `method` | text | `lexical \| semantic_adapter \| manual` |
| `score` | numeric | 0–1 |
| `threshold` | numeric | From the constitution rule at check time |
| `status` | text | `satisfied \| weak \| failed \| not_applicable` |
| `matched_terms` | text[] | Terms from resolution found in body |
| `missing_terms` | text[] | Important resolution terms absent from body |
| `payload` | jsonb | Raw provider response or debug data |
| `created_at` | timestamptz | |

---

### `moderation_reviews`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `flag_id` | uuid FK | → `argument_flags(id)` ON DELETE CASCADE |
| `reviewer_id` | uuid FK | → `profiles(id)` ON DELETE RESTRICT |
| `decision` | text | `confirm \| dismiss \| escalate` |
| `notes` | text | Reviewer notes |
| `created_at` | timestamptz | |

**Invariant**: rows are never updated or deleted.

---

### `audio_submissions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `debate_id` | uuid FK | → `debates(id)` |
| `argument_id` | uuid FK? | → `arguments(id)` ON DELETE SET NULL; set after transcript is accepted |
| `user_id` | uuid FK | → `profiles(id)` |
| `storage_path` | text | Supabase Storage path (e.g. `audio/{user_id}/{id}.webm`) |
| `transcript_text` | text? | Populated after transcription |
| `transcript_status` | text | `uploaded → transcribing → ready_for_review → accepted \| rejected \| failed` |
| `provider_payload` | jsonb | Raw transcription provider response |
| `created_at` | timestamptz | |

---

## Key Design Decisions

1. **Constitution pinned at debate creation.** The `debates.constitution_id` column is written once and never updated. Changing the active constitution does not affect existing debates.

2. **Flags are append-only.** `argument_flags` rows are never deleted. Resolution is via `status` column. This preserves the moderation audit trail.

3. **`argument.parent_id` uses SET NULL on delete**, not CASCADE, so deleting/retracting a parent does not cascade-delete the entire subtree.

4. **`client_validation` vs `server_validation`.** The client snapshot (`client_validation`) is informational — it shows what the client engine checked at submit time. The server result (`server_validation`) is the authoritative summary, with full flag rows in `argument_flags`.

5. **`source` on flags distinguishes authority.** `server_rules` flags are authoritative (blocking). `semantic_adapter` flags are advisory with a confidence score. `user_report` flags require moderator review.
