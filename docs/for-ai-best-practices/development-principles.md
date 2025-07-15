# Core Development Principles

These principles ensure high quality, security, and maintainability for any modern project. Use them as a checklist for all decisions and code reviews.

## The 10 Principles
1. **Do No Harm** — Prioritize security and backward compatibility
2. **Fail Fast, Fail Safe** — Detect and handle errors early and safely
3. **Data Integrity & Privacy** — Protect user data and ensure consistency
4. **Observability First** — Structured logging, metrics, and monitoring
5. **Best Practices First** — Use proven patterns and standards
6. **Configuration as Code** — Version and validate all configs
7. **Progressive Enhancement** — Core features always work, add enhancements incrementally
8. **Continuous Learning** — Monitor, gather feedback, and improve
9. **Ecosystem Thinking** — Ensure plugin/API compatibility and stability
10. **AI-First Documentation** — Write analytical comments for AI and human understanding

## Workflow & Branch Protection
- Direct commits or merges to `main` and `develop` are strictly forbidden. All changes must go through pull requests into `develop` only.
- Merging to `main` is allowed only from `develop` after release approval.
- All PRs must include documentation links and changelog updates.

### Example: Merge Protection
- ✅ feature/sidepanel-e2e → PR → develop → PR → main (release)
- ❌ direct commit to main (forbidden)
- ❌ direct commit to develop (forbidden)
- ✅ fix/plugin-card-bug → PR → develop

## How to Apply
- Analyze each task through the lens of these principles
- Select the most relevant principles for the situation
- Apply them systematically in decisions and code
- Document how principles influenced your solution

## Example Applications
- **New plugin:** 1, 2, 5, 6, 9, 10
- **Bugfix:** 1, 2, 4, 5, 7
- **Optimization:** 2, 4, 5, 6, 7, 8
- **New feature:** 1, 3, 5, 7, 8, 9

## Synergy
- "Do No Harm" + "Fail Fast" = Safe, rapid solutions
- "Best Practices" + "Observability" = Quality with monitoring
- "Progressive Enhancement" + "Ecosystem" = Stable ecosystem
- "Data Privacy" + "Configuration" = Secure configuration

## Result
Following these principles ensures:
- High code and architecture quality
- Security and reliability
- Great user experience
- Scalability and maintainability
- A successful plugin ecosystem

## Cross-References
- [Project README](../../README.md)
- [Roadmap & Progress](../../memory-bank/progress.md)
- [Cursor Rules System](../cursor-rules-system.md) 