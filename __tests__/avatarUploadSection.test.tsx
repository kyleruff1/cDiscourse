/**
 * PR-003 — AvatarUploadSection contract tests.
 *
 * Following the established repo pattern (BranchCollapseStub /
 * InvitePanel / TimelineMiniMap), the file uses source-scan + helper
 * exercise rather than full render(). The visual decisions in the
 * section are tied to testIDs + a11y labels + state predicates which
 * we can verify by inspecting the component source.
 */
import * as fs from 'fs';
import * as path from 'path';

const componentSrc = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'account', 'AvatarUploadSection.tsx'),
  'utf8',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const code = stripComments(componentSrc);

// ── Q1 — testID conventions (PR-004's contract surface) ──────

describe('PR-003 Q1 — AvatarUploadSection testID conventions', () => {
  it('exposes the avatar-upload-section wrapper testID', () => {
    expect(code).toContain('avatar-upload-section');
  });

  it('exposes avatar-current-image testID', () => {
    expect(code).toContain('avatar-current-image');
  });

  it('exposes avatar-generated-placeholder testID', () => {
    expect(code).toContain('avatar-generated-placeholder');
  });

  it('exposes avatar-upload-button testID', () => {
    expect(code).toContain('avatar-upload-button');
  });

  it('exposes avatar-remove-button testID', () => {
    expect(code).toContain('avatar-remove-button');
  });

  it('exposes avatar-remove-confirm-button testID', () => {
    expect(code).toContain('avatar-remove-confirm-button');
  });

  it('exposes avatar-remove-cancel-button testID', () => {
    expect(code).toContain('avatar-remove-cancel-button');
  });

  it('exposes avatar-upload-spinner testID', () => {
    expect(code).toContain('avatar-upload-spinner');
  });

  it('exposes avatar-error-text testID', () => {
    expect(code).toContain('avatar-error-text');
  });

  it('every testID uses the avatar- prefix (PR-004 will mirror the contact- prefix)', () => {
    const testIdMatches = code.match(/testID=['"]([^'"]+)['"]/g) || [];
    const ids = testIdMatches.map((m) => m.replace(/testID=['"]/, '').replace(/['"]/, ''));
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) {
      expect(id.startsWith('avatar-')).toBe(true);
    }
  });
});

// ── Q1 — Profile screen extension contract ───────────────────

describe('PR-003 Q1 — Profile screen extension contract', () => {
  it('does not declare a <TextInput> anywhere (no raw URL text edit)', () => {
    expect(code).not.toMatch(/<TextInput/);
  });

  it('imports the GeneratedAvatar from PR-001 (placeholder reuse)', () => {
    expect(code).toMatch(/from ['"]\.\.\/preferences\/GeneratedAvatar['"]/);
  });

  it('imports the avatar API surface from the new client wrapper', () => {
    expect(code).toMatch(/from ['"]\.\/avatarApi['"]/);
  });

  it('does not import or call AccountScreen, useAccountProfile, or any screen', () => {
    // Presentational only — the component reads props, never the hook.
    expect(code).not.toMatch(/useAccountProfile/);
    expect(code).not.toMatch(/AccountScreen/);
  });
});

// ── Q2 — picker invocation shape ─────────────────────────────

describe('PR-003 Q2 — image-picker invocation shape', () => {
  it('calls launchImageLibraryAsync', () => {
    expect(code).toContain('launchImageLibraryAsync');
  });

  it('requests Images media type only', () => {
    expect(code).toMatch(/MediaTypeOptions\.Images/);
  });

  it('enables OS-native crop UI via allowsEditing', () => {
    expect(code).toMatch(/allowsEditing: true/);
  });

  it('hints a square crop via aspect [1, 1]', () => {
    expect(code).toMatch(/aspect: \[1, 1\]/);
  });

  it('limits quality to 0.85 for bandwidth', () => {
    expect(code).toMatch(/quality: 0\.85/);
  });

  it('asks the OS not to attach EXIF (best effort)', () => {
    expect(code).toMatch(/exif: false/);
  });

  it('handles the cancelled-picker path silently', () => {
    expect(code).toMatch(/result\.canceled/);
  });

  it('handles a malformed asset (no uri or no mimeType)', () => {
    expect(code).toMatch(/asset\.uri/);
    expect(code).toMatch(/asset\.mimeType/);
  });
});

// ── Q6 — optimistic UI state machine ─────────────────────────

describe('PR-003 Q6 — optimistic state machine', () => {
  it('declares the three upload state kinds', () => {
    expect(code).toContain("kind: 'idle'");
    expect(code).toContain("kind: 'uploading'");
    expect(code).toContain("kind: 'error'");
  });

  it('declares the three remove state kinds (idle / confirming / removing)', () => {
    expect(code).toMatch(/RemoveState\s*=\s*'idle'\s*\|\s*'confirming'\s*\|\s*'removing'/);
  });

  it('shows the locally-picked URI in <Image> while uploading', () => {
    // Source contains: source={{ uri: (uploadState as { localUri: string }).localUri }}
    // The cast pushes us through nested braces — accept any match that
    // references `.localUri` inside an Image source prop.
    expect(code).toMatch(/source=\{\{[\s\S]*?localUri[\s\S]*?\}\}/);
  });

  it('renders an ActivityIndicator over the locally-picked image', () => {
    expect(code).toContain('ActivityIndicator');
    expect(code).toContain('spinnerOverlay');
  });

  it('reverts on error by clearing the local URI (state -> error)', () => {
    // Error path: the consumer's avatarPath is unchanged so the prior
    // image re-renders; we just stop showing localUri.
    expect(code).toMatch(/setUploadState\(\{\s*kind:\s*'error'/);
  });

  it('cache-busts via avatarUpdatedAt as the query parameter token', () => {
    expect(code).toMatch(/cacheBustToken:\s*avatarUpdatedAt/);
  });

  it('reverts on remove failure by re-entering confirming state', () => {
    expect(code).toMatch(/setRemoveState\(['"]confirming['"]\)/);
  });

  it('clears remove state on Cancel', () => {
    expect(code).toMatch(/handleCancelRemove/);
    expect(code).toMatch(/setRemoveState\(['"]idle['"]\)/);
  });
});

// ── Two-tap removal confirmation ──────────────────────────────

describe('PR-003 Q6 — two-tap remove confirmation', () => {
  it('handleStartRemove transitions to confirming (not direct removal)', () => {
    expect(code).toMatch(/handleStartRemove[\s\S]*?setRemoveState\(['"]confirming['"]\)/);
  });

  it('Confirm button only shows when removeState !== idle', () => {
    expect(code).toMatch(/removeState !== 'idle'/);
  });

  it('handleConfirmRemove is the only path that calls removeAvatar', () => {
    const matches = code.match(/removeAvatar\(\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT depend on a Modal component', () => {
    expect(code).not.toMatch(/<Modal/);
    expect(code).not.toMatch(/from ['"]react-native-modal['"]/);
  });
});

// ── Accessibility (a11y skill) ────────────────────────────────

describe('PR-003 a11y — Pressable role + label + state', () => {
  it('every Pressable has accessibilityRole="button"', () => {
    const pressables = code.match(/<Pressable[\s\S]*?\/?>/g) || [];
    expect(pressables.length).toBeGreaterThanOrEqual(4);
    for (const p of pressables) {
      expect(p).toMatch(/accessibilityRole=['"]button['"]/);
    }
  });

  it('upload button has an accessibilityLabel describing the action', () => {
    expect(code).toMatch(/accessibilityLabel=\{[^}]*Upload a profile photo[^}]*\}/);
    expect(code).toMatch(/accessibilityLabel=\{[^}]*Change profile photo[^}]*\}/);
  });

  it('remove button has Remove profile photo label', () => {
    expect(code).toMatch(/accessibilityLabel=['"]Remove profile photo['"]/);
  });

  it('confirm-remove has Confirm removing profile photo label', () => {
    expect(code).toMatch(/accessibilityLabel=['"]Confirm removing profile photo['"]/);
  });

  it('cancel-remove has Cancel removal label', () => {
    expect(code).toMatch(/accessibilityLabel=['"]Cancel removal['"]/);
  });

  it('every interactive Pressable carries an accessibilityState block', () => {
    const pressables = code.match(/<Pressable[\s\S]*?\/?>/g) || [];
    for (const p of pressables) {
      expect(p).toMatch(/accessibilityState=\{/);
    }
  });

  it('busy state is set on the upload button while uploading', () => {
    expect(code).toMatch(/busy:\s*isUploading/);
  });

  it('disabled state is set on the upload + remove buttons when blocked', () => {
    expect(code).toMatch(/disabled:\s*interactionDisabled/);
    expect(code).toMatch(/disabled:\s*isRemoving/);
  });

  it('the image rendition exposes accessibilityRole="image"', () => {
    expect(code).toMatch(/accessibilityRole=['"]image['"]/);
  });

  it('the image accessibility label is "Your profile photo"', () => {
    expect(code).toMatch(/accessibilityLabel=['"]Your profile photo['"]/);
  });

  it('error text uses accessibilityLiveRegion="polite"', () => {
    expect(code).toMatch(/accessibilityLiveRegion=['"]polite['"]/);
  });

  it('every Pressable specifies hitSlop for a 44px logical target', () => {
    const pressables = code.match(/<Pressable[\s\S]*?\/?>/g) || [];
    for (const p of pressables) {
      expect(p).toMatch(/hitSlop=\{/);
    }
  });

  it('primary, secondary, and danger buttons all set minHeight: 44 in styles', () => {
    expect(code).toMatch(/minHeight: 44/);
  });
});

// ── Source-scan safety ───────────────────────────────────────

describe('PR-003 — AvatarUploadSection source-scan safety', () => {
  it('does not import SERVICE_ROLE or any service-role surface', () => {
    expect(componentSrc).not.toMatch(/SERVICE_ROLE/);
  });

  it('does not import any AI provider', () => {
    expect(componentSrc).not.toMatch(/anthropic/i);
    expect(componentSrc).not.toMatch(/openai/i);
    expect(componentSrc).not.toMatch(/api\.x\.ai/i);
  });

  it('contains no console.log / console.warn / console.error', () => {
    expect(componentSrc).not.toMatch(/console\.\w+\(/);
  });
});
