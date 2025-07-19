# 🔄 Механизм обновления правил Cursor

## 📋 Типы правил и их обновление

### 1. User Rules (Глобальные)
**Расположение**: Cursor Settings → Rules → User Rules
**Файл**: `memory-bank/cursor-user-rules-simple.md`
**Формат**: Простой текст
**Область применения**: Все проекты в Cursor

#### Обновление:
1. Отредактируйте `memory-bank/cursor-user-rules-simple.md`
2. Скопируйте содержимое в Cursor Settings → Rules → User Rules
3. Нажмите "Save"

### 2. Project Rules (Специфичные для проекта)
**Расположение**: `.cursor/rules/` (версионируется с кодом)
**Формат**: MDC с метаданными
**Область применения**: Только текущий проект

#### Типы применения:
- **Always**: Применяются всегда
- **Auto Attached**: Применяются при работе с файлами по паттерну
- **Agent Requested**: ИИ решает когда применять
- **Manual**: Только по явному вызову

#### Файлы правил:
- `development-principles.mdc` - 10 принципов (Always)
- `architecture-patterns.mdc` - архитектура (Always)
- `plugin-development.mdc` - плагины (Auto Attached: `public/plugins/**/*`)
- `ui-standards.mdc` - UI (Auto Attached: `**/*.tsx`, `pages/**/*`)

#### Обновление:
1. Отредактируйте файлы в `.cursor/rules/`
2. Закоммитьте изменения в git
3. Правила применяются автоматически при следующем открытии проекта

### 3. Saved Memories (Контекст)
**Расположение**: Cursor Settings → Rules → Saved Memories
**Файл**: `memory-bank/cursor-saved-memories.md`
**Формат**: Простой текст
**Область применения**: Быстрое восстановление контекста

#### Обновление:
1. Отредактируйте `memory-bank/cursor-saved-memories.md`
2. Скопируйте содержимое в Cursor Settings → Rules → Saved Memories
3. Нажмите "Save"

## 🚀 Автоматизация обновлений

### Git Hooks (Рекомендуется)
```bash
# .git/hooks/pre-commit
#!/bin/bash
# Проверка синтаксиса MDC файлов
for file in .cursor/rules/*.mdc; do
  if [ -f "$file" ]; then
    # Проверка наличия обязательных метаданных
    if ! grep -q "name:" "$file" || ! grep -q "apply:" "$file"; then
      echo "Error: Invalid MDC format in $file"
      exit 1
    fi
  fi
done
```

### Скрипт синхронизации
```bash
#!/bin/bash
# sync-cursor-rules.sh

echo "🔄 Синхронизация правил Cursor..."

# Обновление User Rules
echo "📝 Обновление User Rules..."
cat memory-bank/cursor-user-rules-simple.md | pbcopy
echo "✅ User Rules скопированы в буфер обмена"

# Обновление Saved Memories
echo "🧠 Обновление Saved Memories..."
cat memory-bank/cursor-saved-memories.md | pbcopy
echo "✅ Saved Memories скопированы в буфер обмена"

# Проверка Project Rules
echo "🔍 Проверка Project Rules..."
for file in .cursor/rules/*.mdc; do
  if [ -f "$file" ]; then
    echo "✅ $file - OK"
  fi
done

echo "🎉 Синхронизация завершена!"
echo "📋 Не забудьте вставить содержимое буфера обмена в Cursor Settings"
```

## 📊 Мониторинг эффективности

### Метрики для отслеживания:
1. **Применение правил**: Сколько раз правила применялись
2. **Качество кода**: ESLint ошибки, покрытие тестами
3. **Безопасность**: Количество security issues
4. **Производительность**: Время сборки, размер бандла
5. **Документация**: Актуальность документации

### Отчеты:
```bash
# Генерация отчета по правилам
echo "📊 Отчет по правилам Cursor"
echo "=========================="
echo "User Rules: $(wc -l < memory-bank/cursor-user-rules-simple.md) строк"
echo "Project Rules: $(ls .cursor/rules/*.mdc | wc -l) файлов"
echo "Saved Memories: $(wc -l < memory-bank/cursor-saved-memories.md) строк"
echo "Последнее обновление: $(date)"
```

## 🔧 Устранение проблем

### Проблема: Правила не применяются
**Решение**:
1. Проверьте синтаксис MDC файлов
2. Убедитесь, что файлы в правильной папке `.cursor/rules/`
3. Перезапустите Cursor
4. Проверьте метаданные в MDC файлах

### Проблема: Конфликт правил
**Решение**:
1. Проверьте приоритеты правил (Always > Auto Attached > Agent Requested > Manual)
2. Убедитесь, что globs не пересекаются
3. Проверьте логи Cursor для ошибок

### Проблема: Правила устарели
**Решение**:
1. Обновите файлы в `memory-bank/`
2. Синхронизируйте с Cursor Settings
3. Обновите Project Rules в `.cursor/rules/`
4. Закоммитьте изменения

## 📈 Рекомендации по развитию

### Добавление новых правил:
1. **Определите тип**: User Rules или Project Rules
2. **Выберите формат**: Простой текст или MDC
3. **Определите область применения**: Always, Auto Attached, etc.
4. **Документируйте**: Добавьте в `progress.md`
5. **Протестируйте**: Проверьте эффективность

### Оптимизация существующих правил:
1. **Анализируйте метрики**: Какие правила работают лучше
2. **Собирайте обратную связь**: От разработчиков
3. **Итеративно улучшайте**: Постепенно оптимизируйте
4. **Документируйте изменения**: В `session-log.md`

### Масштабирование:
1. **Создайте шаблоны**: Для новых проектов
2. **Автоматизируйте**: Скрипты синхронизации
3. **Стандартизируйте**: Единый формат для команды
4. **Мониторьте**: Эффективность применения 