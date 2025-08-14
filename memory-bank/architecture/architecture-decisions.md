# Architectural decisions системы чатов плагинов

## Обзор архитектуры

Система чатов плагинов реализована как многоуровневая архитектура с разделением ответственности между компонентами:

1. **Background Service** - управление данными и кэшированием
2. **UI Components** - пользовательский интерфейс
3. **DevTools Panel** - административный интерфейс
4. **Storage Layer** - персистентность данных

## Ключевые архитектурные принципы

### 1. Принцип единственной ответственности
- Каждый модуль отвечает за одну конкретную задачу
- Четкое разделение между логикой данных и представлением
- Изолированные компоненты с минимальными зависимостями

### 2. Принцип инверсии зависимостей
- UI компоненты не зависят от конкретной реализации хранилища
- Абстракции через messaging API
- Легкая замена компонентов без влияния на другие части

### 3. Принцип открытости/закрытости
- Расширяемая архитектура для новых типов плагинов
- Закрытые для модификации существующие компоненты
- Плагинная система для добавления функциональности

## Детальное описание компонентов

### 1. Background Service (`plugin-chat-cache.ts`)

**Назначение:** Центральный сервис управления чатами плагинов

**Основные функции:**
- LRU кэширование активных чатов в памяти
- Синхронизация с IndexedDB для персистентности
- Управление жизненным циклом чатов
- API для операций с чатами

**Ключевые методы:**
```typescript
// Получение чата
getChat(pluginId: string, pageKey: string): Promise<ChatData | null>

// Сохранение сообщения
saveMessage(pluginId: string, pageKey: string, message: ChatMessage): Promise<void>

// Удаление чата
deleteChat(pluginId: string, pageKey: string): Promise<void>

// Очистка старых чатов
cleanupOldChats(): Promise<void>
```

**Взаимосвязи:**
- Получает запросы от UI через messaging API
- Взаимодействует с IndexedDB через `plugin-chat-api.ts`
- Отправляет события обновления в другие вкладки
- Интегрируется в background script через `background/index.ts`

### 2. Storage API (`plugin-chat-api.ts`)

**Назначение:** Абстракция над IndexedDB для операций с чатами

**Основные функции:**
- CRUD операции с чатами в IndexedDB
- Нормализация данных
- Обработка ошибок хранилища
- Транзакционность операций

**Структура данных:**
```typescript
interface ChatData {
  pluginId: string;
  pageKey: string;
  messages: ChatMessage[];
  lastUpdated: number;
  createdAt: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
```

**Взаимосвязи:**
- Используется только `plugin-chat-cache.ts`
- Инкапсулирует детали работы с IndexedDB
- Предоставляет единый интерфейс для всех операций

### 3. Background Integration (`background/index.ts`)

**Назначение:** Интеграция чат-системы в background script

**Основные функции:**
- Регистрация обработчиков сообщений
- Инициализация чат-кэша
- Управление жизненным циклом сервиса
- Обработка событий расширения

**Обработчики сообщений:**
```typescript
// Получение чата
'GET_PLUGIN_CHAT': (request) => chatCache.getChat(request.pluginId, request.pageKey)

// Сохранение сообщения
'SAVE_PLUGIN_CHAT_MESSAGE': (request) => chatCache.saveMessage(request.pluginId, request.pageKey, request.message)

// Удаление чата
'DELETE_PLUGIN_CHAT': (request) => chatCache.deleteChat(request.pluginId, request.pageKey)

// Получение всех чатов
'GET_ALL_PLUGIN_CHATS': () => chatCache.getAllChats()
```

**Взаимосвязи:**
- Создает экземпляр `PluginChatCache`
- Регистрирует обработчики в chrome.runtime.onMessage
- Отправляет события в другие вкладки через chrome.tabs.query

### 4. UI Components

#### 4.1 PluginControlPanel (`PluginControlPanel.tsx`)

**Назначение:** Основной компонент управления плагином с чатом

**Основные функции:**
- Отображение интерфейса чата
- Управление состоянием плагина (старт/стоп/пауза)
- Интеграция с чат-системой
- Экспорт и очистка чатов

**Ключевые состояния:**
```typescript
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [loading, setLoading] = useState(false);
const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
```

**Взаимосвязи:**
- Загружает чат при монтировании через messaging API
- Сохраняет сообщения через background service
- Слушает события обновления от других вкладок
- Интегрируется с существующей системой плагинов

#### 4.2 DevTools Panel (`PluginChatsTab.tsx`)

**Назначение:** Административный интерфейс для управления всеми чатами

**Основные функции:**
- Просмотр всех чатов плагинов
- Удаление отдельных чатов
- Экспорт чатов в JSON
- Фильтрация и поиск

**Взаимосвязи:**
- Получает данные через messaging API
- Использует file-saver для экспорта
- Интегрируется в DevTools через `devtools-panel/index.tsx`

### 5. Messaging API

**Назначение:** Единый интерфейс коммуникации между компонентами

**Типы сообщений:**
```typescript
// Запросы к background service
type ChatRequest = 
  | { type: 'GET_PLUGIN_CHAT'; pluginId: string; pageKey: string }
  | { type: 'SAVE_PLUGIN_CHAT_MESSAGE'; pluginId: string; pageKey: string; message: ChatMessage }
  | { type: 'DELETE_PLUGIN_CHAT'; pluginId: string; pageKey: string }
  | { type: 'GET_ALL_PLUGIN_CHATS' };

// События обновления
type ChatEvent = 
  | { type: 'PLUGIN_CHAT_UPDATED'; pluginId: string; pageKey: string; messages?: ChatMessage[] };
```

**Взаимосвязи:**
- Используется всеми UI компонентами
- Обрабатывается в background service
- Обеспечивает loose coupling между компонентами

## Потоки данных

### 1. Загрузка чата
```
UI Component → Messaging API → Background Service → Storage API → IndexedDB
                ↓
UI Component ← Messaging API ← Background Service ← Storage API ← IndexedDB
```

### 2. Сохранение сообщения
```
UI Component → Messaging API → Background Service → Storage API → IndexedDB
                ↓
Background Service → Event System → Other Tabs → UI Components
```

### 3. Синхронизация между вкладками
```
Tab A: Save Message → Background Service → Storage API → IndexedDB
                ↓
Background Service → chrome.tabs.query → Tab B → Event Listener → UI Update
```

## Стратегии кэширования

### 1. LRU Cache в памяти
- Хранит активные чаты в Map
- Автоматическое удаление старых записей
- Быстрый доступ к часто используемым чатам

### 2. Персистентность в IndexedDB
- Долгосрочное хранение всех чатов
- Автоматическая очистка старых чатов (90+ дней)
- Транзакционность операций

### 3. Стратегия записи
- Write-through: запись одновременно в кэш и IndexedDB
- Обработка ошибок с откатом кэша
- Асинхронная синхронизация

## Обработка ошибок

### 1. Уровни обработки
- **UI Level**: Пользовательские уведомления и fallback UI
- **Service Level**: Логирование и восстановление состояния
- **Storage Level**: Транзакции и rollback

### 2. Стратегии восстановления
- Автоматическая перезагрузка чата при ошибке
- Fallback на локальное состояние
- Уведомления пользователя о проблемах

## Производительность

### 1. Оптимизации
- Ленивая загрузка чатов
- Кэширование в памяти
- Пагинация для больших чатов
- Дебаунсинг операций записи

### 2. Мониторинг
- Отслеживание времени загрузки
- Мониторинг размера кэша
- Логирование ошибок

## Безопасность

### 1. Изоляция данных
- Чаты изолированы по плагинам и страницам
- Нет доступа к данным других плагинов
- Валидация входных данных

### 2. Приватность
- Локальное хранение без синхронизации
- Автоматическая очистка старых данных
- Контроль доступа через permissions

## Расширяемость

### 1. Плагинная архитектура
- Легкое добавление новых типов плагинов
- Единый интерфейс для всех плагинов
- Конфигурируемые permissions

### 2. API для разработчиков
- Документированный messaging API
- Типизированные интерфейсы
- Примеры интеграции

## Тестирование

### 1. Стратегии тестирования
- Unit тесты для каждого компонента
- Integration тесты для API
- E2E тесты для пользовательских сценариев

### 2. Моки и стабы
- Mock для chrome.runtime API
- Stub для IndexedDB
- Test utilities для UI компонентов

## Документация

### 1. Техническая документация
- API reference
- Архитектурные диаграммы
- Руководства по интеграции

### 2. Пользовательская документация
- Руководства по использованию
- FAQ и troubleshooting
- Примеры использования

## Заключение

Архитектура системы чатов плагинов обеспечивает:
- Высокую производительность через кэширование
- Надежность через обработку ошибок
- Масштабируемость через модульную структуру
- Безопасность через изоляцию данных
- Расширяемость через плагинную архитектуру

Все компоненты работают согласованно, обеспечивая seamless пользовательский опыт при работе с плагинами. 