# Система Мониторинга Ozon Analyzer

Это comprehensive система мониторинга для плагина Ozon Analyzer, обеспечивающая полное покрытие всех критических компонентов в production среде.

## Архитектура Мониторинга

```
┌─────────────────────────────────────────────────┐
│               Monitoring Core                   │
│   ┌─────────────────────────────────────────┐   │
│   │        Error Tracker                     │   │
│   │   - Runtime Error Capture              │   │
│   │   - Pattern Analysis                    │   │
│   │   - Error Rate Monitoring              │   │
│   └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│   ┌─────────────────────────────────────────┐   │
│   │        Performance Monitor              │   │
│   │   - Workflow Execution Times            │   │
│   │   - Pyodide Worker Performance          │   │
│   │   - AI API Response Times               │   │
│   └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│   ┌─────────────────────────────────────────┐   │
│   │        Network Tracker                  │   │
│   │   - HTTP Request Monitoring             │   │
│   │   - Response Time Tracking              │   │
│   │   - Failure Pattern Analysis            │   │
│   └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│   ┌─────────────────────────────────────────┐   │
│   │        Alert System                     │   │
│   │   - Threshold-based Alerts              │   │
│   │   - Escalation Rules                    │   │
│   │   - Custom Alert Templates              │   │
│   └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Ключевые Возможности

### 1. Runtime Error Capture
- ✅ Автоматическое логирование всех ошибок в цепочках выполнения
- ✅ Классификация ошибок по степени критичности
- ✅ Pattern analysis для выявления повторяющихся проблем
- ✅ Контекстная информация (stack traces, timestamps, user data)

### 2. Pyodide Worker Monitoring
- ✅ Отслеживание здоровья Python среды
- ✅ Мониторинг жизненного цикла worker процессов
- ✅ Контроль потребления памяти Pyodide
- ✅ Автоматический restart при падениях

### 3. AI API Monitoring
- ✅ Мониторинг API rate limits и квот
- ✅ Слежение за сбоев и fallback механизмами
- ✅ Измерение времени отклика и успеха запросов
- ✅ Статистика использования токенов

### 4. Network Request Tracking
- ✅ Логирование всех внешних HTTP запросов
- ✅ Метрики timing и success/failure
- ✅ Детекция сетевых проблем
- ✅ Анализ паттернов ошибок соединения

### 5. Performance Metrics
- ✅ Захват времени выполнения workflow шагов
- ✅ Метрики производительности Pyodide
- ✅ Мониторинг использования системных ресурсов
- ✅ Квантильные метрики (P50, P95, P99)

### 6. Memory Usage Tracking
- ✅ Мониторинг потребления памяти Pyodide
- ✅ Предупреждения о приближении к лимитам
- ✅ Auto GC monitoring и optimization
- ✅ Memory leak detection

### 7. HTML Extraction Monitoring
- ✅ Отслеживание успешности парсинга DOM
- ✅ Качество извлекаемых данных
- ✅ Трейсинг селекторов CSS
- ✅ Анализ полноты и точности данных

## Интеграция с Компонентами

### Workflow Engine
```javascript
// Имеет встроенную интеграцию с мониторингом
const result = await runWorkflow('ozon-analyzer', input);
```

### MCP Bridge
```javascript
// Автоматическое отслеживание Python вызовов
const result = await runPythonTool('ozon-analyzer', 'analyze_ozon_product', inputData);
```

### Host API
```javascript
// Мониторинг AI API вызовов
const response = await hostApi.llm_call('gemini-flash', { prompt: 'Analyze this product...' });
```

## Конфигурация Production

Файл `production-config.json` содержит все настройки для production использования:

```json
{
  "monitoring": {
    "enabled": true,
    "production": true,
    "sampling": {
      "error_events": 1.0,
      "performance_metrics": 0.1,
      "network_requests": 0.3
    }
  }
}
```

## Алерты и Оповещения

### Предопределенные Правила Алертов

1. **Pyodide Memory Usage**
   - Порог: 256MB
   - Уровень: MEDIUM
   - Действие: Автоматическая оптимизация памяти

2. **Workflow Timeout**
   - Порог: 300 секунд
   - Уровень: HIGH
   - Действие: Force termination

3. **AI API Failure Rate**
   - Порог: 10%
   - Уровень: HIGH
   - Действие: Fallback to alternative provider

4. **Consecutive Failures**
   - Порог: 5 подряд
   - Уровень: CRITICAL
   - Действие: Emergency restart

### Коды Статусов Алертов

- `LOW`: Информационное оповещение
- `MEDIUM`: Требует внимания
- `HIGH`: Критическое предупреждение
- `CRITICAL`: Немедленное вмешательство

## Метрики и Статистика

### Доступные Метрики

#### Counters
- `errors_total` - Общее количество ошибок
- `requests_total` - Общее количество запросов
- `ai_tokens_used` - Потраченные токены AI

#### Gauges
- `pyodide_memory_used_mb` - Используемая память Pyodide
- `active_connections` - Активные сетевые соединения
- `worker_health_score` - Оценка здоровья worker

#### Histograms
- `request_duration_seconds` - Время выполнения запросов
- `workflow_step_duration` - Время выполнения шагов workflow
- `pyodide_execution_time` - Время выполнения Python кода

## Диагностика и Отладка

### Режимы Логирования

```javascript
import { getMonitoringCore } from './monitoring/index.js';

const monitor = getMonitoringCore();

// Включение детального логирования
monitor.getLogger().setLevel('DEBUG');

// Получение логов за период
const logs = monitor.getLogger().getLogs({
  level: 'ERROR',
  fromTime: Date.now() - 3600000, // последний час
  component: 'workflow_engine'
});

// Экспорт логов для анализа
const logExport = monitor.getLogger().exportLogs({
  format: 'json',
  includeStackTraces: true,
  maxEntries: 1000
});
```

### Health Check Эндпоинты

```javascript
// Проверка здоровья всей системы
const systemHealth = monitor.getHealthStatus();
// { status: 'healthy' | 'degraded' | 'unhealthy', issues: [...] }

// Статистика компонентов
const workflowStats = monitor.getPerformanceMonitor().getPerformanceStats();
const networkStats = monitor.getNetworkTracker().getNetworkStats();
const aiStats = monitor.getErrorTracker().getErrorStats();
```

## Производительность

### Оптимизации

1. **Семплинг Метрик**
   - Performance metrics: 10% сэмплирование
   - Network requests: 50% сэмплирование
   - Error events: 100% (всегда)

2. **Пакетный Логирование**
   - Буферизация логов для batch обработки
   - Asynchronous log shipping
   - Compression для экономии трафика

3. **Memory Management**
   - Automagic cleanup старых данных
   - Efficient data structures
   - Garbage collection monitoring

## Безопасность

### Защита Данных

- Логирование чувствительных данных отключено по умолчанию
- Token masking в logs
- Rate limiting для API calls
- Encryption для persisted data

### Audit Trail

- Все действия мониторинга логируются
- Timestamp verification
- User/context tracking
- Immutable log entries

## Troubleshooting

### Стандартные Проблемы

1. **Высокое Потребление Памяти**
   ```
   Проверьте: monitoring.getMetricsCollector().getMetric('pyodide_memory_used_mb');
   Решение: Restart Pyodide worker или garbage collection
   ```

2. **Частые Ошибки AI API**
   ```
   Проверьте: monitoring.getErrorTracker().getErrorRate();
   Решение: Проверить rate limits или сменить провайдера
   ```

3. **Медленное Выполнение Workflow**
   ```
   Проверьте: monitoring.getPerformanceMonitor().getPerformanceStats();
   Решение: Оптимизировать bottleneck компоненты
   ```

### Emergency Procedures

```javascript
// Полная очистка логов в случае переполнения
monitor.getLogger().clearLogs();

// Force restart Pyodide worker
import { restartWorker } from './bridge/worker-manager.js';
restartWorker();

// Полная очистка метрик
monitor.getMetricsCollector().clearMetrics();

// Emergency mode: отключение не-критичных компонентов
monitor.getLogger().setLevel('ERROR');
```

## Расширение и Кастомизация

### Добавление Новых Метрик

```javascript
// Добавление кастомной метрики
monitor.getMetricsCollector().recordHistogram('custom_operation_time', duration, {
  operation: 'my_custom_op',
  user_id: currentUser.id
});
```

### Создание Custom Алертов

```javascript
// Добавление кастомного правила алерта
monitor.getAlertManager().addAlertRule({
  name: 'Custom Alert',
  condition: {
    metric: 'my_custom_metric',
    operator: '>',
    threshold: 100,
    duration: 300
  },
  severity: 'MEDIUM',
  enabled: true
});
```

## Поддержка и Обслуживание

### Regular Maintenance

1. Очистка старых логов (weekly)
2. Обновление конфигураций алертов
3. Мониторинг производительности мониторинга
4. Обновление thresholds на основе исторических данных

### Support Information

- Version: 1.1.0
- Platform: Chrome Extension
- Compatible with Pyodide v0.24+
- Support for multiple AI providers

---

**Примечание**: Система мониторинга разработана для production использования с акцентом на надежность, производительность и наблюдаемость. Все компоненты протестированы в условиях высокой нагрузки и готовы к использованию в production среде.