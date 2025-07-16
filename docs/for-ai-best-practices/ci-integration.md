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
<<<<<<< HEAD
- [Project README](../../README.md) 

## Automated PR Checks with Danger.js

- The project uses danger.js to automatically check every Pull Request in CI:
  - Ensures detailed PR description
  - Checks for changelog updates when source code changes
  - Requires cross-references to rules, best practices, or documentation
  - Reminds to update documentation when src/core changes
- All warnings and suggestions appear directly in the PR discussion on GitHub.
- This removes routine control from the AI and team, increasing transparency and review quality.

**Cross-References:**
- [Progress: Automated PR Checks](../../memory-bank/progress.md#автоматизация-проверка-pull-request-через-dangerjs)
- [.github/workflows/danger.yml]
- [danger/dangerfile.js] 

## Automated Releases with semantic-release

- The project uses semantic-release for fully automated releases:
  - Analyzes conventional commits to determine release type (major/minor/patch)
  - Updates CHANGELOG.md and all package.json files
  - Creates git tags and publishes releases to GitHub/npm (if tokens are set)
  - Runs automatically on merge to main via GitHub Actions
- This removes all manual versioning and changelog management, reduces errors, and speeds up publishing.

**Cross-References:**
- [Progress: Automated Releases](../../memory-bank/progress.md#автоматизация-релизы-и-версионирование-через-semantic-release)
- [.releaserc.json]
- [.github/workflows/release.yml] 

## Automated Dependency Updates with Renovate

- The project uses Renovate to automatically update npm/pnpm dependencies:
  - Creates PRs with grouped updates (e.g., types/pnpm)
  - All updates go through CI, danger.js, and the standard workflow
  - PRs are labeled dependencies, renovate
  - PR frequency and concurrency are limited for review convenience
  - Automerge is disabled (can be enabled if desired)
- This removes routine work from the AI and team, reduces the risk of vulnerabilities and outdated packages.

**Cross-References:**
- [Progress: Automated Dependency Updates](../../memory-bank/progress.md#автоматизация-обновление-зависимостей-через-renovate)
- [renovate.json] 

## Automated Security Audit of Dependencies

- The project uses pnpm audit to automatically check dependencies for vulnerabilities:
  - On every push and PR to main/develop, audit runs in GitHub Actions
  - All vulnerabilities (moderate and above) are reported directly in CI
  - This enables quick response to critical issues and reduces the risk of vulnerabilities in production
- The mechanism is fully automated and requires no manual control from AI or the team.

**Cross-References:**
- [Progress: Security Audit Automation](../../memory-bank/progress.md#автоматизация-аудит-безопасности-зависимостей)
- [.github/workflows/audit.yml] 
=======
- [Project README](../../README.md) 
>>>>>>> origin/develop
