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