# Архитектура Чата - Chat Architecture

## 🎯 Обзор Архитектуры Чата

### Архитектурные Компоненты

1. **Frontend Layer** - React компоненты и UI
2. **State Management** - Централизованное управление состоянием
3. **Communication Layer** - MCP и Web Workers
4. **Backend Layer** - Python и AI модели
5. **Storage Layer** - IndexedDB и Chrome Storage
6. **Error Handling** - Глобальная обработка ошибок

## 🏗️ Детальная Архитектура

### Frontend Layer

```typescript
// Структура компонентов чата
interface ChatArchitecture {
  components: {
    ChatContainer: React.Component;
    MessageList: React.Component;
    MessageInput: React.Component;
    TypingIndicator: React.Component;
    ErrorBoundary: React.Component;
  };
  hooks: {
    useChat: () => ChatState;
    useMessages: () => Message[];
    useTyping: () => boolean;
  };
  services: {
    ChatService: ChatService;
    MessageService: MessageService;
  };
}
```

#### Ключевые Компоненты

**ChatContainer** - Главный контейнер чата
```typescript
const ChatContainer: React.FC = () => {
  const chatState = useChatStore();
  const { isInitialized, error } = chatState;

  if (error) {
    return <ChatErrorFallback error={error} />;
  }

  if (!isInitialized) {
    return <ChatLoading />;
  }

  return (
    <ChatProvider>
      <div className="chat-container">
        <MessageList />
        <MessageInput />
        <TypingIndicator />
      </div>
    </ChatProvider>
  );
};
```

**MessageList** - Список сообщений с виртуализацией
```typescript
const MessageList: React.FC = () => {
  const messages = useChatStore(state => state.messages);
  const listRef = useRef<HTMLDivElement>(null);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={listRef} className="message-list">
      {messages.map(message => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
};
```

### State Management Layer

**Zustand Store** - Централизованное состояние чата
```typescript
interface ChatState {
  // Сообщения
  messages: Message[];
  isTyping: boolean;

  // Статус соединения
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';

  // Настройки
  config: ChatConfig;

  // Действия
  actions: {
    addMessage: (message: Message) => void;
    setTyping: (typing: boolean) => void;
    setConnectionStatus: (status: ConnectionStatus) => void;
    clearMessages: () => void;
  };
}

const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,
  connectionStatus: 'disconnected',
  config: defaultChatConfig,

  actions: {
    addMessage: (message) => set((state) => ({
      messages: [...state.messages, message]
    })),

    setTyping: (typing) => set({ isTyping: typing }),

    setConnectionStatus: (status) => set({ connectionStatus: status }),

    clearMessages: () => set({ messages: [] }),
  },
}));
```

### Communication Layer

**MCP Bridge** - Протокол связи между JS и Python
```typescript
class MCPBridge {
  private worker: Worker | null = null;
  private messageQueue: MessageQueue;
  private eventEmitter: EventEmitter;

  constructor() {
    this.messageQueue = new MessageQueue();
    this.eventEmitter = new EventEmitter();
    this.initializeWorker();
  }

  private async initializeWorker(): Promise<void> {
    this.worker = new Worker('/workers/mcp-worker.js');

    this.worker.onmessage = (event) => {
      this.handleWorkerMessage(event.data);
    };

    this.worker.onerror = (error) => {
      this.handleWorkerError(error);
    };

    // Инициализация Python среды
    await this.sendMessage({
      type: 'init',
      payload: { pythonVersion: '3.11' }
    });
  }

  async sendMessage(message: MCPMessage): Promise<MCPResponse> {
    return this.messageQueue.enqueue(message);
  }

  private handleWorkerMessage(data: WorkerMessage): void {
    switch (data.type) {
      case 'response':
        this.eventEmitter.emit('response', data.payload);
        break;
      case 'error':
        this.eventEmitter.emit('error', data.payload);
        break;
      case 'status':
        this.eventEmitter.emit('status', data.payload);
        break;
    }
  }
}
```

**Message Queue** - Очередь сообщений с приоритетами
```typescript
class MessageQueue {
  private queue: PriorityQueue<MCPMessage>;
  private processing = false;
  private maxRetries = 3;

  async enqueue(message: MCPMessage): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      const queueItem = {
        message,
        resolve,
        reject,
        retries: 0,
        timestamp: Date.now()
      };

      this.queue.enqueue(queueItem, this.getPriority(message));

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.isEmpty()) {
      return;
    }

    this.processing = true;

    while (!this.queue.isEmpty()) {
      const item = this.queue.dequeue();

      try {
        const response = await this.sendToWorker(item.message);
        item.resolve(response);
      } catch (error) {
        if (item.retries < this.maxRetries) {
          item.retries++;
          this.queue.enqueue(item, this.getPriority(item.message));
        } else {
          item.reject(error);
        }
      }
    }

    this.processing = false;
  }

  private getPriority(message: MCPMessage): number {
    switch (message.type) {
      case 'chat': return 10;
      case 'status': return 5;
      case 'health': return 1;
      default: return 0;
    }
  }
}
```

### Backend Layer (Python)

**Chat Service** - Основная логика обработки чата
```python
class ChatService:
    def __init__(self):
        self.ai_model = None
        self.conversation_history = []
        self.max_history_length = 100

    async def initialize(self):
        """Инициализация AI модели"""
        try:
            self.ai_model = await self.load_ai_model()
            return {"status": "initialized"}
        except Exception as e:
            raise ChatServiceError(f"Failed to initialize AI model: {e}")

    async def process_message(self, message: str, context: dict) -> str:
        """Обработка входящего сообщения"""
        try:
            # Добавление в историю
            self.add_to_history(message, "user")

            # Получение ответа от AI
            response = await self.get_ai_response(message, context)

            # Добавление ответа в историю
            self.add_to_history(response, "assistant")

            return response

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            raise ChatServiceError(f"Failed to process message: {e}")

    async def get_ai_response(self, message: str, context: dict) -> str:
        """Получение ответа от AI модели"""
        if not self.ai_model:
            raise ChatServiceError("AI model not initialized")

        # Подготовка промпта с контекстом
        prompt = self.prepare_prompt(message, context)

        # Генерация ответа
        response = await self.ai_model.generate(prompt)

        return response.strip()

    def add_to_history(self, message: str, role: str):
        """Добавление сообщения в историю"""
        self.conversation_history.append({
            "role": role,
            "message": message,
            "timestamp": datetime.now().isoformat()
        })

        # Ограничение длины истории
        if len(self.conversation_history) > self.max_history_length:
            self.conversation_history = self.conversation_history[-self.max_history_length:]

    def prepare_prompt(self, message: str, context: dict) -> str:
        """Подготовка промпта для AI модели"""
        system_prompt = context.get('system_prompt', 'You are a helpful assistant.')
        history_text = self.format_history()

        return f"{system_prompt}\n\n{history_text}\n\nUser: {message}\nAssistant:"

    def format_history(self) -> str:
        """Форматирование истории разговора"""
        if not self.conversation_history:
            return ""

        formatted = []
        for item in self.conversation_history[-10:]:  # Последние 10 сообщений
            formatted.append(f"{item['role'].title()}: {item['message']}")

        return "\n".join(formatted)
```

### Storage Layer

**IndexedDB Storage** - Локальное хранение данных
```typescript
class ChatStorage {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'ChatDB';
  private readonly version = 1;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Создание object stores
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('timestamp', 'timestamp');
          messagesStore.createIndex('conversationId', 'conversationId');
        }

        if (!db.objectStoreNames.contains('conversations')) {
          const conversationsStore = db.createObjectStore('conversations', { keyPath: 'id' });
          conversationsStore.createIndex('timestamp', 'timestamp');
        }
      };
    });
  }

  async saveMessage(message: Message): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.put(message);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const messages = request.result
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-limit);
        resolve(messages);
      };
    });
  }

  async clearConversation(conversationId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const index = store.index('conversationId');
      const request = index.openCursor(conversationId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }
}
```

### Error Handling Layer

**Global Error Handler** - Централизованная обработка ошибок
```typescript
class ChatErrorHandler {
  private errorLog: ErrorLog[] = [];
  private maxLogSize = 100;

  handleError(error: Error, context?: ErrorContext): void {
    const errorEntry = {
      id: generateId(),
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack,
      context: context || {},
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.errorLog.push(errorEntry);

    // Ограничение размера лога
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Логирование в консоль
    console.error('[ChatError]', errorEntry);

    // Отправка в analytics (если настроено)
    this.reportError(errorEntry);

    // Показ пользовательского уведомления
    this.showUserNotification(error, context);
  }

  private reportError(errorEntry: ErrorLog): void {
    // Отправка в систему мониторинга
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: errorEntry.error,
        fatal: false
      });
    }
  }

  private showUserNotification(error: Error, context?: ErrorContext): void {
    const notification = {
      type: 'error',
      title: 'Произошла ошибка',
      message: this.getUserFriendlyMessage(error, context),
      action: {
        label: 'Повторить',
        callback: () => window.location.reload()
      }
    };

    // Показ уведомления через notification system
    NotificationManager.show(notification);
  }

  private getUserFriendlyMessage(error: Error, context?: ErrorContext): string {
    // Преобразование технических ошибок в понятные пользователю сообщения
    if (error.message.includes('network')) {
      return 'Проблемы с подключением к интернету. Проверьте соединение и попробуйте снова.';
    }

    if (error.message.includes('timeout')) {
      return 'Превышено время ожидания ответа. Попробуйте отправить сообщение еще раз.';
    }

    if (context?.component === 'chat') {
      return 'Произошла ошибка в чате. Мы уже работаем над её устранением.';
    }

    return 'Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.';
  }

  getErrorLog(): ErrorLog[] {
    return [...this.errorLog];
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }
}

// Глобальный обработчик ошибок
window.addEventListener('error', (event) => {
  ChatErrorHandler.handleError(event.error, {
    component: 'global',
    action: 'uncaught_error'
  });
});

window.addEventListener('unhandledrejection', (event) => {
  ChatErrorHandler.handleError(new Error(event.reason), {
    component: 'global',
    action: 'unhandled_promise_rejection'
  });
});
```

## 🔄 Data Flow Architecture

### Поток Данных в Чате

```
1. User Input → MessageInput Component
2. MessageInput → Chat Store (addMessage)
3. Chat Store → Message Queue (enqueue)
4. Message Queue → MCP Bridge (send)
5. MCP Bridge → Web Worker (postMessage)
6. Web Worker → Python Chat Service (process_message)
7. Python Chat Service → AI Model (get_response)
8. AI Model → Python Chat Service (response)
9. Python Chat Service → Web Worker (postMessage)
10. Web Worker → MCP Bridge (onmessage)
11. MCP Bridge → Message Queue (resolve)
12. Message Queue → Chat Store (setTyping false, addMessage)
13. Chat Store → MessageList Component (re-render)
14. MessageList → User Interface (display)
```

### Состояния Чата

```typescript
type ChatStatus =
  | 'initializing'    // Инициализация компонентов
  | 'connecting'      // Подключение к MCP
  | 'ready'           // Готов к работе
  | 'processing'      // Обработка сообщения
  | 'error'           // Ошибка
  | 'disconnected'    // Отключен
  | 'reconnecting';   // Повторное подключение

interface ChatState {
  status: ChatStatus;
  messages: Message[];
  isTyping: boolean;
  error: Error | null;
  connectionAttempts: number;
  lastActivity: number;
}
```

## 📊 Performance Optimizations

### Lazy Loading и Code Splitting

```typescript
// Динамический импорт компонентов чата
const ChatContainer = lazy(() =>
  import('./components/ChatContainer').then(module => ({
    default: module.ChatContainer
  }))
);

// Предзагрузка при наведении
const preloadChat = () => {
  import('./components/ChatContainer');
};
```

### Virtual Scrolling для Message List

```typescript
const MessageList: React.FC = () => {
  const messages = useChatStore(state => state.messages);
  const listRef = useRef<HTMLDivElement>(null);

  // Реализация виртуального скроллинга
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return;

      const scrollTop = listRef.current.scrollTop;
      const itemHeight = 60; // Предполагаемая высота сообщения
      const containerHeight = listRef.current.clientHeight;

      const start = Math.floor(scrollTop / itemHeight);
      const end = start + Math.ceil(containerHeight / itemHeight);

      setVisibleRange({ start: Math.max(0, start - 5), end: end + 5 });
    };

    listRef.current?.addEventListener('scroll', handleScroll);
    return () => listRef.current?.removeEventListener('scroll', handleScroll);
  }, []);

  const visibleMessages = messages.slice(visibleRange.start, visibleRange.end);

  return (
    <div ref={listRef} className="message-list">
      <div style={{ height: messages.length * 60 }}>
        <div style={{ transform: `translateY(${visibleRange.start * 60}px)` }}>
          {visibleMessages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              style={{ height: 60 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

### Memory Management

```typescript
// Очистка старых сообщений
const MAX_MESSAGES = 1000;

const useMessageCleanup = () => {
  const messages = useChatStore(state => state.messages);
  const clearOldMessages = useChatStore(state => state.clearOldMessages);

  useEffect(() => {
    if (messages.length > MAX_MESSAGES) {
      clearOldMessages(MAX_MESSAGES * 0.2); // Удаляем 20% самых старых
    }
  }, [messages.length, clearOldMessages]);
};
```

## 🔒 Security Considerations

### Input Sanitization

```typescript
// Очистка пользовательского ввода
const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Удаление HTML тегов
    .substring(0, 10000); // Ограничение длины
};
```

### Rate Limiting

```typescript
// Ограничение частоты отправки сообщений
const useRateLimit = (maxRequests = 10, windowMs = 60000) => {
  const [requests, setRequests] = useState<number[]>([]);

  const isAllowed = useCallback(() => {
    const now = Date.now();
    const windowStart = now - windowMs;

    const recentRequests = requests.filter(time => time > windowStart);

    if (recentRequests.length >= maxRequests) {
      return false;
    }

    setRequests([...recentRequests, now]);
    return true;
  }, [requests, maxRequests, windowMs]);

  return isAllowed;
};
```

## 📈 Monitoring и Analytics

### Performance Metrics

```typescript
// Отслеживание производительности чата
const useChatMetrics = () => {
  const [metrics, setMetrics] = useState<ChatMetrics>({
    messageSendTime: [],
    messageReceiveTime: [],
    errorCount: 0,
    totalMessages: 0
  });

  const trackMessageSend = useCallback((startTime: number) => {
    const endTime = Date.now();
    const duration = endTime - startTime;

    setMetrics(prev => ({
      ...prev,
      messageSendTime: [...prev.messageSendTime.slice(-99), duration],
      totalMessages: prev.totalMessages + 1
    }));
  }, []);

  const trackMessageReceive = useCallback((startTime: number) => {
    const endTime = Date.now();
    const duration = endTime - startTime;

    setMetrics(prev => ({
      ...prev,
      messageReceiveTime: [...prev.messageReceiveTime.slice(-99), duration]
    }));
  }, []);

  const trackError = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      errorCount: prev.errorCount + 1
    }));
  }, []);

  return {
    metrics,
    trackMessageSend,
    trackMessageReceive,
    trackError
  };
};
```

## 🚀 Deployment и Scaling

### Container Configuration

```yaml
# Docker конфигурация для Python backend
version: '3.8'
services:
  chat-backend:
    build: .
    environment:
      - PYTHONPATH=/app
      - AI_MODEL_PATH=/models
    volumes:
      - ./models:/models:ro
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
```

### CDN Configuration

```typescript
// Настройка CDN для статических ресурсов
const CDN_CONFIG = {
  chatAssets: 'https://cdn.example.com/chat/',
  pyodide: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
  aiModels: 'https://models.example.com/'
};
```

## 📋 API Documentation

### Message Format

```typescript
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}
```

### Chat Configuration

```typescript
interface ChatConfig {
  maxMessageLength: number;
  maxHistoryLength: number;
  typingIndicatorDelay: number;
  autoScroll: boolean;
  enableNotifications: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
}
```

### Error Types

```typescript
type ChatError =
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AI_MODEL_ERROR'
  | 'STORAGE_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR';
```

## 🎯 Future Enhancements

### Планируемые Функции

1. **Multi-language Support** - Поддержка нескольких языков
2. **File Upload** - Загрузка файлов в чат
3. **Voice Messages** - Голосовые сообщения
4. **Video Chat** - Видеозвонки
5. **Collaborative Editing** - Совместное редактирование
6. **Advanced AI Features** - Продвинутые возможности AI

### Архитектурные Улучшения

1. **Microservices Architecture** - Разделение на микросервисы
2. **GraphQL API** - Современный API
3. **WebRTC** - P2P коммуникации
4. **Blockchain Integration** - Децентрализация
5. **AI Model Marketplace** - Рынок AI моделей

---

**Версия документации:** 1.0
**Дата последнего обновления:** 2024-08-25
**Автор:** AI Assistant
**Статус:** Актуально