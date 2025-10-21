# 🔬 Ozon Analyzer E2E Testing Guide
## Руководство по проведению полного end-to-end тестирования workflow

### Обзор
Данный инструмент обеспечивает полное отслеживание жизненного цикла Ozon Analyzer workflow от пользовательского клика до финальных результатов Python execution в production условиях.

---

## 🛠️ Быстрый Старт

### 1. Установка Metrics Collector

```javascript
// Вставьте этот код в консоль браузера или background script
import('./tools/ozon-analyzer-e2e-metrics-collector.js').then(({ E2EMetricsCollector }) => {
    window.metricsCollector = new E2EMetricsCollector();
    window.metricsCollector.startWorkflowTracking();
    console.log('📊 Metrics Collector activated');
});
```

### 2. Базовое использование

```javascript
// Запуск отслеживания
const collector = window.metricsCollector;

// Ручная маркировка фаз (опционально)
collector.recordPhaseStart('user_interaction', { pageUrl: window.location.href });
collector.recordPhaseEnd('user_interaction', { buttonClicked: true });

// Генерация отчета
const report = collector.generateReport();
console.log('📋 E2E Report:', report);
```

---

## 📊 Собираемые Метрики

### Timeline Tracking
- ✅ **Время инициализации** offscreen document (BG→OD)
- ✅ **Время загрузки Pyodide** engine (OD→PY)
- ✅ **Время DOM парсинга** (FastDOMParser execution)
- ✅ **Время AI вызовов** (Gemini/HuggingFace roundtrips)
- ✅ **Общее время workflow** (от клика до результата)

### Memory Monitoring
- ✅ **До и после** каждой фазы выполнения
- ✅ **Delta calculations** для выявления утечек
- ✅ **Peak memory usage** tracking
- ✅ **Memory efficiency** analysis

### Message Flow Analysis
- ✅ **Все Chrome extension messages** interceptions
- ✅ **Response time analysis** между компонентами
- ✅ **Error propagation tracking** по всему workflow
- ✅ **Message bottleneck detection**

---

## 🎯 Тестовые Сценарии

### Сценарий 1: Базовый анализ товара
```javascript
// Тест страницы: https://www.ozon.ru/product/krem-dlya-kozhi-litsa-anticell-anti-age-s-vitaminom-c-na-50ml-1sht-414100123
// Ожидаемый результат: Успешный разбор товара без deep analysis

const testCase1 = {
    pageUrl: 'https://www.ozon.ru/product/...',
    expectedDurationMax: 5000, // 5 секунд
    expectedPhases: ['initialization', 'pyodide_init', 'html_parsing', 'ai_processing', 'result_processing'],
    expectedResults: {
        description: '✓ Извлечение описания',
        composition: '✓ Извлечение состава',
        analysis: '✓ AI анализ соответствия',
        analogs: '✓ Поиск аналогов'
    }
};
```

### Сценарий 2: Анализ с deep analysis
```javascript
// Тест страницы: Товар с несоответствием описания/состава (>70% score)
// Ожидаемый результат: Автоматический запуск deep analysis

const testCase2 = {
    pageUrl: 'https://www.ozon.ru/product/problematic-product',
    expectedDeepAnalysis: true,
    expectedPhases: ['initialization', 'pyodide_init', 'html_parsing', 'ai_processing', 'deep_analysis', 'result_processing'],
    expectedDurationMin: 8000 // Минимально 8 секунд
};
```

### Сценарий 3: Обработка ошибок
```javascript
// Тест страницы: Устаревшая/невалидная структура HTML
// Ожидаемый результат: Graceful degradation с error recovery

const testCase3 = {
    pageUrl: 'https://www.ozon.ru/product/old-format-product',
    expectedFallbackBehavior: true,
    expectedErrorHandling: true,
    expectedDurationTolerance: 15000 // Увеличенная толерантность к ошибкам
};
```

---

## 📋 Чек-лист Ручного Тестирования

### Предварительная подготовка
- [ ] ✅ Очистить browser cache и cookies
- [ ] ✅ Проверить версию Chrome (>= 109 для offscreen support)
- [ ] ✅ Убедиться в наличии интернет-соединения
- [ ] ✅ Инжектировать metrics collector в popup/content script

### ЭТАП 1: Инициация Workflow
- [ ] ✅ Открыть тестовую страницу товара Ozon
- [ ] ✅ Подождать полной загрузки страницы (DOM ready)
- [ ] ✅ Кликнуть кнопку "Запустить" в Ozon Analyzer плагине
- [ ] ✅ Проверить что popup отображается корректно
- [ ] ✅ Подтвердить отправку RUN_WORKFLOW сообщения (в console log)
- [ ] ✅ Проверить время инициализации background script (< 500ms)

### ЭТАП 2: Offscreen Document Setup
- [ ] ✅ Проверить создание offscreen document
- [ ] ✅ Подтвердить загрузку Pyodide (~3-5 секунд)
- [ ] ✅ Проверить инициализацию JS-Python bridge
- [ ] ✅ Подтвердить загрузку workflow.json
- [ ] ✅ Проверить загрузку mcp_server.py инструментов

### ЭТАП 3: HTML Extraction
- [ ] ✅ Проверить извлечение HTML активной вкладки
- [ ] ✅ Подтвердить успешное выполнение FastDOMParser
- [ ] ✅ Проверить извлечение основных полей товара:
  - [ ] Название товара
  - [ ] Описание
  - [ ] Состав/ингредиенты
  - [ ] Категории
  - [ ] Цена и рейтинг

### ЭТАП 4: Python инструменты Execution
- [ ] ✅ Выполнить `analyze_ozon_product` функцию
- [ ] ✅ Проверить параллельное выполнение AI вызовов
- [ ] ✅ Подтвердить успешную работу batch processing
- [ ] ✅ Проверить работу memory management (GC optimization)
- [ ] ✅ Проверить кеширование AI ответов

### ЭТАП 5: Условная логика (run_if)
- [ ] ✅ Оценить условия run_if выражения
- [ ] ✅ Если score > 7: SKIP deep analysis
- [ ] ✅ Если score ≤ 7: TRIGGER deep analysis
- [ ] ✅ Проверить резрешении template выражений ({{...}})
- [ ] ✅ Подтвердить корректную передачу данных между шагами

### ЭТАП 6: Deep Analysis (при необходимости)
- [ ] ✅ Запустить `perform_deep_analysis` (Gemini Pro)
- [ ] ✅ Проверить специальные промпты для medical/scientific analysis
- [ ] ✅ Подтвердить более высокое качество анализа
- [ ] ✅ Проверить интеграцию результатов с базовым анализом

### ЭТАП 7: Result Processing
- [ ] ✅ Проверить формирование финального отчета
- [ ] ✅ Подтвердить сохранение результатов в plugin chat
- [ ] ✅ Проверить отображение результатов в UI
- [ ] ✅ Проверить сериализацию для export

### ЭТАП 8: Очистка и финализация
- [ ] ✅ Проверить завершение всех асинхронных операций
- [ ] ✅ Подтвердить сброс состояния для следующих запусков
- [ ] ✅ Проверить память освобождена корректно (no leaks)
- [ ] ✅ Проверить что все ресурсы освобождены

---

## 🔍 Диагностика Проблем

### Общие проблемы и решения

#### ❌ Offscreen API недоступен
```
Решение: Обновить Chrome до версии 109+
Альтернатива: Использовать fallback режим для старых версий
```

#### ❌ Pyodide не загружается
```
Проверки:
 - Сеть: Проверить доступ к pyodide.org
 - CORS: Убедиться что политика позволяет загрузку
 - Memory: Проверить доступную RAM (минимум 512MB)
```

#### ❌ Message flow прерывается
```
Диагностика:
 - В console: Проверить последовательность WORKFLOW_* сообщений
 - Timeline: Анализировать message response times
 - Errors: Проверить error propagation по стеку
```

#### ❌ Python execution fails
```
Проверки:
 - JS Bridge: Проверить pyodide.isPyodideReady
 - Imports: Убедиться что все Python модули доступны
 - Memory: Проверить Pyodide memory constraints
```

---

## 📈 Генерация Отчета

### Автоматическая генерация
```javascript
const report = window.metricsCollector.generateReport();

// Экспорт в JSON для анализа
const reportJson = JSON.stringify(report, null, 2);

// Скачивание файла
const blob = new Blob([reportJson], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `ozon-analyzer-e2e-report-${Date.now()}.json`;
a.click();
```

### Структура отчета

#### Summary Section
```json
{
  "summary": {
    "totalDuration": 2847.23,
    "totalMessages": 15,
    "totalErrors": 0,
    "phases": 5,
    "timelineEvents": 23
  }
}
```

#### Performance Analysis
```json
{
  "performance": {
    "pyodide_init": {
      "duration": 3450.67,
      "startTime": 1250.34,
      "efficiency": 78.5
    }
  }
}
```

#### Memory Usage
```json
{
  "memory": {
    "peakUsage": 52428800,
    "averageUsage": 31457280,
    "timeline": [/* memory points over time */]
  }
}
```

#### Recommendations
```json
{
  "recommendations": [
    {
      "type": "performance",
      "priority": "medium",
      "title": "Оптимизация Pyodide загрузки",
      "description": "Время инициализации превышает 3 секунды",
      "suggestion": "Рассмотреть precaching Pyodide runtime"
    }
  ]
}
```

---

## 🎯 Ключевые Метрики Производительности

| Этап | Целевое время | Критический порог | Рекомендация при превышении |
|------|---------------|-------------------|-----------------------------|
| Инициализация | < 500ms | > 2000ms | Оптимизация background script loading |
| Pyodide загрузка | < 3000ms | > 8000ms | Precaching или CDN optimization |
| HTML парсинг | < 100ms | > 500ms | Оптимизация FastDOMParser regex |
| AI processing | < 2000ms | > 6000ms | Использование batch requests |
| Deep analysis | < 3000ms | > 10000ms | Fallback на базовый анализ |
| **Общее время** | **< 8000ms** | **> 15000ms** | **Архитектурная оптимизация** |

---

## 🐛 Debugging Команды

```javascript
// Детальная информация о текущем состоянии
console.log('🔍 Debug Info:', window.metricsCollector.getDebugInfo());

// Показать все timeline события
window.metricsCollector.metrics.timeline.forEach(event => {
    console.log(`[${event.performanceTime.toFixed(2)}ms] ${event.type}:`, event.details);
});

// Показать сообщения с задержками > 1000ms
const slowMessages = window.metricsCollector.metrics.messages.filter(msg => {
    const nextMsg = window.metricsCollector.metrics.messages[window.metricsCollector.metrics.messages.indexOf(msg) + 1];
    return nextMsg && (nextMsg.performanceTime - msg.performanceTime) > 1000;
});
console.table(slowMessages);

// Очистить метрики (новый тест)
window.metricsCollector = new E2EMetricsCollector();
```

---

## 📚 API Reference

### `E2EMetricsCollector` Class

#### Методы
- `startWorkflowTracking()` - Запуск отслеживания всего workflow
- `recordPhaseStart(name, details)` - Маркировка начала фазы
- `recordPhaseEnd(name, results)` - Маркировка окончания фазы
- `recordPerformanceMetric(comp, key, val)` - Запись произвольной метрики
- `recordError(error, context)` - Запись ошибки с контекстом
- `generateReport()` - Генерация полного отчета

#### Свойства
- `metrics.timeline[]` - Временная шкала событий
- `metrics.performance{}` - Метрики производительности по фазам
- `metrics.memory{}` - Статистика использования памяти
- `metrics.messages[]` - Все intercepted сообщения
- `metrics.errors[]` - История ошибок

---

## 🎉 Заключение

Данный инструмент обеспечивает **полное покрытие** всех этапов Ozon Analyzer workflow с автоматизированным сбором метрик производительности и анализом message flow. Используйте этот guide для проведения надежного end-to-end тестирования в production условиях.

### Быстрая проверка готовности:
- [ ] Metrics collector инжектирован
- [ ] Тестовая страница подготовлена
- [ ] Чек-лист ручного тестирования готов
- [ ] Анализ результатов настроен

**Время начала тестирования! 🚀**