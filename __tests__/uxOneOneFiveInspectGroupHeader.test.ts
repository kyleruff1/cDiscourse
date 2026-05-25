/**
 * UX-001.5 — InspectGroupHeader primitive + aria label builder.
 *
 * The group header is shipped ready for UX-001.5A — no v1 mount site
 * exists. These tests assert:
 *   - the primitive loads + exports;
 *   - the pure-TS aria label builder grammar (singular / plural / no
 *     count / empty label);
 *   - the source carries no hex literals;
 *   - source includes accessibilityRole="header" + uppercase label.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  InspectGroupHeader,
  buildInspectGroupHeaderAriaLabel,
} from '../src/features/nodeAnnotations/InspectGroupHeader';

const GROUP_HEADER_SRC = fs.readFileSync(
  path.join(
    process.cwd(),
    'src',
    'features',
    'nodeAnnotations',
    'InspectGroupHeader.tsx',
  ),
  'utf8',
);

describe('UX-001.5 — InspectGroupHeader module loads', () => {
  it('exports InspectGroupHeader', () => {
    expect(typeof InspectGroupHeader).toBe('function');
  });
  it('exports buildInspectGroupHeaderAriaLabel', () => {
    expect(typeof buildInspectGroupHeaderAriaLabel).toBe('function');
  });
});

describe('UX-001.5 — buildInspectGroupHeaderAriaLabel grammar', () => {
  it('label-only when count is absent', () => {
    expect(buildInspectGroupHeaderAriaLabel('Observations')).toBe('Observations');
  });

  it('singular noun for count=1', () => {
    expect(buildInspectGroupHeaderAriaLabel('Observations', 1)).toBe(
      'Observations, 1 item',
    );
  });

  it('plural noun for count>1', () => {
    expect(buildInspectGroupHeaderAriaLabel('Allegations', 3)).toBe(
      'Allegations, 3 items',
    );
  });

  it('plural noun for count=0', () => {
    expect(buildInspectGroupHeaderAriaLabel('Allegations', 0)).toBe(
      'Allegations, 0 items',
    );
  });

  it('floors fractional counts', () => {
    expect(buildInspectGroupHeaderAriaLabel('Allegations', 2.7)).toBe(
      'Allegations, 2 items',
    );
  });

  it('ignores negative counts', () => {
    expect(buildInspectGroupHeaderAriaLabel('Allegations', -1)).toBe('Allegations');
  });

  it('trims the label', () => {
    expect(buildInspectGroupHeaderAriaLabel('   Allegations   ', 2)).toBe(
      'Allegations, 2 items',
    );
  });

  it('returns count-only when label is empty', () => {
    expect(buildInspectGroupHeaderAriaLabel('   ', 2)).toBe('2 items');
  });

  it('returns empty string when both label and count are absent', () => {
    expect(buildInspectGroupHeaderAriaLabel('')).toBe('');
  });
});

describe('UX-001.5 — InspectGroupHeader render contract (source-scan)', () => {
  it('uses accessibilityRole="header"', () => {
    expect(GROUP_HEADER_SRC).toMatch(/accessibilityRole="header"/);
  });
  it('uppercase + 11px label per design §2 #10', () => {
    expect(GROUP_HEADER_SRC).toMatch(/textTransform:\s*['"]uppercase['"]/);
    expect(GROUP_HEADER_SRC).toMatch(/fontSize:\s*11/);
  });
  it('top divider hairline from SURFACE_TOKENS.divider', () => {
    expect(GROUP_HEADER_SRC).toMatch(/borderTopColor:\s*SURFACE_TOKENS\.divider/);
  });
  it('no hex literals', () => {
    expect(GROUP_HEADER_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
});
