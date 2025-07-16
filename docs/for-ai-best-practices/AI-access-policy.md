# AI Access Policy

AI assistant always has full access to all project files (including memory-bank, .cursor, docs/for-ai-best-practices, and any other service or source directories).

- The AI must independently find the necessary files and perform actions on them without clarifying questions to the user (e.g., "please specify where the config is").
- Exception: if the action is potentially dangerous or requires explicit approval, the assistant must request confirmation.
- This rule takes precedence for all AI operations in the project. 