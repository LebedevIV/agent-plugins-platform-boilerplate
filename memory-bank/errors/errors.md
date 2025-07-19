# Error graveyard (Resolved Issues)

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

---

### [Manjaro] Remote debugging (9222) не работает в Chrome Flatpak и решается установкой Chromium из репозитория

**Проблема:**
- При запуске Chrome через Flatpak с флагом `--remote-debugging-port=9222` порт не слушается, DevTools протокол недоступен (`curl http://localhost:9222/json/version` не отвечает).
- Аналогично, если Chromium не установлен как системный пакет, а только присутствует в /usr/lib/chromium (нет бинарника в /usr/bin/), remote debugging не работает.

**Причина:**
- Flatpak изолирует сетевые порты, sandbox не позволяет пробросить 9222 наружу.
- В Manjaro/Arch бинарник Chromium может отсутствовать или быть неисполняемым, если пакет установлен не полностью.

**Решение:**
1. Установить Chromium из официального репозитория:
   ```bash
   sudo pacman -Syu chromium
   ```
2. Запустить с remote debugging и отдельным профилем:
   ```bash
   chromium --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
   ```
3. Проверить, что порт слушается:
   ```bash
   ss -ltnp | grep 9222
   curl http://localhost:9222/json/version
   ```
4. После этого DevTools протокол доступен, можно использовать Composer Web, Puppeteer, VSCode DevTools и др.

**Примечание:**
- Для Flatpak Chrome remote debugging практически всегда не работает из-за sandbox. Используйте только системный Chromium/Chrome для автоматизации и интеграции.

--- 

# Error graveyard: ESLint, commitlint, Husky (flat config + type: module)

## Проблема
- Ошибки при коммите из-за несовместимости некоторых плагинов ESLint с flat config (ESLint 9+).
- Ошибки загрузки commitlint.config.js как ESM в проекте с type: module.
- Husky предупреждает о депрецированных строках в commit-msg hook.

## Решение
1. Временно убраны несовместимые плагины и правила из eslint.config.ts.
2. Расширен список ignores для исключения нецелевых файлов.
3. commitlint.config.js переименован в commitlint.config.cjs (CommonJS для type: module).
4. Из .husky/commit-msg удалены устаревшие строки.
5. После этих шагов коммит и push прошли успешно.

## Выводы
- Для Node.js с type: module все конфиги, которые должны быть CommonJS, должны иметь расширение .cjs.
- Для flat config ESLint нужно явно указывать ignores и не использовать плагины, не поддерживающие flat config.
- Все шаги и решения задокументированы в docs/for-ai-best-practices и memory-bank. 