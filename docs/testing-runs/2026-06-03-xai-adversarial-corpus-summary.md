# xAI Adversarial Corpus — Stage 6.1.9 — 2026-06-03

_Run id_: `2026-06-03T18-44-36-344Z-a6d43f87`
_Mode_: live
_Source mode_: xai_x_search

## Doctrine reminder

- Popularity is not evidence. Repetition is not evidence. Engagement velocity is not evidence. Political identity is not evidence.
- Bots are test bots; they never claim to be real X users.
- Hostile source material is redacted and converted into structured pressure, never reproduced.
- Text behavior is annotated; people are not classified.
- All app posts route through `submit-argument`. No `service-role`. No `direct insert`.

## Skill gate

- provocateur: `.claude/skills/bot-provocateur/SKILL.md` · hash=`5ea916ce2f92356c` · 15713 bytes
- revocateur:  `.claude/skills/bot-revocateur/SKILL.md` · hash=`17605e1bf2c5c170` · 16646 bytes
- validated:   yes (passes `npm run skills:validate`)

## Counts

- Sources harvested: 30
- Replies classified: 150
- Usable dissent picks: 16
- Synthetic-fallback dissents: 17

## Issue-frame distribution

- `current debatable news topic` — 12
- `tech policy / platform debate` — 8
- `sports rule change debate` — 8
- `civic policy debate (everyday)` — 2

## Disagreement-axis distribution

- `none` — 94
- `scope` — 32
- `fact` — 17
- `evidence` — 3
- `value` — 2
- `framing` — 2

## Abuse-risk distribution

- `none` — 150

## Amplification-risk distribution

- `none_observed` — 149
- `low` — 1

## Source-chain-risk distribution

- `low` — 141
- `unknown` — 9

## Top deterministic rule candidates

Format: `<disagreementAxis>::<replyFunction>` — count.

- `none::unclear` — 80
- `scope::narrow_scope` — 31
- `fact::rebut` — 17
- `none::caveat` — 8
- `none::ask_source` — 4
- `value::unclear` — 2
- `evidence::unclear` — 2
- `framing::rebut` — 2
- `none::tangent` — 2
- `evidence::ask_source` — 1
- `scope::ask_source` — 1

## Platform-support-warning exhibits (redacted)

- (none)

## Source-chain-axis exhibits (redacted)

- **current debatable news topic** · axis=`source_chain` · dissent=`xai_x_search`
  - source: today's subjects for discussion on BBC Politics have been white guy stabbed by sikh, benefits bill/welfare reform, single sex spaces.
  - reply:  This is How BBC reported it. A Sikh man fatally stabbed a university student in the street because he feared being attacked with his own Sikh blade.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Border security - controversial Election integrity - controversial Deportations - controversial
  - reply:  Quote the part where Border security, election integrity and deportations are all controversial is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: No Jews allowed. Anti-Semitic scandal in Germany. An elderly Israeli couple tried to book a room at a hotel in Bavaria.
  - reply:  Quote the part where Hotel in Germany refused booking to Israeli couple saying no Jews allowed is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Democratic Maine Senate candidate Graham Platner is facing several scandals. Now-deleted Reddit posts including racist, sexist and offensive language have surfaced.
  - reply:  Quote the part where Democratic Maine Senate candidate faces scandals over deleted posts, tattoo and  is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Vini Junior is a better winger than Kylian Mbappe and I know most people will argue. Pace- Vini junior beats Ky Ky in terms of pace.
  - reply:  Quote the part where Vini Junior is a better winger than Kylian Mbappe due to pace and dribbling is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.

## Game-design recommendations

- 17 sources required a synthetic dissent skeleton — surface as "the platform did not produce a usable counterpoint; play this scaffold instead" so users do not mistake it for a real X reply.
- Never convert popularity / virality / engagement velocity into point-standing or claim standing.
- Never label users; only annotate text behavior.

## Compliance

- [x] Skill gate validated before any harvest or dissent classification.
- [x] Every body passes through `xaiSourceRedactor.redactRaw` before this report is rendered.
- [x] Hostile bodies were reduced to category placeholders by `convertHostileBody` BEFORE classification.
- [x] No raw X handles, URLs, post IDs, JWTs, Bearer tokens, or API keys in this report.
- [x] No popularity-as-evidence claims in any exhibit.
- [x] No service-role or direct-insert usage in any committed code path.
