// graph_parts/relations.jsonnet
// This file defines relationships between entities in the project graph.
// Add your relations here.

{
    // Example relation:
    // 'App.tsx_uses_main.tsx': {
    //     from: 'src/App.tsx',
    //     to: 'src/main.tsx',
    //     type: 'uses',
    //     description: 'App.tsx is rendered by main.tsx',
    // },

    // --- Chrome Extension Chat Recovery Project Relations ---
    'chat_recovery_main_docs': {
        from: 'memory-bank/projects/chrome-extension-chat-recovery/README.md',
        to: 'memory-bank/projects/chrome-extension-chat-recovery/docs/project-overview.md',
        type: 'references',
        description: 'Основная документация ссылается на обзор проекта',
    },
    'project_overview_problems': {
        from: 'memory-bank/projects/chrome-extension-chat-recovery/docs/project-overview.md',
        to: 'memory-bank/projects/chrome-extension-chat-recovery/docs/problems-solved.md',
        type: 'references',
        description: 'Обзор проекта ссылается на решенные проблемы',
    },
    'problems_architecture': {
        from: 'memory-bank/projects/chrome-extension-chat-recovery/docs/problems-solved.md',
        to: 'memory-bank/projects/chrome-extension-chat-recovery/architecture/chat-architecture.md',
        type: 'references',
        description: 'Проблемы ссылаются на архитектурные решения',
    },
    'architecture_code_changes': {
        from: 'memory-bank/projects/chrome-extension-chat-recovery/architecture/chat-architecture.md',
        to: 'memory-bank/projects/chrome-extension-chat-recovery/docs/code-changes-summary.md',
        type: 'references',
        description: 'Архитектура ссылается на изменения в коде',
    },
    'code_changes_testing': {
        from: 'memory-bank/projects/chrome-extension-chat-recovery/docs/code-changes-summary.md',
        to: 'memory-bank/projects/chrome-extension-chat-recovery/testing/testing-results.md',
        type: 'references',
        description: 'Изменения в коде ссылаются на результаты тестирования',
    },
    'testing_lessons_learned': {
        from: 'memory-bank/projects/chrome-extension-chat-recovery/testing/testing-results.md',
        to: 'memory-bank/projects/chrome-extension-chat-recovery/docs/lessons-learned.md',
        type: 'references',
        description: 'Тестирование ссылается на уроки и выводы',
    },
    'lessons_back_to_overview': {
        from: 'memory-bank/projects/chrome-extension-chat-recovery/docs/lessons-learned.md',
        to: 'memory-bank/projects/chrome-extension-chat-recovery/docs/project-overview.md',
        type: 'references',
        description: 'Выводы ссылаются обратно на обзор для полного цикла',
    },
}