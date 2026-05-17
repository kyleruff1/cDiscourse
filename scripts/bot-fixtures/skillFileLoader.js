/**
 * Stage 6.1.9 — Skill-from-disk loader.
 *
 * The adversarial bot corpus reads `.claude/skills/bot-provocateur/SKILL.md`
 * and `.claude/skills/bot-revocateur/SKILL.md` from disk at runtime and
 * stamps a short hash of each file into the JSONL run metadata so the
 * corpus output proves WHICH version of each skill was active during the run.
 *
 * No imports of stale in-memory copies. No hardcoded skill content in
 * persona / renderer modules.
 *
 * Pure Node CommonJS. No network. No secrets.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const REPO_ROOT = process.cwd();
const SKILL_DIR = path.join(REPO_ROOT, '.claude', 'skills');

const SKILL_PATHS = {
  'bot-provocateur': path.join(SKILL_DIR, 'bot-provocateur', 'SKILL.md'),
  'bot-revocateur': path.join(SKILL_DIR, 'bot-revocateur', 'SKILL.md'),
};

class SkillFileLoadError extends Error {
  constructor(skillName, reason) {
    super(`SkillFileLoadError(${skillName}): ${reason}`);
    this.name = 'SkillFileLoadError';
    this.skillName = skillName;
    this.reason = reason;
  }
}

function shortHash(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 16);
}

/**
 * Reads ONE skill file from disk + returns its raw text + short hash.
 * Throws SkillFileLoadError if the file is missing or empty.
 */
function loadSkillFromDisk(skillName) {
  const file = SKILL_PATHS[skillName];
  if (!file) throw new SkillFileLoadError(skillName, 'unknown_skill_name');
  if (!fs.existsSync(file)) throw new SkillFileLoadError(skillName, 'file_missing');
  const text = fs.readFileSync(file, 'utf8');
  if (!text || text.length < 80) throw new SkillFileLoadError(skillName, 'file_empty_or_truncated');
  return {
    name: skillName,
    path: path.relative(REPO_ROOT, file).replace(/\\/g, '/'),
    text,
    hash: shortHash(text),
    bytes: Buffer.byteLength(text, 'utf8'),
    loadedAt: new Date().toISOString(),
  };
}

/**
 * Load both adversarial skill files. Returns a `skillGate` object suitable
 * for stamping into JSONL run metadata + the run summary.
 */
function loadAdversarialSkillBundle() {
  const provocateur = loadSkillFromDisk('bot-provocateur');
  const revocateur = loadSkillFromDisk('bot-revocateur');
  return {
    provocateurPath: provocateur.path,
    revocateurPath: revocateur.path,
    provocateurHash: provocateur.hash,
    revocateurHash: revocateur.hash,
    provocateurBytes: provocateur.bytes,
    revocateurBytes: revocateur.bytes,
    provocateurText: provocateur.text,
    revocateurText: revocateur.text,
    loadedAt: new Date().toISOString(),
    validated: false, // set true after validator runs
  };
}

/**
 * Return the redacted skillGate suitable for JSONL events (text removed,
 * hash + path + bytes retained). The full text stays in memory for the
 * prompt builder but never lands in any logged event.
 */
function redactedSkillGate(bundle, validated = true) {
  return {
    provocateurPath: bundle.provocateurPath,
    revocateurPath: bundle.revocateurPath,
    provocateurHash: bundle.provocateurHash,
    revocateurHash: bundle.revocateurHash,
    provocateurBytes: bundle.provocateurBytes,
    revocateurBytes: bundle.revocateurBytes,
    loadedAt: bundle.loadedAt,
    validated: Boolean(validated),
  };
}

module.exports = {
  SKILL_DIR,
  SKILL_PATHS,
  SkillFileLoadError,
  shortHash,
  loadSkillFromDisk,
  loadAdversarialSkillBundle,
  redactedSkillGate,
};
