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