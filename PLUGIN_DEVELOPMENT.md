# Руководство по разработке плагинов

Это руководство поможет вам создать и интегрировать плагины для Agent-Plugins-Platform (APP).

## Архитектура плагина

Плагин в APP состоит из следующих компонентов:

1. **manifest.json** - метаданные и конфигурация плагина
2. **mcp_server.py** - основной Python код, реализующий MCP протокол
3. **workflow.json** (опционально) - описание рабочих процессов плагина
4. **icon.svg** (опционально) - иконка плагина

## Создание нового плагина

### 1. Структура директорий

```
agent-plugins-platform-boilerplate/public/plugins/your-plugin/
├── manifest.json      # Метаданные плагина
├── mcp_server.py      # Python код с MCP протоколом
├── workflow.json      # (Опционально) Рабочие процессы
└── icon.svg           # (Опционально) Иконка плагина
```

### 2. manifest.json

Файл `manifest.json` определяет метаданные плагина и необходимые разрешения.

```json
{
  "name": "Your Plugin Name",
  "version": "1.0.0",
  "description": "Описание вашего плагина",
  "main_server": "mcp_server.py",
  "host_permissions": ["*://*.example.com/*"],
  "permissions": ["activeTab", "scripting"],
  "icon": "icon.svg",
  "author": "Your Name",
  "homepage_url": "https://example.com"
}
```

### 3. mcp_server.py

Файл `mcp_server.py` содержит Python код вашего плагина, реализующий MCP протокол.

```python
import sys
import json
from typing import Any, Dict

# Здесь определите ваши вспомогательные функции
async def process_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Основная логика обработки данных
    """
    # Ваш код здесь
    return {"result": "processed data"}

# Основная функция обработки запросов
async def process_request(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Обрабатывает входящие MCP запросы
    """
    method = request.get("method")
    params = request.get("params", {})
    
    if method == "analyze":
        return await process_data(params)
    else:
        return {"error": f"Unknown method: {method}"}

# Главная функция для чтения stdin и записи в stdout
async def main():
    """
    Основная функция, читающая запросы из stdin и отправляющая ответы в stdout
    """
    # Чтение запроса из stdin
    line = sys.stdin.readline()
    if not line:
        return
    
    # Парсинг JSON запроса
    request = json.loads(line)
    
    # Обработка запроса
    result = await process_request(request)
    
    # Отправка ответа в stdout
    response = {"result": result}
    sys.stdout.write(json.dumps(response) + '\n')
    sys.stdout.flush()

# Точка входа для Pyodide
if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### 4. workflow.json (опционально)

Файл `workflow.json` определяет последовательность операций плагина.

```json
{
  "name": "Example Workflow",
  "version": "1.0.0",
  "steps": [
    {
      "id": "step1",
      "name": "First Step",
      "method": "analyze",
      "input": {
        "source": "user_input"
      },
      "next": "step2"
    },
    {
      "id": "step2",
      "name": "Second Step",
      "method": "process",
      "input": {
        "source": "step1.output"
      }
    }
  ]
}
```

## Взаимодействие с браузером

### Доступ к API браузера

Для доступа к API браузера используйте глобальный объект `js`, который предоставляется Pyodide:

```python
# Отправить сообщение в чат
await js.sendMessageToChat_bridge({"content": "Hello from Python!"})

# Получить содержимое активной вкладки
page_content = await js.getPageContent_bridge()

# Выполнить JavaScript в активной вкладке
result = await js.executeScript_bridge("document.title")
```

### Доступные методы Host API

- `getPageContent_bridge()` - получить HTML содержимое активной вкладки
- `executeScript_bridge(script)` - выполнить JavaScript в активной вкладке
- `sendMessageToChat_bridge(message)` - отправить сообщение в интерфейс чата
- `updatePluginUI_bridge(data)` - обновить UI плагина
- `getStorageItem_bridge(key)` - получить данные из хранилища
- `setStorageItem_bridge(key, value)` - сохранить данные в хранилище

## Отладка плагина

### Консольное логирование

Для отладки используйте `print()` и `console.log()`:

```python
# В Python коде
print("Debug message")

# Доступ к консоли браузера
import js
js.console.log("This will appear in browser console")
```

### Отладка в браузере

1. Откройте страницу options расширения
2. Откройте DevTools (F12)
3. Перейдите на вкладку Console
4. Логи плагина будут отображаться с префиксом [plugin:your-plugin-name]

## Примеры плагинов

### 1. Простой плагин для анализа текста

```python
import sys
import json
from typing import Any, Dict

async def analyze_text(text: str) -> Dict[str, Any]:
    """
    Анализирует текст и возвращает статистику
    """
    words = text.split()
    return {
        "word_count": len(words),
        "char_count": len(text),
        "avg_word_length": sum(len(w) for w in words) / len(words) if words else 0
    }

async def process_request(request: Dict[str, Any]) -> Dict[str, Any]:
    method = request.get("method")
    params = request.get("params", {})
    
    if method == "analyze":
        text = params.get("text", "")
        return await analyze_text(text)
    else:
        return {"error": f"Unknown method: {method}"}

async def main():
    line = sys.stdin.readline()
    request = json.loads(line)
    result = await process_request(request)
    sys.stdout.write(json.dumps({"result": result}) + '\n')
    sys.stdout.flush()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### 2. Плагин для веб-скрапинга

```python
import sys
import json
from typing import Any, Dict
import re

async def scrape_page(url: str = None) -> Dict[str, Any]:
    """
    Извлекает данные со страницы
    """
    # Получаем содержимое страницы
    if url:
        # TODO: Реализовать запрос по URL
        pass
    else:
        # Получаем содержимое активной вкладки
        page_content = await js.getPageContent_bridge()
    
    # Извлекаем заголовок
    title_match = re.search(r"<title>(.*?)</title>", page_content)
    title = title_match.group(1) if title_match else "Unknown"
    
    # Извлекаем все ссылки
    links = re.findall(r'href="(https?://.*?)"', page_content)
    
    return {
        "title": title,
        "links_count": len(links),
        "links": links[:10]  # Первые 10 ссылок
    }

async def process_request(request: Dict[str, Any]) -> Dict[str, Any]:
    method = request.get("method")
    params = request.get("params", {})
    
    if method == "scrape":
        url = params.get("url")
        return await scrape_page(url)
    else:
        return {"error": f"Unknown method: {method}"}

async def main():
    line = sys.stdin.readline()
    request = json.loads(line)
    result = await process_request(request)
    sys.stdout.write(json.dumps({"result": result}) + '\n')
    sys.stdout.flush()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

## Лучшие практики

1. **Безопасность** - не выполняйте потенциально опасный код, валидируйте все входные данные
2. **Производительность** - оптимизируйте операции, особенно при работе с большими данными
3. **Структурирование** - разделяйте логику на модули и функции
4. **Обработка ошибок** - всегда обрабатывайте исключения и предоставляйте понятные сообщения об ошибках
5. **Документация** - комментируйте код и документируйте API вашего плагина
6. **Тестирование** - пишите тесты для проверки функциональности

## FAQ

### Могу ли я использовать сторонние Python библиотеки?

Да, вы можете использовать любые библиотеки, которые поддерживаются Pyodide. Список поддерживаемых библиотек можно найти [здесь](https://pyodide.org/en/stable/usage/packages-in-pyodide.html).

### Как передать данные между плагинами?

Используйте методы `getStorageItem_bridge` и `setStorageItem_bridge` для сохранения и получения данных между плагинами.

### Как обновить UI из плагина?

Используйте метод `updatePluginUI_bridge` для отправки данных в интерфейс. 

## Рекомендации по тестированию системы чатов плагинов

### Юнит-тесты (например, Jest, Vitest)
- Тесты на добавление, получение, удаление чата (plugin-chat-cache.ts)
- Проверка LRU-очистки (при превышении лимита кэша)
- Проверка автоматической очистки устаревших чатов (старше 90 дней)
- Тесты на экспорт/импорт чатов
- Проверка корректности работы с пустыми чатами (не создаются/удаляются)
- Мока chrome.runtime.sendMessage/onMessage для проверки messaging API
- Проверка, что после SAVE_PLUGIN_CHAT_MESSAGE/DELETE_PLUGIN_CHAT отправляется событие PLUGIN_CHAT_UPDATED
- Проверка, что UI корректно реагирует на PLUGIN_CHAT_UPDATED (автоматическая синхронизация)

### Пример unit-теста (Jest)
```ts
import { pluginChatCache } from 'chrome-extension/src/background/plugin-chat-cache';

test('добавление и получение чата', async () => {
  await pluginChatCache.init();
  await pluginChatCache.saveMessage('test-plugin', 'https://test/page', {
    role: 'user', content: 'hello', timestamp: Date.now()
  });
  const chat = await pluginChatCache.getOrLoadChat('test-plugin::https://test/page');
  expect(chat).toBeDefined();
  expect(chat?.messages[0].content).toBe('hello');
});
```

### Интеграционные тесты (e2e, Playwright/WebdriverIO)
- Открытие side-panel, отправка сообщения, проверка появления в истории
- Очистка чата, проверка, что история пуста
- Одновременная работа в двух вкладках: отправка сообщения в одной — мгновенное появление в другой
- Быстрая отправка нескольких сообщений подряд
- Перезапуск расширения/браузера — история чата сохраняется
- Проверка автоматического удаления чата после истечения TTL (можно подменить дату в тесте)
- Экспорт чата — сравнение содержимого JSON с историей в UI

### Пример e2e-теста (Playwright)
```ts
import { test, expect } from '@playwright/test';

test('чат синхронизируется между вкладками', async ({ page, context }) => {
  await page.goto('chrome-extension://.../side-panel.html');
  await page.fill('.chat-input textarea', 'Привет!');
  await page.click('.chat-input button');
  const page2 = await context.newPage();
  await page2.goto('chrome-extension://.../side-panel.html');
  await expect(page2.locator('.chat-message .message-text')).toHaveText('Привет!');
});
```

### UX-тесты
- Проверка отображения индикаторов загрузки, ошибок, статуса синхронизации
- Проверка доступности кнопок “Очистить чат”, “Экспорт чата” (должны быть неактивны при пустом чате)

### Советы по отладке и DevTools
- Для отладки используйте chrome://extensions → “Фоновая страница” → Console для логов background.js
- Включите подробное логирование в plugin-chat-cache.ts (например, при очистке, сохранении, удалении чата)
- Для ручной проверки TTL — вручную измените updatedAt в IndexedDB через DevTools → Application → IndexedDB
- Для расширения DevTools-панели можно добавить вкладку “Чаты плагинов” с просмотром, удалением, экспортом чатов и логом событий PLUGIN_CHAT_UPDATED

### Автоматизация
- Для e2e-тестов используйте мок-данные и автоматическую очистку IndexedDB перед каждым тестом
- Для unit-тестов — мокайте openDB/idb, чтобы не зависеть от реального браузера
- Для тестирования broadcast-событий — используйте несколько окон/вкладок в автоматизированных тестах 

---

## Шаблоны тестов и примеры моков для системы чатов

### Шаблон unit-теста с моками IndexedDB (Jest)
```ts
import { pluginChatCache } from 'chrome-extension/src/background/plugin-chat-cache';

// Мокаем openDB/idb
jest.mock('idb', () => ({
  openDB: jest.fn(() => ({
    getAll: jest.fn(() => []),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe('pluginChatCache', () => {
  beforeEach(async () => {
    await pluginChatCache.init();
  });
  it('создаёт и возвращает чат', async () => {
    await pluginChatCache.saveMessage('test-plugin', 'https://test/page', {
      role: 'user', content: 'hello', timestamp: Date.now()
    });
    const chat = await pluginChatCache.getOrLoadChat('test-plugin::https://test/page');
    expect(chat).toBeDefined();
  });
});
```

### Мок chrome.runtime.sendMessage для unit-тестов UI
```ts
beforeAll(() => {
  global.chrome = {
    runtime: {
      sendMessage: jest.fn(() => Promise.resolve({ messages: [] })),
      onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    },
  } as any;
});
```

### Шаблон e2e-теста (Playwright)
```ts
import { test, expect } from '@playwright/test';

test('чат синхронизируется между вкладками', async ({ page, context }) => {
  await page.goto('chrome-extension://.../side-panel.html');
  await page.fill('.chat-input textarea', 'Привет!');
  await page.click('.chat-input button');
  const page2 = await context.newPage();
  await page2.goto('chrome-extension://.../side-panel.html');
  await expect(page2.locator('.chat-message .message-text')).toHaveText('Привет!');
});
```

---

## Архитектура расширения DevTools-панели для чатов плагинов

**1. Новая вкладка “Чаты плагинов” (Plugin Chats):**
- Таблица: ключ чата, плагин, страница, дата последнего сообщения, количество сообщений.
- Кнопка “Просмотр” — открывает модальное окно с историей сообщений (JSON, UI).
- Кнопка “Удалить” — удаляет чат из IndexedDB и кэша.
- Кнопка “Экспортировать все чаты” — скачивает JSON-файл со всеми чатами.

**2. Вкладка “События” (Events):**
- Лог событий PLUGIN_CHAT_UPDATED (pluginId, pageKey, timestamp).
- Визуализация broadcast-событий между вкладками.

**3. Техническая реализация:**
- Использовать chrome.runtime.sendMessage({ type: 'LIST_PLUGIN_CHATS' }) для получения всех чатов.
- Для удаления — chrome.runtime.sendMessage({ type: 'DELETE_PLUGIN_CHAT', pluginId, pageKey }).
- Для экспорта — chrome.runtime.sendMessage({ type: 'LIST_PLUGIN_CHATS' }) + saveAs(JSON).
- Для логирования событий — подписка на chrome.runtime.onMessage в DevTools-панели.
- UI: React, таблица (например, react-table), модальные окна для просмотра/экспорта.

**4. Пример структуры компонента:**
```tsx
function PluginChatsTab() {
  const [chats, setChats] = useState<PluginChat[]>([]);
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'LIST_PLUGIN_CHATS', pluginId: null })
      .then(setChats);
    const handleUpdate = (msg) => {
      if (msg.type === 'PLUGIN_CHAT_UPDATED') {
        chrome.runtime.sendMessage({ type: 'LIST_PLUGIN_CHATS', pluginId: null })
          .then(setChats);
      }
    };
    chrome.runtime.onMessage.addListener(handleUpdate);
    return () => chrome.runtime.onMessage.removeListener(handleUpdate);
  }, []);
  // ...render table, buttons, modals...
}
```

--- 