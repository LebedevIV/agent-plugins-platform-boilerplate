# Best Practices: Barrel Exports, Aliases, and TypeScript/React in Monorepo

## 1. Barrel Exports (index.ts)
- **Всегда используйте только именованные экспорты** для barrel-файлов (index.ts), избегайте default-экспорта через `export { default as ... }`.
- Для функций, которые должны импортироваться как default, используйте `export default` только в самом файле функции, а не в barrel.
- Не используйте `export * from './file'` для default-экспорта — это не работает корректно в ESM/TypeScript.
- Для компонентов и утилит, которые должны импортироваться как default, импортируйте их напрямую из файла, а не через barrel.

## 2. TypeScript Aliases
- В каждом пакете, где требуется импортировать код из другого workspace-пакета, добавляйте alias в `tsconfig.json`:
  ```json
  "paths": {
    "@extension/shared/*": ["../../packages/shared/dist/*"],
    "@extension/shared": ["../../packages/shared/dist/index.mjs"]
  }
  ```
- Для корректной работы алиасов убедитесь, что все импорты используют относительный путь к `dist`, а не к исходникам.

## 3. Экспорт функций и компонентов
- Если функция/компонент должен импортироваться как default:
  - В файле: `export default function MyFunc() { ... }`
  - Импорт: `import MyFunc from '...'`
- Если как именованный:
  - В файле: `export function MyFunc() { ... }`
  - Barrel: `export { MyFunc } from './MyFunc'`
  - Импорт: `import { MyFunc } from '...'`

## 4. Генерация деклараций
- В каждом пакете обязательно:
  ```json
  "declaration": true,
  "declarationDir": "dist"
  ```
- После изменений всегда пересобирайте пакет, чтобы .d.ts файлы были актуальны.

## 5. Очистка кэша и node_modules
- После смены barrel-экспорта, alias или структуры dist всегда выполняйте:
  ```sh
  pnpm exec rimraf node_modules/.vite
  pnpm exec rimraf dist
  pnpm install
  pnpm run build
  ```

## 6. React+TypeScript+ESLint+Prettier
- Используйте eslint-config-react-app или аналогичный пресет.
- Включайте все правила eslint-plugin-react-hooks.
- Для форматирования используйте Prettier и отключайте конфликтующие правила в ESLint через eslint-config-prettier.
- Включайте форматирование on save в редакторе (VSCode: "Format on Save").
- Для новых пакетов используйте шаблон tsconfig с alias и настройками для ESM/NodeNext.

## 7. TailwindCSS 4+ в монорепо
- Используйте только `@tailwindcss/postcss` как PostCSS-плагин, не подключайте tailwindcss-cli.
- В package.json:
  ```json
  "devDependencies": {
    "tailwindcss": "^4.1.11",
    "autoprefixer": "^10.4.21",
    "@tailwindcss/postcss": "^4.1.11"
  }
  ```
- В postcss.config.cjs:
  ```js
  module.exports = {
    plugins: {
      '@tailwindcss/postcss': {},
      autoprefixer: {},
    },
  }
  ```
- Не используйте секцию "postcss" в package.json.

---

**См. также:**
- memory-bank/ai-barrel-exports-best-practices.md
- .cursor/rules/barrel-exports.md
- Официальные гайды React/TypeScript/ESLint/Prettier 