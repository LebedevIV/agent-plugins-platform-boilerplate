# Технические инструкции для AI-ассистентов

## Обработка пользовательских команд

### Команда: "Сохрани контекст"
```bash
# Выполнить полное сохранение контекста сессии
echo "=== КОНТЕКСТ СЕССИИ $(date) ===" >> memory-bank/session-log.md
echo "## Выполненные задачи:" >> memory-bank/session-log.md
# Добавить выполненные задачи из текущей сессии
echo "## Важные решения:" >> memory-bank/session-log.md
# Добавить принятые решения
echo "## Обнаруженные проблемы:" >> memory-bank/session-log.md
# Добавить найденные проблемы
echo "## Следующие шаги:" >> memory-bank/session-log.md
# Добавить планы на следующую сессию
echo "---" >> memory-bank/session-log.md

# Обновить activeContext.md
echo "## Текущие задачи $(date):" >> memory-bank/activeContext.md
# Добавить текущие задачи

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

### Команда: "Увеличь версию [patch|minor|major]"
```bash
# Выполнить команду версионирования
bash bash-scripts/update_version.sh [patch|minor|major]
# Обновить версию в package.json
# Обновить версию в manifest
```

### Команда: "Очисти проект"
```bash
# Выполнить очистку
pnpm clean
# Удалить node_modules, dist, кэш
# Сообщить о результатах очистки
```

### Команда: "Проверь зависимости"
```bash
# Проверить актуальность зависимостей
pnpm outdated
# Проверить совместимость
# Предложить обновления при необходимости
```

### Команда: "Запусти тесты"
```bash
# Запустить все тесты
pnpm e2e
# Выполнить линтинг
pnpm lint
# Проверить типы
pnpm type-check
```

### Команда: "Проверь код"
```bash
# Выполнить линтинг
pnpm lint
# Проверить типы
pnpm type-check
# Сообщить о найденных проблемах
```

### Команда: "Анализируй производительность"
```bash
# Проанализировать размер бандла
# Проверить время загрузки Pyodide
# Предложить оптимизации
```

### Команда: "Проверь безопасность"
```bash
# Проанализировать конфигурацию безопасности
# Проверить разрешения плагинов
# Оценить риски безопасности
```

### Команда: "Создай релиз"
```bash
# Увеличить версию
bash bash-scripts/update_version.sh patch
# Собрать проект
pnpm build
# Создать ZIP
pnpm zip
```

### Команда: "Собери для продакшена"
```bash
# Выполнить полную сборку
pnpm build
# Оптимизировать для продакшена
# Проверить результат сборки
```

## Версионирование расширения
- Инкремент patch: `pnpm run build` (автоматически)
- Вручную увеличить patch: `bash bash-scripts/update_version.sh patch`
- Вручную увеличить minor: `bash bash-scripts/update_version.sh minor`
- Вручную увеличить major: `bash bash-scripts/update_version.sh major`
- Установить конкретную версию: `bash bash-scripts/update_version.sh 2.0.0`

## Memory-Bank: Миграция между проектами

### Создание полного memory-bank в новом проекте
```bash
# Скопировать memory-bank в новый проект
cp -r memory-bank /path/to/new-project/

# Обновить .cursor-rules.json в новом проекте
echo '{
  "rules": [
    "Изучи файлы memory-bank для понимания контекста проекта",
    "Следуй архитектурным принципам из systemPatterns.md",
    "Используй команды из user-commands.md",
    "Обновляй activeContext.md и progress.md при изменениях"
  ]
}' > .cursor-rules.json
```

## Общие рекомендации
- Для поиска исходников страницы настроек: см. путь в начале `activeContext.md`.
- Для любых изменений в правилах — редактируйте только файлы в `memory-bank`.
- Всегда обновляйте `activeContext.md` и `progress.md` при значимых изменениях.
- Создавайте резервные копии memory-bank перед крупными изменениями.
- Используйте session-log.md для отслеживания истории разработки. 