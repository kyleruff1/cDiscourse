# xAI Adversarial Bot Corpus — 2026-05-17

_Run id_: `2026-05-17T21-57-29-566Z-1baa673e`
_Mode_: dry
_Env booleans_: hasXaiKey=true enableXai=true hasAnthropicKey=true enableAnthropic=true hasBotTests=true

## Skill gate

- provocateur path: `.claude/skills/bot-provocateur/SKILL.md`
- provocateur hash: `d8cf0cd9ea662501`
- revocateur path: `.claude/skills/bot-revocateur/SKILL.md`
- revocateur hash: `44d12e0cfadb7fa7`
- validated: yes (passes `scripts/skills/validateBotSkills.js`)

## Doctrine reminder

- Popularity is not evidence.
- Bots are test bots; they never claim to be real X users.
- Hostile source material is **redacted** and converted into structured pressure, never reproduced.
- Text behavior is annotated; people are not classified.
- All app posts route through `submit-argument`. No `service-role`. No `direct insert`.

## Run counts

- xAI calls: 0 (dry)
- Anthropic calls: 0 (dry)
- Supabase writes: 0
- Scenarios built: 10
- Replies scanned: 47
- Usable dissent replies: 9
- Synthetic fallbacks: 1
- Source-chain risk HIGH replies: 3
- Amplification risk HIGH replies: 0

## Top disagreement axes (replies)

- `none` — 35
- `evidence` — 5
- `source_chain` — 3
- `scope` — 2
- `fact` — 1
- `value` — 1

## Anti-amplification doctrine surfaced

- Replies with amplification-risk text features: 0
- Source-chain warnings raised: 3

## Compliance

- [x] Skill gate validated before any harvest, dissent detection, or move rendering.
- [x] All source / reply bodies pass through xaiSourceRedactor.
- [x] Hostile-source conversion redacts categories; raw abuse is never reproduced.
- [x] No service-role / direct insert / submit-argument bypass in any committed code.
- [x] No raw handles, URLs, post IDs, JWTs, Bearer values, or key shapes in this report.
