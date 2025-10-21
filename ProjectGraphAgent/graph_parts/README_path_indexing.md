# Индексация для поиска по файловым путям в ProjectGraphAgent

## Обзор

Система индексации добавляет быстрый поиск по файловым путям без изменения основной структуры `entities.jsonnet`. AI-агенты могут теперь эффективно находить сущности по путям файлов, директориям и типам файлов.

## Основные возможности

### 1. Поиск по точному пути
```jsonnet
// Найти конкретный файл
local entity = graph.templates.PathSearch.findByPath("package.json");
```

### 2. Поиск по директории
```jsonnet
// Найти все файлы в директории
local files = graph.templates.PathSearch.findByDirectory("packages");
```

### 3. Поиск по типу файла
```jsonnet
// Найти все JSON файлы
local jsonFiles = graph.templates.PathSearch.findByFileType("json");

// Найти все TypeScript файлы
local tsFiles = graph.templates.PathSearch.findByFileType("ts");
```

### 4. Поиск по имени файла
```jsonnet
// Найти все package.json файлы
local packageFiles = graph.templates.PathSearch.findByFileName("package.json");
```

### 5. Поиск с паттернами
```jsonnet
// Найти файлы содержащие паттерн
local memoryFiles = graph.templates.PathSearch.findByPattern("memory-bank");
```

## Индексы

Система создает следующие индексы:

- **pathIndex**: `путь → entity` - быстрый поиск по полному пути
- **directoryIndex**: `директория → [entities]` - файлы по директориям
- **fileTypeIndex**: `расширение → [entities]` - файлы по типу
- **fileNameIndex**: `имя_файла → [entities]` - файлы с одинаковыми именами

## Вспомогательные функции

```jsonnet
// Проверить существование файла
local exists = graph.templates.PathSearch.pathExists("src/main.ts");

// Получить статистику индексов
local stats = graph.templates.PathSearch.getIndexStats();

// Получить родительскую директорию
local parent = graph.templates.PathSearch.getParentDirectory("src/utils/helper.ts");

// Получить расширение файла
local ext = graph.templates.PathSearch.getFileExtension("component.tsx");

// Получить базовое имя файла
local name = graph.templates.PathSearch.getFileName("src/components/Button.tsx");
```

## Примеры использования для AI-агентов

### Анализ зависимостей проекта
```jsonnet
local packageFiles = graph.templates.PathSearch.findByFileName("package.json");
// Анализировать зависимости во всех package.json файлах
```

### Поиск документации
```jsonnet
local docs = graph.templates.PathSearch.findByFileType("md");
// Найти всю документацию проекта
```

### Навигация по коду
```jsonnet
local tsFiles = graph.templates.PathSearch.findByFileType("ts");
local tsxFiles = graph.templates.PathSearch.findByFileType("tsx");
// Проанализировать всю кодовую базу
```

## Преимущества

1. **Быстрый поиск** - индексы обеспечивают O(1) доступ к файлам по пути
2. **Сохранение структуры** - основная структура entities.jsonnet не изменена
3. **Гибкость** - поддержка различных типов поиска
4. **Надежность** - встроенные проверки существования файлов
5. **Простота использования** - интуитивный API для AI-агентов

## Советы по использованию

- Используйте `pathExists()` перед доступом к файлу
- Комбинируйте поиск по типу и директории для точного targeting
- Кешируйте результаты при многократном использовании
- Используйте `getIndexStats()` для отладки и мониторинга

## Доступ к примерам

Полные примеры доступны через:
```jsonnet
local examples = graph.pathSearchExamples;
```

Примеры включают реальные сценарии использования AI-агентами в различных ситуациях анализа и навигации по проекту.