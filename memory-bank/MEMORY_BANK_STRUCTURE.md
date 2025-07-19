# Memory Bank Structure - Структура и правила организации

## 🎯 **Назначение Memory Bank**

`memory-bank/` предназначен для **проектно-специфичного контекста**:
- ✅ Уникальная информация для данного проекта
- ✅ Текущий статус и прогресс разработки
- ✅ История ошибок и решений
- ✅ Принятые архитектурные решения
- ✅ Планы развития и roadmap
- ✅ Результаты тестирования и отладки

## 📁 **Структура каталогов**

```
memory-bank/
├── core/                    # Core context files
│   ├── activeContext.md     # Current project context
│   ├── progress.md          # Development progress
│   ├── projectbrief.md      # Краткое описание проекта
│   └── session-log.md       # Лог сессий разработки
│
├── errors/                  # Errors and solutions
│   ├── errors.md           # Error graveyard (основной файл)
│   ├── build-errors.md     # Ошибки сборки
│   ├── runtime-errors.md   # Runtime ошибки
│   └── ui-errors.md        # UI/UX ошибки
│
├── architecture/            # Architectural decisions
│   ├── decisions.md        # Принятые решения
│   ├── patterns.md         # Системные паттерны
│   ├── security.md         # Архитектура безопасности
│   └── comprehensive.md    # Комплексная архитектура
│
├── development/            # Development process
│   ├── testing-results.md  # Результаты тестирования
│   ├── debugging-guide.md  # Руководство по отладке
│   ├── devtools-guide.md   # Работа с DevTools
│   └── version-management.md # Управление версиями
│
├── ui/                     # UI/UX context
│   ├── side-panel.md       # Улучшения side-panel
│   ├── chat-context.md     # Контекст чата
│   └── lazy-sync.md        # Ленивая синхронизация
│
├── planning/               # Planning
│   ├── future-plans.md     # Планы развития
│   ├── optimization-plans.md # Планы оптимизации
│   └── roadmap.md          # Roadmap проекта
│
├── context/                # Contextual information
│   ├── tech-context.md     # Технический контекст
│   ├── product-context.md  # Продуктовый контекст
│   └── environment.md      # Окружение разработки
│
└── deprecated/             # Deprecated files (для миграции)
    ├── old-errors.md       # Старые файлы ошибок
    ├── old-architecture.md # Старые архитектурные файлы
    └── duplicates.md       # Дублирующие файлы
```

## 📋 **Правила организации файлов**

### **1. Core/ - Core context files**

**Критерии:**
- ✅ Критически важные для понимания проекта
- ✅ Обновляются регулярно
- ✅ Содержат текущий статус

**Файлы:**
- `activeContext.md` - текущий контекст, статус, активные задачи
- `progress.md` - прогресс разработки, достижения, блокеры
- `projectbrief.md` - краткое описание проекта, цели, ограничения
- `session-log.md` - лог сессий разработки, ключевые решения

### **2. Errors/ - Errors and solutions**

**Критерии:**
- ✅ Проектно-специфичные ошибки
- ✅ Решения и workarounds
- ✅ Контекст возникновения

**Структура записей:**
```markdown
## [2024-01-15] - Ошибка сборки TypeScript

**Проблема:** Failed to resolve entry for package '@extension/vite-config'

**Контекст:** Сборка проекта на Vite 6+, React 19+

**Решение:** Перевести пакет на ESM-only, main: dist/index.mjs

**Статус:** ✅ Решено

**Связанные файлы:** .cursor/rules/dev/typescript-build-troubleshooting.mdc
```

### **3. Architecture/ - Architectural decisions**

**Критерии:**
- ✅ Принятые архитектурные решения
- ✅ Обоснование выбора
- ✅ Влияние на проект

**Файлы:**
- `decisions.md` - принятые решения с обоснованием
- `patterns.md` - системные паттерны и подходы
- `security.md` - архитектура безопасности
- `comprehensive.md` - комплексная архитектура проекта

### **4. Development/ - Development process**

**Критерии:**
- ✅ Результаты тестирования
- ✅ Руководства по отладке
- ✅ Процессы разработки

**Файлы:**
- `testing-results.md` - результаты тестов, покрытие, проблемы
- `debugging-guide.md` - руководство по отладке
- `devtools-guide.md` - работа с DevTools, профилирование
- `version-management.md` - управление версиями, релизы

### **5. UI/ - UI/UX context**

**Критерии:**
- ✅ UI/UX решения и улучшения
- ✅ Пользовательский опыт
- ✅ Интерфейсные паттерны

**Файлы:**
- `side-panel.md` - улучшения side-panel
- `chat-context.md` - контекст чата, синхронизация
- `lazy-sync.md` - ленивая синхронизация данных

### **6. Planning/ - Planning**

**Критерии:**
- ✅ Планы развития проекта
- ✅ Roadmap и milestones
- ✅ Стратегические решения

**Файлы:**
- `future-plans.md` - планы развития, новые фичи
- `optimization-plans.md` - планы оптимизации
- `roadmap.md` - roadmap проекта, milestones

### **7. Context/ - Contextual information**

**Критерии:**
- ✅ Технический и продуктовый контекст
- ✅ Окружение разработки
- ✅ Ограничения и требования

**Файлы:**
- `tech-context.md` - технический стек, зависимости
- `product-context.md` - продуктовые требования, пользователи
- `environment.md` - окружение разработки, ограничения

## 🔄 **Workflow работы с Memory Bank**

### **1. Добавление новой информации:**

```bash
# Определить тип информации
- Ошибка/решение → errors/
- Архитектурное решение → architecture/
- Результат тестирования → development/
- UI улучшение → ui/
- План развития → planning/
- Contextual information → context/
```

### **2. Структура записей:**

```markdown
## [YYYY-MM-DD] - Краткое описание

**Контекст:** Описание ситуации

**Детали:** Подробная информация

**Решение/Результат:** Что было сделано

**Статус:** ✅ Решено / 🔄 В процессе / ❌ Проблема

**Связанные файлы:** Ссылки на .cursor/rules/ или другие файлы
```

### **3. Обновление файлов:**

- **Core файлы** - обновляются регулярно (каждая сессия)
- **Errors** - добавляются новые записи в начало
- **Architecture** - обновляются при принятии решений
- **Development** - обновляются после тестирования/отладки
- **Planning** - обновляются при изменении планов

## 🚫 **Запрещенные действия:**

### **НЕ размещать в memory-bank:**
- ❌ Универсальные правила (→ .cursor/rules/)
- ❌ Best practices для всех проектов (→ .cursor/rules/)
- ❌ Автоматизация и workflow (→ .cursor/rules/)
- ❌ Стандарты документации (→ .cursor/rules/)
- ❌ UI/UX стандарты (→ .cursor/rules/)

### **НЕ дублировать информацию:**
- ❌ Одинаковая информация в разных файлах
- ❌ Копирование из .cursor/rules/
- ❌ Дублирование между подкаталогами

## 📊 **Примеры правильной организации:**

### **Ошибка сборки:**
```
Файл: memory-bank/errors/build-errors.md
Запись: [2024-01-15] - Failed to resolve package
Ссылка: .cursor/rules/dev/typescript-build-troubleshooting.mdc
```

### **Архитектурное решение:**
```
Файл: memory-bank/architecture/decisions.md
Запись: [2024-01-15] - Выбор MCP для JS-Python коммуникации
Обоснование: Безопасность, производительность, стандартизация
```

### **Результат тестирования:**
```
Файл: memory-bank/development/testing-results.md
Запись: [2024-01-15] - E2E тесты side-panel
Результат: 8/8 тестов прошли, покрытие 95%
```

## ✅ **Результат систематизации:**

- **Четкая структура** - каждый тип информации в своем месте
- **Нет дублирования** - уникальные файлы для каждого типа
- **Легкий поиск** - логичная организация по каталогам
- **Консистентность** - единообразные форматы записей
- **Масштабируемость** - легко добавлять новые типы информации 