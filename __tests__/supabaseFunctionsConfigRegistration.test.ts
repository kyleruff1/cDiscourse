/**
 * OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001 — config.toml ⇄ functions-dir guard.
 *
 * Root cause this guard exists for: `supabase/functions/admin-classifier-health/`
 * shipped in #500 (OPS-MCP-OBSERVABILITY-002) with an `index.ts` and a
 * function-LOCAL `config.toml`, but WITHOUT a root
 * `[functions.admin-classifier-health]` block in `supabase/config.toml`. The
 * deploy path this project relies on (Supabase GitHub integration / bulk
 * `npx supabase functions deploy`) keys off the ROOT `[functions.*]` blocks, so
 * the function never deployed → the client's
 * `supabase.functions.invoke('admin-classifier-health')` threw
 * `FunctionsFetchError` → the admin panel surfaced `network_error`
 * (src/features/admin/adminClassifierHealthApi.ts).
 *
 * This guard makes that whole CLASS of mistake a test failure: every function
 * directory (a dir under supabase/functions/ that contains an `index.ts`, minus
 * `_shared`) must have a ROOT `[functions.<name>]` registration, and every root
 * registration must point to a real function directory.
 *
 * KNOWN_UNREGISTERED: `apply-manual-tag` (META-1A, #134) is a PRE-EXISTING,
 * SEPARATE instance of the same gap — it has an `index.ts`, is invoked by the
 * client (src/features/metadata/pointTagsApi.ts), yet has no root block and no
 * function-local config.toml. It is OUT OF SCOPE for this hotfix card (the card
 * boundary is: register admin-classifier-health only). It is enumerated here so
 * this guard stays honest: the allow-list is itself asserted (the test FAILS if
 * apply-manual-tag is ever registered/removed, or if any NEW unregistered
 * function appears), so the gap can never be silently widened. Fixing
 * apply-manual-tag's registration is tracked as a follow-up.
 */
import fs from 'node:fs';
import path from 'node:path';

const FUNCTIONS_DIR = path.join(process.cwd(), 'supabase', 'functions');
const CONFIG_PATH = path.join(process.cwd(), 'supabase', 'config.toml');
const CONFIG_SRC = fs.readFileSync(CONFIG_PATH, 'utf8');

/**
 * Directory names under supabase/functions/ that are NOT deployable functions
 * (shared code, not an Edge Function entrypoint). `_shared` is the canonical
 * one; the index.ts check below is the real filter, this is belt-and-braces.
 */
const NON_FUNCTION_DIRS = new Set(['_shared']);

/**
 * PRE-EXISTING unregistered function directories that are knowingly OUT OF SCOPE
 * for this card. See the file docstring. Keep this list EMPTY-able: when a
 * follow-up registers one of these, delete it from here and the test stays green
 * via the root-block path instead.
 */
const KNOWN_UNREGISTERED = new Set(['apply-manual-tag']);

/** Every directory under supabase/functions/ that holds an `index.ts`. */
function listFunctionDirs(): string[] {
  return fs
    .readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !NON_FUNCTION_DIRS.has(name))
    .filter((name) => fs.existsSync(path.join(FUNCTIONS_DIR, name, 'index.ts')))
    .sort();
}

/** Every `[functions.<name>]` header declared in the root config.toml. */
function listRegisteredFunctions(): string[] {
  const names: string[] = [];
  const re = /^\[functions\.([a-z0-9][a-z0-9-]*)\]\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CONFIG_SRC)) !== null) {
    names.push(m[1]);
  }
  return names.sort();
}

describe('supabase/config.toml ⇄ supabase/functions/ registration parity', () => {
  const functionDirs = listFunctionDirs();
  const registered = listRegisteredFunctions();
  const registeredSet = new Set(registered);

  it('discovers at least the known core functions on disk', () => {
    // Sanity: the scan actually found function dirs (guards against a broken
    // path / empty readdir making every assertion vacuously pass).
    expect(functionDirs.length).toBeGreaterThan(5);
    expect(functionDirs).toContain('admin-classifier-health');
    expect(functionDirs).toContain('submit-argument');
  });

  it('parses at least the known core registrations from config.toml', () => {
    expect(registered.length).toBeGreaterThan(5);
    expect(registered).toContain('submit-argument');
    expect(registered).toContain('admin-users');
  });

  it('every function directory has a root [functions.<name>] registration (except documented known gaps)', () => {
    const unregistered = functionDirs.filter((name) => !registeredSet.has(name));
    const unexpected = unregistered.filter((name) => !KNOWN_UNREGISTERED.has(name));
    expect(unexpected).toEqual([]);
  });

  it('no root [functions.<name>] registration points to a missing directory', () => {
    const dirSet = new Set(functionDirs);
    const dangling = registered.filter((name) => !dirSet.has(name));
    expect(dangling).toEqual([]);
  });

  it('the KNOWN_UNREGISTERED allow-list is accurate — each entry exists on disk and is genuinely unregistered', () => {
    // If any of these were quietly registered or deleted, force a maintainer to
    // update this list (so the gap can never be silently widened or stale).
    for (const name of KNOWN_UNREGISTERED) {
      expect(fs.existsSync(path.join(FUNCTIONS_DIR, name, 'index.ts'))).toBe(true);
      expect(registeredSet.has(name)).toBe(false);
    }
  });

  it('admin-classifier-health is registered with verify_jwt = true (the OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001 fix)', () => {
    const header = '[functions.admin-classifier-health]';
    const idx = CONFIG_SRC.indexOf(header);
    expect(idx).toBeGreaterThanOrEqual(0);
    const tail = CONFIG_SRC.slice(idx + header.length);
    const nextSectionIdx = tail.search(/\n\[/);
    const block = nextSectionIdx >= 0 ? tail.slice(0, nextSectionIdx) : tail;
    expect(block).toMatch(/verify_jwt = true/);
    expect(block).not.toMatch(/verify_jwt = false/);
  });

  it('create-marker is registered with verify_jwt = true (MARK-002 #894, the #509 hazard forcing function)', () => {
    // The sole server-authoritative writer for the SELECT-only timestamp_markers
    // table MUST be config.toml-registered or it silently never deploys.
    expect(functionDirs).toContain('create-marker');
    expect(registered).toContain('create-marker');
    const header = '[functions.create-marker]';
    const idx = CONFIG_SRC.indexOf(header);
    expect(idx).toBeGreaterThanOrEqual(0);
    const tail = CONFIG_SRC.slice(idx + header.length);
    const nextSectionIdx = tail.search(/\n\[/);
    const block = nextSectionIdx >= 0 ? tail.slice(0, nextSectionIdx) : tail;
    expect(block).toMatch(/verify_jwt = true/);
    expect(block).not.toMatch(/verify_jwt = false/);
  });

  it('mark-move is registered with verify_jwt = true (FEEDBACK-001 #898, the #509 hazard forcing function)', () => {
    // The sole server-authoritative writer for the SELECT-only move_marks table
    // MUST be config.toml-registered or it silently never deploys and every tap
    // throws network_error.
    expect(functionDirs).toContain('mark-move');
    expect(registered).toContain('mark-move');
    const header = '[functions.mark-move]';
    const idx = CONFIG_SRC.indexOf(header);
    expect(idx).toBeGreaterThanOrEqual(0);
    const tail = CONFIG_SRC.slice(idx + header.length);
    const nextSectionIdx = tail.search(/\n\[/);
    const block = nextSectionIdx >= 0 ? tail.slice(0, nextSectionIdx) : tail;
    expect(block).toMatch(/verify_jwt = true/);
    expect(block).not.toMatch(/verify_jwt = false/);
  });

  it('chime-in is registered with verify_jwt = true (CHIMEIN-P8 #761, the #509 hazard forcing function)', () => {
    // The sole server-authoritative writer for the SELECT-only
    // chime_in_contributions table MUST be config.toml-registered or it silently
    // never deploys and every chime attach throws network_error.
    expect(functionDirs).toContain('chime-in');
    expect(registered).toContain('chime-in');
    const header = '[functions.chime-in]';
    const idx = CONFIG_SRC.indexOf(header);
    expect(idx).toBeGreaterThanOrEqual(0);
    const tail = CONFIG_SRC.slice(idx + header.length);
    const nextSectionIdx = tail.search(/\n\[/);
    const block = nextSectionIdx >= 0 ? tail.slice(0, nextSectionIdx) : tail;
    expect(block).toMatch(/verify_jwt = true/);
    expect(block).not.toMatch(/verify_jwt = false/);
  });
});
