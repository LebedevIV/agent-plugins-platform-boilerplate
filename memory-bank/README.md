# Memory Bank (локальный)

Здесь будут храниться:
- Архитектурные заметки и решения по проекту agent-plugins-platform-boilerplate
- Особенности сборки, настройки, интеграции
- История изменений и важные решения
- TODO и планы по развитию

Формат: markdown-файлы по темам.

## Паттерны интеграции

- Все ключевые хуки, UI-компоненты, сервисы и ресурсы централизованы через папку `platform-core`.
- Boilerplate остаётся чистым, интеграция — только через импорты и alias.
- Пример паттерна:
  ```js
  // hooks/index.ts
  export { usePlugins } from '@platform-core/pages/options/src/hooks/usePlugins';
  // components/index.ts
  export { PluginsTab } from '@platform-core/pages/options/src/components/PluginsTab';
  ```
- Для поддержки и обновления платформы — обновляйте содержимое `platform-core` и фиксируйте архитектурные решения в memory-bank.

## Структура файлов

### Для AI-ассистентов
- `projectbrief.md` - цели и требования проекта
- `productContext.md` - видение продукта и пользовательский опыт
- `activeContext.md` - текущие задачи и фокус работы
- `progress.md` - статус проекта и достижения
- `systemPatterns.md` - архитектурные принципы и паттерны
- `techContext.md` - технологический стек и ограничения
- `user-commands.md` - технические инструкции для обработки пользовательских команд
- `session-log.md` - история сессий разработки

### Для пользователей
- `USER_COMMANDS.md` (в корне проекта) - простые команды для копирования в чат 