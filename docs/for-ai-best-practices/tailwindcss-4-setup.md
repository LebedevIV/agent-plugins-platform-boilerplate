# TailwindCSS 4+ & PostCSS: Platform Setup Best Practices

## 1. devDependencies (package.json)
Добавляйте в каждый новый пакет, где используется TailwindCSS:

```json
"devDependencies": {
  "tailwindcss": "^4.1.11",
  "autoprefixer": "^10.4.21",
  "@tailwindcss/postcss": "^4.1.11"
}
```

## 2. postcss.config.cjs
Создайте файл `postcss.config.cjs` в корне пакета:

```js
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

## 3. Удалите секцию "postcss" из package.json
Если она есть, обязательно удалите:
```json
"postcss": { ... }
```

## 4. Очистка node_modules и кэша
После изменений:
```
pnpm exec rimraf node_modules
del .vite .turbo .cache (если есть)
pnpm install
```

## 5. Проверка
- Сборка должна проходить без ошибок вида "It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin..."
- TailwindCSS 4+ работает только через @tailwindcss/postcss!

## 6. Пример полного набора файлов
- package.json (devDependencies)
- postcss.config.cjs
- tailwind.config.ts (или js)

## 7. Для monorepo
- Не используйте глобальный postcss.config.* — только локальный для каждого пакета.
- Не используйте секцию postcss в package.json.

---

**Эти рекомендации обязательны для всех новых страниц и пакетов платформы.** 