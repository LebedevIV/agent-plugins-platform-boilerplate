# Barrel Exports & Aliases: Monorepo Checklist

1. **Barrel-файлы (index.ts):**
   - Только именованные экспорты через `export { ... } from './...'`.
   - Для default-экспорта — только прямой импорт из файла.
2. **TypeScript alias:**
   - В каждом tsconfig прописывать alias на dist:
     ```json
     "@extension/shared/*": ["../../packages/shared/dist/*"],
     "@extension/shared": ["../../packages/shared/dist/index.mjs"]
     ```
3. **Экспорт функций:**
   - default export — только в файле функции.
   - Barrel — только именованные.
4. **declaration + declarationDir** в tsconfig.
5. **pnpm exec rimraf node_modules/.vite && pnpm exec rimraf dist && pnpm install && pnpm run build** после смены barrel/alias.
6. **TailwindCSS 4+** — только через @tailwindcss/postcss, не через CLI.
7. **ESLint+Prettier** — пресеты, форматирование on save, отключить конфликтующие правила. 