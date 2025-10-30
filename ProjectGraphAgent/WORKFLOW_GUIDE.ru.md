# Руководство по рабочему процессу ProjectGraphAgent

## Обзор

Это руководство объясняет рабочий процесс с двумя директориями для разработки и публикации ProjectGraphAgent.

## Структура директорий

```
/home/igor/Документы/Проекты/
├── agent_plugins_platform/ProjectGraphAgent/          # Режим родительского проекта
│   ├── project_graph.jsonnet              # Содержит данные Agent Plugins Platform
│   ├── graph_parts/entities.jsonnet       # Сущности, специфичные для Agent Plugins Platform
│   ├── settings.json                      # Настройки Agent Plugins Platform
│   └── ... (все остальные файлы)
└── ProjectGraphAgent/                     # Автономный режим
    ├── project_graph.jsonnet              # Чистый шаблон
    ├── graph_parts/entities.jsonnet       # Универсальные примеры
    └── ... (чистая версия, готовая к публикации)
```

## Рабочий процесс разработки

### 1. Этап разработки (Родительский проект)

Работайте в `/home/igor/Документы/Проекты/agent_plugins_platform/ProjectGraphAgent/`:

```bash
cd /home/igor/Документы/Проекты/agent_plugins_platform/ProjectGraphAgent/

# Вносите изменения в:
# - scripts/ (новые функции автоматизации)
# - graph_parts/ (шаблоны, политики, схемы)
# - adapters/ (поддержка языков)
# - README.md, документация

# Тестируйте ваши изменения
npm run graph:audit
npm run graph:validate
```

### 2. Синхронизация с автономной версией

Синхронизируйте изменения в автономную директорию:

```bash
# Из директории agent_plugins_platform/ProjectGraphAgent/
npm run sync
```

Это копирует:
- ✅ `scripts/` - Все скрипты автоматизации
- ✅ `graph_parts/` - Шаблоны, политики, схемы (кроме `entities`)
- ✅ `adapters/` - Языковые адаптеры
- ✅ `README.md`, `README_PUBLISH.md`, `CHANGELOG.md`, `LLM_GUIDELINES.md`
- ✅ `LICENSE`, `package.json`, `.gitignore`

Исключает:
- ❌ `project_graph.jsonnet` - Содержит данные родительского проекта
- ❌ `graph_parts/entities.jsonnet` - Содержит сущности родительского проекта
- ❌ `settings.json` - Настройки родительского проекта
- ❌ `.cache/`, `memory-bank/` - Сгенерированные артефакты

### 3. Очистка автономной версии

Очистите автономную директорию для публикации:

```bash
cd /home/igor/Документы/Проекты/ProjectGraphAgent
npm run clean
```

Это:
- Сбрасывает `project_graph.jsonnet` к шаблонным значениям
- Очищает `graph_parts/entities.jsonnet` до универсальных примеров
- Удаляет `.cache/`, `memory-bank/`, `settings.json`
- Обновляет `package.json` метаданными ProjectGraphAgent
- Создает соответствующий `.gitignore`

### 4. Публикация на GitHub

```bash
cd /home/igor/Документы/Проекты/ProjectGraphAgent
git add -A
git commit -m "feat: описание новой фичи"
git push origin main
```

## Автоматизированный рабочий процесс

Для удобства используйте автоматизированный воркфлоу публикации:

```bash
# Из директории agent_plugins_platform/ProjectGraphAgent/
npm run publish
```

Это автоматизирует шаги 2-4:
1. Синхронизирует изменения в автономную версию
2. Очищает автономную версию от данных родительского проекта
3. Готовит Git-коммит
4. Показывает инструкции для push

Для автоматической отправки на GitHub:
```bash
npm run publish -- --push
```

## Ручные команды

### Только синхронизация
```bash
npm run sync
```

### Только очистка
```bash
cd /home/igor/Документы/Проекты/ProjectGraphAgent
npm run clean
```

### Операции с графом
```bash
npm run graph:audit      # Сгенерировать граф и проверить расхождения
npm run graph:validate   # Проверить граф по схеме
npm run graph:commit     # Групповые коммиты (в планах)
```

## Управление файлами

### Файлы родительского проекта (agent_plugins_platform/ProjectGraphAgent/)

**Содержат данные, специфичные для проекта:**
- `project_graph.jsonnet` - Конфигурация Agent Plugins Platform
- `graph_parts/entities.jsonnet` - Сущности Agent Plugins Platform
- `settings.json` - Настройки Agent Plugins Platform
- `.cache/` - Сгенерированные артефакты для Agent Plugins Platform
- `memory-bank/` - Memory bank для Agent Plugins Platform

**Используются для:**
- Активной разработки
- Тестирования новых функций
- Управления проектом Agent Plugins Platform
- Отладки и экспериментов

### Файлы автономной версии (/home/igor/Документы/Проекты/ProjectGraphAgent/)

**Содержат универсальный шаблон:**
- `project_graph.jsonnet` - Шаблон с плейсхолдерами
- `graph_parts/entities.jsonnet` - Универсальные примеры
- Чистая версия, готовая для любого проекта

**Используются для:**
- Публикации на GitHub
- Распространения в другие проекты
- Создания универсального шаблона
- Документации и примеров

## Лучшие практики

### Разработка
1. **Всегда ведите разработку в родительском проекте** - Сохраняйте данные TSX-viewer для тестирования
2. **Тщательно тестируйте** - Используйте `npm run graph:audit` и `npm run graph:validate`
3. **Документируйте изменения** - Обновляйте README.md и CHANGELOG.md
4. **Регулярно синхронизируйте** - Используйте `npm run sync` после значительных изменений

### Публикация
1. **Проверяйте перед публикацией** - Осматривайте автономную директорию после синхронизации
2. **Очищайте перед коммитом** - Всегда запускайте `npm run clean` в автономной версии
3. **Используйте осмысленные коммиты** - Следуйте правилам Conventional Commits
4. **Тестируйте после публикации** - Проверяйте, что репозиторий на GitHub корректен

### Сопровождение
1. **Держите обе директории в синхронизированном состоянии** - Регулярная синхронизация предотвращает расхождения
2. **Делайте резервные копии важных данных** - Родительский проект содержит ценные тестовые данные
3. **Следите за статусом Git** - Проверяйте на наличие неожиданных изменений
4. **Обновляйте документацию** - Поддерживайте README.md в актуальном состоянии

### Индексация путей
1. **Используйте поиск по путям для больших проектов** - Используйте функции `graph.templates.PathSearch` для эффективного поиска файлов
2. **Проверяйте существование файлов перед доступом** - Всегда используйте `pathExists()` перед работой с файлами
3. **Используйте различные стратегии поиска** - Комбинируйте поиск по директории, типу файла и паттернам для точного targeting
4. **Следите за статистикой индекса** - Используйте `getIndexStats()` для понимания охвата кодовой базы и производительности

## Устранение неполадок

### Проблемы с синхронизацией
```bash
# Проверьте, существует ли источник
ls -la /home/igor/Документы/Проекты/agent_plugins_platform/ProjectGraphAgent/

# Проверьте, существует ли назначение
ls -la /home/igor/Документы/Проекты/ProjectGraphAgent/

# Ручная синхронизация
node scripts/sync_to_standalone.mjs
```

### Проблемы с очисткой
```bash
# Проверьте автономную директорию
cd /home/igor/Документы/Проекты/ProjectGraphAgent
ls -la

# Ручная очистка
node scripts/clean_project.mjs
```

### Проблемы с Git
```bash
# Проверьте статус Git
cd /home/igor/Документы/Проекты/ProjectGraphAgent
git status

# Сбросьте изменения при необходимости
git reset --hard HEAD
git clean -fd
```

## Краткий справочник

| Команда | Расположение | Назначение |
|---------|----------|---------|
| `npm run sync` | agent_plugins_platform/ProjectGraphAgent/ | Синхронизировать с автономной версией |
| `npm run clean` | ProjectGraphAgent/ | Очистить для публикации |
| `npm run publish` | agent_plugins_platform/ProjectGraphAgent/ | Полный рабочий процесс |
| `npm run graph:audit` | Любое | Сгенерировать граф |
| `npm run graph:validate` | Любое | Проверить граф |

## Репозиторий GitHub

- **URL**: https://github.com/LebedevIV/ProjectGraphAgent
- **Ветка**: main
- **Лицензия**: MIT
- **Статус**: Ранняя Alpha

## Следующие шаги

1. **Продолжайте разработку** в родительском проекте
2. **Регулярно синхронизируйтесь**, чтобы поддерживать автономную версию в актуальном состоянии
3. **Публикуйте обновления**, используя автоматизированный рабочий процесс
4. **Собирайте обратную связь** от сообщества GitHub
5. **Итерируйте и улучшайте** на основе использования
