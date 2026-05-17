#!/usr/bin/env node
/**
 * Bot fixture runner — Stage 6.1.2.2 (CommonJS entry).
 *
 * Flow:
 *   1. Load .env.bot-tests / .env
 *   2. Sign in as admin (normal Supabase auth)
 *   3. Ensure bot users exist via admin-users (create_bot_user)
 *   4. Sign in as Bot A; create an Argument Room
 *   5. Have each bot join with their persona side
 *   6. Submit each fixture move through submit-argument
 *   7. Write a redacted run log to docs/testing-runs/
 *
 * No service-role key. No Anthropic. No direct posted-argument insert.
 */
const { randomUUID } = require('node:crypto');
const { loadEnvFiles, buildBotConfig } = require('./loadEnv');
const { loadScenario, validateMoveOrdering, topologicalOrder } = require('./loadScenario');
const { createBotClient, signInBot } = require('./supabaseClient');
const { ensureBotUser } = require('./adminOps');
const { buildSubmitArgumentBody, invokeSubmitArgument } = require('./submitMove');
const { writeRunLog } = require('./writeRunLog');
const { mapPersonaSideToParticipantSide } = require('./personaMapping');

async function main() {
  const cliScenarioId = process.argv[2];
  const env = loadEnvFiles();
  if (cliScenarioId) env.CDISCOURSE_FIXTURE_SCENARIO = cliScenarioId;

  let cfg;
  try {
    cfg = buildBotConfig(env);
  } catch (err) {
    console.error(`[fatal] env validation: ${err.message}`);
    console.error('Copy `.env.bot-tests.example` to `.env.bot-tests` and fill required values.');
    process.exit(2);
  }

  console.log(`[runner] scenario=${cfg.scenarioId} bots=${cfg.bots.length}`);
  const scenario = loadScenario(cfg.scenarioId);
  const errors = validateMoveOrdering(scenario);
  if (errors.length > 0) {
    console.error(`[fatal] scenario validation:\n  ${errors.join('\n  ')}`);
    process.exit(2);
  }
  const moves = topologicalOrder(scenario);

  // Admin sign-in
  const adminClient = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const adminSession = await signInBot(adminClient, cfg.adminEmail, cfg.adminPassword);
  if (!adminSession) {
    console.error('[fatal] admin sign-in failed');
    process.exit(3);
  }
  console.log('[runner] admin signed in');

  // Ensure each bot exists
  const botByAlias = {};
  const aliasByEmail = {};
  aliasByEmail[cfg.adminEmail] = 'admin-1';
  for (const bot of cfg.bots) {
    const { userId, email, created } = await ensureBotUser(adminClient, {
      label: bot.label,
      email: bot.email,
      password: bot.password,
      persona: bot.persona,
      displayName: bot.label,
    });
    console.log(`[runner] bot ${bot.alias} ${created ? 'created' : 'exists'}: ${userId}`);
    botByAlias[bot.alias] = { userId, email, client: null };
    aliasByEmail[bot.email] = bot.alias;
  }

  // Sign in each bot
  for (const bot of cfg.bots) {
    const c = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
    const session = await signInBot(c, bot.email, bot.password);
    if (!session) {
      console.error(`[fatal] bot ${bot.alias} sign-in failed`);
      process.exit(4);
    }
    botByAlias[bot.alias].client = c;
  }
  console.log('[runner] all bots signed in');

  // Map scenario authorAlias → bot alias
  const authorAliasToBotAlias = {};
  const personasInOrder = (scenario.personas || []).map((p) => p.alias);
  const botAliasesAvailable = cfg.bots.map((b) => b.alias);
  for (let i = 0; i < personasInOrder.length && i < botAliasesAvailable.length; i++) {
    authorAliasToBotAlias[personasInOrder[i]] = botAliasesAvailable[i];
  }

  // Create Argument Room as Bot A
  const botA = botByAlias[botAliasesAvailable[0]];
  const constitutionRes = await botA.client
    .from('constitution_versions')
    .select('id')
    .eq('active', true)
    .single();
  if (constitutionRes.error || !constitutionRes.data) {
    console.error('[fatal] no active constitution found');
    process.exit(5);
  }

  const roomTitle = `${scenario.title} (bot fixture ${new Date().toISOString().slice(0, 19)})`;
  // Use scenario.debateDescription if present, else empty string. Never
  // forward `scenario.notes` — those are test-author metadata describing
  // what the fixture exercises, and they pollute the topic-satisfaction
  // reference set so child moves score off-topic.
  const debateDescription =
    typeof scenario.debateDescription === 'string' ? scenario.debateDescription : '';
  const debateInsert = await botA.client
    .from('debates')
    .insert({
      created_by: botA.userId,
      title: roomTitle,
      resolution: scenario.resolution,
      description: debateDescription,
      status: 'open',
      constitution_id: constitutionRes.data.id,
    })
    .select('id')
    .single();
  if (debateInsert.error || !debateInsert.data) {
    console.error(`[fatal] create debate failed: ${debateInsert.error && debateInsert.error.message}`);
    process.exit(5);
  }
  const debateId = debateInsert.data.id;
  console.log(`[runner] room created id=${debateId}`);

  // Auto-join Bot A as moderator
  await botA.client
    .from('debate_participants')
    .insert({ debate_id: debateId, user_id: botA.userId, side: 'moderator' });

  // Other bots join. Persona 'neutral' maps to participant 'moderator' so the
  // bot can post synthesis / cross-side moves; see personaMapping.js.
  for (let i = 1; i < cfg.bots.length; i++) {
    const bot = botByAlias[botAliasesAvailable[i]];
    const personaSide = (scenario.personas && scenario.personas[i] && scenario.personas[i].side) || 'observer';
    const joinSide = mapPersonaSideToParticipantSide(personaSide);
    const { error } = await bot.client
      .from('debate_participants')
      .insert({ debate_id: debateId, user_id: bot.userId, side: joinSide });
    if (error && error.code !== '23505') {
      console.warn(`[runner] join failed for ${botAliasesAvailable[i]}: ${error.message}`);
    }
  }

  // Submit moves
  const argumentIdByMoveId = {};
  const results = [];

  for (const move of moves) {
    const botAlias = authorAliasToBotAlias[move.authorAlias];
    const bot = botByAlias[botAlias];
    if (!bot) {
      results.push({
        moveId: move.moveId,
        expectedStatus: move.expectedStatus,
        actualStatus: 'skipped_no_bot',
        argumentId: null,
        errorCode: `no bot for author ${move.authorAlias}`,
      });
      continue;
    }
    const personaSide = (scenario.personas || []).find((p) => p.alias === move.authorAlias);
    const side = (personaSide && personaSide.side) || 'neutral';

    // Skip children whose parent move did not post — submit-argument would
    // reject with a confusing "parent not found" 403 and pollute the log.
    if (move.parentMoveId && !argumentIdByMoveId[move.parentMoveId]) {
      results.push({
        moveId: move.moveId,
        expectedStatus: move.expectedStatus,
        actualStatus: 'skipped_missing_parent',
        argumentId: null,
        errorCode: 'parent_did_not_post',
        errorDetail: `parent move ${move.parentMoveId} did not post`,
      });
      console.warn(`[runner] ${move.moveId} skipped (parent ${move.parentMoveId} missing)`);
      continue;
    }
    const parentArgumentId = move.parentMoveId ? argumentIdByMoveId[move.parentMoveId] : null;

    const body = buildSubmitArgumentBody({
      debateId,
      parentArgumentId,
      move: {
        moveId: move.moveId,
        argumentType: move.argumentType,
        authorAlias: move.authorAlias,
        parentMoveId: move.parentMoveId,
        disagreementAxis: move.disagreementAxis,
        targetExcerpt: move.targetExcerpt,
        body: move.body,
        selectedTagCodes: move.selectedTagCodes,
        evidence: move.evidence,
      },
      side,
      clientSubmissionId: randomUUID(),
    });

    const result = await invokeSubmitArgument(bot.client, body);
    if (result.ok) {
      const argId = (result.data && result.data.argument && result.data.argument.id) || null;
      if (argId) argumentIdByMoveId[move.moveId] = argId;
      results.push({
        moveId: move.moveId,
        expectedStatus: move.expectedStatus,
        actualStatus: 'posted',
        argumentId: argId,
        errorCode: null,
        errorDetail: null,
      });
      console.log(`[runner] ${move.moveId} posted as ${argId}`);
    } else {
      const errCode =
        typeof result.error === 'object' && result.error ? result.error.error || 'unknown' : String(result.error);
      results.push({
        moveId: move.moveId,
        expectedStatus: move.expectedStatus,
        actualStatus: `failed_${result.status}`,
        argumentId: null,
        errorCode: errCode,
        errorDetail: result.detail || null,
      });
      console.warn(`[runner] ${move.moveId} failed_${result.status} (${errCode})`);
    }
  }

  const logPath = writeRunLog({
    scenarioId: cfg.scenarioId,
    dateIso: new Date().toISOString(),
    roomId: debateId,
    aliasByEmail,
    results,
    notes: [
      `Personas mapped: ${Object.entries(authorAliasToBotAlias).map(([k, v]) => `${k}→${v}`).join(', ')}`,
      `Bots used: ${cfg.bots.length}`,
      `submit-argument calls: ${results.length}`,
      `successes: ${results.filter((r) => r.actualStatus === 'posted').length}`,
      `failures: ${results.filter((r) => r.actualStatus.startsWith('failed_')).length}`,
    ].join('\n'),
  });

  console.log(`[runner] log written: ${logPath}`);
  const failures = results.filter((r) => r.actualStatus !== 'posted');
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[fatal]', err.message);
  process.exit(99);
});
