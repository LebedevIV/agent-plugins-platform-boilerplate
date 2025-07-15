# Roadmap Synchronization Best Practice

Synchronize your user-facing and technical roadmaps for maximum transparency and AI/developer alignment.

## Principle
- Maintain two roadmap files:
  - `docs/PLANS.md` — for users/contributors (public, high-level)
  - `memory-bank/progress.md` — for AI/devs (detailed, technical, always up-to-date)
- Synchronize the `## Planned Automation & Improvements` section between them using a script (e.g., `tools/sync_plans.py`).
- Any update to plans in one file is reflected in the other, ensuring both audiences see the latest roadmap.

## Usage
- Edit plans in `memory-bank/progress.md` (the source of truth)
- Run the sync script manually or via CI to update `docs/PLANS.md`
- Reference `docs/PLANS.md` in onboarding, README, and user docs

## Automation
- Add a CI job to check/sync plans on every push/PR
- Example script: `tools/sync_plans.py`
- Example workflow: see [Cursor Rules System](./cursor-rules-system.md)

## Rationale
- Keeps users and developers aligned
- Ensures AI assistants always have the latest context
- Reduces duplication and risk of outdated docs

## Cross-References
- [Project README](../../README.md)
- [Cursor Rules System](./cursor-rules-system.md)
- [Roadmap & Progress](../../memory-bank/progress.md) 