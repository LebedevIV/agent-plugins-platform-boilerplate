# API Documentation - Ozon Analyzer Plugin

## 📡 Обзор API

Этот документ описывает все внешние интерфейсы, конфигурационные опции и точки интеграции плагина **Ozon Analyzer**. API разработано для простоты использования и высокой производительности.

## 🌐 HTTP API Endpoints

### Health Checks

#### GET `/health`
Базовая проверка здоровья системы.

**Response:**
```json
{
  "overall_status": "healthy",
  "timestamp": "2024-01-01T10:00:00Z",
  "version": "1.0.0",
  "uptime_seconds": 3600000
}
```

#### GET `/health/detailed`
Детальная диагностика системы.

**Response:**
```json
{
  "overall_status": "healthy",
  "components": {
    "workflow_engine": {
      "status": "healthy",
      "response_time_ms": 45
    },
    "pyodide_worker": {
      "status": "healthy",
      "memory_mb": 125
    }
  },
  "performance": {
    "average_execution_time_seconds": 8.7,
    "success_rate_percent": 100.0
  }
}
```

#### GET `/health/plugin/ozon-analyzer`
Проверка здоровья конкретного плагина.

### Analysis Endpoints

#### POST `/api/analysis/product`
Основная точка входа для анализа товара Ozon.

**Request:**
```json
{
  "url": "https://ozon.ru/product/xyz123",
  "page_html": "<html>...</html>",
  "options": {
    "deep_analysis": true,
    "timeout_seconds": 30
  }
}
```

**Response:**
```json
{
  "status": "success",
  "analysis_id": "abc-123-def",
  "timestamp": "2024-01-01T10:00:00Z",
  "results": {
    "description": "Крем для увлажнения кожи",
    "composition": "Вода, гиалуроновая кислота...",
    "categories": ["Косметика", "Уход за кожей"],
    "analysis": {
      "score": 8.5,
      "reasoning": "Описание соответствует составу"
    }
  }
}
```

#### GET `/api/analysis/history`
История выполненных анализов.

**Query Parameters:**
- `limit` (number, optional): Количество записей (default: 50)
- `offset` (number, optional): Начальная позиция (default: 0)
- `status` (string, optional): Фильтр по статусу

**Response:**
```json
{
  "total": 1250,
  "offset": 0,
  "limit": 50,
  "items": [
    {
      "id": "abc-123-def",
      "timestamp": "2024-01-01T10:00:00Z",
      "url": "https://ozon.ru/product/xyz123",
      "status": "completed",
      "results": { ... }
    }
  ]
}
```

#### GET `/api/analysis/{id}`
Получение результатов конкретного анализа.

### Configuration Endpoints

#### GET `/api/config`
Текущая конфигурация системы.

#### PUT `/api/config`
Обновление конфигурации.

**Request:**
```json
{
  "monitoring": {
    "enabled": true,
    "sample_rate": 0.5
  },
  "ai_providers": {
    "fallback_threshold": 3
  }
}
```

### Cache Management

#### POST `/api/cache/clear/{type}`
Очистка кеша указанного типа.

**Path Parameters:**
- `type` (string): Тип кеша (`ai`, `memory`, `lru`)

**Response:**
```json
{
  "status": "success",
  "cache_type": "ai",
  "cleared_entries": 234
}
```

#### GET `/api/cache/status`
Статус всех кешей.

**Response:**
```json
{
  "caches": {
    "ai": {
      "size": 156,
      "max_size": 200,
      "hit_ratio_percent": 78.5
    },
    "memory": {
      "size": 45,
      "max_objects": 100,
      "reused_count": 1234
    }
  }
}
```

### Monitoring API

#### GET `/api/metrics/current`
Текущие метрики системы.

#### GET `/api/metrics/trend/{metric}`
Исторические данные по метрике.

**Path Parameters:**
- `metric` (string): Название метрики

**Query Parameters:**
- `period` (string): Период данных (`1h`, `24h`, `7d`, `30d`)

### Maintenance Endpoints

#### POST `/api/maintenance/restart`
Перезапуск компонентов системы.

#### POST `/api/maintenance/cleanup`
Очистка временных файлов и логов.

## 🔧 Plugin Configuration API

### Manifest Configuration

```javascript
interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main_server: string;
  host_permissions: string[];
  icon: string;
  permissions: string[];
  ai_models: Record<string, string>;
  settings: Record<string, any>;
}
```

### Workflow Configuration

```javascript
interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
  initialInput?: Record<string, any>;
}

interface WorkflowStep {
  id: string;
  description: string;
  tool: string;
  inputs: Record<string, string>;
  run_if?: string;
}
```

## 🤖 AI Models Configuration

### Model Mapping
```javascript
const aiModelMapping = {
  "basic_analysis": "gemini-flash",
  "detailed_comparison": "gemini-pro",
  "deep_analysis": "gemini-pro",
  "scraping_fallback": "gemini-flash"
};
```

### Provider Configuration
```javascript
const aiProviders = {
  google: {
    apiUrl: "https://generativelanguage.googleapis.com",
    models: {
      "gemini-flash": "models/gemini-1.5-flash",
      "gemini-pro": "models/gemini-1.5-pro"
    },
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 20
    }
  },
  openai: {
    apiUrl: "https://api.openai.com/v1",
    models: {
      "gpt-4o-mini": "gpt-4o-mini",
      "gpt-4": "gpt-4"
    },
    rateLimits: {
      requestsPerMinute: 50,
      requestsPerHour: 200,
      burstLimit: 10
    }
  }
};
```

## 📦 Python MCP Server API

### Core Functions

#### `analyze_ozon_product(input_data)`
Главная функция анализа товара.

**Parameters:**
- `input_data` (dict): Данные для анализа
  - `page_html` (string): HTML страница товара

**Returns:** Результаты анализа

#### `perform_deep_analysis(input_data)`
Функция глубокого анализа.

**Parameters:**
- `input_data` (dict): Данные для глубокого анализа
  - `description` (string): Описание товара
  - `composition` (string): Состав товара

**Returns:** Детальный анализ

### Internal Functions

#### `_analyze_composition_vs_description(description, composition)`
Анализ соответствия описания и состава.

#### `_call_ai_model(model_alias, prompt)`
Обертка для вызова AI модели.

#### `_find_similar_products(categories, composition)`
Поиск аналогичных продуктов.

## 🎛️ Configuration Options

### Production Configuration Schema
```json
{
  "$schema": "./production-config.schema.json",
  "name": "Ozon Analyzer Production Configuration",
  "version": "1.0.0",
  "monitoring": {
    "enabled": true,
    "production": true,
    "sampling": {
      "error_events": 1.0,
      "performance_metrics": 0.1,
      "memory_snapshots": 0.5
    }
  },
  "ai_providers": {
    "google": {
      "fallback_chain": ["gemini-flash", "gemini-pro"],
      "rate_limits": {
        "requests_per_minute": 60,
        "requests_per_hour": 1000
      }
    }
  },
  "workflow": {
    "timeout_seconds": 300,
    "max_concurrent_executions": 3
  },
  "pyodide": {
    "memory_limits": {
      "max_heap_mb": 512,
      "warning_threshold_mb": 384
    }
  }
}
```

### Environment Variables
```bash
# Required
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

# Optional
NODE_ENV=production
PORT=3000
LOG_LEVEL=WARN
MONITORING_ENABLED=true
DATADOG_API_KEY=your_datadog_key
```

## 🔗 Integration Points

### Workflow Engine Integration
```javascript
interface WorkflowEngineAPI {
  runWorkflow(pluginId: string): Promise<WorkflowResult>;
  validateWorkflow(workflow: WorkflowDefinition): Promise<boolean>;
  getWorkflowStatus(workflowId: string): Promise<WorkflowStatus>;
}
```

### Pyodide Bridge
```javascript
interface PyodideBridge {
  loadScript(scriptPath: string): Promise<PyodideInstance>;
  callFunction(functionName: string, args: any[]): Promise<any>;
  getStatus(): Promise<PyodideStatus>;
}
```

### AI Client Integration
```javascript
interface AIClient {
  call(model: string, prompt: string): Promise<string>;
  getAvailableModels(): Promise<string[]>;
  getHealth(): Promise<ServiceHealth>;
}
```

## 📊 Data Schemas

### Analysis Result Schema
```json
{
  "type": "object",
  "properties": {
    "description": { "type": "string" },
    "composition": { "type": "string" },
    "categories": {
      "type": "array",
      "items": { "type": "string" }
    },
    "analysis": {
      "type": "object",
      "properties": {
        "score": { "type": "number", "minimum": 0, "maximum": 10 },
        "reasoning": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "analogs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "price_range": { "type": "string" },
          "similarity_score": { "type": "number" }
        }
      }
    }
  }
}
```

### Error Response Schema
```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string", "enum": ["error"] },
    "message": { "type": "string" },
    "code": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "details": {
      "type": "object",
      "properties": {
        "step": { "type": "string" },
        "tool": { "type": "string" },
        "execution_time_ms": { "type": "number" }
      }
    }
  }
}
```

## 🔒 Authentication & Security

### API Key Management
```javascript
const apiKeyManager = {
  // Store encrypted keys
  async setApiKey(provider: string, key: string): Promise<void>,

  // Retrieve decrypted keys
  async getApiKey(provider: string): Promise<string>,

  // Validate key format and connectivity
  async validateApiKey(provider: string): Promise<boolean>,

  // Rotate keys on schedule
  async rotateKeys(): Promise<void>
};
```

### Rate Limiting
```javascript
const rateLimiter = {
  // Global limits
  globalLimits: {
    requestsPerMinute: 60,
    requestsPerHour: 1000
  },

  // Per-provider limits
  providerLimits: new Map([
    ['gemini', { rpm: 60, rph: 1000 }],
    ['openai', { rpm: 50, rph: 200 }]
  ]),

  // Check if request allowed
  isAllowed(provider: string): boolean,

  // Wait for rate limit to reset
  waitForReset(provider: string): Promise<void>
};
```

## 🚀 Usage Examples

### Basic Product Analysis
```javascript
async function analyzeProduct(url) {
  try {
    const response = await fetch('/api/analysis/product', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        options: {
          deep_analysis: false,
          timeout_seconds: 30
        }
      })
    });

    const result = await response.json();

    if (result.status === 'success') {
      console.log('Analysis completed:', result.results);
      return result.results;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}
```

### Bulk Analysis with Monitoring
```javascript
async function bulkAnalyze(products) {
  const results = [];
  const progress = { completed: 0, errors: 0 };

  for (const product of products) {
    try {
      const result = await fetch('/api/analysis/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: product.url,
          page_html: product.html
        })
      });

      const data = await result.json();
      results.push(data);
      progress.completed++;

    } catch (error) {
      progress.errors++;
      console.error(`Failed to analyze ${product.url}:`, error);
    }
  }

  return { results, progress };
}
```

### Configuration Management
```javascript
async function updateConfiguration(newConfig) {
  try {
    const response = await fetch('/api/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newConfig)
    });

    if (response.ok) {
      console.log('Configuration updated successfully');
      return await response.json();
    } else {
      throw new Error(`Configuration update failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to update configuration:', error);
  }
}
```

---

*Эта API документация предоставляет полное описание всех интерфейсов плагина Ozon Analyzer для seamless integration.*