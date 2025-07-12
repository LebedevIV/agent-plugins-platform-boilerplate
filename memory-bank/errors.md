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

## CSP Script Loading Issue (RESOLVED ✅)

### Проблема
Content Security Policy блокирует выполнение тестовых скриптов в DevTools панели:
```
EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script
```

### Причина
CSP `script-src 'self'` блокирует как `eval()`, так и `new Function()`.

### Решение
Реализована CSP-совместимая загрузка через динамические `<script>` теги:
```javascript
const script = document.createElement('script');
script.src = chrome.runtime.getURL(scriptPath);
document.head.appendChild(script);
```

### Файлы изменений
- `chrome-extension/public/test-scripts/test-loader.js` (создан)
- `pages/devtools-panel/src/DebugTab.tsx` (обновлен)
- `memory-bank/devtools-testing-guide.md` (создан)

### Статус
✅ **РЕШЕНО** - 2025-01-12

---

## TestLoader Duplication Issue (RESOLVED ✅)

### Проблема
Ошибка `TestLoader is already declared` при повторной загрузке тестов.

### Причина
Отсутствие проверки на уже загруженные скрипты.

### Решение
Добавлена проверка существования TestLoader:
```javascript
if (typeof window.TestLoader !== 'undefined') {
    console.log('TestLoader уже загружен');
    return;
}
```

### Статус
✅ **РЕШЕНО** - 2025-01-12

---

## URL Fallback Issue (RESOLVED ✅)

### Проблема
Ошибка получения текущего URL в DevTools контексте.

### Причина
`chrome.tabs` API недоступен в DevTools контексте.

### Решение
Добавлен fallback на `window.location.href`:
```javascript
const getCurrentUrl = async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab.url;
    } catch (error) {
        console.log('📍 Используем fallback URL:', window.location.href);
        return window.location.href;
    }
};
```

### Статус
✅ **РЕШЕНО** - 2025-01-12

---

## SidePanel ↔ Background Messaging Issue (RESOLVED ☠️)

### Проблема
Ошибка "The message port closed before a response was received." при обмене сообщениями между сайдпанелью и background (Manifest V3).

### Причина
- Service worker (background) может быть выгружен до отправки ответа.
- Даже при return true и IIFE/Promise-стиле sendMessage не гарантирует стабильности.
- Sidepanel может отправлять сообщения до полной инициализации.

### Неудачные попытки
- Использование sendMessage с return true, IIFE, Promise — ошибка сохраняется.
- Задержки (setTimeout), Promise.resolve — не решают проблему.
- Gemini 2.5 Pro и другие LLM не дали рабочего решения для edge-case Manifest V3.

### Решение
- Перевести обмен на Port API (chrome.runtime.connect/onConnect).
- Port API устойчив к выгрузке service worker и гарантирует доставку сообщений.

### Статус
☠️ **РЕШЕНО через Port API** — 2025-07-12

---

## Другие ошибки

*Здесь будут добавляться другие решенные проблемы* 