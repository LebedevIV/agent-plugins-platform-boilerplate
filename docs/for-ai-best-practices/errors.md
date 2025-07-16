---

> **See also:** [memory-bank/errors.md](../../memory-bank/errors.md) — the main error graveyard for all cross-topic and general issues, solutions, and takeaways.

---

# Error Graveyard: ESLint, commitlint, Husky (flat config + type: module)

## Problem
- Commit fails due to ESLint plugin incompatibility with flat config (ESLint 9+).
- commitlint.config.js fails to load as ESM in a project with type: module.
- Husky warns about deprecated lines in commit-msg hook.

## Solution
1. Temporarily removed incompatible plugins and rules from eslint.config.ts.
2. Expanded ignores to exclude non-target files.
3. Renamed commitlint.config.js to commitlint.config.cjs (CommonJS for type: module).
4. Removed deprecated lines from .husky/commit-msg.
5. After these steps, commit and push succeeded.

## Takeaways
- For Node.js with type: module, all configs that must be CommonJS should use the .cjs extension.
- For ESLint flat config, always specify ignores and avoid plugins that do not support flat config.
- All steps and solutions are documented in docs/for-ai-best-practices and memory-bank. 