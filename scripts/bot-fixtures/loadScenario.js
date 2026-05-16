/**
 * Loads and validates a fixture scenario JSON for the bot runner.
 * CommonJS so tests can require() it directly.
 */
const fs = require('node:fs');
const path = require('node:path');

function loadScenario(scenarioId, fixturesDir) {
  const dir = fixturesDir || path.join(process.cwd(), 'fixtures', 'argument-scenarios');
  const file = path.join(dir, `${scenarioId}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Scenario not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateMoveOrdering(scenario) {
  const errors = [];
  const ids = new Set(scenario.moves.map((m) => m.moveId));
  let rootCount = 0;
  for (const m of scenario.moves) {
    if (m.parentMoveId === null) {
      rootCount++;
      continue;
    }
    if (!ids.has(m.parentMoveId)) {
      errors.push(`move ${m.moveId} references unknown parent ${m.parentMoveId}`);
    }
  }
  if (rootCount === 0) errors.push('scenario has no root move (parentMoveId === null)');
  if (rootCount > 1) errors.push(`scenario has ${rootCount} root moves; expected exactly 1`);
  return errors;
}

function topologicalOrder(scenario) {
  const remaining = scenario.moves.slice();
  const placed = new Set();
  const out = [];
  let safety = remaining.length * remaining.length + 1;

  while (remaining.length > 0 && safety-- > 0) {
    for (let i = 0; i < remaining.length; i++) {
      const m = remaining[i];
      if (m.parentMoveId === null || placed.has(m.parentMoveId)) {
        out.push(m);
        placed.add(m.moveId);
        remaining.splice(i, 1);
        break;
      }
    }
  }
  if (remaining.length > 0) {
    throw new Error(`Cycle or orphan in scenario; could not order: ${remaining.map((r) => r.moveId).join(',')}`);
  }
  return out;
}

module.exports = { loadScenario, validateMoveOrdering, topologicalOrder };
