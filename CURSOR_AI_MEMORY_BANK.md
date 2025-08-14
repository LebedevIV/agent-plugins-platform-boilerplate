# AI Memory Bank - User Commands

## Commands for AI Assistant Recognition

### 📝 Context and Memory:
- `save context` / `Сохрани контекст` / `Сохранить контекст сессии` - Save achievements, decisions and plans to memory-bank
- `update progress` / `Обнови прогресс` / `Обновить прогресс проекта` - Update activeContext.md and progress.md with current status
- `restore context` / `Восстанови контекст` / `Восстановить полный контекст` - Study all memory-bank files and restore full project understanding
- `quick restore` / `Быстрое восстановление` - Get brief summary of key principles and current status

### 🏗️ Analysis and Study:
- `analyze architecture` / `Анализируй архитектуру` / `Анализ архитектуры` - Study systemPatterns.md and techContext.md for architecture understanding
- `study plugins` / `Изучи плагины` - Analyze plugins and their structure
- `check build` / `Проверь сборку` / `Проверить сборку` - Check that project builds and works correctly
- `update documentation` / `Обнови документацию` / `Обновить документацию` - Check and update README.md and PLUGIN_DEVELOPMENT.md

### 🔧 Development:
- `create plugin [name]` / `Создай плагин [название]` - Create new plugin with specified name
- `check code` / `Проверь код` / `Проверить линтинг` - Run linting and type checking
- `run tests` / `Запусти тесты` / `Запустить тесты` - Run all project tests
- `check dependencies` / `Проверь зависимости` / `Проверить зависимости` - Check dependencies relevance and compatibility

### 📊 Project Management:
- `bump version patch/minor/major` / `Увеличь версию [patch|minor|major]` / `Версионирование` - Increase project version according to parameter
- `clean project` / `Очисти проект` / `Очистка проекта` - Clean node_modules, dist and cache
- `analyze performance` / `Анализируй производительность` / `Анализ производительности` - Analyze project performance and suggest optimizations
- `check security` / `Проверь безопасность` / `Анализ безопасности` - Analyze code and configuration security

### 🚀 Releases and Deployment:
- `create release` / `Создай релиз` / `Создать релиз` - Prepare project for release (bump version, create ZIP)
- `build production` / `Собери для продакшена` / `Сборка для продакшена` - Perform full production build

## General Principles:
- Commands can be combined (e.g.: "save context and update progress")
- All actions should consider current project context
- Results should be saved in appropriate memory-bank files
- If command is unclear — clarify details with user
- When restoring context — read all key memory-bank files and use only current best practices

## Usage Instructions:
1. Copy this content
2. Go to Cursor Settings → AI → Rules & Memories
3. Paste into User Rules or Project Rules
4. Save and restart Cursor
