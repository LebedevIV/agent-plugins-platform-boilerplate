# Технические инструкции для AI-ассистентов

## Обработка пользовательских команд

### Команда: "Сохрани контекст"
```bash
# Выполнить полное сохранение контекста сессии
{
  echo "=== КОНТЕКСТ СЕССИИ $(date) ==="
  echo "## Выполненные задачи:"
  # Добавить выполненные задачи из текущей сессии
  echo "## Важные решения:"
  # Добавить принятые решения
  echo "## Обнаруженные проблемы:"
  # Добавить найденные проблемы
  echo "## Lessons Learned / Narrative:"
  # Добавить ключевые нарративы, выводы, инсайты, lessons learned
  echo "## Рекомендации для будущих сессий:"
  # Добавить рекомендации и best practices
  echo "## Следующие шаги:"
  # Добавить планы на следующую сессию
  echo "## Связанные файлы и контекст:"
  echo "- activeContext.md"
  echo "- progress.md"
  echo "- systemPatterns.md"
  echo "- techContext.md"
  echo "- productContext.md"
  echo "- projectbrief.md"
  echo "- README.md"
  echo "---"
} >> memory-bank/session-log.md

# Обновить activeContext.md
{
  echo "## Текущие задачи $(date):"
  # Добавить текущие задачи
} >> memory-bank/activeContext.md

# Создать резервную копию
cp -r memory-bank memory-bank-backup-$(date +%Y%m%d-%H%M%S)
```

### Команда: "Обнови прогресс"
```bash
# Обновить progress.md с новыми достижениями
echo "## Новые достижения $(date):" >> memory-bank/progress.md
# Добавить новые достижения из текущей сессии

# Обновить activeContext.md
echo "## Обновления $(date):" >> memory-bank/activeContext.md
# Добавить обновления контекста
```

### Команда: "Восстанови контекст"
```bash
# Изучить файлы memory-bank в правильном порядке
# 1. README.md - обзор структуры
# 2. projectbrief.md - цели проекта
# 3. productContext.md - видение продукта
# 4. activeContext.md - текущие задачи
# 5. progress.md - статус и достижения
# 6. systemPatterns.md - архитектура
# 7. techContext.md - технологический стек
# 8. session-log.md - история сессий

# Подтвердить понимание контекста и готовность к работе
```

### Команда: "Быстрое восстановление"
```bash
# Предоставить краткую сводку:
echo "Agent-Plugins-Platform: Браузерное расширение для выполнения Python плагинов через Pyodide."
echo ""
echo "КЛЮЧЕВЫЕ ПРИНЦИПЫ:"
echo "- Python в браузере через Pyodide (WebAssembly)"
echo "- MCP протокол для JS-Python коммуникации"
echo "- Песочница для безопасности плагинов"
echo "- Manifest-based система плагинов"
echo "- Вся логика в platform-core/, чистый boilerplate"
echo ""
echo "ТЕКУЩИЙ СТАТУС:"
echo "- Базовая инфраструктура работает"
echo "- Пример плагина функционирует"
echo "- Следующий этап: Enhanced Plugin System"
echo ""
echo "ВАЖНЫЕ ФАЙЛЫ:"
echo "- memory-bank/activeContext.md (текущие задачи)"
echo "- memory-bank/progress.md (достижения и планы)"
echo "- platform-core/ (основная логика)"
echo "- pages/options/ (страница настроек)"
echo ""
echo "КОМАНДЫ: pnpm dev, pnpm build, pnpm e2e"
```

### Команда: "Анализируй архитектуру"
```bash
# Изучить systemPatterns.md и techContext.md
# Предоставить анализ архитектуры проекта
# Объяснить ключевые компоненты и их взаимодействие
```

### Команда: "Изучи плагины"
```bash
# Проанализировать platform-core/public/plugins/
# Изучить структуру существующих плагинов
# Объяснить принципы разработки плагинов
```

### Команда: "Проверь сборку"
```bash
# Выполнить команды сборки
pnpm build
# Проверить результат сборки
# Сообщить о статусе сборки
```

### Команда: "Обнови документацию"
```bash
# Проверить актуальность README.md
# Обновить PLUGIN_DEVELOPMENT.md при необходимости
# Убедиться в соответствии документации текущему состоянию
```

### Команда: "Создай плагин [название]"
```bash
# Создать структуру плагина в platform-core/public/plugins/[название]/
# Создать manifest.json с базовой конфигурацией
# Создать mcp_server.py с шаблоном MCP сервера
# Создать workflow.json если необходимо
# Добавить icon.svg
```