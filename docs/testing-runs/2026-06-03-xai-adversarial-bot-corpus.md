# xAI Adversarial Bot Corpus — 2026-06-03

_Run id_: `2026-06-03T19-24-32-740Z-d49e04cd`
_Mode_: live
_Env booleans_: hasXaiKey=true enableXai=true hasAnthropicKey=true enableAnthropic=true hasBotTests=true

## Skill gate

- provocateur path: `.claude/skills/bot-provocateur/SKILL.md`
- provocateur hash: `5ea916ce2f92356c`
- revocateur path: `.claude/skills/bot-revocateur/SKILL.md`
- revocateur hash: `17605e1bf2c5c170`
- validated: yes (passes `scripts/skills/validateBotSkills.js`)

## Doctrine reminder

- Popularity is not evidence.
- Bots are test bots; they never claim to be real X users.
- Hostile source material is **redacted** and converted into structured pressure, never reproduced.
- Text behavior is annotated; people are not classified.
- All app posts route through `submit-argument`. No `service-role`. No `direct insert`.

## Run counts

- xAI calls: 0
- Anthropic calls: 23
- Supabase writes: 420
- Scenarios built: 30
- Replies scanned: 30
- Usable dissent replies: 30
- Synthetic fallbacks: 0
- Source-chain risk HIGH replies: 0
- Amplification risk HIGH replies: 0

## Top disagreement axes (replies)

- `evidence` — 30

## Anti-amplification doctrine surfaced

- Replies with amplification-risk text features: 0
- Source-chain warnings raised: 0

## Diversity checks (CORPUS-30 §9)

- Duplicate-seed: severityBand=`green` · total=30 · unique=30 · duplicates=0
- Repeated-option (within thread): severityBand=`yellow` · repeated within=1 · cross-thread collisions=0
- Spine saturation: severityBand=`yellow` · repeated-threads=16 · low-diversity windows=2
- Voice distribution: severityBand=`yellow` · collisions=0 · out-of-band voices=3
- Samey-move (text distance): severityBand=`green` · high-overlap pairs=0 · overall mean=0 · max intra-thread mean=0

### Spine distribution (per-run)

- `definition-led` — 39
- `mechanism-led` — 38
- `analogy-led` — 37
- `question-led` — 35
- `quote-led` — 32
- `counterexample-led` — 31
- `scope-led` — 31
- `second-order-effect-led` — 29
- `concession-then-pivot` — 28

### Voice distribution (per-run)

- `analogist` — 30
- `scope_narrower` — 30
- `plain_skeptic` — 30

## Compliance

- [x] Skill gate validated before any harvest, dissent detection, or move rendering.
- [x] All source / reply bodies pass through xaiSourceRedactor.
- [x] Hostile-source conversion redacts categories; raw abuse is never reproduced.
- [x] No service-role / direct insert / submit-argument bypass in any committed code.
- [x] No raw handles, URLs, post IDs, JWTs, Bearer values, or key shapes in this report.
- [x] Diversity checks emit counts / distributions only; never body text.
