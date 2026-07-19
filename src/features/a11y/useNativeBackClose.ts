/**
 * A11Y-PR0-FOLLOW (issue 915) native hardware-back dismissal for inline
 * overlays. The two inline sheets (MarkerPhrasePickerSheet,
 * RequestReviewComposer) are plain Views, not RN Modal, so they have no
 * onRequestClose and the Android back button falls through to app navigation.
 * This hook subscribes to hardwareBackPress while the overlay is open and
 * consumes it (returns true) so back closes the overlay instead of popping the
 * screen. Web is a hard no-op (RN-web BackHandler never fires; the explicit
 * Platform guard keeps it byte-inert and mirrors the useOverlayA11y native
 * no-op invariant). onClose is read through a ref so the subscription is not
 * torn down and rebuilt on every render.
 */
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

export function useNativeBackClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    if (Platform.OS === 'web') return; // hard no-op on web
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true; // consume: prevents default app-exit / screen pop
    });
    return () => sub.remove();
  }, [open]);
}
