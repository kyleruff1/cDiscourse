# xAI Adversarial Corpus — Stage 6.1.9 — 2026-05-17

_Run id_: `2026-05-17T20-48-18-368Z-95ad8d26`
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

- Sources harvested: 5
- Replies classified: 25
- Usable dissent picks: 2
- Synthetic-fallback dissents: 3

## Issue-frame distribution

- `current debatable news topic` — 5

## Disagreement-axis distribution

- `none` — 20
- `scope` — 2
- `fact` — 2
- `evidence` — 1

## Abuse-risk distribution

- `none` — 25

## Amplification-risk distribution

- `none_observed` — 25

## Source-chain-risk distribution

- `low` — 25

## Top deterministic rule candidates

Format: `<disagreementAxis>::<replyFunction>` — count.

- `none::unclear` — 17
- `scope::narrow_scope` — 2
- `none::support` — 2
- `none::caveat` — 1
- `fact::rebut` — 1
- `fact::ask_source` — 1
- `evidence::ask_source` — 1

## Platform-support-warning exhibits (redacted)

- (none)

## Source-chain-axis exhibits (redacted)

- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Isn’t debatable? National debt vs GDP, Bond yields, unemployment, tax burden, better off to be on benefits than in work, inflation, illegal migration, private business closures… anyone concerned about the state of the country is labelled far right!
  - reply:  Quote the part where Anyone concerned about national debt, bond yields, unemployment, tax burden, ben is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Political rhetoric surrounding drug trafficking, national security, and border enforcement continues to generate sharp partisan debate in the United States.
  - reply:  Quote the part where Political rhetoric on drug trafficking, national security and border enforcement is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Debates over judicial reform, statehood proposals, and the Electoral College continue to be highly polarizing issues in U.S. politics.
  - reply:  Quote the part where Debates over judicial reform, statehood proposals and the Electoral College are  is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.

## Game-design recommendations

- 3 sources required a synthetic dissent skeleton — surface as "the platform did not produce a usable counterpoint; play this scaffold instead" so users do not mistake it for a real X reply.
- Never convert popularity / virality / engagement velocity into point-standing or claim standing.
- Never label users; only annotate text behavior.

## Compliance

- [x] Skill gate validated before any harvest or dissent classification.
- [x] Every body passes through `xaiSourceRedactor.redactRaw` before this report is rendered.
- [x] Hostile bodies were reduced to category placeholders by `convertHostileBody` BEFORE classification.
- [x] No raw X handles, URLs, post IDs, JWTs, Bearer tokens, or API keys in this report.
- [x] No popularity-as-evidence claims in any exhibit.
- [x] No service-role or direct-insert usage in any committed code path.
