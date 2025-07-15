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

---

## Safe Delete & Notification in CI/CD

- All automation and CI scripts must protect critical directories from accidental deletion.
- Use safe_rm (bash) or safeDelete (Node.js) in all scripts that may remove files/directories.
- Maintain a list of protected directories (e.g., docs/for-ai-best-practices, memory-bank, platform-core, chrome-extension/public/plugins).
- Any attempt to delete a protected directory should:
  - Be blocked
  - Log a warning (locally or in CI)
  - Optionally, send a notification (e.g., GitHub Actions annotation, Slack, email)

### Example (GitHub Actions warning)
```yaml
- name: Check for protected directory deletion
  run: |
    if git diff --name-status | grep -E 'D[[:space:]]+(docs/for-ai-best-practices|memory-bank|platform-core|chrome-extension/public/plugins)'; then
      echo '::warning::Attempted deletion of a protected directory! Review required.'
    fi
```

## Rationale
- Prevents accidental or malicious loss of critical project data
- Ensures all destructive actions are intentional and reviewed
- Increases trust in automation and onboarding safety

## Cross-References
- [Cursor Rules System](./cursor-rules-system.md)
- [Safe Delete Best Practice](./README.md)
- [Roadmap Synchronization](./roadmap-sync.md)
- [Project README](../../README.md) 