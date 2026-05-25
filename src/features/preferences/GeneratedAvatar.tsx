/**
 * PR-004 — back-compat re-export shim.
 *
 * The avatar component moved from `src/features/preferences/GeneratedAvatar.tsx`
 * (PR-001) to `src/features/account/InitialsAvatar.tsx` (PR-004) so the
 * file path signals the avatar is an identity primitive, not a
 * preferences cosmetic. Existing consumers that import from
 * `'./GeneratedAvatar'` (e.g. `PreferencesPopout`) continue to work
 * unchanged via this re-export.
 *
 * New identity-facing consumers should import directly from
 * `'../account/InitialsAvatar'` and use the `InitialsAvatar` alias.
 */
export {
  GeneratedAvatar,
  InitialsAvatar,
  hashAvatarSeed,
  deriveAvatarInitials,
  deriveAvatarColor,
  getAvatarBackgroundPalette,
} from '../account/InitialsAvatar';
