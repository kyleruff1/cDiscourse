# AI Argument Intelligence Corpus — 2026-05-17

_Run id_: `2026-05-17T06-54-36-104Z-6786b386`
_Mode_: dry
_Rooms_: 2  ·  _Moves_: 23  ·  _Posted_: 0  ·  _Failed_: 23  ·  _Skipped_: 0
_Annotation sources_: deterministic_fallback=23
_Secrets exposed_: no  ·  _Service-role used_: no  ·  _Production app calls Anthropic_: no (this report is bot-runner dev-only)

## Safety contract

- Every annotation is advisory. `userReviewRequired` is `true` on every row.
- No moderation actions are recommended.
- No verdict tokens about speakers appear in any annotation field (the annotator and fallback both refuse to emit them).
- No demographic / political / religious / health / sexuality / protected-class inferences are made.
- Classification is of OBSERVABLE LANGUAGE only.

## Aggregate distributions

### Annotation source

| Value | Count |
|---|---:|
| `deterministic_fallback` | 23 |

### Message category

| Value | Count |
|---|---:|
| `challenge` | 4 |
| `supporting_claim` | 4 |
| `evidence` | 4 |
| `clarification` | 3 |
| `root_claim` | 2 |
| `counter_challenge` | 2 |
| `concession` | 2 |
| `tangent` | 2 |

### Primary rhetorical archetype

| Value | Count |
|---|---:|
| `unclear` | 9 |
| `receipts_backed_claim` | 4 |
| `evidence_challenger` | 3 |
| `scope_narrower` | 2 |
| `concession_repairer` | 2 |
| `tangent_brancher` | 2 |
| `causal_challenger` | 1 |

### Secondary rhetorical archetype

| Value | Count |
|---|---:|
| `quote_supported_claim` | 6 |

### Qualifier codes

| Value | Count |
|---|---:|
| `unclear_mixed` | 21 |
| `receipts_backed_claim` | 4 |
| `evidence_challenger` | 3 |
| `scope_narrower` | 2 |
| `concession_repairer` | 2 |
| `tangent_or_joke` | 2 |
| `tangent_brancher` | 2 |
| `causal_challenger` | 1 |

### Category codes

| Value | Count |
|---|---:|
| `challenge` | 4 |
| `supporting_claim` | 4 |
| `evidence` | 4 |
| `clarification` | 3 |
| `root_claim` | 2 |
| `counter_challenge` | 2 |
| `concession` | 2 |
| `tangent` | 2 |

### Issue-debt axis

| Value | Count |
|---|---:|
| `none` | 17 |
| `scope` | 2 |
| `evidence` | 2 |
| `fact` | 1 |
| `causal` | 1 |

### Repair suggestion

| Value | Count |
|---|---:|
| `none` | 17 |
| `narrow_scope` | 2 |
| `provide_receipt` | 2 |
| `branch_thread` | 2 |

### Suggested UI nudge

| Value | Count |
|---|---:|
| `nudge:none` | 17 |
| `nudge:ask_for_source` | 4 |
| `nudge:split_tangent` | 2 |

### Suggested qualifier code (game)

| Value | Count |
|---|---:|
| `unclear_mixed` | 21 |
| `tangent_or_joke` | 2 |

### Emotional valence

| Value | Count |
|---|---:|
| `mixed` | 23 |

### Heat level

| Value | Count |
|---|---:|
| `cold` | 23 |

### Submit error codes
_(no entries)_

### Fallback short reasons (top)

| Value | Count |
|---|---:|
| `no_anthropic_client` | 23 |

## Anti-amplification doctrine — aggregates

_Doctrine: popularity / repetition / engagement velocity / political identity are NOT evidence. politicalValence describes the TEXT, not the user. No demographic / party / protected-trait inference. No bot / troll / bad-faith user labels._

- platformSupportWarning=true: **0** / 23 moves

### Top political issue frames

| Value | Count |
|---|---:|
| `non_political` | 23 |

### Top political valence frames

| Value | Count |
|---|---:|
| `unclear` | 23 |

### Evidentiary risk

| Value | Count |
|---|---:|
| `medium` | 13 |
| `low` | 10 |

### Amplification risk

| Value | Count |
|---|---:|
| `none_observed` | 23 |

### Recommended game treatment

| Value | Count |
|---|---:|
| `ask_for_receipt` | 11 |
| `allow_as_opinion_no_factual_credit` | 4 |
| `allow_point_standing_after_evidence` | 4 |
| `ask_for_scope_narrowing` | 2 |
| `suggest_branch_to_context_thread` | 2 |

### Amplification signals fired (counts)
_(no entries)_

### Deterministic rule flags fired (counts)

| Value | Count |
|---|---:|
| `shouldOfferScopeNarrowingForPoliticalGeneralization` | 2 |

### Agreement scalar distribution

| Bucket | Count |
|---|---:|
| `>=0.0` | 23 |
| `>=0.25` | 0 |
| `>=0.5` | 0 |
| `>=0.75` | 0 |

### Disagreement scalar distribution

| Bucket | Count |
|---|---:|
| `>=0.0` | 19 |
| `>=0.25` | 4 |
| `>=0.5` | 0 |
| `>=0.75` | 0 |

### Coexistence scalar distribution

| Bucket | Count |
|---|---:|
| `>=0.0` | 23 |
| `>=0.25` | 0 |
| `>=0.5` | 0 |
| `>=0.75` | 0 |

### Playable-tension distribution

| Bucket | Count |
|---|---:|
| `>=0.0` | 23 |
| `>=0.25` | 0 |
| `>=0.5` | 0 |
| `>=0.75` | 0 |

### Top deterministic rule candidates (top 20)

| Rule name | Count | Condition | UI nudge |
|---|---:|---|---|
| `suggest_narrow_scope_move` | 2 | `disagreementAxis === "scope"` | Narrow the claim to the scope you can defend. |

## Sample moves by interest area

### High-playability moves
_(no samples)_

### Branch candidates (recommended split-thread)

**m12** — tangent_brancher · tangent · source=deterministic_fallback

> [DRY] synthesizer/synthesis on "Pitch clock changed baseball pacing." — slot m12.

_why_: no_anthropic_client

**m10** — tangent_brancher · tangent · source=deterministic_fallback

> [DRY] synthesizer/synthesis on "Bike lanes are better curb space than parking." — slot m10.

_why_: no_anthropic_client

### Concession examples

**m11** — concession_repairer · concession · source=deterministic_fallback

> [DRY] revocateur/concession on "Pitch clock changed baseball pacing." — slot m11.

_why_: no_anthropic_client

**m9** — concession_repairer · concession · source=deterministic_fallback

> [DRY] revocateur/concession on "Bike lanes are better curb space than parking." — slot m9.

_why_: no_anthropic_client

### Unsupported bold-claim possibilities
_(no samples)_

### Receipt requests
_(no samples)_

### Quote-anchor requests
_(no samples)_

### Deterministic fallback examples

**m1** — unclear · root_claim · source=deterministic_fallback

> [DRY] provocateur/thesis on "Pitch clock changed baseball pacing." — slot m1.

_why_: no_anthropic_client

**m2** — evidence_challenger · challenge · source=deterministic_fallback

> [DRY] revocateur/rebuttal on "Pitch clock changed baseball pacing." — slot m2.

_why_: no_anthropic_client

**m3** — unclear · clarification · source=deterministic_fallback

> [DRY] synthesizer/clarification_request on "Pitch clock changed baseball pacing." — slot m3.

_why_: no_anthropic_client

**m4** — unclear · supporting_claim · source=deterministic_fallback

> [DRY] revocateur/claim on "Pitch clock changed baseball pacing." — slot m4.

_why_: no_anthropic_client

**m5** — receipts_backed_claim · evidence · source=deterministic_fallback

> [DRY] provocateur/evidence on "Pitch clock changed baseball pacing." — slot m5.

_why_: no_anthropic_client

**m6** — scope_narrower · counter_challenge · source=deterministic_fallback

> [DRY] provocateur/counter_rebuttal on "Pitch clock changed baseball pacing." — slot m6.

_why_: no_anthropic_client

### platformSupportWarning=true (claim must earn standing via evidence)
_(no samples)_

### Claims that should NOT receive factual standing
_(no samples)_

### Claims that could receive standing AFTER evidence

**m5** — receipts_backed_claim · evidence · source=deterministic_fallback

> [DRY] provocateur/evidence on "Pitch clock changed baseball pacing." — slot m5.

_why_: no_anthropic_client

**m7** — receipts_backed_claim · evidence · source=deterministic_fallback

> [DRY] provocateur/evidence on "Pitch clock changed baseball pacing." — slot m7.

_why_: no_anthropic_client

**m3** — receipts_backed_claim · evidence · source=deterministic_fallback

> [DRY] provocateur/evidence on "Bike lanes are better curb space than parking." — slot m3.

_why_: no_anthropic_client

**m8** — receipts_backed_claim · evidence · source=deterministic_fallback

> [DRY] provocateur/evidence on "Bike lanes are better curb space than parking." — slot m8.

_why_: no_anthropic_client

### Viral / crowd-agreement moves (agreement without evidence)
_(no samples)_

### Political-generalization candidates (offer scope narrowing)

**m6** — scope_narrower · counter_challenge · source=deterministic_fallback

> [DRY] provocateur/counter_rebuttal on "Pitch clock changed baseball pacing." — slot m6.

_why_: no_anthropic_client

**m7** — scope_narrower · counter_challenge · source=deterministic_fallback

> [DRY] provocateur/counter_rebuttal on "Bike lanes are better curb space than parking." — slot m7.

_why_: no_anthropic_client

## Recommendations

- Top suggested qualifierCodes worth promoting to deterministic TS qualifiers: `unclear_mixed` (21×), `tangent_or_joke` (2×).
- Top suggested UI nudges to wire into compose flow: `nudge:none` (17×), `nudge:ask_for_source` (4×), `nudge:split_tangent` (2×).
- Repair suggestions worth surfacing in the responder composer: `none` (17×), `narrow_scope` (2×), `provide_receipt` (2×), `branch_thread` (2×).
- Most-pressured issue-debt axes (candidate columns for Admin Arguments epidemiology table): `none` (17×), `scope` (2×), `evidence` (2×), `fact` (1×).
- Deterministic fallback fired 23 times — review fallback reasons to tighten the Anthropic prompt or schema.
- Most-fired anti-amplification rule flags: `shouldOfferScopeNarrowingForPoliticalGeneralization` (2×) — promote the top 3 to TS rules in `engine.ts` and surface as composer nudges.

## Per-room transcripts

## Room — Pitch clock changed baseball pacing.

- scenarioId: `ai-ai-seed-pitch-clock-baseball-12-711459`
- roomId: `(none)`
- rootClaim: The pitch clock made baseball faster and more watchable.
- moves: 12

### Move 1 — `m1` (thesis/Alex)

- parent: (root)
- messageCategory: `root_claim`
- primaryArchetype: `unclear`
- qualifierCodes: `unclear_mixed`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=0 chainRole=`root` parentResponsive=false branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] provocateur/thesis on "Pitch clock changed baseball pacing." — slot m1.

### Move 2 — `m2` (rebuttal/Jordan)

- parent: `m1` (thesis) — "[DRY] provocateur/thesis on "Pitch clock changed baseball pacing." — slot m1."
- targetExcerpt: ""Pitch clock changed baseball pacing." — slot m1."
- disagreementAxis: `fact`
- messageCategory: `challenge`
- primaryArchetype: `evidence_challenger`
- secondaryArchetypes: `quote_supported_claim`
- qualifierCodes: `unclear_mixed`, `evidence_challenger`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`fact` created=true repaired=false unresolved=true repair=`none`
- game: pressure=true pressureAxis=`fact` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=1 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `disagreement axis = fact`, `target_excerpt set`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `low` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `allow_as_opinion_no_factual_credit`
- antiAmplificationJustification: claim includes or requests checkable evidence.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] revocateur/rebuttal on "Pitch clock changed baseball pacing." — slot m2.

### Move 3 — `m3` (clarification_request/Sam)

- parent: `m2` (rebuttal) — "[DRY] revocateur/rebuttal on "Pitch clock changed baseball pacing." — slot m2."
- messageCategory: `clarification`
- primaryArchetype: `unclear`
- qualifierCodes: `unclear_mixed`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=2 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] synthesizer/clarification_request on "Pitch clock changed baseball pacing." — slot m3.

### Move 4 — `m4` (claim/Jordan)

- parent: `m3` (clarification_request) — "[DRY] synthesizer/clarification_request on "Pitch clock changed baseball pacing." — slot m3."
- messageCategory: `supporting_claim`
- primaryArchetype: `unclear`
- qualifierCodes: `unclear_mixed`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=3 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] revocateur/claim on "Pitch clock changed baseball pacing." — slot m4.

### Move 5 — `m5` (evidence/Alex)

- parent: `m2` (rebuttal) — "[DRY] revocateur/rebuttal on "Pitch clock changed baseball pacing." — slot m2."
- messageCategory: `evidence`
- primaryArchetype: `receipts_backed_claim`
- qualifierCodes: `unclear_mixed`, `receipts_backed_claim`
- opinionVector: bA=0.00 nA=0.00 bD=0.30 nD=0.18 co=0.00 unc=0.00 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.30 co=0.00 primary=`receipt_request` agreementType=`none` disagreementType=`evidence` reply=`ask_source`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.20 uiNudge=`nudge:ask_for_source`
- thread: depth=4 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `attached_evidence present`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `low` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `allow_point_standing_after_evidence`
- antiAmplificationJustification: claim includes or requests checkable evidence.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] provocateur/evidence on "Pitch clock changed baseball pacing." — slot m5.

### Move 6 — `m6` (counter_rebuttal/Alex)

- parent: `m2` (rebuttal) — "[DRY] revocateur/rebuttal on "Pitch clock changed baseball pacing." — slot m2."
- targetExcerpt: ""Pitch clock changed baseball pacing." — slot m2."
- disagreementAxis: `scope`
- messageCategory: `counter_challenge`
- primaryArchetype: `scope_narrower`
- secondaryArchetypes: `quote_supported_claim`
- qualifierCodes: `unclear_mixed`, `scope_narrower`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`scope` created=true repaired=false unresolved=true repair=`narrow_scope`
- game: pressure=true pressureAxis=`scope` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=5 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `disagreement axis = scope`, `target_excerpt set`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `low` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_scope_narrowing`
- antiAmplificationJustification: claim includes or requests checkable evidence.
- ruleFlags: `shouldOfferScopeNarrowingForPoliticalGeneralization`
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] provocateur/counter_rebuttal on "Pitch clock changed baseball pacing." — slot m6.

### Move 7 — `m7` (evidence/Alex)

- parent: `m6` (counter_rebuttal) — "[DRY] provocateur/counter_rebuttal on "Pitch clock changed baseball pacing." — slot m6."
- messageCategory: `evidence`
- primaryArchetype: `receipts_backed_claim`
- qualifierCodes: `unclear_mixed`, `receipts_backed_claim`
- opinionVector: bA=0.00 nA=0.00 bD=0.30 nD=0.18 co=0.00 unc=0.00 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.30 co=0.00 primary=`receipt_request` agreementType=`none` disagreementType=`evidence` reply=`ask_source`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.20 uiNudge=`nudge:ask_for_source`
- thread: depth=6 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `attached_evidence present`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `low` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `allow_point_standing_after_evidence`
- antiAmplificationJustification: claim includes or requests checkable evidence.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] provocateur/evidence on "Pitch clock changed baseball pacing." — slot m7.

### Move 8 — `m8` (rebuttal/Jordan)

- parent: `m5` (evidence) — "[DRY] provocateur/evidence on "Pitch clock changed baseball pacing." — slot m5."
- targetExcerpt: ""Pitch clock changed baseball pacing." — slot m5."
- disagreementAxis: `evidence`
- messageCategory: `challenge`
- primaryArchetype: `evidence_challenger`
- secondaryArchetypes: `quote_supported_claim`
- qualifierCodes: `unclear_mixed`, `evidence_challenger`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`evidence` created=true repaired=false unresolved=true repair=`provide_receipt`
- game: pressure=true pressureAxis=`evidence` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=7 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `disagreement axis = evidence`, `target_excerpt set`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `low` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `allow_as_opinion_no_factual_credit`
- antiAmplificationJustification: claim includes or requests checkable evidence.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] revocateur/rebuttal on "Pitch clock changed baseball pacing." — slot m8.

### Move 9 — `m9` (clarification_request/Jordan)

- parent: `m5` (evidence) — "[DRY] provocateur/evidence on "Pitch clock changed baseball pacing." — slot m5."
- messageCategory: `clarification`
- primaryArchetype: `unclear`
- qualifierCodes: `unclear_mixed`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=8 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] revocateur/clarification_request on "Pitch clock changed baseball pacing." — slot m9.

### Move 10 — `m10` (claim/Alex)

- parent: `m9` (clarification_request) — "[DRY] revocateur/clarification_request on "Pitch clock changed baseball pacing." — slot m9."
- messageCategory: `supporting_claim`
- primaryArchetype: `unclear`
- qualifierCodes: `unclear_mixed`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=9 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] provocateur/claim on "Pitch clock changed baseball pacing." — slot m10.

### Move 11 — `m11` (concession/Jordan)

- parent: `m10` (claim) — "[DRY] provocateur/claim on "Pitch clock changed baseball pacing." — slot m10."
- messageCategory: `concession`
- primaryArchetype: `concession_repairer`
- qualifierCodes: `unclear_mixed`, `concession_repairer`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=true unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=10 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] revocateur/concession on "Pitch clock changed baseball pacing." — slot m11.

### Move 12 — `m12` (synthesis/Sam)

- parent: `m11` (concession) — "[DRY] revocateur/concession on "Pitch clock changed baseball pacing." — slot m11."
- messageCategory: `tangent`
- primaryArchetype: `tangent_brancher`
- qualifierCodes: `tangent_or_joke`, `tangent_brancher`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`joke_or_meme` agreementType=`none` disagreementType=`none` reply=`joke`
- issueDebt: axis=`none` created=false repaired=true unresolved=false repair=`branch_thread`
- game: pressure=false pressureAxis=`none` branchRecommended=true concessionWouldHelp=false playability=0.00 uiNudge=`nudge:split_tangent`
- thread: depth=11 chainRole=`branch` parentResponsive=true branchCandidate=true topicDriftPossible=true
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `suggest_branch_to_context_thread`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] synthesizer/synthesis on "Pitch clock changed baseball pacing." — slot m12.

---

## Room — Bike lanes are better curb space than parking.

- scenarioId: `ai-ai-seed-bike-lanes-curb-11-857589`
- roomId: `(none)`
- rootClaim: Protected bike lanes are a better use of curb space than parking in dense corridors.
- moves: 11

### Move 1 — `m1` (thesis/Alex)

- parent: (root)
- messageCategory: `root_claim`
- primaryArchetype: `unclear`
- qualifierCodes: `unclear_mixed`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=0 chainRole=`root` parentResponsive=false branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] provocateur/thesis on "Bike lanes are better curb space than parking." — slot m1.

### Move 2 — `m2` (rebuttal/Jordan)

- parent: `m1` (thesis) — "[DRY] provocateur/thesis on "Bike lanes are better curb space than parking." — slot m1."
- targetExcerpt: ""Bike lanes are better curb space than parking." — slot"
- disagreementAxis: `causal`
- messageCategory: `challenge`
- primaryArchetype: `causal_challenger`
- secondaryArchetypes: `quote_supported_claim`
- qualifierCodes: `unclear_mixed`, `causal_challenger`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`causal` created=true repaired=false unresolved=true repair=`none`
- game: pressure=true pressureAxis=`causal` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=1 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `disagreement axis = causal`, `target_excerpt set`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `low` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `allow_as_opinion_no_factual_credit`
- antiAmplificationJustification: claim includes or requests checkable evidence.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] revocateur/rebuttal on "Bike lanes are better curb space than parking." — slot m2.

### Move 3 — `m3` (evidence/Alex)

- parent: `m2` (rebuttal) — "[DRY] revocateur/rebuttal on "Bike lanes are better curb space than parking." — slot m2."
- messageCategory: `evidence`
- primaryArchetype: `receipts_backed_claim`
- qualifierCodes: `unclear_mixed`, `receipts_backed_claim`
- opinionVector: bA=0.00 nA=0.00 bD=0.30 nD=0.18 co=0.00 unc=0.00 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.30 co=0.00 primary=`receipt_request` agreementType=`none` disagreementType=`evidence` reply=`ask_source`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.20 uiNudge=`nudge:ask_for_source`
- thread: depth=2 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `attached_evidence present`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `low` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `allow_point_standing_after_evidence`
- antiAmplificationJustification: claim includes or requests checkable evidence.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] provocateur/evidence on "Bike lanes are better curb space than parking." — slot m3.

### Move 4 — `m4` (rebuttal/Jordan)

- parent: `m3` (evidence) — "[DRY] provocateur/evidence on "Bike lanes are better curb space than parking." — slot m3."
- targetExcerpt: ""Bike lanes are better curb space than parking." — slot"
- disagreementAxis: `evidence`
- messageCategory: `challenge`
- primaryArchetype: `evidence_challenger`
- secondaryArchetypes: `quote_supported_claim`
- qualifierCodes: `unclear_mixed`, `evidence_challenger`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`evidence` created=true repaired=false unresolved=true repair=`provide_receipt`
- game: pressure=true pressureAxis=`evidence` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=3 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `disagreement axis = evidence`, `target_excerpt set`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `low` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `allow_as_opinion_no_factual_credit`
- antiAmplificationJustification: claim includes or requests checkable evidence.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] revocateur/rebuttal on "Bike lanes are better curb space than parking." — slot m4.

### Move 5 — `m5` (clarification_request/Sam)

- parent: `m4` (rebuttal) — "[DRY] revocateur/rebuttal on "Bike lanes are better curb space than parking." — slot m4."
- messageCategory: `clarification`
- primaryArchetype: `unclear`
- qualifierCodes: `unclear_mixed`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=4 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] synthesizer/clarification_request on "Bike lanes are better curb space than parking." — slot m5.

### Move 6 — `m6` (claim/Jordan)

- parent: `m5` (clarification_request) — "[DRY] synthesizer/clarification_request on "Bike lanes are better curb space than parking." — slot m5."
- messageCategory: `supporting_claim`
- primaryArchetype: `unclear`
- qualifierCodes: `unclear_mixed`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=5 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] revocateur/claim on "Bike lanes are better curb space than parking." — slot m6.

### Move 7 — `m7` (counter_rebuttal/Alex)

- parent: `m4` (rebuttal) — "[DRY] revocateur/rebuttal on "Bike lanes are better curb space than parking." — slot m4."
- targetExcerpt: ""Bike lanes are better curb space than parking." — slot"
- disagreementAxis: `scope`
- messageCategory: `counter_challenge`
- primaryArchetype: `scope_narrower`
- secondaryArchetypes: `quote_supported_claim`
- qualifierCodes: `unclear_mixed`, `scope_narrower`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`scope` created=true repaired=false unresolved=true repair=`narrow_scope`
- game: pressure=true pressureAxis=`scope` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=6 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `disagreement axis = scope`, `target_excerpt set`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `low` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_scope_narrowing`
- antiAmplificationJustification: claim includes or requests checkable evidence.
- ruleFlags: `shouldOfferScopeNarrowingForPoliticalGeneralization`
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] provocateur/counter_rebuttal on "Bike lanes are better curb space than parking." — slot m7.

### Move 8 — `m8` (evidence/Alex)

- parent: `m7` (counter_rebuttal) — "[DRY] provocateur/counter_rebuttal on "Bike lanes are better curb space than parking." — slot m7."
- messageCategory: `evidence`
- primaryArchetype: `receipts_backed_claim`
- qualifierCodes: `unclear_mixed`, `receipts_backed_claim`
- opinionVector: bA=0.00 nA=0.00 bD=0.30 nD=0.18 co=0.00 unc=0.00 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.30 co=0.00 primary=`receipt_request` agreementType=`none` disagreementType=`evidence` reply=`ask_source`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.20 uiNudge=`nudge:ask_for_source`
- thread: depth=7 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `attached_evidence present`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `low` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `allow_point_standing_after_evidence`
- antiAmplificationJustification: claim includes or requests checkable evidence.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] provocateur/evidence on "Bike lanes are better curb space than parking." — slot m8.

### Move 9 — `m9` (concession/Jordan)

- parent: `m6` (claim) — "[DRY] revocateur/claim on "Bike lanes are better curb space than parking." — slot m6."
- messageCategory: `concession`
- primaryArchetype: `concession_repairer`
- qualifierCodes: `unclear_mixed`, `concession_repairer`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=true unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=8 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] revocateur/concession on "Bike lanes are better curb space than parking." — slot m9.

### Move 10 — `m10` (synthesis/Sam)

- parent: `m9` (concession) — "[DRY] revocateur/concession on "Bike lanes are better curb space than parking." — slot m9."
- messageCategory: `tangent`
- primaryArchetype: `tangent_brancher`
- qualifierCodes: `tangent_or_joke`, `tangent_brancher`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`joke_or_meme` agreementType=`none` disagreementType=`none` reply=`joke`
- issueDebt: axis=`none` created=false repaired=true unresolved=false repair=`branch_thread`
- game: pressure=false pressureAxis=`none` branchRecommended=true concessionWouldHelp=false playability=0.00 uiNudge=`nudge:split_tangent`
- thread: depth=9 chainRole=`branch` parentResponsive=true branchCandidate=true topicDriftPossible=true
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `suggest_branch_to_context_thread`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] synthesizer/synthesis on "Bike lanes are better curb space than parking." — slot m10.

### Move 11 — `m11` (claim/Alex)

- parent: `m5` (clarification_request) — "[DRY] synthesizer/clarification_request on "Bike lanes are better curb space than parking." — slot m5."
- messageCategory: `supporting_claim`
- primaryArchetype: `unclear`
- qualifierCodes: `unclear_mixed`
- opinionVector: bA=0.00 nA=0.00 bD=0.00 nD=0.00 co=0.00 unc=0.50 valence=`mixed` heat=`cold`
- stance: agree=0.00 disagree=0.00 co=0.00 primary=`unclear` agreementType=`none` disagreementType=`none` reply=`unclear`
- issueDebt: axis=`none` created=false repaired=false unresolved=false repair=`none`
- game: pressure=false pressureAxis=`none` branchRecommended=false concessionWouldHelp=false playability=0.00 uiNudge=`nudge:none`
- thread: depth=10 chainRole=`pressure` parentResponsive=true branchCandidate=false topicDriftPossible=false
- why: no_anthropic_client
- features: `few observable signals in body`
- uncertainty: `stance signals were weak; downstream rules should treat this`
- politicalIssueFrame: `non_political` · politicalValence: `unclear`
- amplificationSignals: _(none)_
- evidentiaryRisk: `medium` · amplificationRisk: `none_observed` · platformSupportWarning: false
- recommendedGameTreatment: `ask_for_receipt`
- antiAmplificationJustification: claim is plausible but under-sourced.
- annotationSource: `deterministic_fallback`
- submitStatus: `planned`

Body:

> [DRY] provocateur/claim on "Bike lanes are better curb space than parking." — slot m11.

---

## Secrets check

- [x] No emails, JWTs, or `sb_secret_*` strings (redactor strips them).
- [x] No API key value or `Bearer` header.
- [x] No verdict tokens about speakers (the annotator + fallback refuse to emit them, and any that leak from input bodies are redacted).
- [x] No demographic / protected-class inferences.
- [x] Every annotation carries `userReviewRequired: true`.
