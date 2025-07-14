#!/bin/bash
set -e

# === Safe Remove Function ===
PROTECTED_DIRS=("docs" ".cursor" "memory-bank" "docs/for-ai-best-practices" "platform-core" "chrome-extension/public/plugins")

safe_rm() {
  for protected in "${PROTECTED_DIRS[@]}"; do
    if [[ "$1" == "$protected"* ]]; then
      echo "❌ ERROR: Attempt to delete protected directory: $1"
      return 1
    fi
  done
  rm -rf "$1"
  echo "✅ Directory $1 deleted"
}

while true; do
  echo "\n=== Developer Helper Menu ==="
  echo "1) Lint/format all rules and docs (prettier)"
  echo "2) Generate ToC and cross-references"
  echo "3) Sync roadmap/plans"
  echo "4) Create/search/edit rules (CLI)"
  echo "5) Safe remove directory (demo)"
  echo "6) Exit"
  read -p "Choose an option: " opt
  case $opt in
    1)
      if command -v prettier >/dev/null 2>&1; then
        prettier --write .cursor/rules/**/*.mdc docs/**/*.md memory-bank/**/*.md || true
      else
        echo "Prettier not found. Please install it (npm i -g prettier)."
      fi
      ;;
    2)
      node tools/generate-toc-and-crossrefs.cjs
      ;;
    3)
      python3 tools/sync_plans.py
      ;;
    4)
      echo "--- Rule CLI ---"
      echo "a) Add rule"
      echo "b) Search rules"
      echo "c) Edit rule"
      echo "d) List rules"
      read -p "Choose CLI action: " cliopt
      case $cliopt in
        a) node .cursor/rules/create-rule.cjs ;;
        b) echo "Not implemented: use grep or search in your editor." ;;
        c) echo "Not implemented: open file in editor manually." ;;
        d) find .cursor/rules -name '*.mdc' | sort ;;
        *) echo "Unknown CLI action" ;;
      esac
      ;;
    5)
      read -p "Enter directory to remove: " dir
      safe_rm "$dir"
      ;;
    6)
      exit 0
      ;;
    *)
      echo "Unknown option."
      ;;
  esac
done 