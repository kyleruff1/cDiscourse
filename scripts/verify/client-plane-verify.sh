#!/usr/bin/env bash
# client-plane-verify.sh — repeatable, READ-ONLY client-plane verification skeleton.
#
# Mirrors docs/runbooks/client-plane-verify-runbook.md. Proves the live Netlify client
# is serving the current `main` build and that merged Build-2 (A–G machine-observation)
# mapping data renders for a real AUTHENTICATED user — safely, verdict-free, leak-safe —
# WITHOUT a browser sign-in, WITHOUT provider spend, WITHOUT writes.
#
# SAFETY POSTURE (by construction):
#   - Issues ONLY: GET to PostgREST/REST, the bundle GET, and ONE auth password-grant POST
#     (a login — no provider/model spend). It NEVER POSTs to /functions/v1/* (Edge functions),
#     submit-argument, classify-argument-boolean-observations, or any admin_validation path.
#   - No INSERT/UPDATE/DELETE. No productionEnabled flip. No deploy. No #394.
#   - Secrets are referenced by SHA-256 prefix + length only — never printed raw.
#   - Fails closed: every captured artifact is redaction-scanned; a hit aborts the run.
#   - Contains NO real credentials/tokens/emails/spans/bodies — all secrets read at runtime
#     from gitignored .env / .env.bot-tests (canonical loader: scripts/bot-fixtures/loadEnv.js).
#
# Usage:
#   bash scripts/verify/client-plane-verify.sh [--site <url>] [--bot A|B|C] [--rooms id,id,id]
#
# Exit: 0 = PASS, 1 = FAIL/finding, 2 = bad args / missing env.
set -euo pipefail

SITE="https://dev-cdiscourse.netlify.app"
BOT="A"
# #479 corpus rooms (known-populated with production A–G observations). Override with --rooms.
ROOMS="2a66ca93-750e-473d-abc6-753ba256c1b5,2315f479-69cc-416e-9767-ce8651a33f9b,8a158837-d6c3-408b-a8ff-4c6a4299d293"
ENV_CLIENT=".env"
ENV_BOT=".env.bot-tests"
SCRATCH=".claude-tmp"   # gitignored

while [[ $# -gt 0 ]]; do
  case "$1" in
    --site)  SITE="$2"; shift 2;;
    --bot)   BOT="$2"; shift 2;;
    --rooms) ROOMS="$2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

mkdir -p "$SCRATCH"
FAIL=0
note() { printf '\n=== %s ===\n' "$*"; }
ok()   { printf '  [PASS] %s\n' "$*"; }
bad()  { printf '  [FAIL] %s\n' "$*"; FAIL=1; }

# Secret fingerprint (never prints the value).
fp() { local v="$1"; printf 'len=%s sha=%s' "${#v}" "$(printf %s "$v" | sha256sum | cut -c1-12)"; }

# Read a single KEY=value from an env file, strip surrounding quotes. Never echoes the value.
envget() { grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//;s#/$##'; }

# Fail-closed redaction scan over a file. Aborts if any secret/PII shape is present.
SECRET_RE='sk-ant-[A-Za-z0-9_-]{8,}|sb_secret_[A-Za-z0-9_-]{8,}|SUPABASE_SERVICE_ROLE|RESEND_API_KEY|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
redact_guard() {
  local f="$1"
  if grep -aoEq "$SECRET_RE" "$f" 2>/dev/null; then
    echo "ABORT: secret-shaped string found in artifact $f — not saving/printing." >&2
    exit 1
  fi
}

# ── Step 1: source-of-truth ──────────────────────────────────────────────────
note "1. source-of-truth (main)"
git fetch origin main >/dev/null 2>&1 || true
HEAD_SHA="$(git rev-parse --short origin/main)"
LOCAL_MAIN="$(git rev-parse main 2>/dev/null || echo none)"
[[ "$LOCAL_MAIN" == "$(git rev-parse origin/main)" ]] && ok "local main == origin/main ($HEAD_SHA)" || echo "  [note] local main != origin/main (run from a clean pulled main)"
echo "  current main = $HEAD_SHA"

# ── Step 2: env presence ─────────────────────────────────────────────────────
note "2. env"
[[ -f "$ENV_CLIENT" ]] && ok "$ENV_CLIENT present" || { bad "$ENV_CLIENT missing"; exit 2; }
[[ -f "$ENV_BOT" ]] && ok "$ENV_BOT present" || { bad "$ENV_BOT missing"; exit 2; }
SUPA_URL="$(envget "$ENV_BOT" EXPO_PUBLIC_SUPABASE_URL)"
ANON="$(envget "$ENV_BOT" EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
[[ -n "$SUPA_URL" && -n "$ANON" ]] && ok "supabase url + anon loaded (anon $(fp "$ANON"))" || { bad "supabase url/anon missing"; exit 2; }

# ── Step 3: live bundle — secrets + Build-2 markers ──────────────────────────
note "3. live bundle (secrets + Build-2 markers)"
curl -s --max-time 25 "$SITE/" -o "$SCRATCH/cpv-index.html"
BREF="$(grep -oE '/_expo/static/js/web/index-[0-9a-f]+\.js' "$SCRATCH/cpv-index.html" | head -1)"
echo "  live bundle ref: ${BREF:-<none>}"
[[ -n "$BREF" ]] || { bad "no bundle ref in live index.html"; }
if [[ -n "$BREF" ]]; then
  curl -s --max-time 45 "$SITE$BREF" -o "$SCRATCH/cpv-bundle.js"
  if grep -aoEq "$SECRET_RE" "$SCRATCH/cpv-bundle.js"; then bad "token-shaped secret in live bundle"; else ok "no token-shaped secrets in live bundle"; fi
  MISS=0
  for k in isolates_main_disagreement acknowledges_parent_strength question_invites_revision \
           records_remaining_disagreement defines_next_evidence_needed separates_normative_from_empirical \
           separates_observation_from_inference; do
    grep -aq "$k" "$SCRATCH/cpv-bundle.js" || { echo "  [miss] Build-2 marker absent: $k"; MISS=1; }
  done
  [[ "$MISS" == 0 ]] && ok "Build-2 D/F/G/A/B new-key markers present in bundle" || bad "≥1 Build-2 marker missing from bundle"
fi

# ── Step 4: family defs verdict-free (source) ────────────────────────────────
note "4. family definitions — verdict-free user-facing fields"
DEFGLOB="src/features/nodeLabels/machineObservationDefinitions/family"
HITS="$(grep -rhnE "^\s*(label|shortLabel|diagnostic|diagnosticSentence|doctrineNote):" ${DEFGLOB}{A,B,C,D,E,F,G}.ts 2>/dev/null \
  | grep -iE '\b(winner|loser|liar|dishonest|bad faith|manipulative|extremist|propagandist|\btrue\b|\bfalse\b|\bwon\b|\blost\b|correct|wrong)\b' || true)"
[[ -z "$HITS" ]] && ok "no verdict tokens in label/diagnostic/doctrineNote values" || { echo "$HITS"; bad "verdict token in a user-facing field"; }

# ── Step 5: authed bot login (fingerprint only) ──────────────────────────────
note "5. BOT_$BOT login (fingerprint only)"
BEMAIL="$(envget "$ENV_BOT" "CDISCOURSE_BOT_${BOT}_EMAIL")"
BPW="$(envget "$ENV_BOT" "CDISCOURSE_BOT_${BOT}_PASSWORD")"
[[ -n "$BEMAIL" && -n "$BPW" ]] || { bad "BOT_$BOT creds missing in $ENV_BOT"; exit 2; }
LOGIN="$(curl -s --max-time 25 -X POST "$SUPA_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  --data "{\"email\":\"$BEMAIL\",\"password\":\"$BPW\"}")"
TOK="$(printf %s "$LOGIN" | grep -oE '"access_token":"[^"]+"' | head -1 | sed 's/.*:"//;s/"$//')"
USERID="$(printf %s "$LOGIN" | grep -oE '"id":"[0-9a-f-]{36}"' | head -1 | sed 's/.*:"//;s/"$//')"
[[ -n "$TOK" ]] && ok "BOT_$BOT login OK (jwt $(fp "$TOK"))" || { bad "BOT_$BOT login failed"; exit 1; }
# Surface admin-role (a non-admin account is required to truly test the RLS boundary).
ROLE="$(curl -s --max-time 20 "$SUPA_URL/rest/v1/profiles?select=role&id=eq.$USERID" -H "apikey: $ANON" -H "Authorization: Bearer $TOK" 2>/dev/null | grep -oE '"role":"[^"]*"' | head -1 || true)"
echo "  BOT_$BOT profile role: ${ROLE:-<none/null>}  (note: a NON-admin account is needed to validate the RLS boundary empirically)"

# ── Step 6/7: client observation read (run_mode=production, room-scoped) ──────
note "6/7. client production observations (counts + key NAMES only)"
curl -s --max-time 40 \
  "$SUPA_URL/rest/v1/argument_machine_observation_results?select=family,raw_key,argument_machine_observation_runs!inner(run_mode)&debate_id=in.($ROOMS)&argument_machine_observation_runs.run_mode=eq.production&limit=3000" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK" > "$SCRATCH/cpv-obs.json"
redact_guard "$SCRATCH/cpv-obs.json"   # results carry evidence_span if columns were widened — fail closed
node -e '
const r=require("./'"$SCRATCH"'/cpv-obs.json");
if(!Array.isArray(r)){console.log("  [FAIL] observation read error:",JSON.stringify(r).slice(0,160));process.exit(3);}
const LET={parent_relation:"A",disagreement_axis:"B",misunderstanding_repair:"C",evidence_source_chain:"D",argument_scheme:"E",critical_question:"F",resolution_progress:"G"};
const NEW={parent_relation:["acknowledges_parent_strength","compares_parent_to_sibling_branch","identifies_parent_scope_limit"],disagreement_axis:["isolates_main_disagreement","distinguishes_fact_value_disagreement","preserves_face_while_disagreeing"],critical_question:["question_names_uncertainty","question_separates_claim_evidence","question_invites_revision"],resolution_progress:["records_remaining_disagreement","defines_next_evidence_needed","separates_normative_from_empirical"],evidence_source_chain:["names_method_difference","separates_observation_from_inference","flags_context_limit"]};
const by={};for(const x of r){(by[x.family]=by[x.family]||{n:0,k:new Set()});by[x.family].n++;by[x.family].k.add(x.raw_key);}
console.log("  client-visible production observations:",r.length);
let anyBuild2=false;
for(const f of Object.keys(by).sort()){const nm=(NEW[f]||[]).filter(k=>by[f].k.has(k));if(nm.length)anyBuild2=true;console.log(`    ${LET[f]||"?"} ${f}: ${by[f].n} rows, ${by[f].k.size} keys`+(nm.length?` | Build-2 NEW: ${nm.join(", ")}`:""));}
process.exit(anyBuild2?0:7);   // 7 = no Build-2 family rendered (distinguish data-absence in the runbook)
' || { rc=$?; if [[ $rc == 7 ]]; then echo "  [note] no Build-2 new keys in client-visible data — verify DATA-ABSENCE vs UI-failure per runbook step 7 (do NOT trigger fresh provider work)"; bad "no Build-2 family rendered (see note)"; else bad "observation read failed (rc=$rc)"; fi; }
[[ $FAIL == 0 ]] && ok "≥1 already-live Build-2 family renders present rows"

# ── Step 8: RLS leak boundary (policy attestation, source) ───────────────────
note "8. RLS leak boundary (policy source)"
POLFILE="$(grep -rl 'amor_results_select_via_run' supabase/migrations/ 2>/dev/null | head -1)"
if [[ -n "$POLFILE" ]]; then
  ok "results policy amor_results_select_via_run present ($POLFILE) → delegates to runs → public.arguments SELECT (own / participant-private / posted-public)"
  echo "  => observations + evidence_span are scoped to ARGUMENT visibility (never wider); admin observability surfaces exclude evidence_span by design."
else
  bad "amor_results_select_via_run policy not found in migrations"
fi

# ── Step 10: doctrine render-guard suites ────────────────────────────────────
note "10. doctrine render-guard suites"
if npx jest gameCopy nodeAnnotation observationMapping messageQualifier --silent >/dev/null 2>&1; then
  ok "render-doctrine suites green (no verdict tokens / no raw classifier IDs / code→plain-language / span redaction)"
else
  bad "render-doctrine suites FAILED — inspect: npx jest gameCopy nodeAnnotation observationMapping messageQualifier"
fi

# ── Verdict ──────────────────────────────────────────────────────────────────
note "VERDICT"
echo "  main=$HEAD_SHA  bundle=${BREF:-?}"
if [[ $FAIL == 0 ]]; then
  echo "  CLIENT-PLANE VERIFY — PASS (read-only; no spend; no writes). Record leak-safe on the Build-2 closeout PR."
  exit 0
else
  echo "  CLIENT-PLANE VERIFY — FAIL/FINDING. Do NOT post a PASS. Report the failing step; do NOT manufacture data with a provider call."
  exit 1
fi
