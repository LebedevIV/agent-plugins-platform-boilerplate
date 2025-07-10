# ВАЖНО: Страница настроек платформы
- Исходный код страницы настроек находится в папке: agent-plugins-platform-boilerplate/pages/options/
- Основной макет страницы: agent-plugins-platform-boilerplate/pages/options/index.html

# Active Context: Agent-Plugins-Platform

## Current Work Focus

### Memory Bank Initialization
- **Status**: ✅ Completed
- **Goal**: Establish comprehensive project documentation
- **Scope**: Created all core memory bank files for project understanding

### Project State Assessment
- **Current Phase**: Architecture validation and finalization
- **Priority**: Complete system integration verification
- **Focus Areas**: Backend-Frontend integration, consistency verification, final documentation

### Plugin Chats Per Page & Plugin (✅ Completed)
- **Требование:** Чаты плагинов должны быть отдельными для каждой страницы (URL/домен) и для каждого плагина.
- **Сохранение:** Чаты сохраняются только если были начаты, хранятся локально (IndexedDB предпочтительно, допускается localStorage для малых объёмов).
- **Привязка:** Каждый чат принадлежит определённой странице и определённому плагину.
- **Причина:** Чаты могут быть большими, должны быть доступны только на конкретном устройстве/браузере, не должны синхронизироваться между устройствами.
- **UX:** Не сохранять пустые чаты, не создавать записи до первого сообщения.

### Comprehensive Architecture Documentation (✅ Completed)
- **Цель:** Создать полное описание архитектуры, интегрирующее существующую систему плагинов с новой системой чатов
- **Результат:** Создан файл `comprehensive-architecture.md` с детальным описанием всех компонентов
- **Охват:** Все архитектурные слои, компоненты, потоки данных, безопасность, производительность

### Architecture Validation and Finalization (✅ Completed)
- **Цель:** Проверить и формализовать архитектуру как единое непротиворечивое целое
- **Результат:** Обновлена архитектурная документация с реальными реализациями
- **Охват:** Backend-Frontend интеграция, актуальные компоненты, потоки данных

## Recent Changes

### Memory Bank Creation
- ✅ Created `projectbrief.md` - Core project requirements and goals
- ✅ Created `productContext.md` - Product vision and user experience
- ✅ Created `systemPatterns.md` - Architecture and technical patterns
- ✅ Created `techContext.md` - Technology stack and constraints
- ✅ Created `activeContext.md` - Current work tracking
- ✅ Created `progress.md` - Project status and completion tracking
- ✅ Created `comprehensive-architecture.md` - Complete system architecture

### Codebase Analysis
- ✅ Explored project structure and key files
- ✅ Analyzed README.md for project overview
- ✅ Reviewed package.json for dependencies
- ✅ Examined manifest.json for extension configuration
- ✅ Identified core components and architecture

### Chat System Implementation
- ✅ Implemented plugin chat caching system
- ✅ Created IndexedDB storage abstraction
- ✅ Integrated chat system with UI components
- ✅ Added DevTools panel for chat management
- ✅ Implemented real-time sync across tabs

### Architecture Validation
- ✅ Verified background services implementation
- ✅ Validated UI components integration
- ✅ Confirmed chat system functionality
- ✅ Checked platform-core components
- ✅ Updated documentation with real implementations

## Next Steps

### Immediate Actions (Next 1-2 sessions)
1. **Complete Memory Bank**: ✅ Finished creating comprehensive memory bank system
2. **Context Preservation System**: ✅ Created commands for saving and restoring context
3. **Deep Code Review**: ✅ Analyzed core implementation files
4. **Plugin Analysis**: ✅ Studied existing plugin implementation
5. **Build System Review**: ✅ Understood Vite configuration and build process
6. **Architecture Documentation**: ✅ Created comprehensive architecture documentation
7. **Architecture Validation**: ✅ Verified and formalized complete system architecture

### Short-term Goals (Next 1-2 weeks)
1. **Development Environment Setup**: Ensure local development works
2. **Plugin Development Workflow**: Test plugin creation and execution
3. **Documentation Enhancement**: Improve existing documentation
4. **Testing Infrastructure**: Establish testing patterns and tools

### Medium-term Goals (Next 1-2 months)
1. **Plugin Ecosystem**: Expand plugin examples and templates
2. **Performance Optimization**: Improve Pyodide loading and execution
3. **Security Hardening**: Enhance security model and validation
4. **User Experience**: Improve UI and developer experience

## Active Decisions and Considerations

### Architecture Decisions
- **Pyodide Version**: Using 0.27.7 - need to evaluate if upgrade is beneficial
- **MCP Protocol**: Implementing custom MCP bridge - consider standard library usage
- **Plugin Structure**: Manifest-based approach - evaluate flexibility vs complexity
- **Worker Isolation**: Each plugin in separate worker - consider resource sharing
- **Chat System**: LRU cache + IndexedDB approach - proven effective for performance
- **Backend-Frontend Integration**: Unified messaging through chrome.runtime.sendMessage

### Technical Considerations
- **Memory Management**: WebAssembly memory limits and garbage collection
- **Performance**: Pyodide startup time and execution speed
- **Security**: Plugin permission model and sandboxing effectiveness
- **Compatibility**: Browser extension manifest v3 requirements
- **Chat Storage**: IndexedDB for persistence, in-memory cache for performance
- **Real-time Sync**: Cross-tab communication for chat updates

### Development Workflow
- **Testing Strategy**: Need comprehensive testing approach for plugins
- **Debugging Tools**: Improve debugging experience for Python code
- **Documentation**: Balance technical depth with developer accessibility
- **Version Management**: Plugin versioning and update mechanisms

## Current Challenges

### Technical Challenges
1. **Pyodide Performance**: Startup time and memory usage optimization
2. **Plugin Communication**: Reliable JS-Python message passing
3. **Error Handling**: Graceful failure handling across language boundaries
4. **Security Model**: Balancing functionality with security restrictions
5. **Chat System**: Real-time sync and performance optimization

### Development Challenges
1. **Documentation**: Comprehensive but accessible documentation ✅
2. **Testing**: Effective testing strategies for complex system
3. **Debugging**: Tools for debugging Python code in browser context
4. **Deployment**: Streamlined plugin distribution and installation

### User Experience Challenges
1. **Plugin Discovery**: Easy plugin finding and installation
2. **Configuration**: Simple but powerful plugin configuration
3. **Feedback**: Clear status and error reporting
4. **Performance**: Responsive UI despite Python execution overhead
5. **Chat UX**: Intuitive chat interface and management

## Key Insights

### Architecture Strengths
- **Modular Design**: Clear separation of concerns between components
- **Security Focus**: Sandboxed execution with controlled permissions
- **Extensibility**: Plugin system allows easy feature addition
- **Standards Compliance**: MCP protocol for interoperability
- **Chat Integration**: Seamless integration of chat system with plugin architecture
- **Backend-Frontend Unity**: Complete integration through unified messaging system

### Areas for Improvement
- **Performance**: Pyodide initialization and execution optimization
- **Developer Experience**: Better tooling and documentation
- **Error Handling**: More robust error recovery and reporting
- **Testing**: Comprehensive testing infrastructure

### Opportunities
- **Plugin Ecosystem**: Rich ecosystem of reusable Python components
- **AI Integration**: Leverage Python's AI/ML capabilities in browser
- **Automation**: Powerful web automation capabilities
- **Education**: Platform for teaching Python in browser context
- **Chat Analytics**: Insights from plugin usage patterns

## Questions for Clarification

### Technical Questions
1. What is the target performance for plugin execution?
2. How should plugin updates and versioning be handled?
3. What level of browser API access should plugins have?
4. How should plugin dependencies be managed?

### Product Questions
1. Who are the primary users (developers vs end users)?
2. What is the monetization strategy for the platform?
3. How should plugin discovery and distribution work?
4. What level of support and documentation is needed?

### Strategic Questions
1. What is the roadmap for platform evolution?
2. How should the project balance features vs stability?
3. What are the key differentiators from competitors?
4. How should the open-source strategy be structured?

## Architecture Integration Status

### ✅ Completed Components
- **Core Services**: Plugin Manager, Workflow Engine, Host API
- **Bridge Layer**: MCP Bridge, Pyodide Worker, Worker Manager
- **Chat System**: Plugin Chat Cache, Plugin Chat API, IndexedDB storage
- **UI Components**: Side Panel, DevTools Panel, Options Page, Popup, New Tab
- **Documentation**: Comprehensive architecture documentation
- **Backend-Frontend Integration**: Complete unified system

### 🔄 In Progress Components
- **Testing Infrastructure**: Unit tests, integration tests, E2E tests
- **Performance Optimization**: Pyodide startup, memory management
- **Security Hardening**: Permission validation, sandboxing improvements

### ⏳ Planned Components
- **Plugin Marketplace**: Discovery and distribution system
- **Analytics Dashboard**: Usage metrics and performance monitoring
- **Developer Tools**: Enhanced debugging and development experience

## Integration Points

### Chat System Integration
- **Side Panel**: PluginControlPanel component with chat interface
- **DevTools Panel**: Administrative chat management
- **Background Services**: Chat caching and storage management
- **Real-time Sync**: Cross-tab communication for chat updates

### Plugin System Integration
- **Plugin Manager**: Lifecycle management with chat context
- **Workflow Engine**: Execution with chat history preservation
- **Host API**: Browser access with chat logging capabilities
- **MCP Bridge**: Communication with chat context awareness

### UI Integration
- **React Components**: Modern UI with TypeScript support
- **Tailwind CSS**: Consistent styling across all components
- **Vite Build System**: Fast development and optimized production builds
- **Chrome Extension APIs**: Native browser integration

### Backend-Frontend Integration
- **Unified Messaging**: All communication through chrome.runtime.sendMessage
- **Shared Types**: Common interfaces and data structures
- **Real-time Updates**: Synchronized state across all components
- **Error Handling**: Consistent error propagation and display

## Заключение по архитектурной интеграции

Система Agent-Plugins-Platform теперь представляет собой полностью интегрированную архитектуру, где:

1. **Существующая система плагинов** органично дополнена **системой чатов плагинов**
2. **Все UI компоненты** имеют единообразный интерфейс и стиль
3. **Background сервисы** обеспечивают надежную работу всех компонентов
4. **Документация** покрывает все аспекты системы для понимания любым AI-ассистентом
5. **Backend и Frontend** полностью интегрированы в единое непротиворечивое целое

**Ключевые достижения архитектурной интеграции:**
- ✅ **Единая система сообщений** через chrome.runtime.sendMessage
- ✅ **Общие типы данных** и интерфейсы между всеми компонентами
- ✅ **Синхронизированное состояние** между UI и background сервисами
- ✅ **Реальное время обновления** UI при изменениях в системе
- ✅ **Полная документация** с реальными реализациями компонентов

Архитектура готова для дальнейшего развития и масштабирования экосистемы плагинов.

# Контекст разработки: Страница настроек платформы

- Вся логика и страница настроек платформы теперь находятся в проекте `agent-plugins-platform-boilerplate` (директория: `agent-plugins-platform-boilerplate/pages/options/` и интеграция через `platform-core`).
- Старый проект в корне (`agent-plugins-platform`) больше не актуален, используется только как источник для интеграции.
- Для сборки используйте:
  ```bash
  cd agent-plugins-platform-boilerplate && rm -rf dist && pnpm run build
  ```
- В базовый шаблон boilerplate вносить минимум изменений: по возможности использовать импорты и интеграцию через папку `platform-core`, а не менять код шаблона напрямую.

## Правила версионирования и контроля обновлений
- Версия расширения должна храниться в package.json и автоматически попадать в manifest (chrome-extension/manifest.ts).
- Версия расширения обязательно отображается в интерфейсе options/index.html (например, в шапке или футере), чтобы пользователь мог убедиться в успешном обновлении.
- После каждого релиза/изменения версии проверять, что новая версия видна в UI и соответствует package.json.
- Версия должна автоматически увеличиваться (инкремент patch или minor) при каждом билде, чтобы всегда можно было отследить обновление и протестировать свежую сборку.
- Для ручного управления версией используйте скрипт bash-scripts/update_version.sh:
  - Без аргументов или с patch — увеличивает patch (0.5.0 → 0.5.1)
  - С minor — увеличивает minor (0.5.1 → 0.6.0, patch=0)
  - С major — увеличивает major (0.6.0 → 1.0.0, minor=0, patch=0)
  - Можно явно задать версию: ./update_version.sh 2.0.0 

# Narrative & Lessons Learned

## Achievements
- Полная миграция логики и структуры в новый boilerplate с сохранением чистоты архитектуры.
- Внедрение автоматического версионирования и контроля обновлений через UI.
- Реализация динамического UI для страницы настроек с сохранением состояния плагинов.
- Консолидация и стандартизация memory-bank для прозрачности и передачи знаний.
- ✅ **Создание комплексной системы чатов плагинов** с полной интеграцией в архитектуру.
- ✅ **Разработка детальной архитектурной документации** для понимания системы любым AI-ассистентом.
- ✅ **Проверка и формализация архитектуры** как единого непротиворечивого целого.

## Ошибки и важные находки
- Класс selected в index.html может приводить к нежелательному выделению карточек — всегда проверяйте статические классы.
- Важно не дублировать memory-bank: используйте только одну актуальную директорию.
- Для LLM: всегда ищите исходники страниц и правила в папке agent-plugins-platform-boilerplate/memory-bank.
- **Chat System**: LRU кэширование критически важно для производительности чатов.
- **IndexedDB**: Требует правильной обработки ошибок и транзакций для надежности.
- **Architecture Validation**: Реальная реализация может отличаться от документации — всегда проверяйте актуальность.

## Рекомендации для LLM и разработчиков
- Перед началом работы всегда читайте этот файл и progress.md для восстановления контекста.
- Для обновления версии используйте команды из user-commands.md (см. ниже).
- Для восстановления memory-bank в новом проекте — просто скопируйте всю папку memory-bank и обновите .cursor-rules.json.
- Не удаляйте важные исторические решения и выводы — они помогают избежать повторения ошибок.
- **Для понимания архитектуры**: Читайте `comprehensive-architecture.md` для полного понимания системы.
- **Для работы с чатами**: Изучите `plugin-chat-cache.ts` и `plugin-chat-api.ts` для понимания системы чатов.
- **Для проверки интеграции**: Всегда сверяйте документацию с реальной реализацией в коде.

## Правило инициативы и критического мышления
- AI-ассистент всегда должен проявлять инициативу, предлагать улучшения, конструктивно критиковать и выражать своё мнение перед выполнением задачи, если это может повысить качество результата или избежать ошибок.

## Правило максимальной инициативы и конструктивной критики (обязательно для AI-ассистента)

- AI-ассистент всегда обязан проявлять максимальную инициативу, предлагать улучшения, альтернативы и новые идеи по архитектуре, UX, безопасности, производительности и процессам.
- Ассистент обязан конструктивно критиковать любые решения, даже если они исходят от пользователя, и предлагать варианты оптимизации или предотвращения ошибок.
- Если ассистент видит потенциальные риски, архитектурные или UX-проблемы, он обязан их озвучить и предложить mitigation-стратегии.
- Инициатива и критика должны быть конструктивными, аргументированными и направленными на улучшение качества продукта и процессов.
- Это правило обязательно для всех сессий, независимо от формулировок пользователя. 

# Активный контекст разработки

## Текущий статус проекта

### ✅ Завершенные задачи
1. **Система чатов плагинов** - полностью реализована с кэшированием, персистентностью и real-time синхронизацией
2. **Исправление Service Worker** - устранена ошибка "Service worker registration failed. Status code: 15"
3. **Архитектурная документация** - создана комплексная архитектура системы
4. **UI компоненты** - React интерфейсы для управления плагинами и чатами
5. **Система безопасности** - разработана многоуровневая архитектура безопасности

### 🔄 Текущие задачи
1. **Реализация системы безопасности** - внедрение компонентов безопасности в код
2. **Тестирование расширения** - проверка работоспособности после исправлений
3. **Документация безопасности** - создание руководств по безопасности

### 📋 Следующие шаги
1. **Внедрение Secret Manager** - реализация управления API ключами
2. **Network Guard** - контроль сетевых запросов
3. **Audit System** - система аудита и мониторинга
4. **UI безопасности** - интерфейсы для управления безопасностью

## Ключевые архитектурные решения

### Система безопасности
- **Zero Trust Architecture** - плагины не доверяются по умолчанию
- **Principle of Least Privilege** - минимальные необходимые разрешения
- **Defense in Depth** - многоуровневая защита
- **Complete Audit Trail** - полный аудит всех действий
- **Transparent Permissions** - прозрачность разрешений для пользователя

### Компоненты безопасности
1. **Secret Manager** - управление API ключами и секретами
2. **Network Guard** - контроль сетевых запросов и доменов
3. **Audit System** - система аудита и мониторинга
4. **Parameter Validator** - валидация параметров API вызовов
5. **Security Analyzer** - анализ подозрительной активности

### Структура manifest.json плагина
```json
{
  "required_secrets": ["openai_api_key", "weather_api_key"],
  "api_permissions": {
    "openai": {
      "domains": ["api.openai.com"],
      "endpoints": ["/v1/chat/completions"],
      "methods": ["POST"],
      "rate_limit": "100/hour"
    }
  },
  "network_policy": {
    "allowed_domains": ["api.openai.com"],
    "websockets": "denied"
  },
  "api_schemas": {
    "openai": {
      "chat_completions": {
        "type": "object",
        "required": ["prompt"],
        "properties": {
          "prompt": {"type": "string", "maxLength": 4000}
        }
      }
    }
  }
}
```

## Правила разработки

### Обязательные правила
1. **Feature ветки** - все изменения в отдельных ветках от develop
2. **Безопасность прежде всего** - все новые функции должны проходить проверку безопасности
3. **Документация** - все архитектурные решения документируются
4. **Тестирование** - обязательное тестирование перед коммитом

### Стандарты кода
- TypeScript для всех новых файлов
- ESLint и Prettier для форматирования
- Семантические коммиты
- JSDoc документация для публичных API

### Процесс разработки
1. Создание feature ветки от develop
2. Реализация функциональности
3. Тестирование и исправление ошибок
4. Обновление документации
5. Code review и merge в develop

## Технический долг

### Высокий приоритет
1. Внедрение системы безопасности в код
2. Создание UI для управления безопасностью
3. Тестирование всех компонентов безопасности

### Средний приоритет
1. Оптимизация производительности
2. Улучшение UX интерфейсов
3. Расширение документации

### Низкий приоритет
1. Рефакторинг legacy кода
2. Добавление новых функций
3. Интеграция с внешними сервисами

## Контакты и ресурсы

### Документация
- `memory-bank/comprehensive-architecture.md` - полная архитектура системы
- `memory-bank/security-architecture.md` - архитектура безопасности
- `memory-bank/file-relationships.md` - связи между файлами

### Ключевые файлы
- `chrome-extension/src/background/index.ts` - основной background script
- `chrome-extension/src/background/plugin-chat-cache.ts` - система чатов
- `pages/side-panel/src/components/PluginControlPanel.tsx` - UI чатов
- `pages/devtools-panel/src/PluginChatsTab.tsx` - админ панель

### Команды разработки
- `npm run dev` - запуск в режиме разработки
- `npm run build` - сборка для продакшена
- `npm run lint` - проверка кода
- `npm run test` - запуск тестов 
