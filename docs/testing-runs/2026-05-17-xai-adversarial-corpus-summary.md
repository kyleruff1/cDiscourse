# xAI Adversarial Corpus — Stage 6.1.9 — 2026-05-17

_Run id_: `2026-05-17T22-13-14-660Z-5b447504`
_Mode_: live
_Source mode_: xai_x_search

## Doctrine reminder

- Popularity is not evidence. Repetition is not evidence. Engagement velocity is not evidence. Political identity is not evidence.
- Bots are test bots; they never claim to be real X users.
- Hostile source material is redacted and converted into structured pressure, never reproduced.
- Text behavior is annotated; people are not classified.
- All app posts route through `submit-argument`. No `service-role`. No `direct insert`.

## Skill gate

- provocateur: `.claude/skills/bot-provocateur/SKILL.md` · hash=`d8cf0cd9ea662501` · 11127 bytes
- revocateur:  `.claude/skills/bot-revocateur/SKILL.md` · hash=`44d12e0cfadb7fa7` · 11953 bytes
- validated:   yes (passes `npm run skills:validate`)

## Counts

- Sources harvested: 32
- Replies classified: 150
- Usable dissent picks: 13
- Synthetic-fallback dissents: 23

## Issue-frame distribution

- `tech policy / platform debate` — 8
- `civic policy debate (everyday)` — 8
- `culture / media discussion` — 8
- `current debatable news topic` — 6
- `sports rule change debate` — 2

## Disagreement-axis distribution

- `none` — 107
- `scope` — 14
- `fact` — 12
- `evidence` — 12
- `value` — 3
- `framing` — 1
- `logic` — 1

## Abuse-risk distribution

- `none` — 149
- `low` — 1

## Amplification-risk distribution

- `none_observed` — 146
- `low` — 4

## Source-chain-risk distribution

- `low` — 113
- `unknown` — 35
- `medium` — 2

## Top deterministic rule candidates

Format: `<disagreementAxis>::<replyFunction>` — count.

- `none::unclear` — 86
- `none::caveat` — 20
- `scope::narrow_scope` — 13
- `fact::rebut` — 11
- `evidence::unclear` — 6
- `evidence::ask_source` — 4
- `fact::ask_source` — 1
- `evidence::caveat` — 1
- `evidence::rebut` — 1
- `value::unclear` — 1
- `value::caveat` — 1
- `value::rebut` — 1

## Platform-support-warning exhibits (redacted)

- (none)

## Source-chain-axis exhibits (redacted)

- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: BREAKING: The Israeli military’s Central Command chief has signed an order extending Israel’s controversial death penalty law to Palestinians in the occupied West Bank
  - reply:  Quote the part where Israel is extending its controversial death penalty law to Palestinians in the o is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Eseme Eyiboh says the Senate rule amendment debate should prioritise institutional stability, continuity and legislative experience over personalities
  - reply:  Quote the part where Senate rule amendment debate should prioritise institutional stability and legis is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Is Fernandes most creative Premier League player ever? That PFA POTY shouldn’t even be a debate
  - reply:  Quote the part where Bruno Fernandes is the most creative Premier League player ever is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Selecting the #1 hottest controversial issue trending on X: the explosive reports of an Iranian bill offering a bounty on the US President sparking worldwide outrage
  - reply:  Quote the part where Explosive reports of an Iranian bill offering a bounty on the US President spark is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: National debt vs GDP, Bond yields, unemployment, tax burden, better off to be on benefits than in work, inflation, illegal migration
  - reply:  Quote the part where National debt vs GDP, illegal migration and whether people are better off on ben is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.

## Game-design recommendations

- 23 sources required a synthetic dissent skeleton — surface as "the platform did not produce a usable counterpoint; play this scaffold instead" so users do not mistake it for a real X reply.
- Never convert popularity / virality / engagement velocity into point-standing or claim standing.
- Never label users; only annotate text behavior.

## Compliance

- [x] Skill gate validated before any harvest or dissent classification.
- [x] Every body passes through `xaiSourceRedactor.redactRaw` before this report is rendered.
- [x] Hostile bodies were reduced to category placeholders by `convertHostileBody` BEFORE classification.
- [x] No raw X handles, URLs, post IDs, JWTs, Bearer tokens, or API keys in this report.
- [x] No popularity-as-evidence claims in any exhibit.
- [x] No service-role or direct-insert usage in any committed code path.
