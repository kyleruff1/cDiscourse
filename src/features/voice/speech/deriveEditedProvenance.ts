/**
 * VOICE-003 (issue 661) - submit-time edit provenance derivation.
 *
 * A pure Levenshtein-based comparator between the recognizer raw
 * transcript and the composer submitted body. Returns neutral zeros
 * when the artifact terminal state is anything other than 'final' -
 * the reducer stores no submitted body, and the artifact is the
 * sole source of the raw transcript.
 *
 * NOT Damerau: transposition of two adjacent chars counts as two
 * edits (T-D6). If a future card wants Damerau-Levenshtein, that
 * is a separate ratification.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import type { SpeechTranscriptArtifact } from './speechTranscriptArtifact.types';

export interface EditedProvenance {
  readonly wasEdited: boolean;
  readonly editDistance: number;
  readonly transcriptEditedAfterDictation: boolean;
}

// Classic dynamic-programming Levenshtein with a single rolling row
// for O(min(m, n)) memory. Substitution, insertion, and deletion each
// cost 1; a two-character adjacent swap therefore costs 2.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure b is the shorter string so the rolling row is smaller.
  let source = a;
  let target = b;
  if (source.length < target.length) {
    const swap = source;
    source = target;
    target = swap;
  }

  const m = source.length;
  const n = target.length;
  let prev: number[] = new Array(n + 1);
  let curr: number[] = new Array(n + 1);

  for (let j = 0; j <= n; j += 1) prev[j] = j;

  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    const si = source.charCodeAt(i - 1);
    for (let j = 1; j <= n; j += 1) {
      const cost = si === target.charCodeAt(j - 1) ? 0 : 1;
      // Deletion, insertion, substitution.
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      let min = del < ins ? del : ins;
      if (sub < min) min = sub;
      curr[j] = min;
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[n];
}

/**
 * Derive neutral edit provenance for a submit-time comparison. The
 * returned record is intentionally minimal - not a doctrine signal,
 * not a heat measure. See the source-scan guard for the enumerated
 * ban list of inference-shaped tokens.
 *
 * Contract:
 *   - When artifact.terminalState is anything other than 'final' the
 *     comparison is meaningless (there is no raw transcript to
 *     compare against), so the function returns wasEdited=false,
 *     editDistance=0, transcriptEditedAfterDictation=false regardless
 *     of the submitted body.
 *   - When artifact.terminalState is 'final' and the strings match,
 *     wasEdited=false, editDistance=0, transcriptEditedAfterDictation=false.
 *   - Otherwise wasEdited=true, editDistance=levenshtein(...),
 *     transcriptEditedAfterDictation=true.
 *
 * The empty-rawTranscript branch is defensively covered even though
 * it is unreachable under the reducer invariants (T-D7): rawTranscript
 * is empty only when hadFinalEvent is false, and hadFinalEvent is
 * false only when terminalState is not 'final'.
 */
export function deriveEditedProvenance(
  artifact: SpeechTranscriptArtifact,
  submittedBody: string,
): EditedProvenance {
  if (artifact.terminalState !== 'final') {
    return { wasEdited: false, editDistance: 0, transcriptEditedAfterDictation: false };
  }
  const raw = artifact.rawTranscript;
  const distance = levenshtein(raw, submittedBody);
  const wasEdited = distance > 0;
  return {
    wasEdited,
    editDistance: distance,
    transcriptEditedAfterDictation: wasEdited,
  };
}
