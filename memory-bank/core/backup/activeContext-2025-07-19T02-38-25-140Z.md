
---
**Main GitHub Repository:** https://github.com/LebedevIV/agent-plugins-platform-boilerplate
---

# Active Development Context

## Current Project Status
**Last Updated:** 2024-07-19 - Internationalization and Command Synchronization Session

### Completed Tasks
1. ✅ **Complete internationalization of .cursor and memory-bank** - Перевод всех файлов на английский язык
2. ✅ **Command synchronization system** - Automatic Synchronization между всеми источниками
3. ✅ **Cursor Integration AI memory-bank** - Command export для настроек Cursor
4. ✅ **Universal command format** - Поддержка английского и русского языков
5. ✅ **Модернизация PluginCard** - Fully updated дизайн карточек плагинов
6. ✅ **Модернизация PluginControlPanel** - Fully updated интерфейс панели управления
7. ✅ **Улучшение PluginDetails** - Модернизирован компонент отображения деталей плагина
8. ✅ **Улучшение DraftStatus** - Обновлен индикатор статуса с современным дизайном

### Current Focus
**Priority:** Readiness for International Community and Global Usage

### Next Steps
1. Testing command synchronization system
2. Integration of commands into Cursor AI memory-bank
3. Publishing .cursor for international community
4. Further optimization based on feedback

## Key Working Principles

### Assistant Initiative
- Always suggest improvements and optimizations
- Constructively criticize existing solutions
- Suggest alternative approaches
- Proactively identify potential issues

### Code Quality
- Follow principles from memory-bank/development-principles.md
- Apply "Do No Harm" principle
- Use AI-First documentation
- Prioritize security and performance

### Internationalization
- All rules and documentation in English
- Universal command format (английский + русский)
- Readiness for global community
- Compatibility with any AI assistant

## Technical Context

### Current Architecture
- React + TypeScript для UI компонентов
- Modular package system (@extension/*)
- Vite for building
- Tailwind CSS for styling
- Chrome Extension API for integration
- Command synchronization system

### Development Standards
- TypeScript for all new files
- ESLint for code checking
- Component approach with proper accessibility
- Structured logging
- Comprehensive documentation with examples
- English language for all rules and documentation

### Security
- Zero Trust architecture for plugins
- Validation of all input data
- Encryption of sensitive information
- Audit of all plugin actions

## Command System

### Automatic Synchronization
- **Single source of truth** - `.cursor/rules/command-sync.cjs`
- **Automatic generation** - Все файлы создаются автоматически
- **Multiple formats** - USER_COMMANDS.md, ai-memory.mdc, Cursor export

### Command Categories
- **📝 Context and Memory** - Context saving and restoration
- **🏗️ Analysis and Study** - Architecture analysis and plugin study
- **🔧 Development** - Plugin creation and code checking
- **📊 Project Management** - Version management and analysis
- **🚀 Releases and Deployment** - Release creation and building

### Cursor Integration
- **Command export** - `node .cursor/rules/command-sync.cjs export`
- **File for Cursor** - `CURSOR_AI_MEMORY_BANK.md`
- **Integration instructions** - Step-by-step guide

## User Experience

### Priorityы UX
1. Interface intuitiveness
2. Speed and responsiveness
3. Accessibility (a11y)
4. Design consistency
5. Support for various themes
6. Command universality

### Quality Metrics
- Component loading time
- Animation smoothness (60fps)
- Accessibility для скринридеров
- Compatibility with various browsers
- Compatibility with any AI assistant

## Development Plans

### Short-term Goals (1-2 недели)
- Testing command synchronization system
- Integration of commands into Cursor AI memory-bank
- Publishing .cursor for international community
- Collecting feedback from global community

### Medium-term Goals (1 месяц)
- Expanding command system with new categories
- API integration with Cursor for automatic updates
- Creating command templates for different project types
- Development of plugin ecosystem

### Long-term Goals (3 месяца)
- Creating a full-fledged international platform
- Development of global developer community
- Integration with popular services
- Multilingual interface support

## Important Files and Resources

### Command synchronization system
- `.cursor/rules/command-sync.cjs` - Main synchronization script ✅
- `.cursor/rules/doc/command-synchronization.mdc` - System documentation ✅
- `USER_COMMANDS.md` - User command reference ✅
- `CURSOR_AI_MEMORY_BANK.md` - Export for Cursor ✅

### Key Components
- `pages/side-panel/src/components/PluginCard.tsx` - Plugin cards ✅
- `pages/side-panel/src/components/PluginControlPanel.tsx` - Control panel ✅
- `pages/side-panel/src/components/PluginDetails.tsx` - Plugin details ✅
- `pages/side-panel/src/components/DraftStatus.tsx` - Status indicator ✅

### Documentation
- `.cursor/rules/doc/internationalization-complete.mdc` - Documentation интернационализации
- `.cursor/rules/doc/command-synchronization.mdc` - System documentation команд
- `memory-bank/development-principles.md` - Development principles
- `memory-bank/side-panel-improvements.md` - UI improvement plan
- `memory-bank/future-plans.md` - Long-term plans

### Configuration
- `packages/ui/` - UI components and styles
- `packages/vite-config/` - Configuration сборки
- `packages/shared/` - Common utilities

## Commands and Processes

### Command synchronization system
```bash
# Synchronize all files
node .cursor/rules/command-sync.cjs sync

# Export for Cursor AI memory-bank
node .cursor/rules/command-sync.cjs export

# Command help
node .cursor/rules/command-sync.cjs help
```

### Project Build
```bash
# Build all pages
pnpm run build

# Build specific page
cd pages/side-panel && npm run build

# Development
pnpm run dev
```

### Testing
- Use DevTools panel "Agent Platform Tools"
- Test in extension side panel
- Check in various themes (светлая/темная)
- Test all updated components
- Check command synchronization

### Git Workflow
- Create feature branches for new functions
- Create fix branches for fixes
- Use meaningful branch names
- Merge through pull requests

## Contacts and Support

### For Users
- Documentation в memory-bank/
- Testing через DevTools панель
- Feedback through GitHub Issues
- Command reference in USER_COMMANDS.md

### For Developers
- Follow principles from development-principles.md
- Use modular architecture
- Prioritize security and performance
- Document all changes
- Use command synchronization system

## Readiness Status for International Community

### ✅ Ready Components
- Complete internationalization of .cursor and memory-bank
- Command synchronization system
- Universal command format (английский + русский)
- Export for Cursor AI memory-bank
- PluginCard - полностью модернизирован
- PluginControlPanel - полностью обновлен
- PluginDetails - современный дизайн
- DraftStatus - улучшенный индикатор

### 🔄 Ready for Publication
- All rules and documentation in English
- Automatic Synchronization команд
- Readiness for global community
- Compatibility with any AI assistant
- Modern design-система внедрена
- Support for light and dark themes

### 📋 Publication Plan
1. Testing command synchronization system
2. Integration of commands into Cursor AI memory-bank
3. Publishing .cursor for international community
4. Collecting feedback from global community
5. Further optimization based on feedback

## Architecture: Sidepanel and Context Logic

- Extension sidepanel opens and closes by user сразу для всех вкладок браузера (через клик по иконке расширения).
- Side panel content depends on current web page (адреса): если открыт ozon.ru, в списке доступных плагинов появляется карточка ozon.ru, при нажатии на которую появляется чат с этим плагином.
- List of available plugins in sidepanel depends on permissions, указанных в манифестах плагинов: например, карточка плагина ozon.ru появляется только на домене ozon.ru, если в его манифесте есть соответствующее разрешение.
- Sidepanel does not work as separate extension page, а всегда контекстно привязана к активной вкладке и сайту.

## E2E Testing of Ozon Plugin Chat in Chromium (feature/ozon-chat-chromium-test)

### Goal
- Fully automate testing scenario чата плагина Ozon в браузере Chromium с помощью e2e-фреймворка (WebdriverIO).

### Stages and Progress
- [x] Analyzed existing e2e test для сайдпанели (page-side-panel.test.ts)
- [x] Confirmed that test already implements:
  - Opening Ozon page
  - Opening sidepanel
  - Checking for Ozon plugin
  - Click on plugin and open chat
  - Sending message to chat
  - Receiving response from plugin
- [x] Tested existing test in Chromium
- [x] Identified and fixed selector issues
- [x] Added support for Chromium-specific selectors
- [x] Optimized timeouts for stability
- [x] Added error handling and retry logic
- [x] Created testing documentation

### Current Status
**Ready for Use** - Test is fully functional in Chromium и готов для CI/CD интеграции.

### Next Steps
1. Integration into CI/CD pipeline
2. Adding tests for other plugins
3. Expanding test coverage
4. Optimizing test performance
