# Experience Transfer Best Practices

Руководство по переносу опыта работы с Cursor и AI между проектами через систему `.cursor`.

## 🎯 **Почему `.cursor` лучше `docs/for-ai-best-practices`**

### **Автоматическое применение**
- ✅ Cursor автоматически читает все файлы из `.cursor/rules/`
- ✅ Правила применяются без дополнительной настройки
- ✅ AI получает контекст сразу при создании чата

### **Стандартизация**
- ✅ `.cursor` - стандартное место для правил Cursor
- ✅ Все разработчики знают, где искать правила
- ✅ Единообразие между проектами

### **Структурированность**
- ✅ Четкая иерархия (architecture, dev, doc, plugin, etc.)
- ✅ Метаданные с приоритетами и категориями
- ✅ Автоматическая валидация и оптимизация

## 🚀 **Стратегия переноса опыта**

### **1. Экспорт из исходного проекта**

```bash
# Из папки .cursor/rules исходного проекта
node cursor-manager.cjs export

# С указанием целевого проекта
node cursor-manager.cjs export my-new-project
```

**Создается папка `cursor-export/` с:**
- Все правила по категориям
- Скрипты автоматизации
- Инструкции по импорту
- Автоматический скрипт импорта

### **2. Импорт в целевой проект**

```bash
# Скопировать cursor-export в целевой проект
cp -r cursor-export /path/to/new-project/

# Запустить импорт
cd /path/to/new-project
node cursor-export/import-cursor.cjs
```

### **3. Кастомизация для нового проекта**

```bash
# Перейти в .cursor/rules
cd .cursor/rules

# Запустить полную оптимизацию
node cursor-manager.cjs full

# Проверить статус
node cursor-manager.cjs status
```

## 📋 **Что переносится**

### **Core Rules (обязательные)**
- `ai-memory.mdc` - команды для AI (кастомизировать!)
- `environment.mdc` - ограничения окружения (кастомизировать!)
- `index.mdc` - индекс правил
- `README.mdc` - документация структуры

### **Categories (по необходимости)**
- **architecture/** - архитектурные правила
- **dev/** - принципы разработки
- **doc/** - стандарты документации
- **plugin/** - правила для плагинов
- **security/** - правила безопасности
- **ui/** - UI/UX стандарты
- **workflow/** - процессы разработки

### **Automation (обязательно)**
- `audit-cursor.cjs` - аудит системы
- `fix-cursor.cjs` - автоматические исправления
- `optimize-for-ai.cjs` - AI оптимизация
- `cursor-manager.cjs` - главный интерфейс

## 🔧 **Кастомизация для нового проекта**

### **1. Обновить environment.mdc**
```mdc
---
description: Critical environment limitations
globs: ["**/*"]
alwaysApply: true
aiPriority: critical
aiCategory: environment
---

# Environment Constraints

## Node.js Version
- Required: Node.js 18+ (обновить для вашего проекта)

## Browser Support
- Chrome: 120+ (обновить для вашего проекта)
- Firefox: 115+ (обновить для вашего проекта)

## Build Tools
- Vite: 5+ (обновить для вашего проекта)
- TypeScript: 5+ (обновить для вашего проекта)
```

### **2. Обновить ai-memory.mdc**
```mdc
---
description: User commands and AI instructions
globs: ["**/*"]
alwaysApply: true
aiPriority: critical
aiCategory: ai-optimization
---

# AI Memory Bank

## Project-Specific Commands
- `build project` - Собрать проект (обновить команды)
- `test project` - Запустить тесты (обновить команды)
- `deploy project` - Деплой проекта (обновить команды)

## Project Context
- This is a [тип проекта] (обновить описание)
- Main technology stack: [стек] (обновить стек)
- Key features: [особенности] (обновить особенности)
```

### **3. Обновить monorepo-best-practices.mdc**
```mdc
---
description: Monorepo structure and guidelines
globs: ["**/*"]
alwaysApply: true
aiPriority: high
aiCategory: system-design
---

# Monorepo Best Practices

## Project Structure
```
project/
├── packages/          # (обновить структуру)
├── apps/             # (обновить структуру)
├── tools/            # (обновить структуру)
└── docs/             # (обновить структуру)
```

## Package Management
- Package manager: pnpm (обновить если нужно)
- Workspace configuration: pnpm-workspace.yaml (обновить)
```

## 📊 **Workflow переноса**

### **Полный цикл:**
1. **Экспорт** из исходного проекта
2. **Копирование** в целевой проект
3. **Импорт** с автоматической настройкой
4. **Кастомизация** под новый проект
5. **Валидация** и оптимизация
6. **Тестирование** работы AI

### **Команды для AI:**
```bash
# Экспорт
экспорт cursor
экспорт cursor [проект]

# Импорт (в целевом проекте)
импорт cursor

# Проверка
статус cursor
полный cursor
```

## 🎯 **Best Practices**

### **1. Инкрементальный перенос**
- Начните с core rules
- Добавляйте категории по мере необходимости
- Тестируйте каждую категорию

### **2. Кастомизация обязательна**
- Всегда обновляйте `environment.mdc`
- Адаптируйте `ai-memory.mdc` под проект
- Проверяйте актуальность правил

### **3. Валидация после импорта**
```bash
cd .cursor/rules
node cursor-manager.cjs status
node cursor-manager.cjs audit
node cursor-manager.cjs optimize
```

### **4. Документирование изменений**
- Ведите changelog изменений
- Комментируйте кастомизации
- Обновляйте README проекта

### **5. Обратная совместимость**
- Сохраняйте структуру категорий
- Не удаляйте обязательные файлы
- Тестируйте на разных проектах

## 🔄 **Автоматизация**

### **Скрипт быстрого переноса:**
```bash
#!/bin/bash
# quick-transfer.sh

SOURCE_PROJECT=$1
TARGET_PROJECT=$2

echo "🚀 Quick transfer from $SOURCE_PROJECT to $TARGET_PROJECT"

# Экспорт из исходного проекта
cd $SOURCE_PROJECT/.cursor/rules
node cursor-manager.cjs export $TARGET_PROJECT

# Копирование в целевой проект
cp -r cursor-export $TARGET_PROJECT/

# Импорт в целевой проект
cd $TARGET_PROJECT
node cursor-export/import-cursor.cjs

# Очистка
rm -rf cursor-export

echo "✅ Transfer completed!"
```

### **Git hooks для автоматизации:**
```bash
# .git/hooks/post-merge
#!/bin/bash
if [ -d ".cursor/rules" ]; then
    cd .cursor/rules
    node cursor-manager.cjs status
fi
```

## 📈 **Метрики успеха**

### **После переноса проверьте:**
- ✅ Все файлы имеют правильные метаданные
- ✅ AI команды работают в новом проекте
- ✅ Автоматизация функционирует
- ✅ Нет конфликтов с существующими правилами
- ✅ Производительность AI не снизилась

### **Долгосрочные метрики:**
- Скорость onboarding новых разработчиков
- Качество AI-ассистированной разработки
- Консистентность кода между проектами
- Время на настройку новых проектов

## 🎉 **Результат**

После правильного переноса:
- **Быстрый старт** новых проектов
- **Консистентность** между проектами
- **Автоматизация** рутинных задач
- **Улучшенное** AI-ассистирование
- **Стандартизация** процессов разработки

**Система `.cursor` обеспечивает эффективный перенос опыта между проектами с минимальными усилиями!** 🚀 