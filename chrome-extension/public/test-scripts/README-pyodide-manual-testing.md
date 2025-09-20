# 🧪 РУЧНОЕ ТЕСТИРОВАНИЕ PYODIDE В OFFSCREEN DOCUMENT CONTEXT

## 📋 Описание

Этот набор файлов предоставляет комплексную систему для **ручного тестирования Pyodide** в Offscreen Document Context Chrome Extension. Тестирование подтверждает возможность выполнения Python execution архитектуры для реальных сценариев использования.

## 🎯 Цели тестирования

- ✅ Подтвердить создание offscreen document с safety checks
- ✅ Проверить работу Pyodide Python runtime
- ✅ Тестировать базовые арифметические операции Python
- ✅ Валидировать доступ к DOM API
- ✅ Проверить доступ к системной информации Python
- ✅ Тестировать обработку ошибок и invalid Python code
- ✅ Настроить загрузку Pyodide через CDN
- ✅ Реализовать comprehensive логирование и сбор результатов

## 📁 Структура файлов

```
chrome-extension/public/
├── test-scripts/
│   └── pyodide-offscreen-manual-test.js  # Основной тестовый модуль
├── test-pyodide-offscreen-manual.html     # Интерфейс для тестирования
└── offscreen.js                          # Расширен для поддержки тестирования
```

## 🚀 Быстрый старт

### 1. Открыть тестовую страницу

```bash
# В браузере открыть:
chrome-extension://[YOUR_EXTENSION_ID]/public/test-pyodide-offscreen-manual.html
```

Где `[YOUR_EXTENSION_ID]` заменить на ID вашего расширения Chrome.

### 2. Запустить тестирование

1. Нажать кнопку **"▶️ Начать ручное тестирование"**
2. Дождаться завершения всех тестов
3. Просмотреть результаты в интерфейсе

### 3. Ручное использование

Также можно использовать API напрямую в консоли браузера:

```javascript
// Запуск тестирования
startPyodideManualTest().then(result => {
    console.log('Результаты тестирования:', result);
});

// Получение статистики (если тестирование активно)
console.log(getPyodideTestStats());
```

## 🧪 Тестовые сценарии

### Сценарии execução

1. **offscreen_creation**: Проверка создания offscreen document с safety checks
2. **pyodide_initialization**: Инициализация Pyodide runtime
3. **basic_calculation**: Базовые арифметические операции (`1 + 2 + 3`)
4. **system_access**: Доступ к системной информации (`import sys; sys.version`)
5. **dom_access**: Доступ к DOM API (`document.title`)
6. **web_api_manipulation**: Создание и управление DOM элементами
7. **error_handling**: Тестирование обработки Python ошибок

### Конкретные тесты Python кода

| Сценарий | Python код | Ожидаемый результат |
|----------|-----------|-------------------|
| Базовая математика | `1 + 2 + 3` | `6` |
| Системная информация | `import sys; sys.version` | Версия Python |
| DOM доступ | `document.title` | Заголовок страницы |
| Создание DOM элемента | Создание div элемента | Успешное создание |
| Синтаксическая ошибка | `print("Missing parenthesis)` | Ошибка синтаксиса |
| Undefined переменная | `print(unknown_variable)` | NameError |
| Import ошибка | `import nonexistent_module` | ModuleNotFoundError |

## 📊 Результаты тестирования

### Условия успеха

- ✅ **Успешность >= 80%** всех тестов
- ✅ Критические компоненты работают:
  - offscreen document создается
  - Pyodide инициализируется
- ✅ Python код исполняется корректно
- ✅ DOM API доступны из Python
- ✅ Ошибки Python обрабатываются правильно

### Формат результатов

```javascript
{
  success: true,
  results: [
    {
      test: "basic_calculation",
      status: "PASSED",
      result: "6",
      executionTime: 15
    }
  ],
  logs: [...],
  summary: {
    total: 8,
    passed: 7,
    failed: 1,
    successRate: 87.5,
    criticalTestsOk: true,
    architectureReady: true
  }
}
```

## 🔧 API тестирования

### Класс PyodideOffscreenManualTester

```javascript
const tester = new PyodideOffscreenManualTester();

// Запуск полного тестирования
await tester.startManualTesting();

// Получение результатов
const results = tester.getTestResults();

// Результаты в консоль
tester.logResultsToConsole();
```

### Глобальные функции

```javascript
// Быстрый запуск тестирования
startPyodideManualTest();

// Статистика тестирования
getPyodideTestStats();
```

## 🛡️ Safety Checks

### Проверки перед созданием

1. **Offscreen API Support**: Поддержка Offscreen API в версии Chrome
2. **Chrome Version Check**: Версия Chrome >= 109
3. **Memory Usage Check**: Доступность информации о памяти
4. **Permission Check**: Наличие необходимых разрешений

### Fallback Behavior

- **Chrome < 109**: Блокировка тестирования с предупреждением
- **Offscreen API недоступен**: Сообщение об ошибке
- **Pyodide ошибка инициализации**: Откат тестирования

## 📝 Логирование

### Уровни логирования

- **INFO**: Общая информация о ходе тестирования
- **SUCCESS**: Успешное завершение операций
- **ERROR**: Ошибки выполнения
- **CRITICAL**: Критические ошибки (останавливают тестирование)
- **WARNING**: Предупреждения
- **DEBUG**: Детальная отладочная информация

### Формат логов

```
[timestamp] [LEVEL] Message with details
[14:30:25] [INFO] ШАГ 1: Проверка/создание offscreen document...
[14:30:27] [SUCCESS] Offscreen document успешно создан
[14:30:28] [INFO] ШАГ 2: Инициализация Pyodide в offscreen document...
```

## 🚨 Возможные проблемы

### Chrome версия слишком старая

```
❌ Offscreen API не поддерживается в данной версии Chrome
Требуется Chrome 109+ для работы с offscreen document
```

### Ошибки инициализации Pyodide

```
❌ Pyodide initialization отказано: NetworkError
Проверьте подключение к интернету и доступность CDN
```

### Ошибки загрузки ресурсов

```
❌ Failed to load Pyodide resources
Проверьте наличие файлов pyodide.js, pyodide.wasm и т.д.
```

## 🐛 Отладка

### Открыть Developer Console

1. Нажать `F12` или `Ctrl+Shift+I`
2. Перейти на вкладку **Console**
3. Ввести команды для ручного тестирования

### Проверка состояния компонентов

```javascript
// Проверить существование функций тестирования
console.log(window.startPyodideManualTest);
console.log(window.getPyodideTestStats);

// Проверить поддержку API в браузере
console.log(typeof chrome?.offscreen);
console.log(navigator.userAgent.match(/Chrome\/(\d+)/));
```

### Детальное логирование

```
# Включить verbose режим в консоли
localStorage.setItem('pyodide-debug', 'true');

# После внесения изменений перезагрузить extension
chrome.runtime.reload();
```

## 📈 Производительность

### Среднее время выполнения

- **offscreen document создание**: 200-500ms
- **Pyodide инициализация**: 2-5 сек
- **Отдельный Python тест**: 10-50ms
- **Полное тестирование**: 8-15 сек

### Оптимизация

1. **Lazy loading**: Pyodide загружается только по необходимости
2. **Connection pooling**: Многократное использование созданного offscreen document
3. **Batch testing**: Группировка тестов для уменьшения накладных расходов

## 🔄 Интеграция с существующей системой

### Коммуникация через background script

```
UI (тестовая страница) → Background Script → Offscreen Document → Pyodide
                     ↑                          ↑
                     ←──────────────────────────↓
```

### Типы сообщений

- `INITIALIZE_PYODIDE_MANUAL_TEST`: Инициализация для тестирования
- `EXECUTE_PYTHON_TEST_CODE`: Запуск Python кода для тестирования
- `EXECUTE_PYTHON_ERROR_TEST`: Тестирование обработки ошибок

### Соответствие существующей архитектуре

- ✅ Использует существующий offscreen document механизм
- ✅ Интегрируется с PyodideManager классом
- ✅ Соблюдает правила коммуникации через background
- ✅ Не нарушает существующую работу extension

## 🤝 Использование в реальных сценариях

### Development workflow

1. **Разработка**: Увеличивать тестовые сценарии по мере разработки
2. **Testing**: Запуск перед релизом версии
3. **Debugging**: Использование логов для диагностики проблем
4. **Performance**: Мониторинг времени выполнения тестов

### Production monitoring

```javascript
// Интеграция в production код для мониторинга
const healthCheck = await fetch('/extension-health')
  .then(() => startPyodideManualTest())
  .then(result => {
    if (!result.success || result.summary.successRate < 80) {
      alert('Pyodide architecture issue detected!');
    }
    return result;
  });
```

## 📞 Поддержка

### Вопросы и проблемы

1. **GitHub Issues**: Создать issue с описанием проблемы
2. **Console Logs**: Включить детальное логирование
3. **Version Check**: Проверить совместимую версию Chrome
4. **Network Check**: Проверить доступность CDN ресурсов

### Лучшие практики

- ✅ Всегда проверять консоль на ошибки
- ✅ Использовать современную версию Chrome (>= 109)
- ✅ Следить за лимитами памяти браузера
- ✅ Мониторить время выполнения тестов
- ✅ Регулярно очищать localStorage с debug настройками

---

**Версия**: 1.0.0
**Дата**: Декабрь 2024
**Совместимость**: Chrome 109+
**Тестирование**: Offscreen Document API required