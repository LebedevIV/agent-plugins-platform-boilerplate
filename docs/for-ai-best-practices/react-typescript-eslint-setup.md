# React + TypeScript + ESLint + Prettier: Platform Setup Best Practices

## 1. TypeScript
- Всегда добавляйте в `devDependencies`:
  - `@types/react`
  - `@types/react-dom`
- В `tsconfig.json`:
  - Включайте `dom` в `lib` (или не указывайте `lib`, чтобы было по умолчанию)
  - `jsx`: используйте `react-jsx` для React 18+ и 19+
  - Включайте только нужные типы в `types` (например, `chrome` для расширений, не добавляйте `node` без необходимости)

## 2. ESLint
- Используйте ESLint с рекомендованными плагинами:
  - `eslint-plugin-react`
  - `eslint-plugin-react-hooks`
  - `eslint-plugin-react-compiler` (для React 19+)
  - `@typescript-eslint/eslint-plugin`
- В `.eslintrc.cjs`:
  - Включайте все правила из `eslint-plugin-react-hooks` и `eslint-plugin-react-compiler`.
  - Для React 19+:
    ```js
    plugins: ['eslint-plugin-react-compiler', 'react-refresh'],
    rules: {
      'react-compiler/react-compiler': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
    ```

## 3. Prettier
- Используйте Prettier для автоформатирования кода.
- Интегрируйте Prettier с VSCode (расширение `esbenp.prettier-vscode`).
- Включите "format on save" в настройках редактора.
- Отключите конфликтующие правила форматирования в ESLint через `eslint-config-prettier`.
- Для CI используйте `prettier --check` для проверки форматирования.

## 4. React Compiler (React 19+)
- Для оптимизации используйте `babel-plugin-react-compiler` и ESLint-плагин `eslint-plugin-react-compiler`.
- В Vite-конфиге:
  ```js
  import PluginObject from 'babel-plugin-react-compiler';
  export default defineConfig({
    plugins: [[PluginObject], react()],
  });
  ```
- Проверяйте совместимость с помощью:
  ```bash
  npx react-compiler-healthcheck@latest
  ```

## 5. Общие рекомендации
- Не используйте устаревшие секции (например, `postcss` в package.json) — только отдельные конфиги.
- Всегда синхронизируйте версии зависимостей между пакетами.
- После изменений очищайте кэш и node_modules:
  ```bash
  pnpm exec rimraf node_modules
  pnpm install
  ```
- Для новых пакетов используйте шаблоны из актуальных pages/* (options, new-tab, side-panel).

---

> Все рекомендации соответствуют последним best practices React, TypeScript, Vite и платформы. 