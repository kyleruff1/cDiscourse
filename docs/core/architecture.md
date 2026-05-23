# Architecture — CDiscourse

## Stack

| Layer | Technology |
|---|---|
| Mobile client | Expo (React Native) + TypeScript, Expo Router v3 |
| UI | NativeWind (Tailwind for RN) + custom component library |
| State | Zustand (local) + Supabase Realtime (server sync) |
| Backend | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) |
| Rules engine | Pure TypeScript module — shared between client and Edge Functions |
| AI provider | Anthropic Claude via Supabase Edge Function (server-only, key never on client) |
| Testing | Jest + React Native Testing Library; Supabase local dev for DB tests |

No always-on custom server. All backend logic runs in Supabase Edge Functions or enforced at the database layer via RLS and triggers.

---

## Repository Layout

```
debate-constitution-app/
├── app/                         # Expo Router file-system routing
│   ├── _layout.tsx              # Root layout (auth gate, theme provider)
│   ├── +not-found.tsx
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── (app)/
│       ├── _layout.tsx          # Authenticated tab navigator
│       ├── index.tsx            # Home / room feed
│       ├── explore.tsx
│       ├── profile.tsx
│       └── rooms/
│           ├── new.tsx
│           └── [id]/
│               ├── index.tsx    # Room + argument tree
│               └── argument/
│                   └── [aid].tsx
│
├── src/
│   ├── components/              # Shared UI components
│   │   ├── ArgumentNode.tsx
│   │   ├── ArgumentTree.tsx
│   │   ├── ComposeDrawer.tsx
│   │   ├── FlagsPanel.tsx
│   │   ├── RoomCard.tsx
│   │   └── ui/                  # Primitive design-system components
│   ├── hooks/
│   │   ├── useRealtime.ts
│   │   ├── useRoom.ts
│   │   └── useArgumentTree.ts
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client (uses env vars)
│   │   ├── constitution/
│   │   │   ├── index.ts         # Re-exports engine
│   │   │   ├── engine.ts        # Deterministic rules engine (pure TS)
│   │   │   ├── v1.ts            # Constitution v1 definition
│   │   │   └── types.ts         # ConstitutionSchema TypeScript types
│   │   └── types.ts             # Domain model types
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── roomStore.ts
│   │   └── constitutionStore.ts
│   └── utils/
│       ├── flagHelpers.ts
│       └── treeHelpers.ts
│
├── supabase/
│   ├── config.toml              # Supabase local dev config
│   ├── seed.sql                 # Dev seed data
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_rls_policies.sql
│   │   └── 0003_constitution_seed.sql
│   └── functions/
│       ├── moderate-argument/
│       │   └── index.ts         # AI flag generation
│       └── check-topic/
│           └── index.ts         # Topic-satisfaction check
│
├── docs/
│   ├── product-spec.md
│   ├── architecture.md
│   ├── constitution-v1.md
│   └── implementation-plan.md
│
├── __tests__/
│   ├── engine.test.ts           # Rules engine unit tests
│   ├── transitions.test.ts
│   └── flags.test.ts
│
├── .env.example                 # Template — never commit real values
├── .gitignore
├── app.json
├── babel.config.js
├── package.json
├── tsconfig.json
├── jest.config.js
└── CLAUDE.md
```

---

## Database Schema

All tables live in the `public` schema. `auth.users` is Supabase-managed.

### `profiles`
```sql
id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
username    text UNIQUE NOT NULL
display_name text
avatar_url  text
created_at  timestamptz DEFAULT now()
```

### `constitution_versions`
```sql
id          serial PRIMARY KEY
version     text UNIQUE NOT NULL  -- e.g. "1.0.0"
body        jsonb NOT NULL        -- full constitution JSON
published_at timestamptz DEFAULT now()
notes       text
```

### `rooms`
```sql
id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
resolution        text NOT NULL
description       text
status            text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','voting','closed','archived'))
constitution_version text NOT NULL REFERENCES constitution_versions(version)
created_by        uuid NOT NULL REFERENCES profiles(id)
is_public         boolean NOT NULL DEFAULT true
created_at        timestamptz DEFAULT now()
closed_at         timestamptz
```

### `room_members`
```sql
room_id     uuid REFERENCES rooms(id) ON DELETE CASCADE
user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE
side        text NOT NULL CHECK (side IN ('affirmative','negative','neutral'))
joined_at   timestamptz DEFAULT now()
PRIMARY KEY (room_id, user_id)
```

### `arguments`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
room_id         uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE
parent_id       uuid REFERENCES arguments(id) ON DELETE CASCADE
author_id       uuid NOT NULL REFERENCES profiles(id)
type            text NOT NULL  -- CLM|RBT|CRB|EVD|CLR|CON|SYN
side            text NOT NULL CHECK (side IN ('affirmative','negative','neutral'))
body            text NOT NULL
depth           integer NOT NULL DEFAULT 0
tags            text[] DEFAULT '{}'
evidence        jsonb DEFAULT '[]'  -- [{url, label, accessed_at}]
is_deleted      boolean DEFAULT false
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### `flags`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
argument_id     uuid NOT NULL REFERENCES arguments(id) ON DELETE CASCADE
source          text NOT NULL CHECK (source IN ('deterministic','ai'))
rule_id         text NOT NULL      -- e.g. "INVALID_TRANSITION" or "AI_OFF_TOPIC"
severity        text NOT NULL CHECK (severity IN ('info','warning','violation'))
message         text NOT NULL
payload         jsonb DEFAULT '{}'  -- extra structured data
authoritative   boolean NOT NULL    -- true for deterministic, false for AI
reviewed_by     uuid REFERENCES profiles(id)
reviewed_at     timestamptz
dismissed       boolean DEFAULT false
created_at      timestamptz DEFAULT now()
```

---

## Rules Engine (Shared Module)

`src/lib/constitution/engine.ts` exports pure functions used by both the client (instant feedback) and Edge Functions (authoritative check):

```typescript
validateTransition(parentType, childType, constitution) → ValidationResult
validateDepth(depth, constitution) → ValidationResult
validateBodyLength(body, constitution) → ValidationResult
validateTags(tags, constitution) → ValidationResult
runDeterministicChecks(argument, parentArgument, constitution) → Flag[]
```

The engine has no side effects and no network calls. It imports only the constitution type definitions.

---

## Edge Functions

### `moderate-argument`
Trigger: called server-side after an argument is inserted (via Supabase webhook or direct invocation from client after insert).

1. Loads the room's pinned constitution version.
2. Runs `runDeterministicChecks()` — produces authoritative flags, upserts to `flags`.
3. If `constitution.aiChecks.enabled`, calls the AI provider (Claude) with a structured prompt.
4. Parses AI response into typed flags; inserts with `authoritative = false`.
5. Returns flag summary to caller.

The AI provider API key (`ANTHROPIC_API_KEY`) is set only as a Supabase Edge Function secret — never in client environment.

### `check-topic`
Triggered on-demand. Takes a `room_id` and optionally an `argument_id`. Returns a topic-satisfaction summary (how many top-level claims exist per side, open clarification requests, etc.). AI may contribute a "debate maturity" assessment flag.

---

## Realtime

Supabase Realtime channels:
- `room:{room_id}` — subscribes to `INSERT`/`UPDATE` on `arguments` filtered by `room_id`.
- `flags:{argument_id}` — subscribes to `INSERT` on `flags` for a single argument.

Clients apply optimistic updates locally via Zustand; Realtime patches reconcile.

---

## Auth & Security

- Auth: Supabase email+password (magic link planned for v2).
- All tables protected by Row Level Security (RLS). See `0002_rls_policies.sql`.
- RLS summary:
  - `arguments`: anyone can read in public rooms; only `author_id = auth.uid()` can insert/update own; soft-delete only.
  - `rooms`: `is_public` rooms readable by all authenticated users; private rooms only by members.
  - `flags`: readable by room members; writable only by Edge Functions (service role) and room owner for dismiss.
  - `profiles`: readable by all authenticated; writable only by self.
- `SUPABASE_ANON_KEY` in client `.env` — safe to expose (RLS is the guard).
- `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` — Edge Function secrets only; never in client bundle.

---

## Testing Strategy

| Layer | Tool | What |
|---|---|---|
| Rules engine | Jest | All transition matrix combinations, flag conditions, edge cases |
| React components | RNTL | ComposeDrawer validation flow, ArgumentNode rendering |
| Edge Functions | Deno test | Mock Supabase client; test prompt construction and flag parsing |
| DB migrations | `supabase db test` | Schema integrity, RLS policy enforcement |
| E2E (future) | Maestro | Full room creation → argument → flag flow on simulator |
