### 🔍 Ключевые факты

*   Сборка расширения проходит успешно.
*   Манифест `dist/manifest.json` валиден, но содержит неверный путь в поле `devtools_page`.
*   HTML-файлы, на которые ссылается манифест, существуют и корректны.

### 📁 Файлы для анализа

*   `dist/manifest.json`
*   `dist/devtools-panel/index.html`
*   `chrome-extension/manifest.ts`
*   `pages/devtools-panel/index.html`

### 🎯 Задача для Gemini 2.5 Pro

Определить точную причину отсутствия DevTools panel и предложить конкретные шаги для исправления, основываясь на предоставленных файлах и фактах.