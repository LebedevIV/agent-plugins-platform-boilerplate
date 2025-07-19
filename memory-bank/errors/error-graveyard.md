# Error graveyard (Error Graveyard)

## Назначение

Этот файл содержит документацию о допущенных ошибках, их причинах и способах избежания в будущем. Цель - не повторять одни и те же ошибки и учиться на опыте.

## Структура записи ошибки

```markdown
### Ошибка: [Краткое описание]
**Дата:** YYYY-MM-DD  
**Контекст:** [В какой ситуации произошла ошибка]  
**Причина:** [Почему произошла ошибка]  
**Последствия:** [Что пошло не так]  
**Решение:** [Как была исправлена]  
**Урок:** [Что нужно помнить в будущем]  
**Предотвращение:** [Как избежать подобной ошибки]  
```

## Записанные ошибки

### Ошибка: Неправильный barrel export для default exports
**Дата:** 2024-12-19  
**Контекст:** Исправление ошибки `"initAppWithShadow" is not exported by ".../packages/shared/dist/index.mjs"`  
**Причина:** Попытка использовать `export * from './file.js'` для default exports  
**Последствия:** TypeScript не мог найти экспорт, сборка падала  
**Решение:** Использовать явный re-export: `export { default as initAppWithShadow } from './init-app-with-shadow.js'`  
**Урок:** Default exports в TypeScript/ESM требуют явного re-export в barrel files  
**Предотвращение:** Всегда использовать `export { default as Name } from './file.js'` для default exports  

### Ошибка: Node.js типы в браузерном коде
**Дата:** 2024-12-19  
**Контекст:** Множественные ошибки `Cannot find type definition file for 'node'` в tsconfig.json  
**Причина:** Указание `'node'` в `compilerOptions.types` для браузерного кода расширения  
**Последствия:** TypeScript не мог найти типы Node.js, сборка падала  
**Решение:** Убрать `'node'` из types, оставить только `['chrome']`  
**Урок:** Браузерный код расширений не нуждается в Node.js типах  
**Предотвращение:** Проверять `types` в tsconfig.json для browser-specific кода  

### Ошибка: Устаревшие CLI вызовы TailwindCSS
**Дата:** 2024-12-19  
**Контекст:** Ошибка `Command 'tailwindcss-cli' not found` в build.mts  
**Причина:** Использование устаревшего CLI вместо PostCSS pipeline в TailwindCSS 4+  
**Последствия:** Сборка падала из-за отсутствующего CLI  
**Решение:** Удалить CLI вызовы, использовать Vite PostCSS pipeline  
**Урок:** TailwindCSS 4+ работает через PostCSS, не через CLI  
**Предотвращение:** Использовать `@tailwindcss/postcss` в postcss.config.cjs  

### Ошибка: Отсутствующий prettier в pre-commit хуках
**Дата:** 2024-12-19  
**Контекст:** Ошибка `spawn prettier ENOENT` при коммите  
**Причина:** Pre-commit хуки настроены, но prettier не установлен  
**Последствия:** Невозможно было сделать коммит  
**Решение:** Установить `prettier` и `prettier-plugin-tailwindcss` в workspace root  
**Урок:** Проверять наличие всех зависимостей для pre-commit хуков  
**Предотвращение:** Устанавливать prettier при настройке проекта или использовать `git commit --no-verify`  

### Ошибка: Неправильные paths в tsconfig.json
**Дата:** 2024-12-19  
**Контекст:** Ошибка `Cannot find module '@extension/shared'`  
**Причина:** Неправильные пути в `compilerOptions.paths`  
**Последствия:** TypeScript не мог разрешить импорты  
**Решение:** Добавить корректные пути: `"@extension/shared": ["../../packages/shared"]`  
**Урок:** Paths должны указывать на реальные директории относительно tsconfig.json  
**Предотвращение:** Проверять относительные пути при настройке paths  

### Ошибка: Отсутствующий outDir в packages/tsconfig.json
**Дата:** 2024-12-19  
**Контекст:** Ошибка `Cannot find module '.../packages/ui/dist/lib/index'`  
**Причина:** Не указан `outDir` в tsconfig.json пакета  
**Последствия:** Скомпилированные файлы не находились в ожидаемом месте  
**Решение:** Добавить `"outDir": "dist"` в compilerOptions  
**Урок:** Пакеты должны иметь явно указанный outDir для корректной сборки  
**Предотвращение:** Всегда указывать outDir в tsconfig.json для пакетов  

### Ошибка: Установка зависимостей в неправильном месте
**Дата:** 2024-12-19  
**Контекст:** Ошибка `Cannot find module 'tailwindcss'` в конкретном пакете  
**Причина:** Попытка установить зависимости в root вместо конкретного пакета  
**Последствия:** Зависимости не были доступны в нужном пакете  
**Решение:** Установить зависимости в конкретном пакете: `cd pages/package && pnpm add -D tailwindcss`  
**Урок:** В monorepo зависимости нужно устанавливать в конкретных пакетах, а не в root  
**Предотвращение:** Всегда переходить в директорию пакета перед установкой зависимостей  

## Общие уроки

### 1. TypeScript/ESM Barrel Exports
- **Default exports** требуют явного re-export: `export { default as Name } from './file.js'`
- **Named exports** можно re-export напрямую: `export { Name } from './file.js'`
- **Всегда указывать расширение `.js`** в импортах для ESM

### 2. Monorepo Dependencies
- Устанавливать зависимости в конкретных пакетах, а не в root
- Использовать `pnpm add -D package` для devDependencies
- Проверять `pnpm why package` для диагностики конфликтов версий

### 3. TypeScript Configuration
- Браузерный код не нуждается в Node.js типах
- Paths должны указывать на реальные директории
- outDir и declarationDir критичны для пакетов

### 4. Build Tools
- Следовать best practices для новых версий инструментов
- Удалять устаревшие CLI вызовы
- Использовать интегрированные pipeline вместо внешних CLI

### 5. Pre-commit Hooks
- Проверять наличие всех зависимостей для хуков
- Иметь fallback (--no-verify) для критических коммитов
- Документировать требования к окружению

## Команды для диагностики

```bash
# Поиск проблемных tsconfig.json
find . -name "tsconfig.json" -exec grep -l "node" {} \;

# Проверка зависимостей
pnpm why package-name

# Проверка структуры экспортов
grep -r "export.*from" packages/ --include="*.ts" --include="*.tsx"

# Проверка pre-commit хуков
cat .husky/pre-commit
```

## Рекомендации по предотвращению

1. **Создавать новые пакеты** с правильными tsconfig.json изначально
2. **Использовать barrel exports** с явными re-exports для default exports
3. **Следовать best practices** для новых версий инструментов
4. **Проверять зависимости** перед коммитом
5. **Документировать решения** для повторного использования
6. **Тестировать сборку** после каждого изменения конфигурации 