# xAI Adversarial Corpus — Stage 6.1.9 — 2026-05-17

_Run id_: `2026-05-17T20-25-03-931Z-f1d70cbf`
_Mode_: dry
_Source mode_: dry_fixture

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
- Replies classified: 60
- Usable dissent picks: 19
- Synthetic-fallback dissents: 0

## Issue-frame distribution

- `election-process` — 1
- `culture-war` — 1
- `sports` — 1
- `tech-platforms` — 1
- `everyday` — 1

## Disagreement-axis distribution

- `none` — 36
- `evidence` — 8
- `scope` — 6
- `definition` — 4
- `source_chain` — 3
- `value` — 2
- `fact` — 1

## Abuse-risk distribution

- `none` — 60

## Amplification-risk distribution

- `none_observed` — 55
- `medium` — 3
- `low` — 2

## Source-chain-risk distribution

- `unknown` — 41
- `medium` — 16
- `high` — 3

## Top deterministic rule candidates

Format: `<disagreementAxis>::<replyFunction>` — count.

- `none::unclear` — 16
- `evidence::ask_source` — 8
- `none::tangent` — 6
- `scope::narrow_scope` — 5
- `none::counterexample` — 5
- `none::ask_quote` — 4
- `definition::ask_definition` — 4
- `none::ask_source` — 3
- `none::support` — 2
- `source_chain::unclear` — 2
- `value::ask_source` — 1
- `source_chain::narrow_scope` — 1

## Platform-support-warning exhibits (redacted)

- **election-process** · axis=`source_chain` · dissent=`xai_x_search`
  - source: Counties with hundreds of drop boxes can't audit chain-of-custody the same way as a single secured site. One box per county lets the elections office actually verify each pickup.
  - reply:  Which audits found chain-of-custody gaps at multi-box counties? Quote the page, not a summary.
- **culture-war** · axis=`fact` · dissent=`xai_x_search`
  - source: Parents asking the school board for a syllabus is not banning a book. The frame 'censorship' is doing the work the actual policy isn't.
  - reply:  Parental rights stops being neutral the moment the policy removes a book from every child's classroom because some parents disagree.
- **tech-platforms** · axis=`source_chain` · dissent=`xai_x_search`
  - source: When a platform optimizes for engagement, the model learns that minority-position posts get fewer interactions and demotes them. The math will keep doing it whether or not the company wants it to.
  - reply:  Quote the part of the platform's transparency report that documents the demotion you're describing.

## Source-chain-axis exhibits (redacted)

- **election-process** · axis=`source_chain` · dissent=`xai_x_search`
  - source: Counties with hundreds of drop boxes can't audit chain-of-custody the same way as a single secured site. One box per county lets the elections office actually verify each pickup.
  - reply:  Which audits found chain-of-custody gaps at multi-box counties? Quote the page, not a summary.
- **sports** · axis=`source_chain` · dissent=`xai_x_search`
  - source: Average game length dropped 24 minutes. Late innings have less standing around. Pacing keeps fans watching to the end.
  - reply:  Quote the specific line where the report attributes the time drop to the clock vs the base change.
- **tech-platforms** · axis=`source_chain` · dissent=`xai_x_search`
  - source: When a platform optimizes for engagement, the model learns that minority-position posts get fewer interactions and demotes them. The math will keep doing it whether or not the company wants it to.
  - reply:  Quote the part of the platform's transparency report that documents the demotion you're describing.

## Game-design recommendations

- Surface a "Where is the primary source?" nudge whenever a reply matches the source_chain axis (corpus shows 3 cases).
- Show the "platform support is not evidence" warning on rooms whose source-chain risk is HIGH (3 cases).
- Never convert popularity / virality / engagement velocity into point-standing or claim standing.
- Never label users; only annotate text behavior.

## Compliance

- [x] Skill gate validated before any harvest or dissent classification.
- [x] Every body passes through `xaiSourceRedactor.redactRaw` before this report is rendered.
- [x] Hostile bodies were reduced to category placeholders by `convertHostileBody` BEFORE classification.
- [x] No raw X handles, URLs, post IDs, JWTs, Bearer tokens, or API keys in this report.
- [x] No popularity-as-evidence claims in any exhibit.
- [x] No service-role or direct-insert usage in any committed code path.
