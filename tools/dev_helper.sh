#!/bin/bash
set -e

while true; do
  echo "\n=== Developer Helper Menu ==="
  echo "1) Lint/format all rules and docs (prettier)"
  echo "2) Generate ToC and cross-references"
  echo "3) Sync roadmap/plans"
  echo "4) Create/search/edit rules (CLI)"
  echo "5) Exit"
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
      exit 0
      ;;
    *)
      echo "Unknown option."
      ;;
  esac
done 