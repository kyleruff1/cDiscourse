# xAI Adversarial Bot Corpus — 2026-05-17

_Run id_: `2026-05-17T20-52-24-374Z-7fea8919`
_Mode_: live
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

- xAI calls: (not wired in this commit)
- Anthropic calls: (not wired in this commit)
- Supabase writes: 0
- Scenarios built: 5
- Replies scanned: 22
- Usable dissent replies: 5
- Synthetic fallbacks: 0
- Source-chain risk HIGH replies: 0
- Amplification risk HIGH replies: 0

## Top disagreement axes (replies)

- `none` — 15
- `scope` — 5
- `fact` — 1
- `evidence` — 1

## Anti-amplification doctrine surfaced

- Replies with amplification-risk text features: 0
- Source-chain warnings raised: 0

## Compliance

- [x] Skill gate validated before any harvest, dissent detection, or move rendering.
- [x] All source / reply bodies pass through xaiSourceRedactor.
- [x] Hostile-source conversion redacts categories; raw abuse is never reproduced.
- [x] No service-role / direct insert / submit-argument bypass in any committed code.
- [x] No raw handles, URLs, post IDs, JWTs, Bearer values, or key shapes in this report.
