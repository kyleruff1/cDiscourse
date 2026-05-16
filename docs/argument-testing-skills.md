# CDiscourse — Argument Testing Skills

_Stage 6.0.3 — 2026-05-16_

Two project-local Claude Code skills support repeatable argument testing and fixture authoring. Both are manual-invocation only and do not call Anthropic.

---

## Skill 1: argument-fixture-author

**Location:** `.claude/skills/argument-fixture-author/SKILL.md`

**Purpose:** Generate safe, deterministic fixture argument histories for CDiscourse testing.

**Invoke with:**
```
/argument-fixture-author "the topic or resolution"
```

**What it produces:**
- A new JSON file in `fixtures/argument-scenarios/`
- Conforming to `FixtureScenario` type in `src/features/devFixtures/argumentScenarioTypes.ts`
- Passes `validateScenario()` from `src/features/devFixtures/argumentScenarioValidation.ts`

**Safe topic categories:**
- `sports` — format changes, scheduling, style comparisons
- `pop_culture` — trailers, remakes, streaming, playlists
- `light_civic` — local infrastructure, meeting formats, library programming (no named politicians)
- `everyday` — remote work, meeting culture, coffee shops, menus

**What it will not produce:**
- Named politicians or candidates
- Real-world accusations
- Medical, legal, or financial advice
- Identity-based conflicts
- Explicit content or violence
- Forbidden terms: bad faith, manipulation, liar, dishonest, winner, truth, ban, hide
- Emails, passwords, API keys, or service-role keys

**Required scenario structure:**

| Element | Requirement |
|---|---|
| Moves | 6–10 |
| Root move | Exactly one (`parentMoveId: null`) |
| challenge_parent | At least one, with `disagreementAxis` or `qualifierCode` |
| ask_clarification | At least one |
| add_evidence | At least one, with `evidence` field |
| concede_or_narrow | At least one, with `displayMeta.playfulLabel` |
| synthesize_thread | At least one |
| Quote anchor | At least one `targetExcerpt` or `displayMeta.quoteAnchorCandidate` |
| target excerpts | Must appear verbatim in parent body |

---

## Skill 2: argument-counter-runner

**Location:** `.claude/skills/argument-counter-runner/SKILL.md`

**Purpose:** Run and document a repeatable audit of CDiscourse argument behavior using fixture scenarios. Records results in `docs/testing-runs/`.

**Invoke with:**
```
/argument-counter-runner <scenario-id>
/argument-counter-runner all
```

**What it does:**
1. Confirms baseline (checkpoint, typecheck, lint, test, db push --dry-run, functions list).
2. Loads the named fixture scenario.
3. Guides a manual browser walk (human performs each move through the UI).
4. Runs counter-tests: invalid moves, duplicate submissions, empty body, 422 errors, quote anchoring.
5. Creates `docs/testing-runs/<date>-<scenario-id>.md` with move-by-move results.

**What it will never do:**
- Use service-role key in client code
- Create real production users through privileged APIs
- Commit credentials to Git
- Call Anthropic
- Bypass `submit-argument` Edge Function
- Directly insert posted arguments from the client

---

## Fixture File Location

```
fixtures/argument-scenarios/
  README.md
  sports-play-in.json
  pop-culture-trailers.json
  light-civic-bike-lanes.json
  everyday-remote-work.json
```

Run validation after any change:
```bash
npm run test -- --testPathPattern=argumentScenarioValidation
```

---

## Testing Run Log Location

```
docs/testing-runs/
  <YYYY-MM-DD>-<scenario-id>.md
```

Logs contain: aliases only, move-by-move results, counter-test results, and a "no secrets exposed" confirmation. Logs do not contain emails, passwords, JWTs, or API keys.

---

## Security Summary

| What | Rule |
|---|---|
| Test credentials | Never in Git — set via shell env vars only |
| Service-role key | Never in client code or script output |
| Anthropic API key | Supabase secrets only — never in test flow |
| Production data | Never modified by fixture testing |
| Submit path | Always through `submit-argument` Edge Function |
