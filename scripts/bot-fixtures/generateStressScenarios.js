#!/usr/bin/env node
/**
 * Stress scenario generator.
 *
 * Reads `fixtures/argument-scenarios/topicBank.json`, cycles through topics +
 * templates, renders deterministic fixture JSON, and writes one file per
 * scenario to `fixtures/generated-scenarios/`.
 *
 * No model calls. No Anthropic. No OpenAI. Only seeded text composition.
 *
 * Usage:
 *   node scripts/bot-fixtures/generateStressScenarios.js [--count 50] [--seed mySeed]
 *
 * CommonJS.
 */
const fs = require('node:fs');
const path = require('node:path');
const STRESS_CONFIG = require('./stressConfig');
const { TEMPLATES, renderScenarioMoves, seededRng } = require('./stressScenarioTemplates');

function parseArgs(argv) {
  const args = { count: STRESS_CONFIG.DEFAULT_ROOM_COUNT, seed: STRESS_CONFIG.DEFAULT_SEED };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--count' && argv[i + 1]) { args.count = Number(argv[++i]); }
    else if (a === '--seed' && argv[i + 1]) { args.seed = argv[++i]; }
  }
  if (!Number.isFinite(args.count) || args.count < 1) args.count = STRESS_CONFIG.DEFAULT_ROOM_COUNT;
  return args;
}

function flattenTopics(topicBank) {
  const out = [];
  for (const cat of topicBank.categories || []) {
    for (const topic of cat.topics || []) {
      out.push({ ...topic, category: cat.id });
    }
  }
  return out;
}

function buildScenario({ topic, template, scenarioIndex, seedStr }) {
  const { moves, personas } = renderScenarioMoves(template, topic, seedStr);
  const scenarioId = `stress-${String(scenarioIndex + 1).padStart(3, '0')}-${topic.topicId}-${template.id.split('-').pop()}`;
  return {
    scenarioId,
    title: topic.title,
    resolution: topic.resolution,
    category: topic.category,
    personas,
    moves,
    expectedFlags: [],
    expectedTopicChecks: ['resolution_match'],
    expectedTurnStatuses: [],
    hasBranchCandidate: moves.some((m) => m.displayMeta && m.displayMeta.branchCandidate),
    notes: `Generated stress scenario — template ${template.id}, topic ${topic.topicId}.`,
    stressMeta: {
      templateId: template.id,
      topicId: topic.topicId,
      category: topic.category,
      seed: seedStr,
      scenarioIndex,
    },
  };
}

function generate({ count, seed, outputDir }) {
  const topicBank = JSON.parse(fs.readFileSync(STRESS_CONFIG.TOPIC_BANK_PATH, 'utf8'));
  const topics = flattenTopics(topicBank);
  if (topics.length === 0) throw new Error('Topic bank is empty.');

  const dir = outputDir || STRESS_CONFIG.GENERATED_FIXTURE_DIR;
  const masterRng = seededRng(seed);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  } else {
    // Wipe stale generated scenarios from previous runs so the directory
    // reflects exactly this run. Generated scenarios are gitignored.
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json')) fs.unlinkSync(path.join(dir, f));
    }
  }

  const written = [];
  for (let i = 0; i < count; i++) {
    // Cycle topics to maintain coverage, but rotate template via seeded rng so
    // distinct runs produce different mixes.
    const topic = topics[i % topics.length];
    const template = TEMPLATES[Math.floor(masterRng() * TEMPLATES.length)];
    const seedStr = `${seed}::${i}::${template.id}::${topic.topicId}`;
    const scenario = buildScenario({ topic, template, scenarioIndex: i, seedStr });
    const filePath = path.join(dir, `${scenario.scenarioId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2));
    written.push(scenario.scenarioId);
  }

  return { count: written.length, ids: written, outputDir: dir };
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  const result = generate(args);
  console.log(`[stress-generator] wrote ${result.count} scenarios to ${result.outputDir}`);
  console.log(`[stress-generator] seed=${args.seed} count=${args.count}`);
  // Print a small sample so operators can spot-check
  for (const id of result.ids.slice(0, 3)) console.log(`  • ${id}`);
  if (result.ids.length > 3) console.log(`  • ... and ${result.ids.length - 3} more`);
}

module.exports = { generate, buildScenario, flattenTopics, parseArgs };
