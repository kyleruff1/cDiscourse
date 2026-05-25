/**
 * UX-001.2 — Pure-TS layout helper for the Timeline rail's internal top offset.
 *
 * Sits in the arguments feature folder because it is consumed by
 * `ArgumentTimelineMap.tsx` (the rail's `top` value is read at render time).
 * Has no React, no Supabase, no network imports — it is a single exported
 * record of numeric offsets keyed by `Band` from `useHeaderBreakpoint`.
 *
 * Rationale: the previous `top: 120` literal in `ArgumentTimelineMap.tsx`
 * existed to give the "above-rail" band labels vertical space. UX-001.2
 * repositions the bands to overlay the rail's y-range with
 * `pointerEvents: 'none'`, freeing this offset and unburying the Timeline
 * per the brief's hard cap (200 px wide / 168 px tablet / 128 px phone to
 * the first substantive Timeline artifact).
 *
 * Values are inside the brief's envelope (0-12 phone / 0-12 tablet / 0-16
 * wide). The card's offset arithmetic targets the brief's HARD cap with
 * ~9 px slack on each band (see Q10 in `docs/designs/UX-001.2.md`).
 */
import type { Band } from '../../hooks/useHeaderBreakpoint';

/**
 * UX-001.2 — Band-aware internal top offset for the Timeline rail.
 *
 * The rail's `top` style is computed as
 * `BAND_RAIL_OFFSET[band] + TIMELINE_NODE_SIZE / 2 - 1` so the rail
 * centerline sits at this offset plus half a node radius. With
 * 0/0/0 these values keep the rail's TOP edge at 19 px inside the
 * Timeline frame (rail centerline 21 minus rail thickness/2 = 2).
 *
 * The brief's envelope allows up to 12/12/16; pixel-fitting passes may
 * raise these values, and the source-scan test asserts membership in
 * the envelope rather than equality.
 */
export const BAND_RAIL_OFFSET: Record<Band, number> = {
  phone: 0,
  tablet: 0,
  wide: 0,
};

/**
 * UX-001.2 — Brief envelope for the internal rail offset.
 *
 * Exported so tests can assert `BAND_RAIL_OFFSET[band]` is within
 * `[0, BAND_RAIL_OFFSET_MAX[band]]` instead of pinning a specific value.
 */
export const BAND_RAIL_OFFSET_MAX: Record<Band, number> = {
  phone: 12,
  tablet: 12,
  wide: 16,
};
