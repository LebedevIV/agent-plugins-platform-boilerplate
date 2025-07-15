# Testing & Troubleshooting Documentation Best Practice

Document all testing and troubleshooting procedures in modular, cross-linked guides. This ensures rapid onboarding, effective debugging, and AI assistant support.

## Key Practices
- Write step-by-step guides for all major testing and troubleshooting flows
- Separate usage, troubleshooting, and advanced diagnostics into distinct files
- Cross-link guides for navigation (usage → troubleshooting → advanced)
- Use clear, reproducible steps and code snippets
- Reference relevant scripts, automation, and best practices
- Update guides as features or workflows change

## Example Guides
- [DevTools Testing Guide](../devtools-testing-guide.md)
- [DevTools Panel Troubleshooting](../devtools-panel-troubleshooting.md)
- [DevTools Panel Usage](../devtools-panel-usage.md)

## Rationale
- Reduces time to diagnose and fix issues
- Enables AI assistants to help with debugging and onboarding
- Makes knowledge easily transferable to new projects

## Cross-References
- [AI-First Documentation](./ai-first-documentation.md)
- [Cursor Rules System](./cursor-rules-system.md)
- [Project README](../../README.md) 

---

## How to Analyze External Repositories as Submodules

To analyze, search, and track changes in an external git repository (e.g., for studying Chrome extension patterns or sidepanel-background communication), add it as a git submodule:

### Step-by-step:
1. In your monorepo root, run:
   ```bash
   git submodule add <repo-url> external/<folder-name>
   git submodule update --init --recursive
   ```
   Example:
   ```bash
   git submodule add https://github.com/QizhengMo/chrome-extension-sidepanel-template.git external/sidepanel-template
   git submodule update --init --recursive
   ```
2. Open the monorepo in Cursor/VSCode. The submodule will be indexed and available for code search, navigation, and analysis.
3. To update the submodule to the latest version:
   ```bash
   cd external/sidepanel-template
   git pull origin main
   ```
4. To remove the submodule (if no longer needed):
   ```bash
   git submodule deinit -f external/sidepanel-template
   git rm -f external/sidepanel-template
   rm -rf .git/modules/external/sidepanel-template
   ```

**Benefits:**
- Keeps external code isolated from your main git history
- Allows easy updates and independent versioning
- Enables full code search and analysis in Cursor/VSCode

**Use this method for any external codebase you want to analyze or reference in your monorepo.** 