# Интеграционный тест Offscreen Document архитектуры

## 📋 Обзор

Этот каталог содержит полную систему интеграционного тестирования для проверки новой Offscreen Document архитектуры браузерного расширения. Тест проверяет все ключевые компоненты без изменения продакшен кода.

## 🎯 Что тестируется

### 1. Build & Load
- ✅ Доступность Chrome extension APIs
- ✅ Наличие manifest.json и основных разрешений
- ✅ Загрузка расширения без ошибок

### 2. Offscreen Document
- ✅ Создание Offscreen Document через chrome.offscreen.createDocument()
- ✅ Проверка наличия документа через chrome.offscreen.hasDocument()
- ✅ Правильная инициализация с Pyodide.js и offscreen.js

### 3. Message Flow
- ✅ Двусторонняя связь background ↔ offscreen через chrome.runtime.sendMessage()
- ✅ Обработка асинхронных ответов
- ✅ Таймауты и обработка ошибок

### 4. Pyodide Ready
- ✅ Загрузка Pyodide runtime из CDN
- ✅ Инициализация Python интерпретатора
- ✅ Загрузка пакетов (numpy, pandas)
- ✅ Выполнение Python кода через runPythonAsync()

### 5. Workflow Execution
- ✅ Делегирование выполнения в Offscreen Document
- ✅ Обработка workflow через WorkflowEngine
- ✅ Интеграция с Pyodide для Python инструментов
- ✅ Логирование и мониторинг выполнения

## 🚀 Как запустить тестирование

### Вариант 1: Полное веб-интерфейс тестирование

1. **Подготовьте расширение:**
   ```bash
   # Сборка расширения
   npm run build
   # Расширение готово в chrome-extension/dist/
   ```

2. **Загрузите расширение в Chrome:**
   - Откройте `chrome://extensions/`
   - Включите "Developer mode"
   - Нажмите "Load unpacked"
   - Выберите папку `chrome-extension/dist/`

3. **Запустите тест:**
   - Откройте в браузере: `chrome-extension://<extension-id>/public/test-scripts/integration-test.html`
   - Или в консоли: `new OffscreenDocumentIntegrationTest().runAllTests()`

### Вариант 2: Автоматическое тестирование через терминал

```javascript
// В Chrome DevTools консоли расширения
const test = new OffscreenDocumentIntegrationTest();
await test.runAllTests();
```

### Вариант 3: Интеграция в CI/CD

```bash
# В headless режиме (требует puppeteer)
npm run test:integration
```

## 📁 Структура файлов

```
chrome-extension/public/test-scripts/
├── integration-test.html        # Веб-интерфейс для тестирования
├── integration-test.js         # Основная логика тестирования
├── integration-test-helpers.js # Helper'ы для тестовых сообщений
└── README.md                   # Эта документация
```

## 🔧 API тестового интерфейса

### Класс OffscreenDocumentIntegrationTest

```javascript
const test = new OffscreenDocumentIntegrationTest();

await test.runAllTests(); // Запуск всего теста
// или по отдельности:
await test.testBuildAndLoad();
await test.testOffscreenDocument();
await test.testMessageFlow();
await test.testPyodideReady();
await test.testWorkflowExecution();
```

### Тестовые сообщения

Тест отправляет следующие типы сообщений для проверки различных компонентов:

- `TEST_SYNC` - синхронное тестовое сообщение
- `GET_PYODIDE_STATUS` - проверка статуса Pyodide
- `EXECUTE_PYTHON_CODE` - выполнение Python кода
- `GET_WORKFLOW_STATUS` - статус workflow системы
- `EXECUTE_TEST_WORKFLOW` - запуск тестового workflow
- `GET_WORKFLOW_LOGS` - получение логов выполнения

## 📊 Отчет о готовности

После выполнения тестов генерируется детальный отчет с:

- ✅ **Success Count** - количество успешных проверок
- ⚠️ **Warnings** - предупреждения о потенциальных проблемах
- ❌ **Errors** - критические проблемы требующие исправления
- 📈 **Readiness Score** - общая оценка готовности системы (0-100%)

### Интерпретация результатов

- **80-100%** 🟢 - Система готова к продакшену
- **60-79%** 🟡 - Есть проблемы, требующие доработок
- **0-59%** 🔴 - Критические проблемы, требуется серьезная доработка

## 🎮 Ручное тестирование

### Тестирование в веб-интерфейсе

1. **Открыть** `integration-test.html` в расширении
2. **Нажать** "🚀 Запустить полный тест"
3. **Следить** за логами в реальном времени
4. **Анализировать** сводку результатов

### Тестирование в консоли

```javascript
// Создание тестового оффскрин документа
await chrome.offscreen.createDocument({
  url: 'offscreen.html',
  reasons: ['WORKERS'],
  justification: 'Testing Offscreen Document integration'
});

// Проверка наличия
const exists = await chrome.offscreen.hasDocument();
console.log('Offscreen document exists:', exists);

// Тестовое сообщение
chrome.runtime.sendMessage({ type: 'TEST_SYNC' }, response => {
  console.log('Test response:', response);
});
```

## 🔒 Безопасность

- ✅ **НЕ изменяет продакшен код**
- ✅ **Только добавляет тестовые компоненты**
- ✅ **Изолированное выполнение**
- ✅ **Бесплатный откат**

## 📈 Мониторинг и отладка

### Логи тестирования

Тест записывает детальные логи всех операций:
- В Console браузера с префиксом `[TEST]`
- Во внутренний массив результатов `this.results`
- С timestamp'ами и уровнями важности

### Окна отладки

```javascript
// Получить объект Offscreen документа для отладки
console.log(window.offscreenDebug);

// Получить статистику тестовая
console.log(integrationTest.getStats());
```

## 🛠️ Расширение тестов

### Добавление новых проверок

```javascript
// Добавить новый тест в class OffscreenDocumentIntegrationTest
async testCustomFeature() {
  this.logger.info('Начат тест кастомной фичи');

  try {
    // Ваша логика тестирования
    const result = await someCustomTest();

    if (result.success) {
      this.logger.success('Кастомная фича работает корректно', result.data);
    } else {
      this.logger.warning('Кастомная фича имеет проблемы', result);
    }
  } catch (error) {
    this.logger.error('Тест кастомной фичи провален', error);
  }
}

// И вызвать в runAllTests()
await this.testCustomFeature();
```

### Добавление тестовых сообщений

В `integration-test-helpers.js` добавить обработчик:

```javascript
handleCustomTest(data, sendResponse) {
  // Логика обработки кастомного тестового сообщения
}
```

## 🎯 Readiness Criteria

Тест проверяет все требования к готовности системы:

- ✅ Extension успешно собирается
- ✅ Offscreen document загружается
- ✅ Message flow работает
- ✅ Pyodide инициализация работает
- ✅ Workflow execution работает

## 📞 Поддержка

При проблемы с тестированием:

1. Проверьте консоль браузера на ошибки
2. Убедитесь, что расширение правильно загружено
3. Проверьте манифест на наличие необходимых разрешений
4. Убедитесь, что Pyodide доступен по заданному URL

## 🔄 Обновление тестов

При изменении архитектуры обновите соответствующие тесты:
- Изменение Message API -> обновить обработчики в helpers
- Новые workflow функции -> добавить тесты в testWorkflowExecution
- Изменение Pyodide интеграции -> обновить testPyodideReady

---

**Готовность системы определяется автоматической оценкой по результатам всех тестов.**
**Рекомендуется запускать полный тест перед каждым релизом расширений.**