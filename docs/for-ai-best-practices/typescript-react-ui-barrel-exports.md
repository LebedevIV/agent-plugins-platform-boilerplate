# Best Practices: TypeScript + React + Monorepo UI Barrel Exports

## 1. Всегда используйте именованные экспорты для компонентов
- Пример:
  ```tsx
  // packages/ui/lib/components/ToggleButton.tsx
  export function ToggleButton(props: ToggleButtonProps) { ... }
  ```

## 2. Экспортируйте компонент во всех barrel-файлах
- Пример:
  ```ts
  // packages/ui/lib/components/index.ts
  export { ToggleButton } from './ToggleButton';
  // packages/ui/lib/index.ts
  export { ToggleButton } from './components/ToggleButton';
  // packages/ui/index.ts
  export { ToggleButton } from './lib/components/ToggleButton';
  ```

## 3. В tsconfig.json обязательно указывайте "outDir": "dist"
- Без этого TypeScript не будет собирать JS/DT-файлы в нужную папку, и потребители не увидят экспорт.
  ```json
  {
    "compilerOptions": {
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "outDir": "dist"
    }
  }
  ```

## 4. В package.json main/types должны указывать на dist
  ```json
  {
    "main": "dist/index.js",
    "types": "dist/index.d.ts"
  }
  ```

## 5. После изменений всегда делайте:
  ```sh
  pnpm run clean:bundle
  pnpm run ready
  ```

## 6. Импортируйте компонент только как именованный экспорт
  ```tsx
  import { ToggleButton } from '@extension/ui';
  ```

## 7. Не используйте export * для компонентов, если нужен строгий контроль экспорта.

---

### Типовые ошибки и их решения
- Нет dist/ после сборки: проверьте "outDir" в tsconfig и используйте tsc -b.
- Компонент не экспортируется: убедитесь, что он явно экспортируется во всех barrel-файлах и не затерт export *.
- Потребитель не видит типы: проверьте "types" в package.json и наличие index.d.ts в dist/.

---

## Пример итоговой структуры экспорта ToggleButton
```
packages/ui/
  lib/
    components/
      ToggleButton.tsx   // export function ToggleButton ...
      index.ts           // export { ToggleButton } from './ToggleButton';
    index.ts             // export { ToggleButton } from './components/ToggleButton';
  index.ts               // export { ToggleButton } from './lib/components/ToggleButton';
  tsconfig.json          // "outDir": "dist"
  package.json           // "main": "dist/index.js", "types": "dist/index.d.ts"
  dist/
    index.js
    index.d.ts
    lib/
      components/
        ToggleButton.js
        ToggleButton.d.ts
      index.js
      index.d.ts
```

---

> Документ создан автоматически AI-ассистентом после устранения ошибки экспорта ToggleButton. Следуйте этим правилам для всех новых и существующих UI-пакетов платформы. 