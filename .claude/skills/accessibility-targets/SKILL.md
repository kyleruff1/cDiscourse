---
name: accessibility-targets
description: Accessibility requirements for CDiscourse UI work. Invoke for any visible-UI card (most of Epics 1, 2, 4, 5, 7, 8, 9, 11) and especially IX-003 (keyboard/a11y nav). Covers tap targets, screen-reader contract, keyboard nav, color independence, reduce-motion behavior.
---

# Accessibility targets — CDiscourse

## Minimum bar (must pass before card is "done")

1. **Hit target ≥ 44×44** logical pixels on every `Pressable`. Use `hitSlop` if the visual is smaller.
2. **Color is never the only signal.** Shape/stroke/texture carry the meaning. Verify with a grayscale snapshot.
3. **All text inside `<Text>`** — raw strings in `<View>` will crash on native and degrade accessibility on web.
4. **Every interactive element exposes**:
   - `accessibilityRole` (`button`, `link`, `radio`, `checkbox`, `tab`, etc.)
   - `accessibilityLabel` (descriptive — not just the visible text if context matters)
   - `accessibilityState` (`{ selected, disabled, busy, expanded }` as applicable)
   - `accessibilityHint` (optional — only when the result of the action isn't obvious from the label)
5. **Focus order matches reading order** — no `tabIndex` jumping unless you have a deliberate reason.
6. **Reduce motion** — listen to `AccessibilityInfo.isReduceMotionEnabled()` and disable non-essential animations.

## Timeline node accessibility (Epic 2, 3, 8)

Each node `<Pressable>`:

```ts
<Pressable
  accessibilityRole="button"
  accessibilityLabel={
    `${kindLabel} on side ${side === 'for' ? 'For' : 'Against'}, ` +
    `position ${ordinal} of ${totalNodes}, ` +
    `${strengthBandLabel}` +
    `${isActive ? ', currently active' : ''}` +
    `${branchKind !== 'mainline' ? `, on ${branchLabel} branch` : ''}` +
    `${evidenceDebtCount > 0 ? `, ${evidenceDebtCount} unresolved debt${evidenceDebtCount === 1 ? '' : 's'}` : ''}`
  }
  accessibilityState={{ selected: isActive }}
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
/>
```

The label is intentionally verbose because screen-reader users get one shot per element.

## Keyboard navigation (IX-003)

On web (`Platform.OS === 'web'`):
- `Left` / `Right` arrows → previous / next sibling on the active branch
- `Up` / `Down` arrows → parent / first child
- `Home` → root
- `End` → latest move
- `Enter` / `Space` → open popover for the focused node
- `Esc` → close popover, return focus to node
- `Tab` → standard focus order: rail → composer → node list (or whatever the room defines)

On native, none of the above applies — native uses VoiceOver / TalkBack rotor navigation.

## Reduce motion

Animations to disable when `prefersReducedMotion` is true:
- Gradient rail color transitions (snap instead)
- Node scale-on-active (fade instead)
- Popover open/close (snap instead)
- Branch expand/collapse (snap instead)

Keep:
- Scroll inertia (system-controlled)
- Color changes themselves (information, not motion)

## Color contrast targets

Use WCAG AA as the bar:
- Body text: 4.5:1 against background
- Large text (18px+ or 14px bold): 3:1
- Non-text UI components (borders, icons that carry meaning): 3:1

Strength bands need to remain distinguishable in the muted palette:
- "Needs work" muted fill + dashed border MUST still pass 3:1 against the rail background.
- "Strongly supported" glow must NOT trigger a flash hazard (>3 flashes per second is forbidden).

## High-contrast / color-blind mode (PR-001)

The preferences popout exposes:
- `colorAccessibilityMode: 'default' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'high_contrast'`

When set, the visual-token system swaps the color family but **preserves shape/stroke**. Tests verify each mode produces distinguishable nodes.

## Screen-reader announcements for dynamic changes

When a node transitions state (new active, new strength band, new debt), use `AccessibilityInfo.announceForAccessibility(message)` sparingly:

- Yes: "Active move changed to root claim."
- Yes: "Three new replies on the active branch."
- No: announcement on every score recalculation (chatty).
- No: announcement on hover or focus (the role + label do the work).

## Forms and inputs (PR-001, PR-004, composer)

- `TextInput` requires `accessibilityLabel` if there's no visible `<Text>` label nearby.
- Use `accessibilityErrorMessage` (RN 0.74+) for validation errors. If not available, render the error inline with `accessibilityLiveRegion="polite"`.
- For multi-step forms, announce step transitions with `announceForAccessibility`.

## Keyboard hints — platform-conditional pattern (POSTRUN-UX001 / UX-001.4)

Keyboard shortcut hints (key badges like `A`, `I`, `G` on menu triggers) MUST NOT appear as primary UI on phone or tablet. The pattern:

- Key badges render only when `Platform.OS === 'web'` AND `windowWidth >= 1024` (the iPad Pro landscape boundary; corrected per OPS-005 from an earlier draft that used 768). The canonical encoding lives in `expo-rn-patterns` skill §"Keyboard shortcut badge visibility — `{platformOs, windowWidth}` encoding" and in production at `src/features/arguments/oneBox/menuKeyBadgeModel.ts:57-77`.
- On phone, tablet, and all native platforms (`ios` / `android` / `macos` / `windows`), the key badge component renders `null` regardless of width even if the keyboard shortcut is still wired (some hybrid devices have keyboards, but the visual hint is wrong as a primary mobile cue).
- The keyboard shortcut itself remains active on the web build regardless of viewport — only the visual badge is platform-conditional.

Compact controls (chips, badges, key hints) must also pass three accessibility checks during cross-device QA:

1. **Focus visibility** — when keyboard-focused on web, the control has a visible focus ring distinct from its hover or active state.
2. **Touch target size** — at every supported viewport the control meets 44×44 logical pixels, via visual size or `hitSlop`.
3. **Screen-reader name** — the control's `accessibilityLabel` reads naturally without including the keyboard shortcut (the badge is visual-only; screen readers get the action name).

Cross-device QA matrices (e.g., UX-001.6) MUST check all three for every new compact interactive element.

## Testing checklist before claiming a card done

```
- [ ] Grayscale snapshot is still legible (shape carries the meaning)
- [ ] All Pressables have role + label + state
- [ ] All Pressables meet 44×44 hit target (visual or hitSlop)
- [ ] Tab order matches reading order on web
- [ ] Reduce-motion path tested manually OR has an explicit test
- [ ] Keyboard-only path tested on web for any interactive feature
- [ ] VoiceOver / TalkBack tested on native for any new component (or documented as deferred)
```

If a card is shipped before VoiceOver/TalkBack testing happens, file the verification as a follow-up card explicitly. Do not silently skip.
