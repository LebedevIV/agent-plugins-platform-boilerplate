# CI/CD Integration for Docs & Rules

Automate validation, indexing, and synchronization of your documentation and rules for reliability and developer efficiency.

## Best Practices
- Add a GitHub Actions workflow (e.g., `.github/workflows/rules-check.yml`) to:
  - Regenerate rule index and README structure on every push/PR
  - Validate all rule files for required sections, uniqueness, and valid related links
  - Check for uncommitted changes after automation
  - Sync roadmaps between user/dev files
- Fail the build if any issues are found (structure, missing cross-links, outdated index, etc.)
- Optionally, run ToC/cross-reference automation, security/performance audits, and roadmap sync

## Example Workflow
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

## Rationale
- Ensures documentation and rules are always up-to-date and valid
- Prevents human error and outdated navigation
- Enables rapid onboarding and AI context

## Cross-References
- [Cursor Rules System](./cursor-rules-system.md)
- [Roadmap Synchronization](./roadmap-sync.md)
- [Project README](../../README.md) 