# DevTools Testing Guide

## Обзор

Этот документ описывает процесс тестирования функциональности чатов плагинов через DevTools панель "Agent Platform Tools".

## Проблема CSP и решение

### Проблема
При попытке использовать `eval()` или `new Function()` для выполнения динамически загруженных скриптов возникала ошибка:
```
EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'self'".
```

### Решение
Создан `TestLoader` класс, который использует загрузку скриптов через `<script>` теги вместо динамического выполнения кода. Это полностью соответствует политике CSP.

## Структура тестовых файлов

```
chrome-extension/public/test-scripts/
├── ozon-test.js          # Тестовые функции для Ozon
└── test-loader.js        # Загрузчик тестов (безопасный)
```

## Как тестировать

### 1. Открытие DevTools
1. Откройте любую веб-страницу (например, https://www.ozon.ru)
2. Нажмите F12 для открытия DevTools
3. Перейдите на вкладку "Agent Platform Tools" (не "Console"!)

### 2. Использование интерфейса
В DevTools панели перейдите на вкладку "Debug" и используйте кнопки:

- **"Загрузить TestLoader"** - загружает систему тестирования
- **"Загрузить тесты Ozon"** - загружает тестовые функции для Ozon
- **"Запустить все тесты Ozon"** - выполняет полный цикл тестирования

### 3. Использование консоли
После загрузки тестов в консоли DevTools панели доступны функции:

```javascript
// Запуск всех тестов
ozonTestSystem.runOzonTests();

// Отдельные функции
ozonTestSystem.createOzonChat();
ozonTestSystem.createTestPluginChat();
ozonTestSystem.sendTestLogs();
ozonTestSystem.getAllData();

// Управление загрузчиком
testLoader.loadOzonTests();
testLoader.runOzonTests();
testLoader.getLoadedScripts();
testLoader.clearLoadedScripts();
```

## Тестовые сценарии

### Сценарий 1: Создание чатов
1. Откройте страницу товара на Ozon
2. Загрузите тесты через интерфейс
3. Выполните `ozonTestSystem.createOzonChat()`
4. Проверьте вкладку "Чаты плагинов" - должен появиться новый чат

### Сценарий 2: Отправка логов
1. Загрузите тесты
2. Выполните `ozonTestSystem.sendTestLogs()`
3. Проверьте вкладку "Логи" - должны появиться тестовые записи

### Сценарий 3: Получение данных
1. Загрузите тесты
2. Выполните `ozonTestSystem.getAllData()`
3. В консоли отобразятся все чаты, черновики и логи

## Отладка

### Проверка контекста
Убедитесь, что вы находитесь в правильном контексте DevTools:
```javascript
// Должно быть доступно
chrome.runtime
window.testLoader
window.ozonTestSystem
```

### Логирование
Все операции логируются в:
- Консоль DevTools панели
- Вкладка "Debug" в DevTools панели
- Вкладка "Логи" для логов плагинов

### Экспорт логов
В Debug вкладке есть кнопка "Экспорт логов" для сохранения отладочной информации.

## Частые ошибки

### 1. "TestLoader не найден"
**Причина**: TestLoader не загружен
**Решение**: Нажмите "Загрузить TestLoader" в Debug вкладке

### 2. "Функции ozonTestSystem не найдены"
**Причина**: Тесты Ozon не загружены
**Решение**: Нажмите "Загрузить тесты Ozon" в Debug вкладке

### 3. "Ошибка CSP"
**Причина**: Попытка использовать eval() или new Function()
**Решение**: Используйте TestLoader с загрузкой через script теги

### 4. "Нет доступа к chrome.runtime"
**Причина**: Неправильный контекст DevTools
**Решение**: Убедитесь, что открыта вкладка "Agent Platform Tools", а не обычная консоль

## Технические детали

### TestLoader класс
```javascript
class TestLoader {
  async loadScriptSafely(scriptPath) // Загружает скрипт через script тег
  async loadOzonTests()              // Загружает тесты Ozon
  async runOzonTests()               // Запускает все тесты
  getLoadedScripts()                 // Список загруженных скриптов
  clearLoadedScripts()               // Очистка загруженных скриптов
}
```

### Безопасная загрузка
```javascript
// Вместо eval() или new Function()
const script = document.createElement('script');
script.src = chrome.runtime.getURL(scriptPath);
script.type = 'text/javascript';
document.head.appendChild(script);
```

### Интеграция с DevTools
- TypeScript декларации для глобальных объектов
- React компоненты для управления тестами
- Автоматическое логирование операций
- Проверка дублирования загрузки скриптов

## Рекомендации

1. **Всегда проверяйте контекст** - убедитесь, что находитесь в DevTools панели расширения
2. **Используйте интерфейс** - кнопки в Debug вкладке безопаснее, чем ручной вызов
3. **Мониторьте логи** - следите за вкладкой "Логи" для отладки
4. **Экспортируйте данные** - используйте экспорт для анализа проблем
5. **Тестируйте на реальных страницах** - особенно на Ozon для полного тестирования

## Обновления

- **2024-12-19**: Добавлен TestLoader для безопасной загрузки скриптов
- **2024-12-19**: Интегрированы тестовые функции в DevTools панель
- **2024-12-19**: Добавлены TypeScript декларации для глобальных объектов
- **2024-12-19**: Заменен new Function() на загрузку через script теги для полного соответствия CSP 