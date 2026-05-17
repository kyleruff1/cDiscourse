# xAI Adversarial Corpus — Stage 6.1.9 — 2026-05-17

_Run id_: `2026-05-17T21-57-42-213Z-a3752f08`
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
- Replies classified: 30
- Usable dissent picks: 4
- Synthetic-fallback dissents: 3

## Issue-frame distribution

- `current debatable news topic` — 5

## Disagreement-axis distribution

- `none` — 16
- `scope` — 8
- `fact` — 3
- `evidence` — 3

## Abuse-risk distribution

- `none` — 30

## Amplification-risk distribution

- `none_observed` — 29
- `low` — 1

## Source-chain-risk distribution

- `low` — 24
- `unknown` — 6

## Top deterministic rule candidates

Format: `<disagreementAxis>::<replyFunction>` — count.

- `none::unclear` — 14
- `scope::narrow_scope` — 7
- `fact::rebut` — 3
- `evidence::unclear` — 2
- `none::tangent` — 1
- `scope::ask_source` — 1
- `evidence::ask_source` — 1
- `none::ask_source` — 1

## Platform-support-warning exhibits (redacted)

- (none)

## Source-chain-axis exhibits (redacted)

- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Isn’t debatable? National debt vs GDP, Bond yields, unemployment, tax burden, better off to be on benefits than in work, inflation, illegal migration, private business closures… anyone concerned about the state of the country is labelled far right!
  - reply:  Quote the part where National debt vs GDP, bond yields, unemployment, tax burden, benefits vs work, i is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Cases involving organized crime and cross-border gangs continue fueling heated debates around immigration policy, law enforcement resources, and public safety priorities.
  - reply:  Quote the part where Cases involving organized crime and cross-border gangs continue fueling heated d is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.
- **current debatable news topic** · axis=`source_chain` · dissent=`synthetic_fallback`
  - source: Debates over judicial reform, statehood proposals, and the Electoral College continue to be highly polarizing issues in U.S. politics. Supporters of these ideas argue they strengthen democratic representation, while opponents view them as attempts to reshape long-standing constit
  - reply:  Quote the part where Debates over judicial reform, statehood proposals and the Electoral College cont is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.

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
