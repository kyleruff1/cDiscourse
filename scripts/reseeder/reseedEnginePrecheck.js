/**
 * RESEED-001 — engine pre-check (LOAD-BEARING).
 *
 * Answers "would `submit-argument` accept this planned move?" for every
 * template BEFORE it is emitted, so `--no-provider` hits 100% validator pass
 * BY CONSTRUCTION.
 *
 * This is a MIRROR, not a replacement: it calls the SAME pure
 * `evaluateArgumentDraft` that the deployed Edge Function runs. The two
 * constitution copies are kept in sync by convention:
 *   - src/domain/constitution/            (imported here + by the client)
 *   - supabase/functions/_shared/constitution/  (run by the deployed Edge fn)
 * If they drift, a pre-check-valid move could still be Edge-rejected; the
 * harness treats that as LOGGED SIGNAL (reseedReport `engineRejection` count),
 * never a crash — see reseedReport.js.
 *
 * Runtime loading: the engine is pure TypeScript (src/domain/constitution),
 * whose entire import graph is relative sibling `.ts` files with NO external /
 * npm / React / Supabase imports. A plain Node `.js` cannot `require` a `.ts`,
 * and this repo has no ts-node/tsx loader and no compiled JS build of the
 * engine. Rather than add a dependency (forbidden) or hand-roll a replacement
 * (design-forbidden — the pre-check must be a mirror), we transpile the engine
 * `.ts` files on the fly with the ALREADY-INSTALLED `typescript` compiler
 * (a devDependency, resolvable from node_modules) into an in-memory CommonJS
 * module graph. This yields the identical `evaluateArgumentDraft` at both real
 * Node runtime AND under jest.
 *
 * CommonJS / pure (no network, no Supabase, no Anthropic).
 */

const fs = require('node:fs');
const path = require('node:path');

const ENGINE_DIR = path.resolve(__dirname, '..', '..', 'src', 'domain', 'constitution');

// ── On-the-fly TS module loader (engine subgraph only) ─────────────
// Cache keyed by absolute path so `./types` shared between engine files
// resolves to a single instance.
const _tsCache = new Map();

function _loadEngineTs(absNoExt) {
  const ts = require('typescript');
  const abs = absNoExt.endsWith('.ts') ? absNoExt : `${absNoExt}.ts`;
  if (_tsCache.has(abs)) return _tsCache.get(abs).exports;

  const src = fs.readFileSync(abs, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
    fileName: abs,
  }).outputText;

  const mod = { exports: {} };
  _tsCache.set(abs, mod); // set before eval so cyclic sibling imports resolve
  const dir = path.dirname(abs);
  const localRequire = (spec) => {
    if (spec.startsWith('.')) return _loadEngineTs(path.resolve(dir, spec));
    return require(spec);
  };
  const factory = new Function('exports', 'require', 'module', '__filename', '__dirname', out);
  factory(mod.exports, localRequire, mod, abs, dir);
  return mod.exports;
}

let _engine = null;
function getEngine() {
  if (_engine) return _engine;
  const evalMod = _loadEngineTs(path.join(ENGINE_DIR, 'evaluateArgumentDraft'));
  const v1 = _loadEngineTs(path.join(ENGINE_DIR, 'constitution.v1'));
  _engine = {
    evaluateArgumentDraft: evalMod.evaluateArgumentDraft,
    constitutionVersion: v1.constitutionVersion,
    constitutionRules: v1.constitutionRules,
    tagDefinitions: v1.tagDefinitions,
    flagDefinitions: v1.flagDefinitions,
  };
  return _engine;
}

/**
 * Run the real engine on a planned move.
 *
 * @param {object} move PlannedMove:
 *   {
 *     argumentType, parentType|null, body, targetExcerpt|null, parentBody|null,
 *     selectedTagCodes[], attachedEvidence[{url?, sourceText?}], resolution,
 *     side?, description?
 *   }
 * @returns {{ valid: boolean, blockingCodes: string[] }}
 *   valid === evaluateArgumentDraft(input).allowPost.
 */
function isEngineValidMove(move) {
  if (!move || typeof move !== 'object') {
    return { valid: false, blockingCodes: ['MALFORMED_MOVE'] };
  }
  const engine = getEngine();

  const parentArgument =
    move.parentType == null
      ? undefined
      : {
          id: 'reseed-parent',
          argumentType: move.parentType,
          side: move.side || 'affirmative',
          body: typeof move.parentBody === 'string' ? move.parentBody : '',
          depth: 0,
        };

  const target = {};
  if (move.targetExcerpt) target.targetExcerpt = move.targetExcerpt;
  if (move.disagreementAxis) target.disagreementAxis = move.disagreementAxis;

  const input = {
    debateId: 'reseed-precheck',
    debateResolution: String(move.resolution || ''),
    debateDescription: typeof move.description === 'string' ? move.description : undefined,
    parentArgument,
    existingSiblingArguments: [],
    argumentType: move.argumentType,
    side: move.side || 'affirmative',
    body: String(move.body || ''),
    selectedTagCodes: Array.isArray(move.selectedTagCodes) ? move.selectedTagCodes : [],
    attachedEvidence: Array.isArray(move.attachedEvidence) ? move.attachedEvidence : [],
    activeConstitution: engine.constitutionVersion,
    activeRules: engine.constitutionRules,
    tagDefinitions: engine.tagDefinitions,
    flagDefinitions: engine.flagDefinitions,
    // Mirror the deployed Edge Function: it evaluates with server rules.
    evaluationContext: 'server',
  };
  if (Object.keys(target).length > 0) input.target = target;

  const result = engine.evaluateArgumentDraft(input);
  const blockingCodes = (result.blockingErrors || []).map((e) => e.flagCode);
  return { valid: result.allowPost === true, blockingCodes };
}

/** Expose the loaded constitution (read-only) for planners/renderers. */
function getConstitution() {
  const e = getEngine();
  return {
    constitutionVersion: e.constitutionVersion,
    constitutionRules: e.constitutionRules,
    tagDefinitions: e.tagDefinitions,
    flagDefinitions: e.flagDefinitions,
  };
}

module.exports = {
  isEngineValidMove,
  getConstitution,
  ENGINE_DIR,
};
