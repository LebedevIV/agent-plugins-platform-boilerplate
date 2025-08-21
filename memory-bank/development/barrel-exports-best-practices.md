# Barrel Exports & Aliases: Monorepo Checklist

## Barrel-файлы (index.ts):
- Только именованные экспорты через `export { ... } from './...'`.
- Для default-экспорта — только прямой импорт из файла.

## TypeScript alias:
- В каждом tsconfig прописывать alias на dist:
  ```json
  "@extension/shared/*": ["../../packages/shared/dist/*"],
  "@extension/shared": ["../../packages/shared/dist/index.mjs"]
  ```

## Экспорт функций:
- default export — только в файле функции.
- Barrel — только именованные.

## Конфигурация TypeScript:
- declaration + declarationDir в tsconfig обязательны.

## Сборка после изменений:
- **pnpm exec rimraf node_modules/.vite && pnpm exec rimraf dist && pnpm install && pnpm run build** после смены barrel/alias.

## Инструменты:
- **TailwindCSS 4+** — только через @tailwindcss/postcss, не через CLI.
- **ESLint+Prettier** — пресеты, форматирование on save, отключить конфликтующие правила.

## Troubleshooting:
- При проблемах с barrel exports: удалить node_modules/.vite, dist, переустановить зависимости
- Проверять правильность alias в tsconfig.json
- Использовать явные re-exports для default exports