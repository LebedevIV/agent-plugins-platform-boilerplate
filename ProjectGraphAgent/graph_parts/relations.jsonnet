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

    // --- Ozon Analyzer Plugin Relations ---

    // Плагин и его компоненты
    'ozon_analyzer_manifest_workflow': {
        from: 'chrome-extension/public/plugins/ozon-analyzer/manifest.json',
        to: 'chrome-extension/public/plugins/ozon-analyzer/workflow.json',
        type: 'defines',
        description: 'Манифест определяет конфигурацию рабочего процесса',
    },
    'ozon_analyzer_workflow_python': {
        from: 'chrome-extension/public/plugins/ozon-analyzer/workflow.json',
        to: 'chrome-extension/public/plugins/ozon-analyzer/mcp_server.py',
        type: 'executes',
        description: 'Рабочий процесс запускает Python функции',
    },
    'ozon_analyzer_directory_manifest': {
        from: 'chrome-extension/public/plugins/ozon-analyzer/',
        to: 'chrome-extension/public/plugins/ozon-analyzer/manifest.json',
        type: 'contains',
        description: 'Директория плагина содержит файл манифеста',
    },

    // Python AI интеграция
    'ozon_mcp_server_ai_integration': {
        from: 'chrome-extension/public/plugins/ozon-analyzer/mcp_server.py',
        to: 'chrome-extension/src/background/ai-api-client.ts',
        type: 'uses',
        description: 'Python код вызывает AI API через клиент',
    },
    'ozon_mcp_server_host_api': {
        from: 'chrome-extension/public/plugins/ozon-analyzer/mcp_server.py',
        to: 'chrome-extension/src/background/host-api.ts',
        type: 'calls',
        description: 'Python код вызывает хостовые API функции',
    },

    // Background script connections
    'host_api_background_script': {
        from: 'chrome-extension/src/background/host-api.ts',
        to: 'chrome-extension/src/background/index.ts',
        type: 'connects',
        description: 'Host API мост подключен к основному фоновому скрипту',
    },
    'ai_client_background_script': {
        from: 'chrome-extension/src/background/ai-api-client.ts',
        to: 'chrome-extension/src/background/index.ts',
        type: 'called_by',
        description: 'Background скрипт вызывает AI клиента для обработки запросов',
    },

    // Документационные связи
    'ozon_analyzer_readme_main_docs': {
        from: 'chrome-extension/public/plugins/ozon-analyzer/README.md',
        to: 'docs/plugins/ozon-analyzer-technical-spec.md',
        type: 'references',
        description: 'README плагина ссылается на техническую спецификацию',
    },
    'ozon_analyzer_readme_ui_docs': {
        from: 'chrome-extension/public/plugins/ozon-analyzer/README.md',
        to: 'docs/plugins/ozon-analyzer-ui-documentation.md',
        type: 'references',
        description: 'README плагина ссылается на UI документацию',
    },
    'ozon_analyzer_readme_integration': {
        from: 'chrome-extension/public/plugins/ozon-analyzer/README.md',
        to: 'docs/plugins/ozon-analyzer-integration-guide.md',
        type: 'references',
        description: 'README плагина ссылается на руководство по интеграции',
    },

    // Техническая документация связана с кодом
    'technical_spec_manifest': {
        from: 'docs/plugins/ozon-analyzer-technical-spec.md',
        to: 'chrome-extension/public/plugins/ozon-analyzer/manifest.json',
        type: 'documents',
        description: 'Техническая спецификация документирует структуру манифеста',
    },
    'technical_spec_python_code': {
        from: 'docs/plugins/ozon-analyzer-technical-spec.md',
        to: 'chrome-extension/public/plugins/ozon-analyzer/mcp_server.py',
        type: 'documents',
        description: 'Техническая спецификация описывает Python API',
    },
    'integration_guide_host_api': {
        from: 'docs/plugins/ozon-analyzer-integration-guide.md',
        to: 'chrome-extension/src/background/host-api.ts',
        type: 'documents',
        description: 'Руководство по интеграции описывает работу host API',
    },
    'ui_docs_manifest_config': {
        from: 'docs/plugins/ozon-analyzer-ui-documentation.md',
        to: 'chrome-extension/public/plugins/ozon-analyzer/manifest.json',
        type: 'documents',
        description: 'UI документация ссылается на настройки плагина',
    },

    // Memory Bank документация плагина
    'plugin_adaptation_core_memory': {
        from: 'memory-bank/core/plugin-adaptations.md',
        to: 'chrome-extension/public/plugins/ozon-analyzer/',
        type: 'documents',
        description: 'Memory Bank документирует адаптацию плагина',
    },
    'plugin_architecture_memory': {
        from: 'memory-bank/architecture/plugin-system-integration.md',
        to: 'chrome-extension/public/plugins/ozon-analyzer/',
        type: 'documents',
        description: 'Архитектурная документация в Memory Bank',
    },
    'plugin_testing_memory': {
        from: 'memory-bank/development/ozon-analyzer-testing.md',
        to: 'chrome-extension/public/plugins/ozon-analyzer/',
        type: 'documents',
        description: 'Результаты тестирования в Memory Bank',
    },
    'plugin_ui_memory': {
        from: 'memory-bank/ui/ozon-analyzer-ui-integration.md',
        to: 'chrome-extension/public/plugins/ozon-analyzer/',
        type: 'documents',
        description: 'UI документация в Memory Bank',
    },

    // Связь между компонентами для path indexing
    'background_script_calls_ai_client': {
        from: 'chrome-extension/src/background/index.ts',
        to: 'chrome-extension/src/background/ai-api-client.ts',
        type: 'imports',
        description: 'Background скрипт импортирует и использует AI клиента',
    },
    'background_script_calls_host_api': {
        from: 'chrome-extension/src/background/index.ts',
        to: 'chrome-extension/src/background/host-api.ts',
        type: 'imports',
        description: 'Background скрипт импортирует host API bridge',
    },

    // Core workflow integration
    'ozon_workflow_uses_workflow_engine': {
        from: 'chrome-extension/public/plugins/ozon-analyzer/workflow.json',
        to: 'core/workflow-engine.js',
        type: 'executed_by',
        description: 'Рабочий процесс плагина исполняется workflow engine',
    },
    'workflow_engine_calls_mcp_bridge': {
        from: 'core/workflow-engine.js',
        to: 'bridge/mcp-bridge.js',
        type: 'calls',
        description: 'Workflow engine вызывает MCP bridge для выполнения Python',
    },
}