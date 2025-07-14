# Cursor Rules System — Modular, AI-First, Automated

This document describes the principles, structure, automation, and best practices for organizing `.cursor/rules/` in a modern, AI-friendly, and scalable way. Use this as a template to implement the same system in any project.

---

## 1. Introduction

The `.cursor/rules/` system is designed for:
- Maximum clarity and maintainability for both humans and AI assistants
- Fast navigation, search, and automation
- Seamless scaling as the number of rules grows
- Full compatibility with AI-first workflows and best practices
- Automated cross-referencing and documentation

---

## 2. Core Principles & Rationale

- **English-First**: All rules, docs, and comments are in English for maximum AI and team compatibility. (User commands may remain in the original language for clarity.)
- **One Rule — One File**: Each `.mdc` file contains exactly one rule or standard. This enables modularity, easy linking, and granular automation.
- **Topic-Based Folders**: Rules are grouped by topic (e.g., `dev-principles/`, `architecture/`, `plugin/`, `ui/`, `workflow/`, `doc/`).
- **Category Expansion**: For large projects, use more granular folders: `security/`, `workflow/`, `code-style/`, `automation/`, `memorybank/`, `dev-experience/`.
- **Explicit Metadata**: Each rule file includes `description:`, `globs:`, `alwaysApply:`, and (optionally) `related:` and `examples:`.
- **Cross-Reference Policy**: Every rule or doc should include links to all relevant files (related rules, onboarding, progress, user commands, architecture, graveyard, etc.) in a `Cross-References` section.
- **Automation-First**: Index, summary, and cross-references are auto-generated and checked by scripts for all `.md`/`.mdc` files.
- **AI-First Documentation**: All rules are written with clarity for both humans and AI, with explicit logic, rationale, and cross-links.

---

## 3. Directory & File Structure

```
.cursor/
  rules/
    README.md
    index.mdc
    dev-principles/
      01-do-no-harm.mdc
      ...
    architecture/
      project-structure.mdc
      ...
    plugin/
      structure.mdc
      ...
    ui/
      accessibility.mdc
      ...
    workflow/
      branches.mdc
      ...
    doc/
      ai-first.mdc
      user-commands.mdc
      ...
    security/
      security-principles.mdc
      ...
    code-style/
      typescript-best-practices.mdc
      ...
    automation/
      automation.mdc
      ...
    memorybank/
      memorybank-quality.mdc
      knowledge-map.mdc
      ...
    dev-experience/
      user-commands.mdc
      ...
```

---

## 4. Rule File Format (`.mdc`)

Each rule file must contain:
- `# Heading` — short, clear title
- **Category** (optional but recommended for large projects)
- Main rule body (bulleted or short paragraphs)
- **Rationale** — why this rule is important (AI/Dev/Team context)
- **Example** — code/config/example if relevant
- `related:` — (optional) list of related rule files
- **Cross-References** — (optional but recommended) links to onboarding, progress, user commands, architecture, graveyard, etc.
- `description:` — short summary for index/search
- `globs:` — file globs for rule application
- `alwaysApply:` — usually `false`
- `---` — end of metadata

**Example:**
```
# Plugin Error Handling

**Category:** plugin

- Graceful Degradation: Continue working with reduced functionality
- User Feedback: Provide clear error messages to users
- Logging: Log errors for debugging without exposing sensitive data
- Fallbacks: Implement fallback mechanisms for critical features
- Recovery: Automatic retry mechanisms where appropriate

## Rationale
Clear error handling ensures plugins do not break the user experience and are easy to debug for both developers and AI.

## Example
If a plugin fails, show a user-friendly error and log the details for debugging.

related:
  - plugin-security.mdc
  - architecture-error-handling.mdc

## Cross-References
- [Onboarding](../../docs/onboarding.md) — for new developer guidance
- [Progress](../../memory-bank/progress.md) — for current project status
- [User Commands](../../docs/USER_COMMANDS.md) — for automation commands
- [Architecture](../../memory-bank/codebase-architecture.md) — for system overview

description: Error handling requirements for all plugins
globs:
  - public/plugins/*
alwaysApply: false
---
```

---

## 5. Automation & CLI

- **CLI Scripts** (in `.cursor/rules/`):
  - `create-rule.cjs` — Interactive CLI to create a new rule file from a template. Updates index/README automatically.
  - `generate-rules-index.cjs` — Scans all `.mdc` files (recursively) and regenerates `index.mdc` and the structure section in `README.md`.
  - `check-rules-structure.cjs` — Validates all `.mdc` files for required sections, uniqueness, and valid related links. Used in CI.
- **Advanced CLI/Helper Scripts** (optional):
  - `list` — Show structure of all rules by folder
  - `search <keyword>` — Search rules by keyword
  - `add <category> <filename.mdc>` — Create a new rule from template
  - `edit <relpath>` — Edit a rule by relative path
  - `generate-toc` — Recursively updates ToC, summary, and required cross-references for all `.md`/`.mdc` files
  - `security-audit` — Checks Docker, .env, dependencies, outputs `audit-report.md`
- **Usage:**
  - `node .cursor/rules/create-rule.cjs`
  - `node .cursor/rules/generate-rules-index.cjs`
  - `node .cursor/rules/check-rules-structure.cjs`

---

## 6. CI Integration

- **GitHub Actions** workflow (`.github/workflows/rules-check.yml`):
  - Runs on every push/PR to `.cursor/rules/`
  - Regenerates index/README and checks for uncommitted changes
  - Validates all rules for structure and related links
  - Fails the build if any issues are found
- **Advanced CI (optional):**
  - Runs ToC/cross-reference automation, security/performance audit, and roadmap sync

**Example:**
```yaml
name: Rules Structure Check
on:
  push:
    paths:
      - '.cursor/rules/**'
  pull_request:
    paths:
      - '.cursor/rules/**'
jobs:
  check-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Generate index and README structure
        run: node .cursor/rules/generate-rules-index.cjs
      - name: Check for uncommitted changes
        run: |
          git diff --exit-code || (echo 'index.mdc or README.md is outdated. Please run generate-rules-index.cjs and commit the result.' && exit 1)
      - name: Check rules structure
        run: node .cursor/rules/check-rules-structure.cjs
```

---

## 7. How to Add/Update Rules

- Use `create-rule.cjs` to add new rules (enforces template and updates navigation)
- Always provide a clear heading, rationale, example, and cross-references
- Use English for all content except user commands (which may remain in the original language)
- Run `generate-rules-index.cjs` after any manual changes
- Run `check-rules-structure.cjs` to validate before commit/PR
- For advanced projects, use the CLI/ToC/cross-reference automation and developer helper scripts

---

## 8. How to Port to Another Project

1. Copy `.cursor/rules/` (with all subfolders, scripts, and templates) to the new project
2. Add the GitHub Actions workflow to `.github/workflows/`
3. Update or add rules as needed for the new context
4. Run the CLI scripts to generate index/README and validate structure
5. (Optional) Update globs and descriptions for the new codebase
6. Document any project-specific conventions in `README.md`
7. (Optional) Add advanced automation for ToC, cross-references, and roadmap sync

---

## 9. Advanced Practices: Roadmap & Synchronization

- **User-Facing Roadmap:**
  - All current and planned automation, DevOps, and AI improvements are published in `docs/PLANS.md` for easy access by users and contributors.
  - This file is always in sync with the technical/AI roadmap in `memory-bank/progress.md`.
- **AI/Dev Roadmap:**
  - `memory-bank/progress.md` contains the full, detailed, and always up-to-date list of planned improvements, technical context, and project status for AI/LLM and the core team.
- **Synchronization Mechanism:**
  - The section `## Planned Automation & Improvements` is automatically synchronized between `memory-bank/progress.md` and `docs/PLANS.md` using a script (e.g., `tools/sync_plans.py`).
  - This script can be run manually or automatically in CI.
  - Any update to plans in one file is reflected in the other, ensuring both user and AI/Dev audiences always see the latest roadmap.
- **Best Practice:**
  - Always update plans in `memory-bank/progress.md` (the source of truth), then run the sync script or let CI handle it.
  - Reference `docs/PLANS.md` in onboarding, README, and user docs for maximum transparency.

---

## 10. FAQ & Troubleshooting

- **Q: Why English?**
  - For maximum AI compatibility and international team support
- **Q: Why one rule per file?**
  - For modularity, easy linking, and granular automation
- **Q: What if I need a new topic?**
  - Just create a new folder and add rules there
- **Q: How to avoid duplicates?**
  - Use the CLI search and always check before adding
- **Q: How to update navigation?**
  - Run the ToC/summary automation after any changes

---

## 11. Appendix: Templates & Examples

**Rule Template:**
```
# [Rule Title]

**Category:** [security|workflow|code-style|automation|memorybank|dev-experience]

## Rule
Describe the rule clearly and concisely.

## Rationale
Why is this rule important? (AI/Dev/Team context)

## Example
Provide a code/config/example if relevant.

related:
  - [other-rule.mdc]

## Cross-References
- [Related Rule 1](../security/another-rule.mdc) — similar security policy
- [Graveyard](../../memory-bank/graveyard.md) — see failed solutions
- [Onboarding](../../docs/onboarding.md) — for new developer guidance
- [Progress](../../memory-bank/progress.md) — for current project status
- [User Commands](../../docs/USER_COMMANDS.md) — for automation commands
- [Architecture](../../memory-bank/codebase-architecture.md) — for system overview

description: [Short summary]
globs:
  - [glob patterns]
alwaysApply: false
---
```

**CLI Usage:**
- `node .cursor/rules/create-rule.cjs`
- `node .cursor/rules/generate-rules-index.cjs`
- `node .cursor/rules/check-rules-structure.cjs`

---

**This system is proven, scalable, and AI-friendly. Copy, adapt, and use it in any project!** 