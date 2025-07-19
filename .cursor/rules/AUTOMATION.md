# .cursor Automation System

Комплексная система automation для аудита, исправления и оптимизации каталога `.cursor` для лучшего понимания AI и Cursor.

## 🎯 **Purpose**

Система automation обеспечивает:
- **Автоматический аудит** каталога `.cursor` на предмет проблем
- **Исправление** найденных проблем (дубликаты, сломанные ссылки, метаdata)
- **Оптимизацию** правил специально для AI и Cursor
- **Monitoring** состояния и качества правил

## 🛠️ **Компоненты системы**

### **1. CursorAuditor** (`audit-cursor..js`)
- Сканирование всех файлов в `.cursor/rules`
- Verification метаданных и их валидности
- Поиск дублирующего контента
- Verification сломанных ссылок
- Validation структуры каталога
- Генерация подробных отчетов

### **2. CursorFixer** (`fix-cursor..js`)
- Автоматическое исправление метаданных
- Удаление дублирующих файлов
- Исправление сломанных ссылок
- Обновление индексов

### **3. AIOptimizer** (`optimize-for-ai..js`)
- Optimization метаданных для AI
- Добавление AI-специфичных тегов
- Purpose Priorityов и категорий
- Создание AI-оптимизированных индексов

### **4. CursorManager** (`cursor-manager..js`)
- Главный Interface для всех операций
- Управление workflow
- Генерация отчетов о Statusе
- CLI Interface

## 🚀 **Usage**

### **Базовые команды:**

```bash
# Показать справку
node cursor-manager..js help

# Check Status
node cursor-manager..js status

# Запустить аудит
node cursor-manager..js audit

# Применить исправления
node cursor-manager..js fix

# Оптимизировать для AI
node cursor-manager..js optimize

# Полный workflow
node cursor-manager..js full
```

### **Опции:**

```bash
#.json вывод для аудита
node cursor-manager..js audit -.json

# Пропустить аудит перед исправлениями
node cursor-manager..js fix --no-audit-first

# Пропустить аудит после оптимизации
node cursor-manager..js optimize --no-audit-after
```

## 📊 **Что проверяет аудит**

### **Файлы и структура:**
- Общее Quantity файлов
- Соотношение `.mdc` и `.md` файлов
- Наличие обязательных директорий
- Наличие обязательных файлов

### **Метаdata:**
- Наличие.yaml frontmatter
- Валидность полей `description`, `globs`, `alwaysApply`
- AI-специфичные поля `aiPriority`, `aiCategory`

### **Контент:**
- Дублирующий контент между файлами
- Сломанные ссылки в документации
- Консистентность структуры

### **AI-Optimization:**
- Priorityы правил (critical, high, medium, normal)
- Категории (system-design, development-practices, etc.)
- AI-специфичные теги и Comme.ts

## 🤖 **AI-специфичные оптимизации**

### **Priorityы:**
- **critical**: Применяется ко всему коду и решениям
- **high**: Применяется к большинству задач
- **medium**: Применяется когда релевантно
- **normal**: Применяется когда уместно

### **Категории:**
- **system-design**: Architecture и структура системы
- **development-practices**: Standards кодирования
- **documentation**: Documentation и Communication
- **plugin-development**: Правила для плагинов
- **security**: Security
- **user-interface**: UI/UX Standards
- **process-management**: Workflow и Processes
- **ai-optimization**: AI-специфичные оптимизации

## 📈 **Отчеты и метрики**

### **Статистика:**
- Общее Quantity файлов
- Файлы с/без метаданных
- Quantity проблем
- Процент AI-готовности

### **Проблемы:**
- Дублирующий контент
- Сломанные ссылки
- Невалидные метаdata
- Отсутствующие файлы/директории

### **Recommendations:**
- Конвертация `.md` в `.mdc`
- Добавление метаданных
- Удаление дубликатов
- Исправление ссылок

## 🔄 **Workflow**

### **Полный workflow (`full`):**
1. **Аудит** - поиск проблем
2. **Исправления** - автоматическое решение
3. **Optimization** - AI-специфичные улучшения
4. **Финальный аудит** - Verification результатов
5. **Отчет** - сравнение до/после

### **Инкрементальный workflow:**
- `audit` → анализ проблем
- `fix` → исправление
- `optimize` → Optimization
- `status` → Monitoring

## 📝 **Integration с AI**

### **Автоматические команды:**
Система интегрирована с AI memory-bank через команды:
- `аудит cursor` / `cursor audit`
- `исправь cursor` / `cursor fix`
- `оптимизируй cursor` / `cursor optimize`
- `полный cursor` / `cursor full`
- `Status cursor` / `cursor status`

### **AI-оптимизированные файлы:**
- `ai-optimization.mdc` - инструкции для AI
- `ai-index.mdc` - индекс по Priorityам
- AI-теги в каждом файле
- Priorityы и категории в метаданных

## 🎯 **Результаты**

После полной оптимизации:
- ✅ Все файлы имеют правильные метаdata
- ✅ Нет дублирующего контента
- ✅ Все ссылки работают
- ✅ AI-специфичные оптимизации применены
- ✅ Priorityы и категории назначены
- ✅ Автоматическое применение критических правил

## 🔧 **Расширение системы**

### **Добавление новых проверок:**
1. Create Method в `CursorAuditor`
2. Add в основной workflow
3. Update отчеты

### **Добавление новых исправлений:**
1. Create Method в `CursorFixer`
2. Интегрировать в процесс исправления
3. Add в отчеты

### **Добавление новых оптимизаций:**
1. Create Method в `AIOptimizer`
2. Add AI-специфичную логику
3. Update валидацию

## 📚 **Связанные файлы**

- `audit-cursor..js` - Аудит системы
- `fix-cursor..js` - Исправления
- `optimize-for-ai..js` - AI Optimization
- `cursor-manager..js` - Главный Interface
- `ai-optimization.mdc` - AI инструкции
- `ai-index.mdc` - AI индекс
- `ai-memory.mdc` - Команды для AI 