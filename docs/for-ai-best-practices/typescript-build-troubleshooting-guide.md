# TypeScript Build Troubleshooting Guide for AI

## Обзор

Это руководство содержит проверенные решения для наиболее частых TypeScript ошибок в monorepo проектах с браузерными расширениями. Основано на реальном опыте исправления ошибок в agent-plugins-platform.

## Быстрая диагностика

### 1. Анализ ошибок TypeScript

**Шаг 1:** Определить тип ошибки
```bash
# Поиск всех TypeScript ошибок
pnpm run build 2>&1 | grep -E "(error|Error|ERROR)"
```

**Шаг 2:** Классифицировать ошибку
- `Cannot find type definition file for 'node'` → TypeScript Configuration
- `Cannot find module '@extension/...'` → Module Resolution
- `is not exported by` → Barrel Export Issues
- `Cannot find module 'tailwindcss'` → TailwindCSS Setup
- `Rollup failed to resolve import` → Missing Dependencies

### 2. Систематическое исправление

## TypeScript Configuration Errors

### Ошибка: `Cannot find type definition file for 'node'`

**Причина:** Node.js типы указаны в браузерном коде
**Файлы:** `pages/*/tsconfig.json`, `tests/e2e/tsconfig.json`

**Решение:**
```json
{
  "compilerOptions": {
    "types": ["chrome"]  // Убрать 'node'
  }
}
```

**Команда для поиска:**
```bash
find . -name "tsconfig.json" -exec grep -l "node" {} \;
```

### Ошибка: `Cannot find module '@extension/shared'`

**Причина:** Неправильные paths в tsconfig.json
**Решение:**
```json
{
  "compilerOptions": {
    "paths": {
      "@extension/shared": ["../../packages/shared"],
      "@extension/ui": ["../../packages/ui"],
      "@extension/vite-config": ["../../packages/vite-config"]
    }
  }
}
```

## Barrel Export Issues

### Ошибка: `"ComponentName" is not exported by ".../dist/index.mjs"`

**Причина:** Неправильный barrel export для default exports

**Решение:**
```typescript
// В component-file.ts
export default function ComponentName() { ... }

// В index.ts (barrel file)
export { default as ComponentName } from './component-file.js';

// В импорте
import { ComponentName } from '@extension/package';
```

**Паттерны для разных типов экспортов:**

1. **Default exports:**
```typescript
// Файл: utils/init-app-with-shadow.ts
export default function initAppWithShadow() { ... }

// Barrel: utils/index.ts
export { default as initAppWithShadow } from './init-app-with-shadow.js';
```

2. **Named exports:**
```typescript
// Файл: components/ToggleButton.tsx
export function ToggleButton() { ... }

// Barrel: components/index.ts
export { ToggleButton } from './ToggleButton';
```

3. **Mixed exports:**
```typescript
// Barrel: index.ts
export * from './helpers.js';
export * from './colorful-logger.js';
export { default as initAppWithShadow } from './init-app-with-shadow.js';
export type * from './types.js';
```

## TailwindCSS 4+ Setup

### Ошибка: `Cannot find module 'tailwindcss'`

**Решение:**
```bash
# В конкретном пакете
pnpm add -D tailwindcss autoprefixer @tailwindcss/postcss
```

### Ошибка: `Loading PostCSS Plugin failed: Cannot find module '@tailwindcss/postcss'`

**Решение:** Создать `postcss.config.cjs`
```javascript
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

### Ошибка: `Command 'tailwindcss-cli' not found`

**Решение:** Удалить из `build.mts`
```typescript
// УДАЛИТЬ:
// execSync(`pnpm exec tailwindcss-cli -i ${input} -o ${output} -c ${configPath}`, { stdio: 'inherit' });

// ОСТАВИТЬ только Vite PostCSS pipeline
```

## Module Resolution

### Ошибка: `Rollup failed to resolve import 'file-saver'`

**Решение:**
```bash
# В конкретном пакете
pnpm add file-saver
```

### Ошибка: `Cannot find module '.../packages/ui/dist/lib/index'`

**Решение:** Добавить в `packages/ui/tsconfig.json`
```json
{
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

### Ошибка: `Failed to resolve entry for package '@extension/vite-config'`

**Решение:** Исправить `package.json`
```json
{
  "main": "dist/index.mjs",
  "exports": {
    ".": "./dist/index.mjs"
  }
}
```

## Build Script Issues

### Ошибка: `jsx is not exported by react/jsx-runtime.js`

**Причина:** Несовместимость версий React/SWC/Vite

**Решение:**
1. Обновить зависимости:
```bash
pnpm add react@latest react-dom@latest vite@latest @vitejs/plugin-react-swc@latest
```

2. Проверить `tsconfig.json`:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

3. Не использовать `import type React`

## Pre-commit Hook Issues

### Ошибка: `spawn prettier ENOENT`

**Решение 1:** Установить prettier
```bash
pnpm add -D prettier prettier-plugin-tailwindcss -w
```

**Решение 2:** Пропустить хуки
```bash
git commit --no-verify -m "message"
```

## Команды для диагностики и исправления

### Диагностика
```bash
# Поиск проблемных tsconfig.json
find . -name "tsconfig.json" -exec grep -l "node" {} \;

# Проверка зависимостей
pnpm why react
pnpm why tailwindcss

# Проверка версий
pnpm list react react-dom vite @vitejs/plugin-react-swc
```

### Исправление
```bash
# Очистка и пересборка
rm -rf dist && pnpm run build

# Очистка кэша
pnpm exec rimraf node_modules/.vite .turbo .cache && pnpm install

# Переустановка зависимостей
rm -rf node_modules pnpm-lock.yaml && pnpm install
```

## Шаблоны конфигураций

### pages/*/tsconfig.json
```json
{
  "extends": "@extension/tsconfig/base",
  "compilerOptions": {
    "types": ["chrome"],
    "paths": {
      "@extension/shared": ["../../packages/shared"],
      "@extension/ui": ["../../packages/ui"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### packages/*/tsconfig.json
```json
{
  "extends": "../tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "declarationDir": "dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["lib/**/*", "index.mts"],
  "exclude": ["node_modules", "dist"]
}
```

### postcss.config.cjs (для TailwindCSS 4+)
```javascript
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

## Порядок действий для AI

1. **Анализ:** Определить тип и контекст ошибки
2. **Поиск:** Найти все связанные файлы
3. **Исправление:** Применить соответствующее решение
4. **Проверка:** Выполнить `pnpm run build`
5. **Повтор:** Если ошибки остались, перейти к следующему типу
6. **Документация:** Записать решение для будущего использования

## Частые ошибки и их решения

| Ошибка | Тип | Решение |
|--------|-----|---------|
| `Cannot find type definition file for 'node'` | TS Config | Убрать 'node' из types |
| `"Component" is not exported by` | Barrel Export | `export { default as Component } from './file.js'` |
| `Cannot find module 'tailwindcss'` | Dependencies | `pnpm add -D tailwindcss autoprefixer @tailwindcss/postcss` |
| `Rollup failed to resolve import` | Missing Dep | `pnpm add package-name` |
| `spawn prettier ENOENT` | Pre-commit | `git commit --no-verify` |

## Заключение

Этот guide основан на реальном опыте исправления ошибок в agent-plugins-platform. Все решения проверены и работают в production. При возникновении новых ошибок - добавлять их в этот guide для будущего использования. 