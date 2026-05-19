#!/usr/bin/env bash
# HOST-001 — bash wrapper around inject-runtime-env.mjs.
#
# Usage:
#   ./scripts/build/inject-runtime-env.sh
#   ./scripts/build/inject-runtime-env.sh --dry
#   ./scripts/build/inject-runtime-env.sh --url 'https://x.supabase.co' --publishable-key 'sb_publishable_...'
#
# Pulls values from env or from explicit flags; never reads .env files. Delegates
# to the cross-platform Node entrypoint so the validation logic stays in one place.

set -euo pipefail

DRY=0
URL=""
KEY=""
DIST_DIR="dist"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry|--dry-run)
      DRY=1
      shift
      ;;
    --url)
      URL="$2"
      shift 2
      ;;
    --url=*)
      URL="${1#*=}"
      shift
      ;;
    --publishable-key)
      KEY="$2"
      shift 2
      ;;
    --publishable-key=*)
      KEY="${1#*=}"
      shift
      ;;
    --dist-dir)
      DIST_DIR="$2"
      shift 2
      ;;
    --dist-dir=*)
      DIST_DIR="${1#*=}"
      shift
      ;;
    --help|-h)
      cat <<'EOF'
inject-runtime-env.sh — write <dist>/runtime-env.js for the SPA.

Flags:
  --url <url>                  EXPO_PUBLIC_SUPABASE_URL value (defaults to env).
  --publishable-key <key>      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY value (defaults to env).
  --dist-dir <path>            Output directory (default: dist).
  --dry / --dry-run            Plan only.
  --help / -h                  Show this help.

Doctrine: no env-file reads, never echoes values, refuses on forbidden shapes.
EOF
      exit 0
      ;;
    *)
      printf 'inject-runtime-env: unknown arg: %s\n' "$1" >&2
      exit 64
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NODE_ENTRY="$SCRIPT_DIR/inject-runtime-env.mjs"

args=("$NODE_ENTRY" "--dist-dir=$DIST_DIR")
if [ "$DRY" -eq 1 ]; then args+=("--dry"); fi
if [ -n "$URL" ]; then args+=("--url=$URL"); fi
if [ -n "$KEY" ]; then args+=("--publishable-key=$KEY"); fi

cd "$REPO_ROOT"
exec node "${args[@]}"
