# Vite + React 19 + SWC + node-polyfills: AI Error Prevention & Auto-Fix Knowledge

> Этот файл предназначен для AI-ассистента. Используй эти правила для автоматического предотвращения и устранения типовых ошибок сборки, связанных с современным стеком Vite/React/SWC/polyfills.

---

## 1. jsx-runtime export error ("jsx is not exported by react/jsx-runtime.js")
- **Причины:**
  - Несовместимость версий React 19.x, Vite 6+, @vitejs/plugin-react-swc
  - Некорректный импорт React (import type React)
  - Множественные версии react/react-dom в node_modules
- **AI-алгоритм решения:**
  1. Проверь, что только одна версия react и react-dom (`pnpm why react`)
  2. Обнови react, react-dom, vite, @vitejs/plugin-react-swc до последних версий
  3. Очисти node_modules и lockfile, затем `pnpm install`
  4. Проверь, что в tsconfig есть: `"jsx": "react-jsx"`
  5. Не используй `import type React` — только `import * as React` или вообще без импорта для нового JSX runtime

---

## 2. node-polyfills/unenv external errors
- **Ошибка:** Rollup failed to resolve import 'unenv/node/process' или 'unenv/polyfill/globalthis'
- **Причины:**
  - React 19, vite-plugin-node-polyfills, file-saver и другие зависимости требуют node/polyfills, которые не нужны в браузере
- **AI-алгоритм решения:**
  1. Добавь `'unenv/node/process'` и `'unenv/polyfill/globalthis'` в `build.rollupOptions.external` во всех Vite-конфигах (желательно централизованно через withPageConfig)
  2. Это безопасно для браузерных расширений

---

## 3. Best practices для AI
- Всегда проверяй, что @vitejs/plugin-react-swc реально подключён во всех Vite-конфигах
- После обновлений зависимостей всегда делай `pnpm install` и чисти node_modules при странных ошибках
- Не допускай смешения нескольких версий react/react-dom
- Для новых проектов всегда используй `"jsx": "react-jsx"` и не требуй явного импорта React в компонентах
- Если появляется ошибка jsx-runtime — первым делом проверь версии и структуру node_modules

---

> Этот файл не для людей, а для LLM/AI: всегда следуй этим правилам при анализе и автопочинке сборки Vite + React 19+! 