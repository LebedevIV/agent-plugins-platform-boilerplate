# TypeScript Build Troubleshooting - Quick Reference

## Быстрые решения

### 1. TypeScript Config Errors
- **`Cannot find type definition file for 'node'`** → Убрать `'node'` из `types: ["chrome"]`
- **`Cannot find module '@extension/shared'`** → Добавить paths в tsconfig.json

### 2. Barrel Export Issues  
- **`"Component" is not exported by`** → `export { default as Component } from './file.js'`
- **Default exports** → Требуют явный re-export
- **Named exports** → Можно re-export напрямую

### 3. TailwindCSS 4+
- **`Cannot find module 'tailwindcss'`** → `pnpm add -D tailwindcss autoprefixer @tailwindcss/postcss`
- **PostCSS error** → Создать `postcss.config.cjs` с `@tailwindcss/postcss`
- **CLI error** → Удалить `tailwindcss-cli` из build.mts

### 4. Module Resolution
- **`Rollup failed to resolve import`** → `pnpm add package-name`
- **`Cannot find module '.../dist/index'`** → Добавить `"outDir": "dist"` в tsconfig.json

### 5. Pre-commit Issues
- **`spawn prettier ENOENT`** → `git commit --no-verify`

## Команды

```bash
# Поиск проблем
find . -name "tsconfig.json" -exec grep -l "node" {} \;

# Очистка и сборка
rm -rf dist && pnpm run build

# Пропуск хуков
git commit --no-verify -m "message"
```

## Паттерны

### pages/*/tsconfig.json
```json
{
  "compilerOptions": {
    "types": ["chrome"],
    "paths": {
      "@extension/shared": ["../../packages/shared"]
    }
  }
}
```

### Barrel exports
```typescript
// Default
export { default as Component } from './component.js';

// Named  
export { Component } from './component.js';
```

### postcss.config.cjs
```javascript
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
``` 