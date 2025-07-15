
---
## Working with AI: Fallback Rule

When working with the AI assistant, if it cannot answer from its own memory, it will first consult the .rules directory, then the memory-bank directory. This ensures all project knowledge is accessible and up-to-date. See [.cursor/rules/doc/ai-fallback.rules.md](../.cursor/rules/doc/ai-fallback.rules.md).
---

---
## Branch Protection: main & develop

- Direct push to main and develop is forbidden (enforced both locally and on GitHub).
- All changes must go through feature/fix/doc branches, merged into develop, and only then into main via PR.
- Local pre-push hook (.husky/pre-push) blocks direct push to main and develop:
  ```sh
  #!/bin/sh
  bash bash-scripts/prevent-main-develop-push.sh
  ```
- See [.cursor/rules/dev/git-workflow.rules.md](../.cursor/rules/dev/git-workflow.rules.md) for details.
--- 