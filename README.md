# Agent-Plugins-Platform

![Status](https://img.shields.io/badge/status-functional-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![JavaScript](https://img.shields.io/badge/javascript-ES6+-yellow.svg)

**Платформа для запуска Python кода в браузере через Pyodide с поддержкой MCP (Model Context Protocol)**

Этот проект представляет собой готовое решение для интеграции Python в браузерные расширения и веб-приложения. Он позволяет выполнять Python код в изолированной среде WebAssembly, используя Pyodide, и предоставляет удобный мост между JavaScript и Python через MCP протокол.

## 🚀 Возможности

- **Python в браузере**: Полноценное выполнение Python 3.11+ кода через Pyodide
- **MCP протокол**: Простой и эффективный способ коммуникации между JS и Python
- **Плагинная архитектура**: Легкое добавление новых Python модулей
- **Безопасность**: Изолированное выполнение в WebWorker
- **Готовый UI**: Тестовый стенд для демонстрации функциональности
- **API мост**: Удобные функции для взаимодействия с браузером

## 🏗️ Архитектура

Проект был реорганизован с использованием современного boilerplate. Вся бизнес-логика платформы централизована в директории `agent-plugins-platform-boilerplate/platform-core/`.

```
agent-plugins-platform-boilerplate/
├── platform-core/          # Централизованная логика платформы
│   ├── core/               # Основная бизнес-логика
│   │   ├── plugin-manager.js    # Управление плагинами
│   │   ├── host-api.js          # API для взаимодействия с браузером
│   │   └── workflow-engine.js   # Обработка рабочих процессов
│   ├── bridge/              # Мост между JS и Python
│   │   ├── pyodide-worker.js    # WebWorker с Pyodide
│   │   ├── mcp-bridge.js        # MCP протокол
│   │   └── worker-manager.js    # Управление WebWorker'ами
│   ├── public/              # Публичные ресурсы платформы
│   │   ├── plugins/             # Python плагины
│   │   └── ...
│   └── ui/                  # UI компоненты платформы
├── pages/                  # Страницы расширения (options, popup и т.д.)
├── packages/               # Общие пакеты и утилиты
├── public/                 # Статические ресурсы
└── ...                     # Другие файлы и директории boilerplate
```

## 📦 Установка и запуск

```bash
# Клонирование репозитория
git clone https://github.com/your-username/agent-plugins-platform.git
cd agent-plugins-platform

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Сборка проекта
npm run build
```

## 🔧 Создание плагина

1. Создайте папку в `agent-plugins-platform-boilerplate/public/plugins/your-plugin/`
2. Добавьте `manifest.json`:
```json
{
  "name": "Your Plugin",
  "version": "1.0.0",
  "description": "Описание плагина",
  "main_server": "main.py",
  "host_permissions": ["*://*.example.com/*"]
}
```

3. Создайте `main.py` с MCP сервером:
```python
import sys
import json
from typing import Any, Dict

async def your_function(data: Dict[str, Any]) -> Dict[str, Any]:
    # Ваш код здесь
    await js.sendMessageToChat_bridge({"content": "Hello from Python!"})
    return {"status": "success"}

async def main():
    line = sys.stdin.readline()
    request = json.loads(line)
    # Обработка запроса
    result = await your_function(request.get("input", {}))
    sys.stdout.write(json.dumps({"result": result}) + '\n')
```

## 🧩 Интеграция с boilerplate

В проекте используется современный подход к интеграции через алиасы:

- `@platform-core` — для доступа к основной логике, мосту, хукам и UI компонентам
- `@platform-public` — для доступа к публичным ресурсам (плагинам, Pyodide, wheels)

Пример импорта:
```js
import { PluginManager } from '@platform-core/core/plugin-manager.js';
import { PluginsTab } from '@platform-core/pages/options/src/components/PluginsTab';
```

## 🔗 Полезные ссылки

- [MCP Protocol](https://github.com/mcpwithoutmcp/mcp) - Стандарт протокола Model Context Protocol
- [Pyodide](https://pyodide.org/en/stable/) - Python в WebAssembly
- [WebWorker API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) - Документация по WebWorker

## 📝 Лицензия

MIT License

## 🌟 Примеры использования

### Анализ веб-страниц
Проект включает пример плагина для анализа товаров на Ozon.ru, демонстрирующий:
- Получение контента страницы
- Обработку данных в Python
- Отправку результатов в UI

### Интеграция в браузерные расширения
Модуль может быть интегрирован в любые браузерные расширения для выполнения Python логики.

## 🔌 API

### JavaScript → Python
```javascript
// Отправка сообщения в Python
await js.sendMessageToChat_bridge({"content": "Message"});

// Получение контента страницы
const content = await js.getActivePageContent_bridge({"title": "h1"});
```

### Python → JavaScript
```python
# Отправка сообщения в UI
await js.sendMessageToChat_bridge({"content": "Hello from Python!"})

# Получение данных страницы
content = await js.getActivePageContent_bridge({"title": "h1"})
```

## 🛡️ Безопасность

- Python код выполняется в изолированном WebWorker
- Ограниченный доступ к браузерным API
- Sandboxed среда Pyodide
- Контролируемые разрешения для каждого плагина

## 🤝 Вклад в проект

Проект открыт для вкладов! Вы можете:
- Добавлять новые плагины
- Улучшать API моста
- Оптимизировать производительность
- Расширять функциональность

## 🙏 Благодарности

Разработано [LebedevIV](https://github.com/LebedevIV) как модуль для интеграции Python в браузерные расширения.

---

**Примечание**: Этот проект изначально планировался как часть более крупной платформы, но теперь представляет собой самостоятельный модуль, который может быть полезен разработчикам, нуждающимся в выполнении Python кода в браузере.

## Работа с AI-ассистентом

Этот проект разрабатывается в тесном сотрудничестве с AI-ассистентом (Gemini 2.5 Pro в Cursor). Весь необходимый контекст для AI, включая историю архитектурных решений и "кладбище" отвергнутых идей, хранится в [MEMORY_BANK.md](./MEMORY_BANK.md).