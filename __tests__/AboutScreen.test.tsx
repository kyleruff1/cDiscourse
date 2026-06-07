/**
 * NAV-START-ARGUMENT-001 Slice B — public About screen tests.
 *
 * The About screen is a PUBLIC/user-facing surface reached from the
 * upper-right About item in the global header.
 *
 * Covers:
 *   - Renders (public, dark-styled), shows the brand + a description + the
 *     canonical site mark.
 *   - "Back" is a real button that calls onBack (state-only, no router).
 *   - No admin / debug / classifier / routing content.
 *   - No verdict / popularity vocabulary in any rendered string.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import { AboutScreen } from '../src/features/navigation/AboutScreen';
import { APP_COPYRIGHT_TEXT } from '../src/features/navigation/AppPrimaryNav';
import { FORBIDDEN_PUBLIC_NAV_TOKENS } from '../src/features/navigation/appPrimaryNavModel';
import { BRAND } from '../src/lib/designTokens';

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

describe('AboutScreen — renders public dark-styled content', () => {
  it('renders the About screen container', () => {
    const { getByTestId } = render(<AboutScreen onBack={() => {}} />);
    expect(getByTestId('about-screen')).toBeTruthy();
  });

  it('shows the CivilDiscourse brand mark', () => {
    const { getByTestId } = render(<AboutScreen onBack={() => {}} />);
    expect(getByTestId('about-screen-brand').props.children).toBe('CivilDiscourse');
  });

  it('shows a description paragraph', () => {
    const { getByTestId } = render(<AboutScreen onBack={() => {}} />);
    expect(String(getByTestId('about-screen-paragraph-0').props.children).length).toBeGreaterThan(0);
  });

  it('shows the canonical site mark / copyright', () => {
    const { getByTestId } = render(<AboutScreen onBack={() => {}} />);
    expect(getByTestId('about-screen-site-mark').props.children).toBe(APP_COPYRIGHT_TEXT);
  });

  it('uses the dark app backdrop (dark-styled, not bright)', () => {
    const { getByTestId } = render(<AboutScreen onBack={() => {}} />);
    const style = flattenStyle(getByTestId('about-screen').props.style);
    expect(style.backgroundColor).toBe(BRAND.surface.app.bg);
  });
});

describe('AboutScreen — Back control', () => {
  it('Back is a real button that calls onBack once', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<AboutScreen onBack={onBack} />);
    const back = getByTestId('about-screen-back');
    expect(back.props.accessibilityRole).toBe('button');
    fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('AboutScreen — no restricted content, no verdict vocabulary', () => {
  it('renders no admin / debug / classifier / routing strings', () => {
    const { queryByText } = render(<AboutScreen onBack={() => {}} />);
    expect(queryByText('Admin')).toBeNull();
    expect(queryByText('Debug')).toBeNull();
    expect(queryByText(/classifier/i)).toBeNull();
    expect(queryByText(/routing/i)).toBeNull();
  });

  it('the source contains no admin / debug / classifier / routing tokens', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'features', 'navigation', 'AboutScreen.tsx'),
      'utf8',
    );
    // Strip comment lines: the doc comment names these surfaces to explain
    // the screen does NOT render them. The scan asserts no executable
    // reference reaches them.
    const codeOnly = src
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    const lower = codeOnly.toLowerCase();
    for (const banned of ['admin', 'debug', 'classifier', 'routing', 'family h', 'service_role']) {
      expect(lower).not.toContain(banned);
    }
  });

  it('the About copy is free of verdict / popularity tokens', () => {
    const { getByTestId } = render(<AboutScreen onBack={() => {}} />);
    const texts: string[] = [
      String(getByTestId('about-screen-brand').props.children),
      String(getByTestId('about-screen-paragraph-0').props.children),
      String(getByTestId('about-screen-paragraph-1').props.children),
      String(getByTestId('about-screen-paragraph-2').props.children),
    ];
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const banned of FORBIDDEN_PUBLIC_NAV_TOKENS) {
        expect(lower).not.toContain(banned.toLowerCase());
      }
    }
  });
});
