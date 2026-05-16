import { useContext } from 'react';
import { AppSessionContext } from './AppSessionProvider';

/** Access session state and dispatch from anywhere inside AppSessionProvider. */
export function useAppSession() {
  return useContext(AppSessionContext);
}
