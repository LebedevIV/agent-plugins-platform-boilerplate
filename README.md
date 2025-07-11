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

### 🚀 Быстрый старт
**Для новых разработчиков**: 
- [QUICK_START.md](QUICK_START.md) - быстрый старт (3 шага)
- [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) - полное руководство по настройке среды разработки

### Требования
- Node.js >= 22.15.1
- pnpm >= 10.11.0
- Cursor IDE (рекомендуется для лучшей работы с ИИ-ассистентом)

### Установка зависимостей
```bash
pnpm install
```

### Разработка
```bash
# Запуск в режиме разработки
pnpm dev

# Сборка для продакшена
pnpm build

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

**Подробные команды и настройки**: См. [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)

## 🔌 Разработка плагинов

### Быстрый старт
```bash
# Создание нового плагина
mkdir public/plugins/my-plugin
# Создайте manifest.json, mcp_server.py, icon.svg
```

### Структура плагина
```
public/plugins/plugin-name/
├── manifest.json      # Метаданные и разрешения плагина
├── mcp_server.py      # Python MCP сервер
├── workflow.json      # Определение workflow (опционально)
└── icon.svg          # Иконка плагина (опционально)
```

**Подробное руководство**: См. [PLUGIN_DEVELOPMENT.md](PLUGIN_DEVELOPMENT.md)

## 🔧 Конфигурация

### Основные файлы
- **Настройки**: `pages/options/src/Options.tsx`
- **Компоненты**: `pages/options/src/components/`
- **Стили**: `pages/options/src/Options.css`

### Alias для импортов
- `@platform-core` — core, bridge, хуки, UI
- `@platform-public` — public/plugins, public/pyodide, public/wheels

**Подробная конфигурация**: См. [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)

## 🧪 Тестирование

```bash
pnpm e2e    # E2E тесты
pnpm test   # Unit тесты
```

**Подробное тестирование**: См. [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)

## 📦 Сборка и деплой

```bash
pnpm build        # Сборка для Chrome Web Store
pnpm build:firefox # Сборка для Firefox Add-ons
pnpm zip          # Создание ZIP архива
```

**Подробная сборка**: См. [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)

## 🔒 Безопасность

- Валидация манифестов плагинов
- Песочница для изолированного выполнения
- Принцип минимальных привилегий
- Аудит кода плагинов

**Подробная безопасность**: См. [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)

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
