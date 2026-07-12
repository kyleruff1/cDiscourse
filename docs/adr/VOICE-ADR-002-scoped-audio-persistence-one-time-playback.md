# VOICE-ADR-002 — Scoped audio persistence, one-time playback

**Status:** Proposed — ratified on operator merge of this PR
**Date:** 2026-07-12
**Deciders:** operator (kyleruff@gmail.com)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/863 (ASP-ADR-001)
**Supersedes:** VOICE-ADR-001 in part (sections: No-audio posture; Data-classification rows 'Raw audio' and 'Local audio URI')
**Package:** `12_SECURITY_PRIVACY_AND_ADR_PLAN.md` (§A outline, §B decision checklist, §C risk register); `08_VOICE_S3_AND_TRANSCRIPTION_PLAN.md` §15 (explicit ADR-001 comparison)
**Binds:** every ASP voice card downstream (VOICE-DB/BE/UI-*, one-time-playback, markers-on-voice, MCP Family K, VOICE-STT-001, SEC-VOICE-004, native/AUDIO cards); each card's doctrine self-check cites THIS file as the durable contract.

> This ADR is the operator-ratified gate for all voice-persistence work. The shipped, Accepted VOICE-ADR-001 forbids storing, uploading, replaying, or UI-exposing raw audio; nothing voice-persistent may ship until THIS ADR is ratified. It is DOCS-ONLY — it introduces no code, install, config-plugin edit, migration, bucket, Edge Function, or mcp-server change. Ratification mechanic: the operator's merge of this PR is the ratification signature.

---

## §0 Status & relationship to VOICE-ADR-001

This ADR **supersedes VOICE-ADR-001 in part only** — specifically its **§ No-audio v1 privacy posture** and exactly two rows of its **§ Data classification table**: **'Raw audio (PCM / recording)'** and **'Local audio URI'**. Everything else in VOICE-ADR-001 remains in force. VOICE-ADR-001's own file is edited by a single status-header line and is otherwise untouched (append-only doc discipline).

This ADR **binds every ASP voice card**. Each downstream card (VOICE-DB/BE/UI-*, one-time-playback, markers-on-voice, MCP Family K, VOICE-STT-001, SEC-VOICE-004, native/AUDIO) carries a doctrine self-check that **cites THIS file** as the durable contract; a card that violates any section here is not mergeable.

### Carried forward VERBATIM from VOICE-ADR-001

The following clauses from VOICE-ADR-001 are **carried forward unchanged** and remain binding under this ADR. They are re-quoted in full so this ADR is self-contained; the source section in VOICE-ADR-001 is named above each block. (Reviewers may diff these blocks byte-for-byte against VOICE-ADR-001.)

**From VOICE-ADR-001 § Acceptance-gate invariant (VERBATIM):**

> "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine is the sole gate. Speech recognition, waveform rendering, transcript metadata, voice artifacts, and MCP Family K run only as composition aids or post-storage observations. No path may block, reject, route, delay, or penalize an ordinary user post."

**From VOICE-ADR-001 § Text fallback (VERBATIM):**

> A **text-only fallback exists for every argument entry window.** Each of the following degrades to a working text box and **NEVER blocks text posting**:
>
> - permission denial
> - recognizer unavailable (device / browser / platform)
> - speech error mid-session
> - waveform unavailable
> - snapshot / image export unavailable
>
> When voice is unofferable the adapter renders no Speak button (or a disabled one with a plain-language hint) and the user simply types. Every terminal and error state in the speech session machine keeps the keyboard path alive.

**From VOICE-ADR-001 § Forbidden inference list (VERBATIM — includes the `recognitionConfidence` wording patch):**

> No part of the speech-first stack — UI, model, artifact, persistence, or MCP — may detect, infer, score, label, or expose any of:
>
> - emotion detection
> - tone judgment
> - voice stress
> - anger
> - confidence as a speaker / person trait
> - honesty / sincerity
> - manipulation-by-voice
> - biometric inference
> - speaker identity
> - credibility
> - intent
> - truth (no truth value on any claim)
> - winner / loser / verdict
> - public-person accusation (mark the POINT, never the PERSON)
>
> **Wording patch (binding):** if speech-to-text confidence is ever surfaced, it MUST be named **`recognitionConfidence` / `recognizerConfidence`** — *never* "speaker confidence" (which reads as a person-trait inference and is forbidden above). Such a value is **non-user-facing unless separately ratified** by a later card, and v1 should **prefer deferring confidence entirely**. The boundary is: recognizer accuracy is a property of the *software*, never of the *person speaking*.

**From VOICE-ADR-001 § Transcript ownership (VERBATIM — the fourth bullet's interim-transcript locality clause is the interim-transcript locality carry-forward):**

> The user owns the submitted text.
>
> - The **interim** transcript is display-only. It lives in the adapter's own chrome and **never enters the submitted body** — a half-recognized phrase can never be submitted.
> - The **final** transcript may be inserted into the existing editable composer body **ONLY via the same path as typed input** (`handleBodyChange` → `updateField({ body })`). It never bypasses the keyboard write path; the engine, draft persistence, char-count, and validation panel behave identically whether text arrived by thumb or by voice.
> - The user **may edit** the text before posting, with full keyboard parity.
> - The app **may record `wasEdited` / `editDistance` as NEUTRAL provenance** (text arrived, then was corrected). These are never credibility, honesty, or sincerity signals, and no downstream consumer (including Family K) may interpret them as such.

The **interim-transcript locality clause** (the first bullet above) is called out per the outline: the interim transcript is display-only, lives in the adapter's own chrome, and never enters the submitted body — a half-recognized phrase can never be submitted. This remains true under audio persistence: persistence changes what happens to the *audio object*, never how transcript text reaches the body.

**From VOICE-ADR-001 § MCP Family K boundaries — MAY / MAY NOT lists (VERBATIM):**

> **Family K MAY consume:**
>
> - submitted text (same text path as every existing family)
> - post-store speech provenance metadata
> - user-edited-after-speech boolean (`transcript_was_edited`)
> - edit-distance summary
> - recognizer availability / errors
> - duration
> - locale / language
> - bounded amplitude summary
> - text-fallback-used flag
>
> **Family K MAY NOT consume:**
>
> - raw audio
> - a local audio URI
> - any playable file
> - a waveform image that includes user text
> - emotion / identity / speaker-state / truth / credibility / intent features (the entire § Forbidden inference list)

Under this ADR the audio object now exists, but **Family K still never receives a URL, a storage key, a playable file, or audio bytes** — the MAY / MAY NOT boundary above is unchanged.

---

## §1 Decision

Voice argument entries are stored as **governed artifacts**. The **edited transcript is the argument body and passes the unchanged deterministic gate** — the same `submit-argument` path, byte-unchanged, gating the TEXT exactly as it gates typed input today. The **audio is a linked, consent-gated, retention-bounded object**, playable **once per eligible listener** by default, author-saveable, and **hard-deleted from storage** on lifecycle triggers.

**Voice is available in private 1:1 rooms only at launch** (D4). Circle rooms and public rooms are excluded at launch and deferred to the §5 revisit. The audio never gates a post; it is a linked object, never an acceptance dependency. The deterministic rules engine remains the sole submission gate (carried-forward Acceptance-gate invariant, §0).

---

## §2 Consent model (Q1)

- **Author consent (first-record sheet, per-user + versioned).** A `voice_consent_version` gates recording; a version bump re-prompts. The sheet discloses, in plain language:
  - the audio is stored until it is played, expires (**3 days unplayed**, D6), or is deleted;
  - **one-listen default** — each eligible listener may hear it once;
  - the author may **save** the recording, which re-opens playback (§4);
  - listeners are **identified to the author** via play receipts (legibility, not surveillance — the room already shows who is present);
  - **transcripts and timing metadata persist after the audio is deleted**;
  - **the app deletes the audio but cannot prevent screen or mic re-recording** (the analog hole — §6);
  - a **report can pause deletion** for moderation review (§7);
  - the retention numbers are stated up front (D6): **3-day unplayed expiry · 12-hour post-consume grace · 7-day moderation hold · 5-minute playback session · 60-second recording cap**.
- **Research / analysis scope (D7).** v1 collects **rendering / navigation-only timing metadata** — word timings, segment boundaries, amplitude bins — **stored, not scored**. If timing-structure *analysis* (pauses, words-per-minute as a studied signal) is ever intended, it is **named in the consent sheet or not collected**; that is a future consent-version bump. **Disclose-or-don't-collect.**
- **Listener side.** The playback gate confirm — "This plays once. Ready?" — is the listener's informed consumption. Receipts are disclosed in-room.
- **Recording-party law.** Voice entries are **self-recordings the author deliberately authors** (voice-memo model), not interception of another party; two-party-consent statutes do not attach. Minors: existing ToS age floor; revisited at public-mode.
- **Legal basis (GDPR / BIPA note).** Stored voice is biometric-adjacent; the lawful basis is **consent**, and the **one-listen + deletion-by-default minimization posture is the data-minimization argument** that makes storage defensible. No identity, affect, or credibility inference is ever performed (the carried-forward § Forbidden inference list, §0).

---

## §3 One-time playback (Q2)

Playback is **server-enforced**, never client-enforced. The storage bucket is private with deny-all client policies; **only Edge Functions mint signed URLs** (in either direction). The lock is an **ordering guarantee**:

- The receipt **`UNIQUE(recording_id, listener_id)` INSERT precedes the URL mint — fail-closed** (D3). A crash between the two costs the listener a listen (recoverable via the `abandoned` play-state + an admin re-issue path) rather than ever granting a free replay.
- **"Once" = one receipt-gated session** (D3). Inside the session the listener may **scrub and replay**; a dropped session **resumes on the same receipt** inside the window.
- **The session window length is 5 minutes** (D6). D3 defines the *semantics* of a session; D6 sets the *number*. **The 5-minute window supersedes the package's ~10-minute exemplar.**
- **Author replay is non-consuming** ("your copy") — a `consuming=false` receipt; the author never spends a listener's listen.
- **Eligibility = current room participants minus the author** (D4), scoped to **private 1:1 rooms** at launch.

---

## §4 Saved-recording exception (Q8)

- **Author-only.** A `Keep` action moves the recording to a saved state and **cancels its deletion job**; the once-gate is bypassed for eligible room members while saved.
- The save confirm states explicitly that the recording becomes **replayable by everyone in the room, repeatedly, until the author deletes it**.
- **Save-after-consume re-opens playback for people who already used their listen** — the confirm sheet says exactly that.
- **Reversible:** an author `delete-now` schedules immediate deletion.
- An **opponent can never preserve the author's audio** — only the author saves.
- Saved recordings **follow the current room ACL** through visibility transitions; receipts keep logging (play-log, not lock).

---

## §5 Public / private implications (Q4)

- **Launch: voice is available in private 1:1 rooms only** (D4). **Circle rooms are excluded at launch**, and **public rooms are off at launch**.
- Circles and public rooms join a single **§5 revisit list** (the Phase-8 revisit). The **constraints are pre-recorded now** so the revisit is a decision, not a rediscovery: **unbounded / many eligible listeners make one-listen incoherent** — with a large or open-ended listener set there is no coherent "each listener hears it once," and no safe moment to delete the object. Revisit options for both circles and public: **saved-only** (drop the once-gate; everyone replays) or **transcript-only** (no audio object at all).
- One-way public→private: recordings follow the room; any issued receipts stand.

---

## §6 Deletion guarantees and honest limits (Q6)

The storage lane is **AWS S3 from day one** (D2): SSE-S3 encryption, **versioning OFF** (versioning would silently defeat deletion), `Cache-Control: private, no-store` on every object, a **30-day lifecycle rule as a deletion backstop**, and **bucket-owner-enforced ACLs**. The **4-function provider adapter** — `createSignedUploadUrl` / `createSignedPlaybackUrl` / `deleteObject` / `headObject` — is **implemented over S3**; Supabase Storage is the config swap.

**Guaranteed:**
- the storage object is removed and the removal is **HEAD-verified** (`headObject` confirms the key is gone before the row is tombstoned);
- **new playback is impossible after deletion** — no receipt can mint a URL for a removed key;
- tombstoned rows carry **no audio bytes and no signed URL**;
- every mint / consume / save / delete writes an `admin_audit_events` row (§11).

**Not guaranteed (honest limits):**
- **in-flight sessions may finish** — a session already holding a valid short-TTL URL can complete;
- **CDN / edge caches expire on their TTL** — mitigated by `Cache-Control: private, no-store` on every object, so no shared cache retains it;
- **AWS backup / purge runs on the provider's schedule** — **SEC-VOICE-004 confirms AWS backup and purge behavior on the chosen plan tier BEFORE any Phase-6 copy freezes**, so consent copy never overpromises;
- **screen / mic re-recording is not preventable** (the analog hole) — no DRM theater.

**Copy rule:** never promise more than **"the app deletes it."**

**Tombstone exception (stated deliberately).** **DB rows always tombstone; only storage objects hard-delete.** This is the **one deliberate exception** to the soft-delete-everywhere house convention: the recording row persists (tombstoned, audio-free) while the S3 object is genuinely removed. The waveform peaks, transcript segments, and markers are **untouched** by deletion — they are the durable trace.

---

## §7 Moderation & abuse (Q3)

- A **report sets `moderation_hold=true`, which pauses deletion jobs** for the recording so the audio survives long enough to be reviewed.
- The **transcript always persists** for review, regardless of hold.
- Moderators get a **review-scoped, audited, non-consuming** playback path (a `consuming=false` receipt; every access is logged).
- **Holds auto-expire after 7 days** (D6), releasing the deletion job.
- **Per-user / day recording caps** apply; harassment-by-voice inherits the existing flags pipeline (flags are never deleted, only dismissed).
- Author cooldowns are **moderator actions, never automatic content removal.** Consistent with the AI-moderation hard limits: the moderator never deletes, hides, or modifies content automatically, and never assigns a truth value to a claim.

---

## §8 Transcript accuracy & correction (Q7)

- The **body** (the user-edited text at post time) is **authoritative** — "their words as posted" — and is **immutable like every argument body**.
- STT **`transcript_segments` are navigation metadata**, labeled "transcript," not the authoritative record. Segments are produced by the D5 provider (**Deepgram nova-3**, confirmed by the VOICE-STT-001 10-clip bake-off; key in Edge secrets only, spend operator-armed).
- **Correction = a segment re-run, never a body mutation.** Re-running STT rewrites segments; it never touches the posted body.
- **Markers snapshot `quoted_text` at creation** so a later segment re-run can never rewrite what a rebuttal quoted.

---

## §9 Timestamp-quote misrepresentation (Q5)

- A marker chip **always deep-links the full transcript**; `quoted_text` is snapshotted verbatim.
- The viewer shows **±1 segment of surrounding context** so a quote cannot be framed by cropping.
- Markers are **answerable like any other move** (symmetrical rebuttal).
- **Residual clip-framing risk is accepted and documented** — it is the same class as text quote-cropping, which the platform already tolerates.

---

## §10 User controls

- **Author:** record / re-record / trim / edit-transcript before posting · save / unsave · delete-now · see listen receipts · the existing argument-deletion request path (deleting the argument hard-schedules the audio).
- **Listener:** play once, knowingly · resume a dropped session · read the transcript after expiry · report.
- **Everyone:** the **text path is available everywhere, always** (the carried-forward § Text fallback guarantee, §0).

---

## §11 Audit logs

`admin_audit_events` rows are written for: recording created / activated; URL minted (records the **receipt id, never the URL**); receipt consumed / abandoned; saved / unsaved; deletion scheduled / executed / verified / failed; moderation hold set / released; transcript job outcomes.

**Never logged:** audio bytes, signed URLs, full storage keys, or transcript text in audit payloads. (House Edge-logging rules apply — no Authorization header, no signed URL, no key.)

---

## §12 Enforcement checklist (reviewers verify per card)

- Byte-unchanged submit gate (flag-off proof)
- Bucket client-read probe denied
- Receipt-before-URL order
- Race test (2 mints → 1 receipt)
- HEAD-verified deletion
- No affect / emotion feature anywhere (source-scan)
- Consent version gate
- Text fallback in every entry window
- Family K payload schema contains no URL / audio field

---

## Operator decision checklist (D1–D8) — ratified values

Per the card's acceptance, the operator's D1–D8 rulings (2026-07-12) are embedded here. Three rulings **deviate from the package recommendation** and are flagged.

| # | Decision | Operator ruling (2026-07-12) | Package recommendation | Deviation |
|---|---|---|---|---|
| **D1** | Store raw audio at all? (THE decision) | **YES, scoped** — consent-gated storage, one-listen default, author-save exception, hard deletion on lifecycle triggers; the **minimization posture is the defensibility argument**. | YES, scoped | matches |
| **D2** | Storage lane | **AWS S3 from day one** — SSE-S3, versioning OFF, `Cache-Control: private, no-store`, 30-day lifecycle backstop, bucket-owner-enforced ACLs; the 4-fn provider adapter (`createSignedUploadUrl` / `createSignedPlaybackUrl` / `deleteObject` / `headObject`) is implemented over S3; **Supabase Storage is the config swap**; AWS keys live in **Supabase Edge secrets only** (new credential surface, operator-provisioned when the VOICE-DB/BE cards start); **SEC-VOICE-004 confirms AWS backup / purge behavior BEFORE the Phase-6 copy freezes**. | Supabase Storage private bucket; S3 a config swap | **DEVIATION** — S3 is primary from day one; Supabase Storage becomes the swap |
| **D3** | What "once" means | **One receipt-gated session** — receipt `UNIQUE(recording_id, listener_id)` INSERT precedes the URL mint (fail-closed); scrub / replay inside the window; resume on drop; author replay non-consuming. The **session window length comes from D6 (5 minutes)**: D3 defines the semantics, D6 sets the number, and **5 min supersedes the package's ~10-min exemplar**. | One receipt-gated session (~10 min) | window number set by D6 |
| **D4** | Who can play; public rooms | **Private 1:1 rooms only at launch** — eligible listeners = current room participants minus the author; **circle rooms excluded at launch** and joining public rooms on the §5 revisit list. | Participants minus author; public voice off | **DEVIATION** — tighter: 1:1 only; circles deferred with public |
| **D5** | STT provider | **Deepgram nova-3** (word timestamps, ~$0.26/audio-hr); the VOICE-STT-001 10-clip bake-off confirms before the lane hardens; key in Edge secrets only; operator-armed spend. | Deepgram (bake-off decides) | matches |
| **D6** | Retention numbers | **3d unplayed expiry · 12h post-consume grace · 7d moderation hold · 5-min playback session · 60s recording cap.** | 7d · 24h · 14d · 10-min · 120s | **DEVIATION** — tighter set across all five numbers |
| **D7** | Consent / research scope | **Rendering-only timing metadata in v1** (stored-not-scored); research use of timing structure = a named disclosure in a future consent-version bump. **Disclose-or-don't-collect.** | Rendering-only in v1; research = consent bump | matches |
| **D8** | Fixture exclusion on Home | **Fixture / bot rooms excluded from user-facing Home** (records the shipped HOME-001 reality); the admin reveal toggle is default-OFF. | Ships Phase 1 (HOME-001 AC); admin toggle default-off | matches |

**Three deviations from the package recommendation:** **D2** (AWS S3 from day one), **D4** (private 1:1 rooms only), **D6** (tighter retention numbers).

**Ratification mechanic:** merge of this ADR's PR is the operator's ratification signature (`docs/voice-adr-002` → `feat/voice-adr-002`). This table records the operator's chosen values.

---

## Consequences

- Every downstream ASP voice card (VOICE-DB/BE/UI-*, one-time-playback, markers-on-voice, MCP Family K, VOICE-STT-001, SEC-VOICE-004, native/AUDIO) carries a doctrine self-check that cites THIS file; a card that violates any section above is not mergeable.
- The storage, STT, Edge, and native-build costs stay isolated in their GATE-C cards; none precedes the design.
- The privacy posture is auditable: private bucket with deny-all client policies, receipt-before-URL fail-closed ordering, HEAD-verified deletion, `no-store` object headers, no affect / identity / credibility inference anywhere (source-scan), and the enforcement checklist (§12) verified per card.
- ADR-001 receives only a status-header line (`Superseded in part by VOICE-ADR-002` — sections: No-audio posture; Data-classification rows 'Raw audio' and 'Local audio URI'); its text is otherwise unedited (append-only doc discipline). The ~10 downstream VOICE / MCP-K / AUDIO cards cite VOICE-ADR-002 thereafter.
