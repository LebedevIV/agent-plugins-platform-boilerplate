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

    // --- Tests ---
    // Note: Test configurations are managed separately and not included in this graph
    // ... other entities
}