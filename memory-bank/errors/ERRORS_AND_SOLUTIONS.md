# Error graveyard и решений (ERRORS_AND_SOLUTIONS)

> Этот файл содержит все типовые ошибки сборки, инфраструктуры и их решения для проекта agent-plugins-platform. Используется как основной справочник для AI и разработчиков.

---

## 1. jsx-runtime export error ("jsx is not exported by react/jsx-runtime.js")
- Причины: несовместимость версий React 19.x, Vite 6+, @vitejs/plugin-react-swc, некорректный импорт React, множественные версии react/react-dom.
- Решения: см. memory-bank/vite-react19-errors.md (перенести сюда весь раздел).

## 2. node-polyfills/unenv external errors
- Ошибка: Rollup failed to resolve import 'unenv/node/process' или 'unenv/polyfill/globalthis'.
- Причины и решения: см. memory-bank/vite-react19-errors.md (перенести сюда весь раздел).

## 3. Ошибки ESM/CJS, dist, turbo, tsc-alias
- Причины: dist собран не в ESM, нет type: module, turbo не пересобирает зависимости.
- Решения: см. memory-bank/vite-react19-errors.md и другие файлы.

## 4. Ошибки с хуками React (useRef, useState и др.)
- Причины: dist собран не в ESM, некорректный node_modules, кэш Rollup/Vite, устаревшие lock-файлы.
- Решения: полная очистка node_modules, dist, lock-файлов, пересборка зависимостей.

## 5. popup не используется
- Все ошибки, связанные с popup, можно игнорировать, если они не влияют на работу sidepanel.

- Использовать только Node.js версии 22.17.1 и выше. Понижать версию запрещено, все баги и инфраструктурные проблемы решать только в этом контексте.

---

> При возникновении любой ошибки сборки или инфраструктуры — всегда сверяйтесь с этим файлом! 