# CDiscourse — Bot Topic Bank

_Stage 6.1.3 — 2026-05-17_

Canonical reference for the spicy bot stress-test topic library.

The topic bank lives at `fixtures/argument-scenarios/topicBank.json`. The stress generator (`scripts/bot-fixtures/generateStressScenarios.js`) loads it, cycles through topics + templates, and renders deterministic fixture JSON files into `fixtures/generated-scenarios/` (gitignored).

## What this is for

The topic bank gives the bots **safe-by-design** debate prompts to argue about. The bots can be sharp, sarcastic, and overconfident, but the topics themselves are intentionally low-stakes so the corpus exercises the argument game without producing harmful content.

## Hard scope rules

The topic bank intentionally avoids:

- Named current politicians or candidates
- Real ongoing public scandals
- Accusations against named private individuals
- Medical / legal / financial advice framed as recommendations
- Protected-class identity attacks
- Sexual content, violence, self-harm, extremist content
- Doxxing, harassment, threats
- High-stakes misinformation

## Categories (8)

| Category | Theme | Example topic |
|---|---|---|
| `animal_taxonomy_weird` | Collective-noun and species hot takes | "A group of magpies should also be called a murder." |
| `sports_hot_takes` | Sport-format / culture takes | "Defense-first teams are more fun than highlight teams." |
| `pop_culture_hot_takes` | Movies / music / media | "Movie trailers should not show third-act footage." |
| `everyday_absurd` | Daily-life hot takes | "Coffee shops should have quiet zones like libraries." |
| `light_civic` | Low-stakes civic | "Council meetings should enforce a 3-minute timer." |
| `technology_everyday` | Tech-in-daily-life | "Read receipts make conversations worse." |
| `food_low_stakes` | Food framing takes | "Tacos are structurally superior to sandwiches." |
| `design_product` | UI/UX takes | "Tabs are overused in product UI." |

Each category currently has **4 topic seeds**, so the bank has **32 topics**. Cycling through 8 categories × 3 templates produces ~24 distinct (topic, template) pairs per seed; 50 generated scenarios cycle through topics with template variation per scenario.

## Topic seed schema

Each topic seed in `topicBank.json` includes:

| Field | Purpose |
|---|---|
| `topicId` | Stable identifier, kebab-case |
| `title` | Short headline |
| `resolution` | Debate-room resolution string (becomes `debates.resolution`) |
| `resolutionKeywords` | 4–5 tokens the topic-satisfaction lexical rail can match |
| `thesisFraming` | Body text the provocateur uses for the root thesis |
| `counterClaims` | 2 pre-written rebuttal stems for the revocateur |
| `evidenceFacts[]` | `{ label, sourceText }` evidence stubs (no URLs) |
| `scopeNarrowings` | 2 narrowing phrases used in concession moves |
| `tangentHooks` | 1+ phrases that mark branch candidates |

The generator deterministically pulls these into `stressScenarioTemplates.js` body renderers, which also weave in spicy phrases from `scripts/bot-fixtures/spicyLanguage.js`.

## Adding a topic

1. Open `fixtures/argument-scenarios/topicBank.json`.
2. Pick a category. Append a topic seed using the schema above.
3. **Pick resolutionKeywords that the topic-satisfaction rail can match.** Use unhyphenated tokens (`teams`, `season`) plus hyphenated multi-word tokens (`play-in`, `late-season`) where they appear as one word in the body. Stop-words (`the`, `for`, `with`, ...) do not count.
4. **Use plain English.** Avoid the forbidden terms list (`liar`, `dishonest`, `bad faith`, `manipulation`, `winner`, `truth`, `ban`, `hide` — note that "hide" and "ban" are flagged as moderation verbs). Use neutral substitutes like "bury" / "block".
5. Run `npm run test -- --testPathPattern=stressGenerator` — the stress validator will report transition issues, concession-marker issues, or forbidden phrases for any generated scenario built off the new topic.
6. Run `npm run bot:fixture:generate-stress` and inspect a sample file in `fixtures/generated-scenarios/`.

## What this is NOT

- Not a list of AI prompts. No LLM calls. Topic seeds are static data.
- Not a set of personal opinions endorsed by the project. Topic seeds are intentionally provocative for **testing**, not for publication.
- Not a final UX taxonomy. Categories may collapse or split as we learn what the rails actually catch.

See also: `docs/bot-fixture-runner.md`, `.claude/skills/bot-provocateur/SKILL.md`, `.claude/skills/bot-revocateur/SKILL.md`.
