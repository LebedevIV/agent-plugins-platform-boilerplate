// graph_parts/policies.jsonnet
// This part defines project-wide development policies.

{
    graphUsage: {
      graphUsagePolicy: {
        rule: 'An AI assistant MUST read and parse this entire file, including all imported parts, at the beginning of a session. The assistant MUST consider the `metadata` block of each entity to assess the reliability of the information.',
        appliesTo: ['AIAssistant'],
      },
    },

    documentationSync: {
      rule: 'All changes to user-facing features or the build process must be documented in both the primary README.md and all localized versions (e.g., README.ru.md).',
      files: ['README.md', 'README.ru.md'],
    },
    releaseNotesUpdate: {
      rule: 'All significant changes, new features, and bug fixes must be added to RELEASE_NOTES.md under the correct version.',
      files: ['RELEASE_NOTES.md'],
    },
    memoryBankUpdate: {
        rule: 'The memory-bank must be updated to reflect the high-level context and \'why\' behind significant changes, following the structure defined in .cursor/rules/memory-bank.mdc.',
        files: ['memory-bank/'],
    },

    // Single source of truth for commit groups
    commitGroups: {
        feat: {
          id: 'feat',
          description: 'Новая функция или значительное улучшение.',
          patterns: ['src/**/*.ts', 'src/**/*.tsx', 'chrome-extension/**/*.ts', 'chrome-extension/**/*.tsx', 'ui/**/*.ts', 'ui/**/*.tsx'],
          messagePrefix: 'feat:',
        },
        fix: {
          id: 'fix',
          description: 'Исправление ошибки.',
          patterns: ['src/**/*.ts', 'src/**/*.tsx', 'chrome-extension/**/*.ts', 'chrome-extension/**/*.tsx', 'ui/**/*.ts', 'ui/**/*.tsx'],
          messagePrefix: 'fix:',
        },
        docs: {
          id: 'docs',
          description: 'Изменения только в документации.',
          patterns: ['**/*.md', 'docs/**', 'README.md', 'README.ru.md'],
          messagePrefix: 'docs:',
        },
        style: {
          id: 'style',
          description: 'Изменения стиля кода (форматирование, пробелы и т.д.).',
          patterns: ['src/**/*.css', 'ui/**/*.css', '**/*.scss', 'tailwind.config.js'],
          messagePrefix: 'style:',
        },
        refactor: {
          id: 'refactor',
          description: 'Изменение кода, которое не исправляет ошибку и не добавляет функцию.',
          patterns: ['src/**/*.ts', 'src/**/*.tsx', 'chrome-extension/**/*.ts', 'chrome-extension/**/*.tsx', 'ui/**/*.ts', 'ui/**/*.tsx'],
          messagePrefix: 'refactor:',
        },
        test: {
          id: 'test',
          description: 'Добавление отсутствующих тестов или исправление существующих.',
          patterns: ['tests/**', '**/*.test.ts', '**/*.spec.ts', 'test-scripts/**'],
          messagePrefix: 'test:',
        },
        build: {
          id: 'build',
          description: 'Изменения, влияющие на систему сборки или внешние зависимости.',
          patterns: ['package.json', 'package-lock.json', 'packages/**/package.json', 'tsconfig.json', 'vite.config.ts', 'manifest.json'],
          messagePrefix: 'build:',
        },
        ci: {
          id: 'ci',
          description: 'Изменения в конфигурации CI и скриптах.',
          patterns: ['.github/**', '.cursor/**', 'bash-scripts/**'],
          messagePrefix: 'ci:',
        },
        chore: {
          id: 'chore',
          description: "Другие изменения, которые не модифицируют src или test файлы.",
          patterns: ['.gitignore', '.vscode/**', '.cursorrules', '.gemini/**', '.kilocode/**', '.roo/**', 'ProjectGraphAgent/**', 'public/**'],
          messagePrefix: 'chore:',
        },
        revert: {
          id: 'revert',
          description: 'Откат предыдущего коммита.',
          patterns: [],
          messagePrefix: 'revert:',
        },
    },
}