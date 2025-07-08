# User Commands & Automation

## Версионирование расширения
- Инкремент patch: `pnpm run build` (автоматически)
- Вручную увеличить patch: `bash bash-scripts/update_version.sh patch`
- Вручную увеличить minor: `bash bash-scripts/update_version.sh minor`
- Вручную увеличить major: `bash bash-scripts/update_version.sh major`
- Установить конкретную версию: `bash bash-scripts/update_version.sh 2.0.0`

## Memory-Bank: Сохранение контекста

### Команда для сохранения контекста в конце сессии
```bash
# Сохранить текущий контекст и достижения
echo "=== КОНТЕКСТ СЕССИИ $(date) ===" >> memory-bank/session-log.md
echo "## Выполненные задачи:" >> memory-bank/session-log.md
echo "- [ ] Добавьте выполненные задачи" >> memory-bank/session-log.md
echo "" >> memory-bank/session-log.md
echo "## Важные решения:" >> memory-bank/session-log.md
echo "- [ ] Добавьте принятые решения" >> memory-bank/session-log.md
echo "" >> memory-bank/session-log.md
echo "## Обнаруженные проблемы:" >> memory-bank/session-log.md
echo "- [ ] Добавьте найденные проблемы" >> memory-bank/session-log.md
echo "" >> memory-bank/session-log.md
echo "## Следующие шаги:" >> memory-bank/session-log.md
echo "- [ ] Добавьте планы на следующую сессию" >> memory-bank/session-log.md
echo "" >> memory-bank/session-log.md
echo "---" >> memory-bank/session-log.md
```

### Обновление ключевых файлов контекста
```bash
# Обновить activeContext.md с текущими задачами
echo "## Текущие задачи $(date):" >> memory-bank/activeContext.md
echo "- [ ] Добавьте текущие задачи" >> memory-bank/activeContext.md

# Обновить progress.md с новыми достижениями
echo "## Новые достижения $(date):" >> memory-bank/progress.md
echo "- [ ] Добавьте новые достижения" >> memory-bank/progress.md

# Создать резервную копию memory-bank
cp -r memory-bank memory-bank-backup-$(date +%Y%m%d-%H%M%S)
```

## Memory-Bank: Восстановление контекста

### Команда для восстановления контекста в новом чате
```bash
# Восстановить полный контекст проекта
echo "=== ВОССТАНОВЛЕНИЕ КОНТЕКСТА ==="
echo ""
echo "Для полного восстановления контекста Agent-Plugins-Platform выполните:"
echo ""
echo "1. Изучите файлы memory-bank в следующем порядке:"
echo "   - README.md (обзор структуры)"
echo "   - projectbrief.md (цели проекта)"
echo "   - productContext.md (видение продукта)"
echo "   - activeContext.md (текущие задачи)"
echo "   - progress.md (статус и достижения)"
echo "   - systemPatterns.md (архитектура)"
echo "   - techContext.md (технологический стек)"
echo "   - session-log.md (история сессий)"
echo ""
echo "2. Ключевые принципы проекта:"
echo "   - Вся логика в platform-core/, boilerplate остается чистым"
echo "   - Безопасность прежде всего (песочница, MCP протокол)"
echo "   - Python в браузере через Pyodide + WebAssembly"
echo "   - Manifest-based плагины с контролем разрешений"
echo ""
echo "3. Текущий статус:"
echo "   - Базовая инфраструктура работает"
echo "   - Пример плагина (Ozon Analyzer) функционирует"
echo "   - Следующий этап: Enhanced Plugin System"
echo ""
echo "4. Важные файлы для изучения:"
echo "   - platform-core/core/ (ядро системы)"
echo "   - platform-core/bridge/ (MCP мост)"
echo "   - platform-core/public/plugins/ (плагины)"
echo "   - pages/options/ (страница настроек)"
echo ""
echo "5. Команды разработки:"
echo "   - pnpm dev (разработка)"
echo "   - pnpm build (сборка)"
echo "   - pnpm e2e (тесты)"
echo "   - bash bash-scripts/update_version.sh (версионирование)"
```

### Команда для быстрого восстановления контекста
```bash
# Быстрое восстановление для LLM
echo "=== БЫСТРОЕ ВОССТАНОВЛЕНИЕ КОНТЕКСТА ==="
echo ""
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

### Восстановление контекста в новом чате (для любой LLM)
```bash
# Команда для пользователя в новом чате:
echo "Пожалуйста, изучи файлы в папке memory-bank в следующем порядке:"
echo "1. README.md - обзор структуры"
echo "2. projectbrief.md - цели проекта"
echo "3. productContext.md - видение продукта"
echo "4. activeContext.md - текущие задачи"
echo "5. progress.md - статус и достижения"
echo "6. systemPatterns.md - архитектура"
echo "7. techContext.md - технологический стек"
echo "8. user-commands.md - команды и автоматизация"
echo ""
echo "После изучения файлов, подтверди понимание контекста и готовность к работе."
```

## Общие рекомендации
- Для поиска исходников страницы настроек: см. путь в начале `activeContext.md`.
- Для любых изменений в правилах — редактируйте только файлы в `memory-bank`.
- Всегда обновляйте `activeContext.md` и `progress.md` при значимых изменениях.
- Создавайте резервные копии memory-bank перед крупными изменениями.
- Используйте session-log.md для отслеживания истории разработки. 