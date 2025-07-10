# Комплексная архитектура Agent-Plugins-Platform

## Обзор системы

Agent-Plugins-Platform - это браузерное расширение, которое позволяет выполнять Python код в браузере через Pyodide (WebAssembly Python runtime) с использованием MCP (Model Context Protocol) для коммуникации между JavaScript и Python. Система включает в себя плагинную архитектуру, систему чатов плагинов, и полный набор UI компонентов для управления плагинами.

## Архитектурные слои

### 1. Extension Layer (Слой расширения)
```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│  Manifest V3 │ Background Service │ Content Scripts │ UI   │
└─────────────────────────────────────────────────────────────┘
```

**Компоненты:**
- **manifest.ts** - конфигурация расширения (Manifest V3)
- **Background Service** - фоновые сервисы и управление жизненным циклом
- **Content Scripts** - инъекция в веб-страницы для доступа к DOM
- **UI Components** - пользовательские интерфейсы (popup, side-panel, options, devtools)

### 2. Core Services Layer (Слой основных сервисов)
```
┌─────────────────────────────────────────────────────────────┐
│                    Core Services                            │
├─────────────────────────────────────────────────────────────┤
│ Plugin Manager │ Workflow Engine │ Host API │ Chat System  │
└─────────────────────────────────────────────────────────────┘
```

**Компоненты:**
- **plugin-manager.ts** - управление жизненным циклом плагинов
- **workflow-engine.ts** - выполнение рабочих процессов плагинов
- **host-api.ts** - предоставление доступа к браузерным API для Python
- **plugin-chat-cache.ts** - система кэширования чатов плагинов
- **plugin-chat-api.ts** - API для работы с хранилищем чатов

### 3. Bridge Layer (Слой мостов)
```
┌─────────────────────────────────────────────────────────────┐
│                      Bridge Layer                           │
├─────────────────────────────────────────────────────────────┤
│   MCP Bridge   │  Pyodide Worker  │  Worker Manager        │
└─────────────────────────────────────────────────────────────┘
```

**Компоненты:**
- **mcp-bridge.ts** - реализация MCP протокола для JS-Python коммуникации
- **pyodide-worker.js** - WebWorker с Pyodide runtime
- **worker-manager.ts** - управление WebWorker'ами для плагинов

### 4. Plugin Layer (Слой плагинов)
```
┌─────────────────────────────────────────────────────────────┐
│                     Plugin System                           │
├─────────────────────────────────────────────────────────────┤
│  Plugin Registry │  Plugin Execution │  Plugin Storage     │
└─────────────────────────────────────────────────────────────┘
```

**Структура плагина:**
```
public/plugins/plugin-name/
├── manifest.json      # Метаданные и разрешения плагина
├── mcp_server.py      # Python реализация MCP протокола
├── workflow.json      # Определение рабочего процесса
└── icon.svg          # Иконка плагина
```

### 5. UI Layer (Слой пользовательского интерфейса)
```
┌─────────────────────────────────────────────────────────────┐
│                      UI Components                          │
├─────────────────────────────────────────────────────────────┤
│ Popup │ Side Panel │ Options │ DevTools │ New Tab │ Content│
└─────────────────────────────────────────────────────────────┘
```

**Компоненты:**
- **popup/** - всплывающее окно расширения
- **side-panel/** - боковая панель с управлением плагинами
- **options/** - страница настроек
- **devtools-panel/** - панель инструментов разработчика
- **new-tab/** - новая вкладка
- **content/** - контент-скрипты для инъекции в страницы

## Детальное описание компонентов

### Background Services (chrome-extension/src/background/)

#### 1. Plugin Manager (`plugin-manager.ts`)
**Назначение:** Центральный координатор плагинов
**Основные функции:**
- Загрузка и инициализация плагинов
- Управление жизненным циклом плагинов
- Координация выполнения плагинов
- Управление разрешениями и безопасностью

**Ключевые методы:**
```typescript
class PluginManager {
  async getAvailablePlugins(): Promise<Plugin[]>
  async loadPlugin(pluginId: string): Promise<Plugin>
  async executePlugin(pluginId: string, input: any): Promise<any>
  async stopPlugin(pluginId: string): Promise<void>
  async getPluginStatus(pluginId: string): Promise<PluginStatus>
}
```

**Реальная реализация:**
- Использует статический список плагинов: `['ozon-analyzer', 'google-helper', 'test-plugin', 'time-test']`
- Загружает манифесты плагинов из `public/plugins/{pluginId}/manifest.json`
- Интегрируется с системой настроек через `pluginSettingsStorage`

#### 2. Workflow Engine (`workflow-engine.ts`)
**Назначение:** Выполнение рабочих процессов плагинов
**Основные функции:**
- Парсинг workflow.json
- Последовательное выполнение задач
- Обработка условий и циклов
- Управление состоянием выполнения

**Ключевые методы:**
```typescript
class WorkflowEngine {
  async runWorkflow(pluginId: string): Promise<void>
  async executeStep(step: WorkflowStep, context: any): Promise<any>
  async handleCondition(condition: Condition, context: any): Promise<boolean>
}
```

**Реальная реализация:**
- Загружает workflow.json из `public/plugins/{pluginId}/workflow.json`
- Поддерживает инструменты типа `host.{toolName}` и `python.{toolName}`
- Интегрируется с Host API и MCP Bridge для выполнения инструментов
- Логирует выполнение через консоль (в service worker)

#### 3. Host API (`host-api.ts`)
**Назначение:** Предоставление браузерных API для Python
**Основные функции:**
- Безопасный доступ к DOM
- Управление вкладками и окнами
- Работа с хранилищем
- Сетевые запросы

**Ключевые методы:**
```typescript
class HostAPI {
  async getElements(options: HostApiOptions, context: WorkflowContext): Promise<any>
  async getActivePageContent(selectors?: string[], context?: WorkflowContext): Promise<any>
  async host_fetch(url: string): Promise<any>
  sendMessageToChat(message: { content: string }): void
}
```

**Реальная реализация:**
- Использует `chrome.runtime.sendMessage` для связи с background script
- Находит целевую вкладку (не расширение) для выполнения операций
- Поддерживает `getElements`, `getActivePageContent`, `host_fetch`
- Интегрируется с системой логирования через `sendMessageToChat`

#### 4. MCP Bridge (`mcp-bridge.ts`)
**Назначение:** Реализация MCP протокола
**Основные функции:**
- Сериализация/десериализация сообщений
- Маршрутизация сообщений между JS и Python
- Обработка ошибок и таймаутов
- Управление сессиями

**Ключевые методы:**
```typescript
class MCPBridge {
  async runPythonTool(pluginId: string, toolName: string, toolInput: any): Promise<any>
  async sendMessage(message: MCPMessage): Promise<MCPResponse>
  async callFunction(name: string, params: any[]): Promise<any>
}
```

**Реальная реализация:**
- Использует WebWorker для изолированного выполнения Python
- Загружает Python код из `public/plugins/{pluginId}/mcp_server.py`
- Поддерживает двустороннюю связь Python ↔ JavaScript
- Обрабатывает `host_call` для вызова JavaScript функций из Python

#### 5. Pyodide Worker (`pyodide-worker.js`)
**Назначение:** Изолированная среда выполнения Python
**Основные функции:**
- Инициализация Pyodide runtime
- Выполнение Python кода
- Управление памятью WebAssembly
- Обработка ошибок Python

**Ключевые методы:**
```javascript
class PyodideWorker {
  async initializePyodide(): Promise<void>
  async loadPackage(packageName: string): Promise<void>
  async runPython(code: string): Promise<any>
  async callPythonFunction(name: string, args: any[]): Promise<any>
}
```

**Реальная реализация:**
- Загружает Pyodide из `../pyodide/` директории
- Предоставляет глобальный объект `js` для Python
- Поддерживает `sendMessageToChat` и `host_fetch` функции
- Обрабатывает `run_python_tool` сообщения

#### 6. Worker Manager (`worker-manager.ts`)
**Назначение:** Управление WebWorker'ами
**Основные функции:**
- Singleton паттерн для единственного Pyodide worker
- Управление жизненным циклом worker'а
- Обработка ошибок worker'а

**Ключевые методы:**
```typescript
class WorkerManager {
  getWorker(): Worker
  resetWorker(): void
}
```

**Реальная реализация:**
- Создает единственный экземпляр Pyodide worker
- Обрабатывает критические ошибки worker'а
- Автоматически сбрасывает worker при ошибках

### Chat System (Система чатов плагинов)

#### 1. Plugin Chat Cache (`plugin-chat-cache.ts`)
**Назначение:** Центральный сервис управления чатами
**Основные функции:**
- LRU кэширование активных чатов в памяти
- Синхронизация с IndexedDB
- Управление жизненным циклом чатов
- API для операций с чатами

**Ключевые методы:**
```typescript
class PluginChatCache {
  async getOrLoadChat(chatKey: string): Promise<PluginChat | null>
  async saveMessage(pluginId: string, pageKey: string, message: ChatMessage): Promise<void>
  async deleteChat(pluginId: string, pageKey: string): Promise<void>
  async listChatsForPlugin(pluginId: string): Promise<PluginChat[]>
}
```

**Реальная реализация:**
- Использует IndexedDB с именем `plugin-chats-db`
- LRU кэш с лимитом 50 чатов в памяти
- Ключ чата: `${pluginId}::${pageKey}`
- Поддерживает транзакционные операции

#### 2. Plugin Chat API (`plugin-chat-api.ts`)
**Назначение:** Абстракция над IndexedDB для чатов
**Основные функции:**
- CRUD операции с чатами в IndexedDB
- Нормализация данных
- Обработка ошибок хранилища
- Транзакционность операций

**Структура данных:**
```typescript
interface ChatData {
  chatKey: string;
  pluginId: string;
  pageKey: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatMessage {
  role: 'user' | 'plugin';
  content: string;
  timestamp: number;
}
```

**Реальная реализация:**
- Использует `idb` библиотеку для работы с IndexedDB
- Автоматическое создание схемы БД при первом использовании
- Обработка ошибок и fallback механизмы

### UI Components (pages/)

#### 1. Side Panel (`side-panel/`)
**Назначение:** Основной интерфейс управления плагинами
**Компоненты:**
- **PluginCard.tsx** - карточка плагина с основной информацией
- **PluginControlPanel.tsx** - панель управления плагином с чатом
- **PluginDetails.tsx** - детальная информация о плагине
- **SidePanel.tsx** - основной контейнер

**Ключевые функции:**
- Отображение списка доступных плагинов
- Управление состоянием плагинов (старт/стоп/пауза)
- Интеграция с системой чатов
- Экспорт и очистка чатов

**Реальная реализация:**
- Использует React + TypeScript
- Интегрируется с background script через `chrome.runtime.sendMessage`
- Поддерживает фильтрацию плагинов по `host_permissions`
- Реальное время синхронизации чатов между вкладками

#### 2. DevTools Panel (`devtools-panel/`)
**Назначение:** Административный интерфейс
**Компоненты:**
- **PluginChatsTab.tsx** - управление всеми чатами плагинов
- **Panel.tsx** - основной контейнер DevTools

**Ключевые функции:**
- Просмотр всех чатов плагинов
- Удаление отдельных чатов
- Экспорт чатов в JSON
- Фильтрация и поиск

**Реальная реализация:**
- Табличное представление всех чатов
- Модальное окно для просмотра деталей чата
- Экспорт всех чатов в JSON файл
- Реальное время обновления при изменениях

#### 3. Options Page (`options/`)
**Назначение:** Страница настроек расширения
**Компоненты:**
- **index.tsx** - основной интерфейс настроек
- **components/** - компоненты настроек

**Ключевые функции:**
- Настройка разрешений плагинов
- Управление глобальными настройками
- Информация о версии расширения
- Сброс настроек

#### 4. Popup (`popup/`)
**Назначение:** Быстрый доступ к основным функциям
**Компоненты:**
- **index.tsx** - всплывающее окно
- **Popup.css** - стили

**Ключевые функции:**
- Быстрый запуск/остановка плагинов
- Статус активных плагинов
- Доступ к основным настройкам

#### 5. New Tab (`new-tab/`)
**Назначение:** Интерфейс новой вкладки
**Компоненты:**
- **index.tsx** - интерфейс новой вкладки
- **NewTab.css** - стили

**Ключевые функции:**
- Демонстрация возможностей платформы
- Быстрый доступ к плагинам
- Информация о системе

#### 6. Content Scripts
**Назначение:** Инъекция в веб-страницы
**Компоненты:**
- **content/** - базовые контент-скрипты
- **content-ui/** - UI компоненты для страниц
- **content-runtime/** - runtime компоненты

**Ключевые функции:**
- Доступ к DOM страницы
- Инъекция UI компонентов
- Взаимодействие с плагинами

### Platform Core (platform-core/)

#### 1. Core Services
**Назначение:** Переиспользуемые сервисы для разных частей системы
**Компоненты:**
- **core/plugin-manager.js** - базовая логика управления плагинами
- **core/workflow-engine.js** - движок выполнения воркфлоу
- **core/host-api.js** - базовый Host API

**Реальная реализация:**
- JavaScript модули для переиспользования
- Интегрируются с chrome-extension через импорты
- Поддерживают как UI, так и background контексты

#### 2. Bridge Components
**Назначение:** JS-Python коммуникация
**Компоненты:**
- **bridge/mcp-bridge.js** - MCP протокол
- **bridge/pyodide-worker.js** - Pyodide worker
- **bridge/worker-manager.js** - управление worker'ами

**Реальная реализация:**
- Изолированные WebWorker'ы для Python выполнения
- Двусторонняя связь через postMessage
- Singleton паттерн для worker управления

## Потоки данных

### 1. Загрузка и инициализация плагина
```
UI Component → Background Service → Plugin Manager → Plugin Registry
                ↓
            Manifest Validation → Permission Check → Plugin Loading
```

### 2. Выполнение плагина
```
UI Component → Background Service → Workflow Engine → MCP Bridge
                ↓
            Host API ← Python Plugin ← Python Code Execution
                ↓
            Browser APIs → DOM Manipulation → Network Requests
```

### 3. Система чатов
```
UI Component → Messaging API → Background Service → Storage API → IndexedDB
                ↓
            Real-time Sync → Other Tabs → UI Components
```

### 4. Административные операции
```
DevTools Panel → Messaging API → Background Service → Plugin Manager
                ↓
            Plugin Registry → Plugin Lifecycle Management
```

## Интеграция Backend и Frontend

### 1. Background Service Integration
**Основной координатор:** `chrome-extension/src/background/index.ts`
- Обрабатывает все сообщения от UI компонентов
- Управляет жизненным циклом плагинов
- Координирует работу всех сервисов

**Ключевые интеграции:**
```typescript
// Обработка сообщений от UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PLUGINS') {
    // Загрузка плагинов с настройками
  }
  if (message.type === 'RUN_WORKFLOW') {
    // Запуск плагина
  }
  if (message.type === 'SAVE_PLUGIN_CHAT_MESSAGE') {
    // Сохранение сообщения чата
  }
});
```

### 2. UI Integration
**Side Panel:** `pages/side-panel/src/SidePanel.tsx`
- Основной интерфейс управления плагинами
- Интеграция с системой чатов
- Реальное время синхронизации

**DevTools Panel:** `pages/devtools-panel/src/PluginChatsTab.tsx`
- Административное управление чатами
- Просмотр и экспорт данных
- Системный мониторинг

### 3. Chat System Integration
**PluginControlPanel:** `pages/side-panel/src/components/PluginControlPanel.tsx`
- Полнофункциональный чат интерфейс
- Интеграция с IndexedDB через background
- Реальное время синхронизации между вкладками

**Background Chat API:** `chrome-extension/src/background/plugin-chat-api.ts`
- LRU кэширование для производительности
- Транзакционные операции с IndexedDB
- Broadcasting изменений между вкладками

### 4. Plugin System Integration
**Workflow Execution:** `chrome-extension/src/background/workflow-engine.ts`
- Выполнение декларативных воркфлоу
- Интеграция с Host API и MCP Bridge
- Логирование и обработка ошибок

**MCP Communication:** `chrome-extension/src/background/mcp-bridge.ts`
- Двусторонняя связь JS ↔ Python
- Обработка host_call из Python
- Управление WebWorker жизненным циклом

## Безопасность

### 1. Изоляция выполнения
- Каждый плагин выполняется в отдельном WebWorker
- Pyodide runtime изолирован от основного потока
- Ограниченный доступ к браузерным API

### 2. Система разрешений
- Манифест плагина определяет необходимые разрешения
- Runtime валидация разрешений
- Гранулярный контроль доступа к API

### 3. Валидация данных
- Все сообщения валидируются по MCP схеме
- Санитизация входных данных
- Обработка ошибок на всех уровнях

### 4. Приватность чатов
- Чаты изолированы по плагинам и страницам
- Локальное хранение без синхронизации
- Автоматическая очистка старых данных

## Производительность

### 1. Оптимизации
- Ленивая загрузка плагинов и Pyodide
- LRU кэширование активных чатов
- Асинхронное выполнение всех операций
- Эффективное управление памятью

### 2. Мониторинг
- Отслеживание времени загрузки плагинов
- Мониторинг использования памяти
- Логирование ошибок и производительности
- Метрики использования

### 3. Ограничения
- WebAssembly память (обычно 2GB)
- Время инициализации Pyodide
- Ограничения браузерного хранилища
- Сетевые ограничения

## Расширяемость

### 1. Плагинная архитектура
- Стандартизированный интерфейс плагинов
- MCP протокол для совместимости
- Манифест-базированная конфигурация
- Система версионирования

### 2. API для разработчиков
- Документированный Host API
- Примеры и шаблоны плагинов
- Инструменты разработки и отладки
- Система распространения плагинов

### 3. Интеграции
- Поддержка различных Python библиотек
- Расширяемая система разрешений
- Интеграция с внешними сервисами
- Поддержка различных браузеров

## Технологический стек

### Frontend
- **TypeScript** - типизированный JavaScript
- **React** - UI библиотека
- **Vite** - сборщик и dev сервер
- **Tailwind CSS** - CSS фреймворк

### Backend (в браузере)
- **Pyodide** - WebAssembly Python runtime
- **MCP Protocol** - протокол коммуникации
- **IndexedDB** - локальное хранилище
- **Web Workers** - изолированное выполнение

### Инструменты разработки
- **ESLint** - линтер кода
- **Prettier** - форматирование кода
- **Turbo** - монорепозиторий build system
- **pnpm** - менеджер пакетов

## Процессы разработки

### 1. Feature Branch Workflow
- Все изменения в отдельных feature ветках
- Обязательный code review перед merge
- Автоматические тесты и линтинг
- Семантическое версионирование

### 2. Документация
- Memory bank для сохранения контекста
- Архитектурная документация
- API документация
- Руководства пользователя и разработчика

### 3. Тестирование
- Unit тесты для компонентов
- Integration тесты для API
- E2E тесты для пользовательских сценариев
- Тестирование безопасности

### 4. Развертывание
- Автоматическая сборка и тестирование
- Chrome Web Store интеграция
- Мониторинг производительности
- Обработка ошибок и обратная связь

## Заключение

Agent-Plugins-Platform представляет собой комплексную систему для выполнения Python кода в браузере с полной интеграцией чатов плагинов. Архитектура обеспечивает:

- **Безопасность** через изоляцию и систему разрешений
- **Производительность** через кэширование и оптимизации
- **Расширяемость** через плагинную архитектуру
- **Надежность** через обработку ошибок и мониторинг
- **Удобство использования** через интуитивные UI компоненты

**Backend полностью интегрирован с Frontend** через:
- Единую систему сообщений через `chrome.runtime.sendMessage`
- Общие типы данных и интерфейсы
- Синхронизированное состояние между компонентами
- Реальное время обновления UI при изменениях

Система готова к production использованию и дальнейшему развитию экосистемы плагинов. 