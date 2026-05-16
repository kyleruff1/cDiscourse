export interface AuthUser {
  id: string;
  email: string | null;
}

export type AuthError =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_already_used'
  | 'weak_password'
  | 'network_error'
  | 'config_missing'
  | 'unknown';

export interface AuthResult<T = void> {
  ok: boolean;
  data?: T;
  error?: AuthError;
  /** Human-readable message safe to show in the UI. */
  message?: string;
}
