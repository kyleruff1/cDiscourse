/**
 * Stress-test runner configuration. CommonJS / pure.
 */
const path = require('node:path');

const REPO_ROOT = process.cwd();

const STRESS_CONFIG = {
  DEFAULT_SEED: 'cdiscourse-stress-default-2026',
  DEFAULT_ROOM_COUNT: 50,
  MIN_MOVES: 10,
  MAX_MOVES: 15,

  GENERATED_FIXTURE_DIR: path.join(REPO_ROOT, 'fixtures', 'generated-scenarios'),
  STRESS_LOG_DIR: path.join(REPO_ROOT, 'logs', 'bot-stress'),
  SUMMARY_DIR: path.join(REPO_ROOT, 'docs', 'testing-runs'),

  TOPIC_BANK_PATH: path.join(REPO_ROOT, 'fixtures', 'argument-scenarios', 'topicBank.json'),

  // Acceptable failure budget for a clean 10-room or 50-room gate.
  ACCEPTABLE_POST_RATE: 0.7, // ≥70% of moves should post
  ACCEPTABLE_ROOM_RATE: 0.8, // ≥80% of rooms should at least create + run
};

module.exports = STRESS_CONFIG;
