# Experience Transfer Best Practices

Руководство по переносу опыта работы с Cursor и AI между проектами через систему `.cursor`.

## 🎯 **Почему `.cursor` лучше `docs/for-ai-best-practices`**

### **Автоматическое применение**
- ✅ Cursor автоматически читает все файлы из `.cursor/rules/`
- ✅ Правила применяются без дополнительной Settings
- ✅ AI получает контекст сразу при создании чата

### **Стандартизация**
- ✅ `.cursor` - стандартное место для правил Cursor
- ✅ Все разработчики знают, где искать правила
- ✅ Единообразие между проектами

### **Структурированность**
- ✅ Четкая иерархия (architecture, dev, doc, plugin, etc.)
- ✅ Метаdata с Priorityами и Categoryми
- ✅ Автоматическая Validation и Optimization

## 🚀 **Стратегия переноса опыта**

### **1. Экспорт из исходного проекта**

```bash
# Из папки .cursor/rules исходного проекта
node cursor-manager..js export

# С указанием целевого проекта
node cursor-manager..js export my-new-project
```

**Создается папка `cursor-export/` с:**
- Все правила по Categoryм
- Скрипты автоматизации
- Инструкции по импорту
- Автоматический скрипт импорта

### **2. Импорт в целевой проект**

```bash
# Скопировать cursor-export в целевой проект
cp -r cursor-export /path/to/new-project/

# Запустить импорт
cd /path/to/new-project
node cursor-export/import-cursor..js
```

### **3. Кастомизация для нового проекта**

```bash
# Перейти в .cursor/rules
cd .cursor/rules

# Запустить полную оптимизацию
node cursor-manager..js full

# Check Status
node cursor-manager..js status
```

## 📋 **Что переносится**

### **Core Rules (обязательные)**
- `ai-memory.mdc` - команды для AI (кастомизировать!)
- `environment.mdc` - Constrai.ts окружения (кастомизировать!)
- `index.mdc` - индекс правил
- `README.mdc` - Documentation структуры

### **Categories (по необходимости)**
- **architecture/** - архитектурные правила
- **dev/** - Principles разработки
- **doc/** - Standards документации
- **plugin/** - правила для плагинов
- **security/** - правила безопасности
- **ui/** - UI/UX Standards
- **workflow/** - Processes разработки

### **Automation (Required)**
- `audit-cursor..js` - аудит системы
- `fix-cursor..js` - автоматические исправления
- `optimize-for-ai..js` - AI Optimization
- `cursor-manager..js` - главный Interface

## 🔧 **Кастомизация для нового проекта**

### **1. Update environment.mdc**
``.mdc
---
description: Critical environment limitations
globs: ["**/*"]
alwaysApply: true
aiPriority: critical
aiCategory: environment
---

# Environment Constrai.ts

## Node.js Version
- Required: Node.js 18+ (Update для вашего проекта)

## Browser Support
- Chrome: 120+ (Update для вашего проекта)
- Firefox: 115+ (Update для вашего проекта)

## build Tools
- Vite: 5+ (Update для вашего проекта)
- TypeScript: 5+ (Update для вашего проекта)
```

### **2. Update ai-memory.mdc**
``.mdc
---
description: User Commands and AI instructions
globs: ["**/*"]
alwaysApply: true
aiPriority: critical
aiCategory: ai-optimization
---

# AI Memory Bank

## Project-Specific Commands
- `build project` - Собрать проект (Update команды)
- `test project` - Запустить тесты (Update команды)
- `deploy project` - Деплой проекта (Update команды)

## Project Context
- This is a [Type проекта] (Update Description)
- Main technology stack: [стек] (Update стек)
- Key features: [особенности] (Update особенности)
```

### **3. Update monorepo-best-practices.mdc**
``.mdc
---
description: Monorepo structure and guIDElines
globs: ["**/*"]
alwaysApply: true
aiPriority: high
aiCategory: system-design
---

# Monorepo Best Practices

## Project Structure
```
project/
├── packages/          # (Update структуру)
├── apps/             # (Update структуру)
├── tools/            # (Update структуру)
└── docs/             # (Update структуру)
```

## Package Management
- Package manager: pnpm (Update если нужно)
- Workspace configuration: pnpm-workspace.yaml (Update)
```

## 📊 **Workflow переноса**

### **Полный цикл:**
1. **Экспорт** из исходного проекта
2. **Копирование** в целевой проект
3. **Импорт** с автоматической настройкой
4. **Кастомизация** под новый проект
5. **Validation** и Optimization
6. **Testing** работы AI

### **Команды для AI:**
```bash
# Экспорт
экспорт cursor
экспорт cursor [проект]

# Импорт (в целевом проекте)
импорт cursor

# Verification
Status cursor
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

### **3. Validation после импорта**
```bash
cd .cursor/rules
node cursor-manager..js status
node cursor-manager..js audit
node cursor-manager..js optimize
```

### **4. Documentation изменений**
- Ведите changelog изменений
- Комментируйте кастомизации
- Обновляйте README проекта

### **5. Обратная Compatibility**
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
node cursor-manager..js export $TARGET_PROJECT

# Копирование в целевой проект
cp -r cursor-export $TARGET_PROJECT/

# Импорт в целевой проект
cd $TARGET_PROJECT
node cursor-export/import-cursor..js

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
    node cursor-manager..js status
fi
```

## 📈 **Метрики успеха**

### **После переноса проверьте:**
- ✅ Все файлы имеют правильные метаdata
- ✅ AI команды работают в новом проекте
- ✅ Автоматизация функционирует
- ✅ Нет конфликтов с существующими правилами
- ✅ Performance AI не снизилась

### **Долгосрочные метрики:**
- Скорость onboarding новых разработчиков
- Quality AI-ассистированной разработки
- Консистентность кода между проектами
- Time на настройку новых проектов

## 🎉 **Результат**

После правильного переноса:
- **Быстрый старт** новых проектов
- **Консистентность** между проектами
- **Автоматизация** рутинных задач
- **Улучшенное** AI-ассистирование
- **Стандартизация** процессов разработки

**Система `.cursor` обеспечивает эффективный перенос опыта между проектами с минимальными усилиями!** 🚀 