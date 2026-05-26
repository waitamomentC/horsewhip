#!/usr/bin/env bash
# Install Horsewhip protocol into a user project (does not overwrite CLAUDE.md by default)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROTOCOL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-.}"
TARGET="$(cd "$TARGET" && pwd)"
BRANCH="${HW_BRANCH:-main}"
BASE_URL="${HW_URL:-https://raw.githubusercontent.com/waitamomentC/horsewhip/${BRANCH}}"

MODE="rules-only"
SNIPPET=0
DRY=0

usage() {
  cat <<'EOF'
Usage: install-claude-horsewhip.sh [PROJECT_DIR] [options]

  Installs AGENTS.md + .claude/rules/horsewhip-protocol.md (does NOT touch CLAUDE.md by default)

Options:
  --with-claude-md    Create CLAUDE.md from template only if missing
  --snippet           Print snippet for existing CLAUDE.md
  --append-snippet    Append snippet (backs up CLAUDE.md)
  --offline           Use local horsewhip repo (HW_REPO or script location)
  --branch BRANCH     GitHub raw branch (default: main)
  --dry-run
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-claude-md) MODE="with-claude" ; shift ;;
    --snippet) SNIPPET=1 ; shift ;;
    --append-snippet) SNIPPET=2 ; shift ;;
    --offline) BASE_URL="file://${HW_REPO:-$REPO_ROOT}" ; shift ;;
    --branch) BRANCH="$2"; BASE_URL="https://raw.githubusercontent.com/waitamomentC/horsewhip/${BRANCH}"; shift 2 ;;
    --dry-run) DRY=1 ; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    *) TARGET="$(cd "$1" && pwd)"; shift ;;
  esac
done

fetch() {
  local rel="$1" dest="$2"
  if [[ "$BASE_URL" == file://* ]]; then
    local src="${BASE_URL#file://}/$rel"
    [[ -f "$src" ]] || { echo "Missing: $src" >&2; exit 1; }
    if [[ $DRY -eq 1 ]]; then echo "cp $src -> $dest"
    else mkdir -p "$(dirname "$dest")" && cp "$src" "$dest"
    fi
  else
    if [[ $DRY -eq 1 ]]; then echo "curl $BASE_URL/$rel -> $dest"
    else mkdir -p "$(dirname "$dest")" && curl -fsSL -o "$dest" "$BASE_URL/$rel"
    fi
  fi
}

SNIPPET_FILE="$PROTOCOL_DIR/templates/CLAUDE.snippet-horsewhip.md"
RULES_DIR="$TARGET/.claude/rules"
RULES_FILE="$RULES_DIR/horsewhip-protocol.md"
AGENTS_FILE="$TARGET/AGENTS.md"
CLAUDE_FILE="$TARGET/CLAUDE.md"

if [[ $SNIPPET -eq 1 ]]; then
  cat "$SNIPPET_FILE"
  exit 0
fi

if [[ $SNIPPET -eq 2 ]]; then
  if [[ ! -f "$CLAUDE_FILE" ]]; then
    echo "No CLAUDE.md — use --with-claude-md first." >&2
    exit 1
  fi
  bak="$CLAUDE_FILE.bak.$(date +%Y%m%d%H%M%S)"
  if [[ $DRY -eq 1 ]]; then echo "append snippet; backup $bak"
  else
    cp "$CLAUDE_FILE" "$bak"
    { echo ""; cat "$SNIPPET_FILE"; } >> "$CLAUDE_FILE"
    echo "Appended snippet. Backup: $bak"
  fi
  exit 0
fi

echo "→ Installing Horsewhip protocol into: $TARGET"

if [[ "$BASE_URL" == file://* ]]; then
  [[ $DRY -eq 1 ]] || node "$PROTOCOL_DIR/scripts/sync.mjs"
  if [[ $DRY -eq 1 ]]; then
    echo "cp $REPO_ROOT/AGENTS.md -> $AGENTS_FILE"
    echo "cp $REPO_ROOT/.claude/rules/horsewhip-protocol.md -> $RULES_FILE"
  else
    cp "$REPO_ROOT/AGENTS.md" "$AGENTS_FILE"
    mkdir -p "$RULES_DIR" && cp "$REPO_ROOT/.claude/rules/horsewhip-protocol.md" "$RULES_FILE"
  fi
else
  fetch "protocol/AGENTS.md" "$AGENTS_FILE"
  PREAMBLE_TMP="$(mktemp)"
  fetch "protocol/templates/claude-rules-preamble.md" "$PREAMBLE_TMP"
  if [[ $DRY -eq 1 ]]; then
    echo "combine preamble + AGENTS -> $RULES_FILE"
  else
    mkdir -p "$RULES_DIR"
    { cat "$PREAMBLE_TMP"; echo ""; cat "$AGENTS_FILE"; } > "$RULES_FILE"
    rm -f "$PREAMBLE_TMP"
  fi
fi

if [[ "$MODE" == "with-claude" ]]; then
  if [[ -f "$CLAUDE_FILE" ]]; then
    echo "⚠ CLAUDE.md exists — skipped."
  else
    fetch "protocol/templates/CLAUDE.horsewhip-user.md" "$CLAUDE_FILE"
    echo "✓ Created CLAUDE.md from template."
  fi
else
  if [[ -f "$CLAUDE_FILE" ]]; then
    echo "✓ Left CLAUDE.md unchanged (--snippet to add pointer)."
  fi
fi

echo "✓ AGENTS.md"
echo "✓ .claude/rules/horsewhip-protocol.md"
