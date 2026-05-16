# CDiscourse — Invite Flow

_Stage 6.1.0 — 2026-05-16_

## Current State

**UI and model only.** No email sending, no Supabase migration, no backend invite records in this stage.

The `InvitePanel` component is a placeholder that:
- Accepts email or display name input
- Lets user mark as "planned invite" (local state only)
- Generates a shareable invite text preview
- Shows "Invite sending coming later."

---

## Future Invite Model (not yet migrated)

When the invite backend is implemented, the DB table would be:

```sql
CREATE TABLE argument_room_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id uuid NOT NULL REFERENCES debates(id),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  invitee_email_lower text,
  invitee_profile_id uuid REFERENCES profiles(id),
  role_or_side text NOT NULL DEFAULT 'any',
  status text NOT NULL DEFAULT 'planned',
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  accepted_at timestamptz
);
```

This migration should NOT be created until Stage 6.1.3 or later.

---

## InvitePanel Location

Accessed via the "Invite" chip in the Argument Room toolbar (between Thread/Tracks toggle and the action bar).

The panel appears inline below the toolbar and can be closed.

---

## Security Constraints

- Do NOT expose user search broadly.
- Do NOT use service-role keys in client.
- Do NOT create real users through the invite flow.
- Do NOT send emails in Stage 6.1.0.
- Do NOT log invite text to console in production.

---

## Source Files

- `src/features/invites/inviteTypes.ts`
- `src/features/invites/inviteCopy.ts`
- `src/features/invites/InvitePanel.tsx`
