// graph_parts/entities.jsonnet
// This part defines the core entities of the project.

local templates = import 'templates.jsonnet';
local Metadata = templates.Metadata;
local Component = templates.Component;
local IpcChannel = templates.IpcChannel;
local FileEntity = templates.FileEntity;
local DefaultMetadata = templates.DefaultMetadata;

{
    // --- Config & Manifest Files ---
    'package.json': FileEntity(
        'PackageManagementFile',
        'package.json',
        'Определяет метаданные проекта, скрипты, зависимости и конфигурации сборки.',
        Metadata(1.0, 'Gemini-1.5-Pro')
    ) + {
        sections: [
            { name: 'scripts', purpose: 'Определяет командные скрипты для разработки, сборки и запуска приложения.' },
            { name: 'dependencies', purpose: 'Список библиотек, необходимых для работы приложения.' },
            { name: 'devDependencies', purpose: 'Список библиотек для разработки и сборки.' },
        ],
    },
    // --- Chrome Extension ---
    // Note: Chrome extension components are managed separately and not included in this graph

    // --- Core Platform ---
    // Note: Platform-core components are managed separately and not included in this graph

    // --- UI Components ---
    // Note: UI components are managed separately and not included in this graph

    // --- Packages ---
    'packages/dev-utils/package.json': FileEntity(
        kind='PackageConfig',
        path='packages/dev-utils/package.json',
        purpose='Конфигурация пакета утилит для разработки.',
        metadata=DefaultMetadata()
    ),
    'packages/hmr/package.json': FileEntity(
        kind='PackageConfig',
        path='packages/hmr/package.json',
        purpose='Конфигурация пакета горячей перезагрузки модулей.',
        metadata=DefaultMetadata()
    ),
    'packages/i18n/package.json': FileEntity(
        kind='PackageConfig',
        path='packages/i18n/package.json',
        purpose='Конфигурация пакета интернационализации.',
        metadata=DefaultMetadata()
    ),

    // --- Documentation ---
    // Note: Documentation files are managed separately and not included in this graph

    // --- Memory Bank ---
    'memory-bank/INDEX.md': FileEntity(
        kind='MemoryBankIndex',
        path='memory-bank/INDEX.md',
        purpose='Главный индексный файл системы памяти с навигацией по категориям и быстрым доступом.',
        metadata=DefaultMetadata()
    ),
    // --- Chrome Extension Chat Recovery Project ---
    'memory-bank/projects/chrome-extension-chat-recovery/README.md': FileEntity(
        kind='ProjectDocumentation',
        path='memory-bank/projects/chrome-extension-chat-recovery/README.md',
        purpose='Документация проекта восстановления функционала чата в Chrome Extension.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/projects/chrome-extension-chat-recovery/docs/project-overview.md': FileEntity(
        kind='ProjectOverview',
        path='memory-bank/projects/chrome-extension-chat-recovery/docs/project-overview.md',
        purpose='Обзор проекта восстановления чата с ключевыми метриками и целями.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/projects/chrome-extension-chat-recovery/docs/problems-solved.md': FileEntity(
        kind='ProblemsDocumentation',
        path='memory-bank/projects/chrome-extension-chat-recovery/docs/problems-solved.md',
        purpose='Документация всех решенных проблем и их решений.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/projects/chrome-extension-chat-recovery/architecture/chat-architecture.md': FileEntity(
        kind='ArchitectureDocumentation',
        path='memory-bank/projects/chrome-extension-chat-recovery/architecture/chat-architecture.md',
        purpose='Полная архитектура чата с детальными техническими решениями.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/projects/chrome-extension-chat-recovery/docs/code-changes-summary.md': FileEntity(
        kind='CodeChangesDocumentation',
        path='memory-bank/projects/chrome-extension-chat-recovery/docs/code-changes-summary.md',
        purpose='Сводка всех изменений в коде с техническими деталями.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/projects/chrome-extension-chat-recovery/testing/testing-results.md': FileEntity(
        kind='TestingDocumentation',
        path='memory-bank/projects/chrome-extension-chat-recovery/testing/testing-results.md',
        purpose='Результаты тестирования с метриками качества и производительности.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/projects/chrome-extension-chat-recovery/docs/lessons-learned.md': FileEntity(
        kind='LessonsLearned',
        path='memory-bank/projects/chrome-extension-chat-recovery/docs/lessons-learned.md',
        purpose='Выводы и уроки из проекта для будущих разработок.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/architecture/README.md': FileEntity(
        kind='MemoryBank',
        path='memory-bank/architecture/README.md',
        purpose='Документация архитектуры в системе памяти.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/development/README.md': FileEntity(
        kind='MemoryBank',
        path='memory-bank/development/README.md',
        purpose='Информация о разработке в системе памяти.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/audit_logs.md': FileEntity(
        kind='MemoryBankAudit',
        path='memory-bank/audit_logs.md',
        purpose='Логи аудита системы памяти для отслеживания изменений и проверок.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/drift.md': FileEntity(
        kind='MemoryBankDrift',
        path='memory-bank/drift.md',
        purpose='Документация дрейфа системы памяти - расхождений между ожидаемой и реальной структурой.',
        metadata=DefaultMetadata()
    ),
    'memory-bank/diagrams/graph.mmd': FileEntity(
        kind='MemoryBankDiagram',
        path='memory-bank/diagrams/graph.mmd',
        purpose='Диаграмма Mermaid для визуализации структуры системы памяти.',
        metadata=DefaultMetadata()
    ),

    // --- Source Code ---
    'src/background.ts': FileEntity(
        kind='BackgroundScript',
        path='src/background.ts',
        purpose='Фоновый скрипт для основного приложения.',
        metadata=DefaultMetadata()
    ),
    'src/matches/all/index.tsx': Component(
        name='AllMatches',
        path='src/matches/all/index.tsx',
        purpose='Компонент для отображения всех совпадений.',
        metadata=DefaultMetadata()
    ),
    'src/matches/example/index.tsx': Component(
        name='ExampleMatches',
        path='src/matches/example/index.tsx',
        purpose='Пример компонента для отображения совпадений.',
        metadata=DefaultMetadata()
    ),

    // --- Chrome Extension Plugins ---
    'chrome-extension/public/plugins/ozon-analyzer/': FileEntity(
        kind='PluginDirectory',
        path='chrome-extension/public/plugins/ozon-analyzer/',
        purpose='Ozon Analyzer плагин для анализа товаров на маркетплейсе Ozon.ru с AI интеграцией.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ) + {
        sections: [
            { name: 'manifest.json', purpose: 'Конфигурация плагина с AI моделями и настройками' },
            { name: 'workflow.json', purpose: 'Определение рабочего процесса анализа' },
            { name: 'mcp_server.py', purpose: 'Основная Python логика обработки товаров' },
            { name: 'README.md', purpose: 'Документация и пользовательское руководство' }
        ],
    },

    'chrome-extension/public/plugins/ozon-analyzer/mcp_server.py': Component(
        name='OzonMcpServer',
        path='chrome-extension/public/plugins/ozon-analyzer/mcp_server.py',
        purpose='MCP сервер для анализа товаров Ozon с AI поддержкой.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ) + {
        sections: [
            { name: 'analyze_ozon_product', purpose: 'Главная функция анализа продукта на основе HTML' },
            { name: 'perform_deep_analysis', purpose: 'Функция глубокого анализа с AI и альтернативными товарами' },
            { name: '_call_ai_model', purpose: 'Унифицированная обертка для AI API вызовов' },
            { name: '_extract_description_and_composition', purpose: 'Парсинг описания и состава товара' },
            { name: '_extract_categories', purpose: 'Извлечение категорий товара' },
            { name: '_find_similar_products', purpose: 'Поиск похожих товаров через AI' },
            { name: '_analyze_composition_vs_description', purpose: 'Сравнение состава с описанием' }
        ],
    },

    'chrome-extension/public/plugins/ozon-analyzer/manifest.json': FileEntity(
        kind='PluginManifest',
        path='chrome-extension/public/plugins/ozon-analyzer/manifest.json',
        purpose='Манифест конфигурации Ozon Analyzer плагина с настройками AI и метаданными.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ),

    'chrome-extension/public/plugins/ozon-analyzer/workflow.json': FileEntity(
        kind='PluginWorkflow',
        path='chrome-extension/public/plugins/ozon-analyzer/workflow.json',
        purpose='Определение рабочего процесса анализа товаров для APP платформы.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ),

    'chrome-extension/public/plugins/ozon-analyzer/README.md': FileEntity(
        kind='PluginDocumentation',
        path='chrome-extension/public/plugins/ozon-analyzer/README.md',
        purpose='Полная документация плагина Ozon Analyzer для пользователей и разработчиков.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ),

    // --- Ozon Analyzer Technical Documentation ---
    'docs/plugins/ozon-analyzer-technical-spec.md': FileEntity(
        kind='PluginTechnicalSpecification',
        path='docs/plugins/ozon-analyzer-technical-spec.md',
        purpose='Техническая спецификация архитектуры, API и интеграции плагина.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ),

    'docs/plugins/ozon-analyzer-integration-guide.md': FileEntity(
        kind='PluginIntegrationGuide',
        path='docs/plugins/ozon-analyzer-integration-guide.md',
        purpose='Пошаговое руководство по интеграции и созданию аналогичных плагинов.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ),

    'docs/plugins/ozon-analyzer-ui-documentation.md': FileEntity(
        kind='PluginUIDocumentation',
        path='docs/plugins/ozon-analyzer-ui-documentation.md',
        purpose='Комплексная документация UI/UX компонентов плагина.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ),

    // --- AI API Integration ---
    'chrome-extension/src/background/ai-api-client.ts': Component(
        name='AIApiClient',
        path='chrome-extension/src/background/ai-api-client.ts',
        purpose='Клиент для интеграции с AI API сервисами (OpenAI, Google Gemini).',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ) + {
        sections: [
            { name: 'AIApiClient', purpose: 'Основной класс для AI API интеграции' },
            { name: 'callModel', purpose: 'Универсальный метод вызова AI модели' },
            { name: 'callGeminiApi', purpose: 'Интеграция с Google Gemini API' },
            { name: 'callOpenAIApi', purpose: 'Интеграция с OpenAI API' },
            { name: 'getApiKey', purpose: 'Безопасное получение API ключей' },
            { name: 'MODEL_CONFIGS', purpose: 'Конфигурации всех поддерживаемых моделей' }
        ],
    },

    'chrome-extension/src/background/host-api.ts': Component(
        name='HostApi',
        path='chrome-extension/src/background/host-api.ts',
        purpose='API моста для связи между фоновым скриптом и Python runtime.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ) + {
        sections: [
            { name: 'hostApi', purpose: 'Основной объект API моста' },
            { name: 'llm_call', purpose: 'Функция вызова AI моделей из Python' },
            { name: 'get_setting', purpose: 'Функция получения настроек из Python' },
            { name: 'sendMessageToChat', purpose: 'Отправка сообщений в UI из Python' },
            { name: 'host_fetch', purpose: 'HTTP запросы из Python с CORS' },
            { name: 'findTargetTab', purpose: 'Поиск целевой вкладки для анализа' }
        ],
    },

    'chrome-extension/src/background/index.ts': Component(
        name='BackgroundScript',
        path='chrome-extension/src/background/index.ts',
        purpose='Основной фоновый скрипт Chrome расширения с обработкой событий и коммуникацией.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ) + {
        sections: [
            { name: 'messageRouter', purpose: 'Центральный роутер входящих сообщений' },
            { name: 'handleHostApiMessage', purpose: 'Обработка host API вызовов из Python' },
            { name: 'RUN_WORKFLOW', purpose: 'Обработчик запуска рабочих процессов' },
            { name: 'llm_call handling', purpose: 'Обработка AI API запросов' },
            { name: 'ExtensionMessage interface', purpose: 'Типизация сообщений расширения' }
        ],
    },

    // --- Memory Bank Documentation ---
    'memory-bank/core/plugin-adaptations.md': FileEntity(
        kind='MemoryBankDocumentation',
        path='memory-bank/core/plugin-adaptations.md',
        purpose='Документация процесса адаптации плагина Ozon Analyzer к архитектуре APP.',
        metadata=DefaultMetadata()
    ),

    'memory-bank/architecture/plugin-system-integration.md': FileEntity(
        kind='MemoryBankArchitecture',
        path='memory-bank/architecture/plugin-system-integration.md',
        purpose='Архитектурный анализ интеграции mikro-плагинов в экосистему платформы.',
        metadata=DefaultMetadata()
    ),

    'memory-bank/development/ozon-analyzer-testing.md': FileEntity(
        kind='MemoryBankDevelopment',
        path='memory-bank/development/ozon-analyzer-testing.md',
        purpose='Результаты тестирования плагина Ozon Analyzer с метриками производительности.',
        metadata=DefaultMetadata()
    ),

    'memory-bank/ui/ozon-analyzer-ui-integration.md': FileEntity(
        kind='MemoryBankUI',
        path='memory-bank/ui/ozon-analyzer-ui-integration.md',
        purpose='Документация UI/UX интеграции плагина с рекомендациями по использованию.',
        metadata=DefaultMetadata()
    ),

    // --- Tests ---
    // Note: Test configurations are managed separately and not included in this graph

    // --- HTML Transmission Settings ---
    'html-transmission-settings': Component(
        name='HTMLTransmissionSettings',
        path='pages/options/src/components/SettingsTab.tsx',
        purpose='Настройка режима передачи HTML содержимого в плагины (целиком или чанками).',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ) + {
        sections: [
            { name: 'htmlTransmissionMode', purpose: 'Переменная состояния режима передачи HTML' },
            { name: 'loadHtmlTransmissionMode', purpose: 'Загрузка настроек из chrome.storage.local' },
            { name: 'saveHtmlTransmissionMode', purpose: 'Сохранение настроек в хранилище' },
            { name: 'ToggleButton', purpose: 'UI компонент переключения режимов' }
        ],
        configuration: {
            modes: {
                direct: {
                    name: 'Прямая передача',
                    description: 'HTML передается целиком одним сообщением',
                    default: true,
                    performance: 'Быстрее для большинства страниц',
                    limitations: 'Не работает с HTML >50MB'
                },
                chunks: {
                    name: 'Передача чанками',
                    description: 'HTML разбивается на части по 32KB',
                    default: false,
                    performance: 'Стабильнее для больших документов',
                    limitations: 'Медленнее из-за накладных расходов'
                }
            },
            storage: 'chrome.storage.local',
            fallback: 'direct'
        },
        chain_of_usage: [
            {
                component: 'SettingsTab.tsx',
                action: 'Пользователь изменяет переключатель',
                result: 'Сохранение в chrome.storage.local'
            },
            {
                component: 'background.ts',
                action: 'RUN_WORKFLOW получает настройки',
                result: 'Выбор метода sendHtmlDirectly или sendInChunks'
            },
            {
                component: 'offscreen.js',
                action: 'Получение EXECUTE_WORKFLOW с HTML',
                result: 'Выполнение Python кода с данными'
            }
        ],
        validation: {
            allowed_values: ['direct', 'chunks'],
            default_value: 'direct',
            storage_key: 'htmlTransmissionMode'
        }
    },

    'memory-bank/ui/html-transmission-settings.md': FileEntity(
        kind='UIDocumentation',
        path='memory-bank/ui/html-transmission-settings.md',
        purpose: 'Документация UI компонентов и интерфейса настройки передачи HTML.',
        metadata=Metadata(1.0, 'Gemini-1.5-Pro')
    ) + {
        sections: [
            { name: 'UI Components', purpose: 'Описание пользовательского интерфейса настроек' },
            { name: 'ToggleButton', purpose: 'Компонент переключения режимов передачи' },
            { name: 'State Management', purpose: 'Управление состоянием в React компонентах' },
            { name: 'Storage Integration', purpose: 'Интеграция с chrome.storage API' }
        ]
    },
    // ... other entities
}