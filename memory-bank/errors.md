# Кладбище ошибок (Resolved Issues)

## DevTools Panel Issue (RESOLVED ✅)

### Проблема
Custom DevTools panel "Agent Platform Tools" не появляется в браузере DevTools, несмотря на корректную конфигурацию и успешную сборку.

### Причина
Неправильная конфигурация `devtools_page` в манифесте:
- **Неправильно**: `devtools_page: 'devtools-panel/index.html'`
- **Правильно**: `devtools_page: 'devtools/index.html'`

### Объяснение
`devtools_page` должен указывать на страницу-инициализатор (`devtools/index.html`), которая вызывает `chrome.devtools.panels.create()`, а не на саму панель (`devtools-panel/index.html`).

### Решение
1. Изменить в `chrome-extension/manifest.ts`:
   ```typescript
   devtools_page: 'devtools/index.html' // вместо 'devtools-panel/index.html'
   ```

2. Обновить название панели в `pages/devtools/src/index.ts`:
   ```typescript
   chrome.devtools.panels.create('Agent Platform Tools', '/icon-34.png', '/devtools-panel/index.html');
   ```

### Файлы изменений
- `chrome-extension/manifest.ts`
- `pages/devtools/src/index.ts`
- `docs/devtools-panel-troubleshooting.md` (создан)
- `docs/devtools-panel-usage.md` (обновлен)

### Статус
✅ **РЕШЕНО** - 2025-07-12

### Коммит
`9a13f3f` - fix: resolve DevTools panel issue - correct devtools_page path in manifest

---

## Другие ошибки

*Здесь будут добавляться другие решенные проблемы* 