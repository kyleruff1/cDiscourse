/**
 * Loads bot-fixture runner env from `.env.bot-tests` (preferred) and `.env`.
 * CommonJS so tests can require() it directly.
 */
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'CDISCOURSE_ADMIN_EMAIL',
  'CDISCOURSE_ADMIN_PASSWORD',
  'CDISCOURSE_BOT_A_EMAIL',
  'CDISCOURSE_BOT_A_PASSWORD',
  'CDISCOURSE_BOT_B_EMAIL',
  'CDISCOURSE_BOT_B_PASSWORD',
];

function parseDotEnv(content) {
  const out = {};
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

function mergeEnvLayers(...layers) {
  const out = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [k, v] of Object.entries(layer)) {
      if (v !== undefined && v !== '') out[k] = v;
    }
  }
  return out;
}

function validateRequiredKeys(env) {
  const missing = [];
  for (const k of REQUIRED_KEYS) {
    if (!env[k] || env[k] === '') missing.push(k);
  }
  return missing;
}

function buildBotConfig(env) {
  const missing = validateRequiredKeys(env);
  if (missing.length > 0) {
    throw new Error(`Missing required env keys: ${missing.join(', ')}`);
  }

  const bots = [];
  for (const alias of ['A', 'B', 'C']) {
    const email = env[`CDISCOURSE_BOT_${alias}_EMAIL`];
    const password = env[`CDISCOURSE_BOT_${alias}_PASSWORD`];
    if (!email || !password) continue;
    bots.push({
      alias: `bot-${alias.toLowerCase()}`,
      email,
      password,
      label: env[`CDISCOURSE_BOT_${alias}_LABEL`] || `bot-${alias.toLowerCase()}`,
      persona: env[`CDISCOURSE_BOT_${alias}_PERSONA`] || '',
    });
  }

  return {
    supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    adminEmail: env.CDISCOURSE_ADMIN_EMAIL,
    adminPassword: env.CDISCOURSE_ADMIN_PASSWORD,
    bots,
    scenarioId: env.CDISCOURSE_FIXTURE_SCENARIO || 'sports-play-in',
  };
}

function loadEnvFiles(cwd) {
  const dir = cwd || process.cwd();
  const candidates = ['.env.bot-tests', '.env'];
  const fileEnv = {};
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      Object.assign(fileEnv, parseDotEnv(fs.readFileSync(p, 'utf8')));
    }
  }
  return mergeEnvLayers(fileEnv, process.env);
}

module.exports = {
  REQUIRED_KEYS,
  parseDotEnv,
  mergeEnvLayers,
  validateRequiredKeys,
  buildBotConfig,
  loadEnvFiles,
};
