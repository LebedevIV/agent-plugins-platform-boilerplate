# .cursor/rules/ — Modular Rules for Cursor AI

This directory contains all rules and standards for automation and AI assistants in the Agent Plugins Platform.

## Principles
- Each rule is a separate .mdc file (one rule — one file)
- Grouped by topic: development principles, architecture, plugin standards, UI/UX, workflow, documentation, etc.
- Each file contains: a short description, globs, the rule itself, and (optionally) examples or related links
- All rules are in English (except user commands, which remain in Russian)
- README and index.mdc help with navigation and search

## CLI Scripts

- **create-rule.js** — Interactive CLI to create a new .mdc rule file from a template. Prompts for all required fields and updates index/README automatically.
  - Usage: `node .cursor/rules/create-rule.js`
- **generate-rules-index.js** — Scans all .mdc files and regenerates `index.mdc` and the structure section in `README.md`.
  - Usage: `node .cursor/rules/generate-rules-index.js`
- **check-rules-structure.js** — Validates all .mdc files for required sections, uniqueness, and valid related links. Used in CI.
  - Usage: `node .cursor/rules/check-rules-structure.js`

## Example Structure
```
.cursor/
  rules/
    architecture/
      architecture-chat-system.mdc
      architecture-error-handling.mdc
      architecture-observability.mdc
      architecture-performance.mdc
      architecture-plugin.mdc
      architecture-project-structure.mdc
      architecture-security.mdc
      architecture-workflow.mdc
      project-architecture.mdc
    dev/
      dev-principle-01-do-no-harm.mdc
      dev-principle-02-ai-first-docs.mdc
      dev-principle-03-best-practices.mdc
      dev-principle-04-fail-fast-safe.mdc
      dev-principle-05-observability.mdc
      dev-principle-06-config-as-code.mdc
      dev-principle-07-progressive-enhancement.mdc
      dev-principle-08-data-integrity-privacy.mdc
      dev-principle-09-continuous-learning.mdc
      dev-principle-10-ecosystem-thinking.mdc
      development-guidelines.mdc
      security-and-deployment.mdc
      testing-and-debugging.mdc
      typescript.mdc
    doc/
      ai-first.mdc
      knowledge-map.mdc
      memorybank-quality.mdc
      restore-context.mdc
      user-commands.mdc
    plugin/
      plugin-best-practices.mdc
      plugin-documentation.mdc
      plugin-error-handling.mdc
      plugin-performance.mdc
      plugin-security.mdc
      plugin-structure.mdc
      plugin-testing.mdc
    security/
      validation.mdc
    ui/
      accessibility.mdc
      ui-accessibility.mdc
      ui-animation.mdc
      ui-error-handling.mdc
      ui-forms.mdc
      ui-loading-states.mdc
      ui-mobile.mdc
      ui-navigation.mdc
      ui-performance.mdc
      ui-react-components.mdc
      ui-styling.mdc
      ui-testing.mdc
    workflow/
      automation.mdc
      branches.mdc
      workflow.mdc
```

---
## AI Fallback Rule

If an AI agent cannot answer a question from its own memory-bank, it must first check the .rules directory, then the memory-bank directory. See [doc/ai-fallback.rules.md](./doc/ai-fallback.rules.md).
---

## How to Use
- The AI assistant should always refer to specific .mdc files when making decisions
- To add a new rule: create a separate .mdc file in the appropriate section (preferably via the CLI)
- To find a rule: use index.mdc or README.md, or search by file name 