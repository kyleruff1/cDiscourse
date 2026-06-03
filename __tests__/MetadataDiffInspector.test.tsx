/**
 * META-1E — MetadataDiffInspector component tests.
 *
 * The repo's UI test discipline is pure-helper + source-scan (the pinned
 * react-test-renderer is held away from @testing-library's peer, see
 * AddAnnotationSheet.test.tsx). The component's load-bearing contract —
 *   - reads ONLY the pure model (`buildMetadataDiffInspectorModel`);
 *   - imports no Supabase / fetch / router / AI;
 *   - uses no hex color literals (designTokens only);
 *   - renders the four chip testIDs + row/empty testIDs;
 *   - chips carry accessibilityRole="button" + accessibilityState;
 *   - exposes NO write path (no onPress that mutates, no edit/delete/dismiss)
 * — is asserted here via (a) the pure model that drives every render value
 * and (b) a source-scan of the component for the read-only + a11y contract.
 */

import * as fs from 'fs';
import * as path from 'path';
import { buildMetadataDiffInspectorModel } from '../src/features/metadata/metadataDiffInspectorModel';
import type { MetadataEvent } from '../src/features/metadata';

const COMPONENT_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'metadata', 'MetadataDiffInspector.tsx'),
  'utf8',
);

function evt(over: Partial<MetadataEvent>): MetadataEvent {
  const kind = over.kind ?? 'add';
  const codeFamily = over.codeFamily ?? 'manual_tag';
  const code = over.code ?? 'needs_source';
  const messageId = over.messageId ?? 'm1';
  const at = over.at ?? '2026-05-18T10:00:00.000Z';
  return {
    eventId: over.eventId ?? `${kind}:${codeFamily}:${code}:${messageId}:${at}`,
    kind,
    codeFamily,
    code,
    messageId,
    clusterId: 'c1',
    at,
    cause: over.cause ?? null,
  };
}

// ── Source composition + imports ───────────────────────────────

describe('META-1E MetadataDiffInspector — source composition', () => {
  it('imports the pure metadataDiffInspectorModel', () => {
    expect(COMPONENT_SRC).toMatch(/from '\.\/metadataDiffInspectorModel'/);
    expect(COMPONENT_SRC).toMatch(/buildMetadataDiffInspectorModel/);
  });

  it('reuses the read-only InspectGroupHeader primitive (no new copy primitive)', () => {
    expect(COMPONENT_SRC).toMatch(/import \{ InspectGroupHeader \} from .+nodeAnnotations\/InspectGroupHeader/);
  });

  it('sources all authored strings from gameCopy (no scattered raw strings)', () => {
    expect(COMPONENT_SRC).toMatch(/METADATA_DIFF_INSPECTOR_COPY/);
  });

  it('uses formatDateTime + formatRelativeShort for timestamps', () => {
    expect(COMPONENT_SRC).toMatch(/formatDateTime/);
    expect(COMPONENT_SRC).toMatch(/formatRelativeShort/);
  });
});

describe('META-1E MetadataDiffInspector — forbidden imports (read-only, no I/O)', () => {
  it('imports no Supabase client', () => {
    expect(COMPONENT_SRC).not.toMatch(/@supabase\/supabase-js/);
    expect(COMPONENT_SRC).not.toMatch(/from '.*lib\/supabase/);
  });

  it('makes no fetch / XMLHttpRequest call', () => {
    expect(/\bfetch\s*\(/.test(COMPONENT_SRC)).toBe(false);
    expect(COMPONENT_SRC.includes('XMLHttpRequest')).toBe(false);
  });

  it('imports no router / navigation', () => {
    expect(COMPONENT_SRC).not.toMatch(/expo-router/);
    expect(COMPONENT_SRC).not.toMatch(/@react-navigation/);
  });

  it('references no AI provider or service-role secret', () => {
    expect(COMPONENT_SRC).not.toMatch(/anthropic/i);
    expect(COMPONENT_SRC).not.toMatch(/x\.ai|XAI_API_KEY/);
    expect(COMPONENT_SRC).not.toMatch(/SERVICE_ROLE/);
  });

  it('has no console.log', () => {
    expect(/\bconsole\.log\s*\(/.test(COMPONENT_SRC)).toBe(false);
  });
});

describe('META-1E MetadataDiffInspector — token-only styling', () => {
  it('uses no hex color literals', () => {
    expect(COMPONENT_SRC).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('imports designTokens (SURFACE_TOKENS / SPACING / RADIUS / TOUCH_TARGET)', () => {
    expect(COMPONENT_SRC).toMatch(/designTokens/);
    expect(COMPONENT_SRC).toMatch(/SURFACE_TOKENS/);
    expect(COMPONENT_SRC).toMatch(/TOUCH_TARGET/);
  });
});

// ── testID + accessibility contract ────────────────────────────

describe('META-1E MetadataDiffInspector — render structure (source-scan)', () => {
  it('renders the panel header testID', () => {
    expect(COMPONENT_SRC).toMatch(/\$\{baseTestID\}-header/);
  });

  it('renders one chip per filter with testID metadata-diff-chip-<id>', () => {
    expect(COMPONENT_SRC).toMatch(/\$\{baseTestID\}-chip-\$\{f\.id\}/);
    expect(COMPONENT_SRC).toMatch(/model\.filters\.map/);
  });

  it('renders one row per visible row with testID metadata-diff-row-<rowId>', () => {
    expect(COMPONENT_SRC).toMatch(/\$\{baseTestID\}-row-\$\{row\.rowId\}/);
    expect(COMPONENT_SRC).toMatch(/model\.visibleRows\.map/);
  });

  it('renders the empty-state testID gated on model.isEmpty', () => {
    expect(COMPONENT_SRC).toMatch(/\$\{baseTestID\}-empty/);
    expect(COMPONENT_SRC).toMatch(/model\.isEmpty/);
  });

  it('chips are accessibilityRole="button" with accessibilityState selected + disabled', () => {
    expect(COMPONENT_SRC).toMatch(/accessibilityRole="button"/);
    expect(COMPONENT_SRC).toMatch(/accessibilityState=\{\{\s*selected:\s*f\.active,\s*disabled\s*\}\}/);
  });

  it('chips carry a hitSlop for the 44x44 touch target', () => {
    expect(COMPONENT_SRC).toMatch(/hitSlop=\{TOUCH_TARGET\.hitSlopAll\}/);
  });

  it('the leading kind marker is hidden from accessibility (text glyph, not color)', () => {
    expect(COMPONENT_SRC).toMatch(/accessibilityElementsHidden/);
  });
});

// ── Read-only contract — no write path ─────────────────────────

describe('META-1E MetadataDiffInspector — strictly read-only', () => {
  it('exposes no edit / delete / dismiss / submit affordance', () => {
    expect(COMPONENT_SRC).not.toMatch(/onDelete|onDismiss|onSubmit|onApply|onRemove|onEdit/);
  });

  it('the only state setter toggles the local filter set (pure view-state)', () => {
    // The single useState manages the active-filter array; the only onPress
    // calls toggleFilter. No other state, no mutation callback.
    expect(COMPONENT_SRC).toMatch(/setActiveFilters/);
    expect(COMPONENT_SRC).toMatch(/onPress=\{\(\) => toggleFilter\(f\.id\)\}/);
    // exactly one useState in the component.
    const useStateCount = (COMPONENT_SRC.match(/useState/g) ?? []).length;
    // one import reference + one call site = 2 textual hits.
    expect(useStateCount).toBeLessThanOrEqual(2);
  });

  it('does not read MetadataEvent.cause anywhere', () => {
    expect(COMPONENT_SRC).not.toMatch(/\.cause/);
  });
});

// ── Model-driven render values (the component renders these verbatim) ──

describe('META-1E MetadataDiffInspector — model drives the rendered values', () => {
  it('empty events → model.isEmpty so the empty state renders', () => {
    const model = buildMetadataDiffInspectorModel({ events: [], messageId: 'm1', activeFilters: [] });
    expect(model.isEmpty).toBe(true);
    expect(model.visibleRows.length).toBe(0);
  });

  it('populated events → expected visible-row count + per-chip counts', () => {
    const events: MetadataEvent[] = [
      evt({ kind: 'add', codeFamily: 'manual_tag', code: 'needs_source', at: '2026-05-18T10:00:01.000Z' }),
      evt({ kind: 'remove', codeFamily: 'manual_tag', code: 'tangent', at: '2026-05-18T10:00:02.000Z' }),
      evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open->rebutted', at: '2026-05-18T10:00:03.000Z' }),
    ];
    const model = buildMetadataDiffInspectorModel({ events, messageId: 'm1', activeFilters: [] });
    expect(model.isEmpty).toBe(false);
    expect(model.visibleRows.length).toBe(3);
    expect(model.filters.find((f) => f.id === 'added_tag')!.count).toBe(1);
    expect(model.filters.find((f) => f.id === 'removed_tag')!.count).toBe(1);
    expect(model.filters.find((f) => f.id === 'triggered_transition')!.count).toBe(1);
    expect(model.filters.find((f) => f.id === 'resolved_request')!.available).toBe(false);
  });
});
