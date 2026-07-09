/**
 * PROOF-002 (#889) — frozen user-facing copy for the source drawer.
 *
 * COPY LAW (cdiscourse-doctrine section 1 + section 9 + the ROOM-003 precedent):
 * every user-facing string says Source / Receipts / Sources. The token proof is
 * FORBIDDEN in any rendered string (the shipped ban-list treats proof / proven /
 * validated as truth verdicts, and evidence is not the same as proof). Component
 * names, file names, type names (ProofDrawer, ProofChip, proof_items) are
 * internal and exempt. proofDrawerCopyBanList.test.ts scans THIS object for the
 * box-copy tokens AND the verdict ban-list, each with a firing negative control.
 *
 * Pure TS. No React, no Supabase, no network. Comments are apostrophe-free for
 * scanner safety (the uxOneOneTwoDoctrine quote-parity gotcha); copy STRINGS may
 * carry apostrophes.
 */
import type { ProofDrawerKind } from './proofDrawerModel';

export const PROOF_DRAWER_COPY = Object.freeze({
  /** Drawer title. */
  title: 'Add a source',
  /** Grid intro line above the kind tiles. */
  gridIntro: 'What are you backing this with?',
  /** Header above the list of already-attached sources. */
  attachedHeader: 'Sources on this move',
  /** Primary attach button. */
  attachButton: 'Attach source',
  /** Dismiss button (keeps the drawer open for fast multi-attach until pressed). */
  doneButton: 'Done',
  /** Owed marker shown on the composer Source slot when a source is owed. */
  owedMarker: 'Source owed',
  /** Detach affordance on an own attached source. */
  detachLabel: 'Remove source',
  /** Inline error fallback for an unmapped error code. */
  errorFallback: "Couldn't attach that source — try again.",
  /** Accessibility label for the drawer root. */
  drawerA11yLabel: 'Add a source to this move',
  /** Accessibility label for the close control. */
  closeA11yLabel: 'Close the source drawer',
  /** Per-kind tile label (COPY LAW: no proof token). */
  kindLabel: Object.freeze<Record<ProofDrawerKind, string>>({
    url: 'Link',
    quote: 'Quote',
    source_text: 'Source text',
    note: 'Note',
    prior_move: 'Earlier point',
    external_ref: 'Reference',
  }),
  /** Per-kind one-line helper. */
  kindHelper: Object.freeze<Record<ProofDrawerKind, string>>({
    url: 'Paste a link to where this comes from.',
    quote: 'Quote the exact passage you are leaning on.',
    source_text: 'Paste the relevant excerpt of the source.',
    note: 'Add a short note about the source.',
    prior_move: 'Point back to an earlier move in this room.',
    external_ref: 'Reference an external source by link.',
  }),
  /** Per-kind input placeholder. */
  kindPlaceholder: Object.freeze<Record<ProofDrawerKind, string>>({
    url: 'https://…',
    quote: 'The exact words you are quoting…',
    source_text: 'Paste the source excerpt…',
    note: 'A short note about the source…',
    prior_move: 'Pick an earlier move…',
    external_ref: 'https://…',
  }),
});

/** Plain-language messages for the reconciled attach-proof error codes. */
export const ATTACH_ERROR_COPY = Object.freeze<Record<string, string>>({
  unauthorized: 'Sign in to add a source.',
  not_a_participant: 'Join this room to add a source.',
  not_your_move: 'You can only add sources to your own moves.',
  kind_not_supported: 'That kind of source is not available yet.',
  validation_failed: 'That source is missing something — check the field and try again.',
  debate_argument_mismatch: 'That move is not in this room.',
  argument_not_found: 'We could not find that move.',
  claim_not_found: 'We could not find the point that source answers.',
  referenced_argument_not_found: 'We could not find that earlier point.',
  proof_cap_reached: 'This move already has the most sources it can hold.',
  proof_not_found: 'We could not find that source.',
  not_your_proof: 'You can only remove a source you added.',
  network_error: "We could not reach the server — try again.",
});
