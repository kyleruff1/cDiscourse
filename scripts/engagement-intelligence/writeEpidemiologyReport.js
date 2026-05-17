/**
 * Build a committable Markdown epidemiology report from an
 * `EpidemiologyAggregate` plus the per-pair interpretations.
 *
 * Pure / CommonJS. Caller is responsible for writing to disk.
 */

function pct(num, denom) { return denom === 0 ? '0%' : `${Math.round((num / denom) * 100)}%`; }

function bucketRows(buckets) {
  const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return ['_(no pairs)_'];
  return entries.map(([k, v]) => `- \`${k}\` — ${v}`);
}

function ruleCandidateRows(candidates) {
  if (!candidates || candidates.length === 0) return ['_(none)_'];
  return candidates.map((c) =>
    `- **${c.title}** — target: \`${c.targetAppSurface}\`; predicate: \`${c.deterministicPredicateName}\`; examples: ${c.examplePairIds.length}`,
  );
}

function buildReportMarkdown(aggregate, interpretations) {
  const date = (aggregate.collectedAt || new Date().toISOString()).slice(0, 10);
  const total = aggregate.replyPairCount;
  const lines = [];
  lines.push(`# Engagement Epidemiology — ${date}`);
  lines.push('');
  lines.push(`_Run id_: \`${aggregate.runId}\``);
  lines.push(`_Source mode_: \`${aggregate.source}\``);
  lines.push(`_Stories_: ${aggregate.storyCount}  ·  _Root posts_: ${aggregate.rootPostCount}  ·  _Reply pairs_: ${total}  ·  _Excluded_: ${aggregate.excludedCount}`);
  lines.push(`_X API live calls_: NO  ·  _xAI live calls_: NO  ·  _service-role used_: NO  ·  _user-review required_: ALWAYS`);
  lines.push('');
  lines.push('## Stance distribution');
  lines.push('');
  lines.push('| primaryStance | count | % |');
  lines.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(aggregate.stanceDistribution)) {
    lines.push(`| \`${k}\` | ${v} | ${pct(v, total)} |`);
  }
  lines.push('');
  lines.push('## Agreement × disagreement heatmap');
  lines.push('');
  lines.push(...bucketRows(aggregate.agreementDisagreementHeatmap.buckets));
  lines.push('');
  lines.push('## Disagreement type distribution');
  lines.push('');
  lines.push('| disagreementType | count | % |');
  lines.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(aggregate.disagreementTypeDistribution)) {
    lines.push(`| \`${k}\` | ${v} | ${pct(v, total)} |`);
  }
  lines.push('');
  lines.push('## Agreement type distribution');
  lines.push('');
  lines.push('| agreementType | count | % |');
  lines.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(aggregate.agreementTypeDistribution)) {
    lines.push(`| \`${k}\` | ${v} | ${pct(v, total)} |`);
  }
  lines.push('');
  lines.push('## Top reply functions');
  lines.push('');
  lines.push('| replyFunction | count |');
  lines.push('|---|---:|');
  for (const r of aggregate.topReplyFunctions) lines.push(`| \`${r.replyFunction}\` | ${r.count} |`);
  lines.push('');
  lines.push('## Rule candidates (advisory only — none auto-wired)');
  lines.push('');
  lines.push(...ruleCandidateRows(aggregate.topRuleCandidates));
  lines.push('');
  lines.push('## Sample interpretations (first 10)');
  lines.push('');
  for (const i of (interpretations || []).slice(0, 10)) {
    const v = i.finalVector;
    lines.push(`### \`${i.pairId}\``);
    lines.push(`- stance: \`${v.primaryStance}\` · function: \`${v.replyFunction}\` · confidence: \`${i.confidence}\``);
    lines.push(`- agreement: ${v.agreementScore.toFixed(2)} (\`${v.agreementType}\`) · disagreement: ${v.disagreementScore.toFixed(2)} (\`${v.disagreementType}\`) · coexistence: ${v.coexistenceScore.toFixed(2)} · uncertainty: ${v.uncertaintyScore.toFixed(2)}`);
    lines.push(`- labels: ${i.labels.length ? i.labels.map((l) => `\`${l}\``).join(', ') : '_(none)_'}`);
    lines.push(`- rationale: ${v.scalarRationale}`);
    lines.push('');
  }
  lines.push('## Compliance');
  lines.push('');
  lines.push('- [x] Official X API only (no scraping, no browser automation)');
  lines.push('- [x] No raw post IDs / handles / URLs / emails in this report');
  lines.push('- [x] xAI calls not made (or, if made, advisory and merged at most)');
  lines.push('- [x] No moderation recommendations; outputs are advisory');
  lines.push('- [x] No truth claims; no winner / loser; no bad-faith / liar / extremist labels');
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(aggregate.notes || '_(none)_');
  lines.push('');
  return lines.join('\n');
}

module.exports = { buildReportMarkdown };
