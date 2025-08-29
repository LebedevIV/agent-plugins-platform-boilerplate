// graph_parts/path_search_examples.jsonnet
// Examples of how AI agents can use the new path indexing system

local graph = import '../project_graph.jsonnet';
local PathSearch = graph.templates.PathSearch;

{
    // Примеры использования для AI-агентов

    examples: {

        // 1. Поиск конкретного файла по пути
        findSpecificFile: {
            description: 'Найти конкретный файл по полному пути',
            example: PathSearch.findByPath('package.json'),
            usage: 'graph.templates.PathSearch.findByPath("package.json")',
        },

        // 2. Поиск всех файлов в директории
        findFilesInDirectory: {
            description: 'Найти все файлы в указанной директории',
            example: PathSearch.findByDirectory('src'),
            usage: 'graph.templates.PathSearch.findByDirectory("src")',
        },

        // 3. Поиск файлов по типу (расширению)
        findFilesByType: {
            description: 'Найти все файлы определенного типа',
            examples: {
                json_files: PathSearch.findByFileType('json'),
                md_files: PathSearch.findByFileType('md'),
                ts_files: PathSearch.findByFileType('ts'),
            },
            usage: 'graph.templates.PathSearch.findByFileType("json")',
        },

        // 4. Поиск файлов с одинаковыми именами
        findFilesByName: {
            description: 'Найти все файлы с одинаковым базовым именем',
            example: PathSearch.findByFileName('package.json'),
            usage: 'graph.templates.PathSearch.findByFileName("package.json")',
        },

        // 5. Поиск с использованием паттернов
        findByPattern: {
            description: 'Поиск файлов по паттерну в пути',
            examples: {
                memory_bank: PathSearch.findByPattern('memory-bank'),
                chrome_extension: PathSearch.findByPattern('chrome-extension'),
                tests: PathSearch.findByPattern('test'),
            },
            usage: 'graph.templates.PathSearch.findByPattern("memory-bank")',
        },

        // 6. Рекурсивный поиск в директории
        findRecursive: {
            description: 'Найти все файлы в директории и поддиректориях',
            examples: {
                all_in_src: PathSearch.findInDirectoryRecursive('src'),
                all_in_packages: PathSearch.findInDirectoryRecursive('packages'),
            },
            usage: 'graph.templates.PathSearch.findInDirectoryRecursive("src")',
        },

        // 7. Работа с путями файлов
        pathUtils: {
            description: 'Вспомогательные функции для работы с путями',
            examples: {
                get_parent_dir: PathSearch.getParentDirectory('packages/dev-utils/package.json'),
                get_file_extension: PathSearch.getFileExtension('src/background.ts'),
                get_file_name: PathSearch.getFileName('src/matches/all/index.tsx'),
            },
        },

        // 8. Проверка существования файла
        checkExistence: {
            description: 'Проверка существования файла в индексе',
            examples: {
                exists: PathSearch.pathExists('package.json'),
                not_exists: PathSearch.pathExists('nonexistent-file.json'),
            },
            usage: 'graph.templates.PathSearch.pathExists("package.json")',
        },

        // 9. Получение статистики индексов
        getStatistics: {
            description: 'Получить статистику по индексам',
            example: PathSearch.getIndexStats(),
            usage: 'graph.templates.PathSearch.getIndexStats()',
        },

        // 10. Получение всех доступных директорий и типов файлов
        getAvailableOptions: {
            description: 'Получить все доступные директории и типы файлов',
            directories: PathSearch.getAllDirectories(),
            file_types: PathSearch.getAllFileTypes(),
        },
    },

    // Примеры реальных сценариев использования для AI-агентов
    ai_agent_scenarios: {

        // Сценарий 1: Анализ зависимостей проекта
        dependency_analysis: {
            description: 'Найти все package.json файлы для анализа зависимостей',
            action: |||
                local packageFiles = graph.templates.PathSearch.findByFileType('json');
                local packageJsons = [f for f in packageFiles if std.length(std.findSubstr('package.json', f.path)) > 0];
                // Анализировать зависимости в каждом package.json
            |||,

            files_found: PathSearch.findByFileName('package.json'),
        },

        // Сценарий 2: Поиск документации
        documentation_search: {
            description: 'Найти всю документацию проекта',
            action: |||
                local docs = graph.templates.PathSearch.findByFileType('md');
                local readme = graph.templates.PathSearch.findByFileName('README.md');
                // Объединить и проанализировать документацию
            |||,

            markdown_files: PathSearch.findByFileType('md'),
        },

        // Сценарий 3: Анализ структуры исходного кода
        code_structure_analysis: {
            description: 'Проанализировать структуру исходного кода',
            action: |||
                local tsFiles = graph.templates.PathSearch.findByFileType('ts');
                local tsxFiles = graph.templates.PathSearch.findByFileType('tsx');
                local allCodeFiles = tsFiles + tsxFiles;
                // Анализировать архитектуру кода
            |||,

            typescript_files: PathSearch.findByFileType('ts'),
            react_files: PathSearch.findByFileType('tsx'),
        },

        // Сценарий 4: Поиск конфигурационных файлов
        config_files_search: {
            description: 'Найти все конфигурационные файлы',
            action: |||
                local jsonFiles = graph.templates.PathSearch.findByFileType('json');
                local configFiles = [f for f in jsonFiles if std.length(std.findSubstr('config', f.path)) > 0];
                // Анализировать конфигурации
            |||,

            json_files: PathSearch.findByFileType('json'),
        },

        // Сценарий 5: Навигация по проекту для AI-агента
        ai_navigation: {
            description: 'AI-агент может быстро перемещаться по проекту',
            examples: {
                // Найти конкретный файл
                find_entity: PathSearch.findByPath('src/background.ts'),

                // Найти все файлы в папке
                explore_directory: PathSearch.findByDirectory('src'),

                // Найти файлы по типу для анализа
                find_similar: PathSearch.findByFileType('ts'),

                // Проверить существование перед операциями
                check_before_action: PathSearch.pathExists('target-file.ts'),
            },
        },
    },

    // Советы по использованию для AI-агентов
    usage_tips: {
        performance: [
            'Используйте индексы для быстрого поиска вместо перебора всех entities',
            'Кешируйте результаты поиска при многократном использовании',
            'Используйте findByDirectory для поиска в конкретной области проекта',
        ],

        best_practices: [
            'Проверяйте существование файла перед попыткой доступа',
            'Используйте рекурсивный поиск для глубокого анализа директорий',
            'Комбинируйте поиск по типу и директории для точного targeting',
        ],

        common_patterns: [
            'Поиск всех package.json: findByFileName("package.json")',
            'Документация проекта: findByFileType("md")',
            'Исходный код: findByFileType("ts") + findByFileType("tsx")',
            'Конфигурация: findByPattern("config")',
        ],
    },
}