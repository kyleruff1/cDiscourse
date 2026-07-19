# Overlay screen-reader verification checklist (A11Y-PR0-FOLLOW, issue 915)

RUNTIME-CHECK — operator-assisted. jest cannot reach an on-device screen reader,
so the code deliverable (Item 1 Tab-trap + focus-restore adoption on
`AddAnnotationSheet`, Item 2 native hardware-back hook `useNativeBackClose`,
Item 3 `accessibilityViewIsModal` gap closure on `MarkerPhrasePickerSheet`) ships
jest-verified, and this checklist is what the operator checks off after the
branch is on a device build. The checkboxes are intentionally left UNCHECKED for
the operator to record actual observed behavior.

## How to run

For each overlay: open it, then attempt to reach background content with the
screen-reader cursor and attempt to dismiss.

- iOS: build to a device/simulator, Settings -> Accessibility -> VoiceOver on.
  Open each overlay, single-finger swipe right/left through the elements,
  confirm the cursor cannot land on a background room element while the overlay
  is up. Confirm the dismiss paths.
- Android: Settings -> Accessibility -> TalkBack on. Open each overlay, swipe
  right repeatedly, note whether any background element is announced. Press the
  hardware/gesture Back button and confirm the overlay closes (for #2 and #3 this
  is the new `useNativeBackClose` path).
- Record PASS / PARTIAL / the actual observed behavior per cell. PARTIAL Android
  AVIM cells feed the host-level `importantForAccessibility` follow-up
  (out of scope for this card).

## Expected behavior

| # | Overlay | Container / mechanism | iOS VoiceOver expected | Android TalkBack expected | Hardware/gesture back expected |
|---|---------|-----------------------|------------------------|---------------------------|-------------------------------|
| 1 | `AddAnnotationSheet` | RN `Modal` + AVIM on sheet | Swiping does not escape to background; cursor stays in the sheet | `Modal` isolates; cursor stays in the sheet | Android back closes (via `Modal.onRequestClose`) |
| 2 | `MarkerPhrasePickerSheet` | inline View + AVIM on root overlay + panel + `useNativeBackClose` | Background ignored; cursor stays in the sheet | AVIM weak on Android — background MAY remain reachable (known limitation; record actual) | Android back closes (via `useNativeBackClose`) |
| 3 | `RequestReviewComposer` | inline View + AVIM on root overlay + `useNativeBackClose` | Background ignored; cursor stays in the composer | AVIM weak on Android — record actual reachability | Android back closes (via `useNativeBackClose`) |
| 4 | `PreSendReviewSheet` | inline View + AVIM (root + panel) | Background ignored | Record actual | Back = back-to-editing (record actual) |
| 5 | `oneBox/Popout` | inline View + AVIM (3 refs) | Background ignored | Record actual | Record actual |
| 6 | `ArgumentComposerDock` overlay | inline View + AVIM (2 refs) | Background ignored | Record actual | Record actual |

## Operator sign-off (leave unchecked until the device pass is done)

- [ ] 1. `AddAnnotationSheet` — VoiceOver containment + back verified
- [ ] 2. `MarkerPhrasePickerSheet` — VoiceOver containment + TalkBack reachability recorded + hardware back closes
- [ ] 3. `RequestReviewComposer` — VoiceOver containment + TalkBack reachability recorded + hardware back closes
- [ ] 4. `PreSendReviewSheet` — VoiceOver containment recorded
- [ ] 5. `oneBox/Popout` — VoiceOver containment recorded
- [ ] 6. `ArgumentComposerDock` overlay — VoiceOver containment recorded

## Known limitation (documented follow-up, out of scope here)

`accessibilityViewIsModal` is honored by iOS VoiceOver; on Android it is
effectively a no-op for inline (non-`Modal`) overlays. Full Android TalkBack
containment for an inline overlay would require the host that mounts these
overlays to set `importantForAccessibility="no-hide-descendants"` on the
background siblings — host wiring outside the three files this card touched.
Any PARTIAL Android cells above feed that separate host-level follow-up card.
