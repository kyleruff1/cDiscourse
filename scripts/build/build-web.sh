#!/usr/bin/env bash
# HOST-001 — bash wrapper for the Expo Web build.
#
# Usage:
#   ./scripts/build/build-web.sh                  # real build
#   ./scripts/build/build-web.sh --dry            # plan only
#   ./scripts/build/build-web.sh --output-dir custom-dist
#
# Doctrine:
#   - Does NOT read .env* files.
#   - Does NOT call Anthropic / xAI / X / Supabase / Resend.
#   - Does NOT deploy. Only produces ./<output-dir>.
#   - Refuses if output-dir resolves outside the repo root.

set -euo pipefail

DRY=0
OUTPUT_DIR="dist"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry|--dry-run)
      DRY=1
      shift
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --output-dir=*)
      OUTPUT_DIR="${1#*=}"
      shift
      ;;
    --help|-h)
      cat <<'EOF'
build-web.sh — produce the Expo Web static bundle.

Flags:
  --dry / --dry-run        Plan only. Prints what would run, exits 0.
  --output-dir <path>      Output directory (default: dist). Must stay inside the repo.
  --help / -h              Show this help.

Doctrine: no env-file reads, no network calls, no AI providers.
EOF
      exit 0
      ;;
    *)
      printf 'build-web: unknown arg: %s\n' "$1" >&2
      exit 64
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Resolve and refuse paths outside repo root.
RESOLVED_OUT="$(cd "$REPO_ROOT" && python3 -c "import os, sys; print(os.path.realpath(os.path.join(os.getcwd(), sys.argv[1])))" "$OUTPUT_DIR" 2>/dev/null || true)"
if [ -z "$RESOLVED_OUT" ]; then
  # Fallback if python3 is not available: do a best-effort prefix check.
  case "$OUTPUT_DIR" in
    /*) RESOLVED_OUT="$OUTPUT_DIR" ;;
    *) RESOLVED_OUT="$REPO_ROOT/$OUTPUT_DIR" ;;
  esac
fi

case "$RESOLVED_OUT" in
  "$REPO_ROOT"|"$REPO_ROOT"/*) : ;;
  *) printf 'refused: output-dir resolves outside repo root: %s\n' "$RESOLVED_OUT" >&2 ; exit 2 ;;
esac

printf '[build-web] repo root: %s\n' "$REPO_ROOT"
printf '[build-web] output dir: %s\n' "$RESOLVED_OUT"
if [ "$DRY" -eq 1 ]; then
  printf '[build-web] mode: dry-run (plan only)\n'
  printf '[build-web] would run: npx expo export --platform web --output-dir %s\n' "$OUTPUT_DIR"
  printf '[build-web] dry-run complete. No build executed.\n'
  exit 0
fi

printf '[build-web] mode: apply\n'
mkdir -p "$RESOLVED_OUT"

cd "$REPO_ROOT"
npx expo export --platform web --output-dir "$OUTPUT_DIR"

if ! command -v find >/dev/null 2>&1; then
  printf '[build-web] warning: find(1) not available; skipping dist summary.\n'
  exit 0
fi

COUNT="$(find "$RESOLVED_OUT" -type f | wc -l | tr -d ' ')"
BYTES="$(find "$RESOLVED_OUT" -type f -printf '%s\n' 2>/dev/null | awk 'BEGIN{s=0} {s+=$1} END{print s}')"
if [ -z "$BYTES" ]; then BYTES=0; fi

if [ "$BYTES" -lt 1024 ]; then
  HUMAN="${BYTES} B"
elif [ "$BYTES" -lt 1048576 ]; then
  HUMAN="$(awk -v b="$BYTES" 'BEGIN{printf "%.1f KiB", b/1024}')"
else
  HUMAN="$(awk -v b="$BYTES" 'BEGIN{printf "%.2f MiB", b/1048576}')"
fi

printf '[build-web] dist summary: %s files, %s\n' "$COUNT" "$HUMAN"

if [ "$COUNT" -eq 0 ]; then
  printf '[build-web] refused: dist is empty after build.\n' >&2
  exit 3
fi
