# Best Practices & Organizational Patterns

This folder collects modular, transferable best practices, organizational methods, and documentation patterns proven in this project. Use these as templates or direct copies for other projects.

## Purpose
- Enable rapid project bootstrap with modern, AI-friendly, automation-ready methods
- Share and reuse effective patterns for rules, documentation, CI, onboarding, testing, troubleshooting, and more
- Serve as a living knowledge base for the team and AI assistants

## Included Topics
- Modular Rule System (see: [cursor-rules-system.md](../cursor-rules-system.md))
- Automation & CLI Scripts
- CI/CD Integration for Docs & Rules
- Roadmap Synchronization (user/dev)
- Onboarding & Developer Experience
- Testing & Troubleshooting Guides
- AI-First Documentation Principles
- Security & Quality Principles
- Transferability & Project Bootstrap

## Cross-References
- [Project README](../../README.md)
- [Cursor Rules System](../cursor-rules-system.md)
- [Roadmap & Progress](../../memory-bank/progress.md)
- [Developer Setup](../../DEVELOPER_SETUP.md)
- [Plugin Development](../../PLUGIN_DEVELOPMENT.md)

---

## Safe Delete & Automation Safety

- All automation scripts must use safe delete functions to prevent accidental removal of protected directories (e.g., docs/for-ai-best-practices, memory-bank, platform-core, chrome-extension/public/plugins).
- Use safe_rm in bash scripts and safeDelete in Node.js scripts (see ci-integration.md for details).
- Any attempt to delete a protected directory should be blocked and logged.
- CI workflows should notify maintainers if such an attempt is detected.

## Cross-References
- [Project README](../../README.md)
- [Cursor Rules System](../cursor-rules-system.md)
- [Roadmap & Progress](../../memory-bank/progress.md)
- [Developer Setup](../../DEVELOPER_SETUP.md)
- [Plugin Development](../../PLUGIN_DEVELOPMENT.md)
- [CI Integration & Safe Delete](./ci-integration.md)

---

**Contribute new best practices as you discover them!** 