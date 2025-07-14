# Cursor Rules System — Modular, AI-First, Automated

This document describes the principles, structure, automation, and best practices for organizing `.cursor/rules/` in a modern, AI-friendly, and scalable way. Use this as a template to implement the same system in any project.

---

## 1. Introduction

The `.cursor/rules/` system is designed for:
- Maximum clarity and maintainability for both humans and AI assistants
- Easy navigation, search, and automation
- Seamless scaling as the number of rules grows
- Full compatibility with AI-first workflows and best practices

---

## 2. Core Principles & Rationale

- **English-First**: All rules, docs, and comments are in English for maximum AI and team compatibility. (User commands may remain in the original language for clarity.)
- **One Rule — One File**: Each `.mdc` file contains exactly one rule or standard. This enables modularity, easy linking, and granular automation.
- **Topic-Based Folders**: Rules are grouped by topic (e.g., `dev-principles/`, `architecture/`, `plugin/`, `ui/`, `workflow/`, `doc/`).
- **Explicit Metadata**: Each rule file includes `description:`, `globs:`, `alwaysApply:`, and (optionally) `related:` and `examples:`.
- **Cross-Referencing**: Related rules are linked via a `related:` section for easy navigation and AI context.
- **Automation-First**: Index and documentation are always up-to-date via CLI scripts and CI.
- **AI-First Documentation**: All rules are written with clarity for both humans and AI, with explicit logic and rationale.

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
```

---

## 4. Rule File Format (`.mdc`)

Each rule file must contain:
- `# Heading` — short, clear title
- Main rule body (bulleted or short paragraphs)
- `related:` — (optional) list of related rule files
- `description:` — short summary for index/search
- `globs:` — file globs for rule application
- `alwaysApply:` — usually `false`
- `---` — end of metadata
- (Optional) `# Examples` section

**Example:**
```
# Plugin Error Handling
- Graceful Degradation: Continue working with reduced functionality
- User Feedback: Provide clear error messages to users
- Logging: Log errors for debugging without exposing sensitive data
- Fallbacks: Implement fallback mechanisms for critical features
- Recovery: Automatic retry mechanisms where appropriate

related:
  - plugin-security.mdc
  - architecture-error-handling.mdc

description: Error handling requirements for all plugins
globs:
  - public/plugins/*
alwaysApply: false
---

# Examples
- If a plugin fails, show a user-friendly error and log the details for debugging.
```

---

## 5. Automation & CLI

- **CLI Scripts** (in `.cursor/rules/`):
  - `create-rule.cjs` — Interactive CLI to create a new rule file from a template. Updates index/README automatically.
  - `generate-rules-index.cjs` — Scans all `.mdc` files (recursively) and regenerates `index.mdc` and the structure section in `README.md`.
  - `check-rules-structure.cjs` — Validates all `.mdc` files for required sections, uniqueness, and valid related links. Used in CI.
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
- Always provide a clear heading, description, globs, and (if possible) related links
- Use English for all content except user commands (which may remain in the original language)
- Run `generate-rules-index.cjs` after any manual changes
- Run `check-rules-structure.cjs` to validate before commit/PR

---

## 8. How to Port to Another Project

1. Copy `.cursor/rules/` (with all subfolders, scripts, and templates) to the new project
2. Add the GitHub Actions workflow to `.github/workflows/`
3. Update or add rules as needed for the new context
4. Run the CLI scripts to generate index/README and validate structure
5. (Optional) Update globs and descriptions for the new codebase
6. Document any project-specific conventions in `README.md`

---

## 9. FAQ & Troubleshooting

- **Q: Why English?**
  - For maximum AI compatibility and international team support
- **Q: Why one rule per file?**
  - For modularity, easy linking, and granular automation
- **Q: What if I need a new topic?**
  - Just create a new folder and add rules there
- **Q: How to avoid duplicates?**
  - Use `check-rules-structure.cjs` and always search before adding
- **Q: How to update navigation?**
  - Run `generate-rules-index.cjs` after any changes

---

## 10. Appendix: Templates & Examples

**Rule Template:**
```
# [Rule Title]
- [Main points]

related:
  - [other-rule.mdc]

description: [Short summary]
globs:
  - [glob patterns]
alwaysApply: false
---

# Examples
- [Example usage]
```

**CLI Usage:**
- `node .cursor/rules/create-rule.cjs`
- `node .cursor/rules/generate-rules-index.cjs`
- `node .cursor/rules/check-rules-structure.cjs`

---

**This system is proven, scalable, and AI-friendly. Copy, adapt, and use it in any project!** 