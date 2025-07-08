# Agent-Plugins-Platform

Браузерное расширение, которое позволяет выполнять Python плагины в браузере с использованием Pyodide и MCP протокола.

## 🚀 Возможности

- **Python в браузере**: Выполнение Python кода через Pyodide
- **MCP протокол**: Стандартизированная коммуникация между JavaScript и Python
- **Плагинная архитектура**: Модульная система плагинов
- **Безопасность**: Песочница для изолированного выполнения
- **Современный UI**: React + TypeScript + Tailwind CSS

## 📁 Архитектура проекта

```
agent-plugins-platform/
├── platform-core/           # Основная логика платформы
│   ├── core/               # Ядро системы (PluginManager, HostAPI, WorkflowEngine)
│   ├── bridge/             # MCP Bridge и Pyodide Worker
│   ├── public/             # Плагины, Pyodide, wheels
│   ├── src/                # Background scripts
│   └── ui/                 # UI компоненты
├── pages/                  # Страницы расширения
│   ├── options/            # Страница настроек
│   ├── popup/              # Popup окно
│   ├── side-panel/         # Боковая панель
│   └── ...
├── packages/               # Внутренние пакеты
└── tests/                  # Тесты
```

## 🛠️ Установка и разработка

### Требования
- Node.js >= 22.15.1
- pnpm >= 10.11.0

### Установка зависимостей
```bash
pnpm install
```

### Разработка
```bash
# Запуск в режиме разработки
pnpm dev

# Сборка для Chrome
pnpm build

# Сборка для Firefox
pnpm build:firefox

# Создание ZIP архива
pnpm zip
```

### Тестирование
```bash
# E2E тесты
pnpm e2e

# Линтинг
pnpm lint

# Проверка типов
pnpm type-check
```

## 🔌 Разработка плагинов

### Структура плагина
```
public/plugins/plugin-name/
├── manifest.json      # Метаданные и разрешения плагина
├── mcp_server.py      # Python MCP сервер
├── workflow.json      # Определение workflow
└── icon.svg          # Иконка плагина
```

### Пример manifest.json
```json
{
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Описание плагина",
  "main_server": "mcp_server.py",
  "host_permissions": ["*://*.example.com/*"],
  "permissions": ["activeTab", "scripting"]
}
```

### Пример Python плагина
```python
import sys
import json
from typing import Any, Dict

async def main():
    line = sys.stdin.readline()
    request = json.loads(line)
    
    # Обработка запроса
    result = await process_request(request)
    
    # Отправка ответа
    response = {"result": result}
    sys.stdout.write(json.dumps(response) + '\n')

async def process_request(request: Dict[str, Any]) -> Dict[str, Any]:
    # Логика плагина
    return {"status": "success"}
```

## 🔧 Конфигурация

### Настройки Options
- Исходный код: `pages/options/src/Options.tsx`
- Компоненты: `pages/options/src/components/`
- Стили: `pages/options/src/Options.css`

### Alias для импортов
- `@platform-core` — core, bridge, хуки, UI
- `@platform-public` — public/plugins, public/pyodide, public/wheels

## 🧪 Тестирование

### E2E тесты
```bash
pnpm e2e
```

### Unit тесты
```bash
pnpm test
```

## 📦 Сборка и деплой

### Сборка для Chrome Web Store
```bash
pnpm build
pnpm zip
```

### Сборка для Firefox Add-ons
```bash
pnpm build:firefox
pnpm zip:firefox
```

## 🔒 Безопасность

- Валидация манифестов плагинов
- Песочница для изолированного выполнения
- Принцип минимальных привилегий
- Аудит кода плагинов

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📞 Поддержка

Если у вас есть вопросы или проблемы, создайте issue в репозитории.
