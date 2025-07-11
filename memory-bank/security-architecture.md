# Архитектура безопасности Agent-Plugins-Platform

## Обзор
Двухуровневая система безопасности с централизованным контролем доступа к API и сетевых запросов.

## 1. Система секретов (API ключи)

### 1.1 Хранилище на уровне платформы
```typescript
// background.js - защищенное хранилище
interface PlatformSecrets {
  openai_api_key?: string;
  gemini_api_key?: string;
  weather_api_key?: string;
  github_token?: string;
  // ... другие API ключи
}

// chrome.storage.local - зашифрованное хранение
const secretsStorage = {
  get: async (key: string): Promise<string | null> => {
    const encrypted = await chrome.storage.local.get(`secret_${key}`);
    return decrypt(encrypted[`secret_${key}`]);
  },
  set: async (key: string, value: string): Promise<void> => {
    const encrypted = encrypt(value);
    await chrome.storage.local.set({ [`secret_${key}`]: encrypted });
  }
};
```

### 1.2 Декларация разрешений в манифесте плагина
```json
{
  "name": "Weather Assistant",
  "version": "1.0.0",
  "required_secrets": [
    "weather_api_key",
    "openai_api_key"
  ],
  "api_permissions": {
    "weather": {
      "domains": ["api.weatherapi.com"],
      "endpoints": ["/v1/current.json", "/v1/forecast.json"],
      "methods": ["GET"],
      "rate_limit": "1000/day",
      "purpose": "Получение данных о погоде"
    },
    "openai": {
      "domains": ["api.openai.com"],
      "endpoints": ["/v1/chat/completions"],
      "methods": ["POST"],
      "rate_limit": "100/hour",
      "purpose": "Генерация ответов на основе данных о погоде"
    }
  }
}
```

### 1.3 Контролируемая передача секретов
```typescript
// plugin-chat-api.ts - безопасные вызовы API
class SecureAPI {
  async llmCall(provider: string, params: LLMParams): Promise<LLMResponse> {
    // 1. Проверка разрешений
    const hasPermission = await this.checkAPIPermission(provider);
    if (!hasPermission) {
      throw new Error(`Plugin not authorized to use ${provider} API`);
    }

    // 2. Валидация параметров
    const validatedParams = await this.validateParams(provider, params);
    
    // 3. Получение секрета (только в background.js)
    const secret = await secretsStorage.get(`${provider}_api_key`);
    
    // 4. Выполнение запроса
    const response = await this.makeSecureRequest(provider, validatedParams, secret);
    
    // 5. Аудит
    await this.auditLog('api_call', provider, params, 'success');
    
    return response;
  }
}
```

## 2. Система сетевых разрешений

### 2.1 Белый список доменов
```json
{
  "network_policy": {
    "allowed_domains": [
      "api.weatherapi.com",
      "api.openai.com",
      "api.github.com"
    ],
    "blocked_domains": [
      "*.malware.com",
      "*.phishing.com"
    ],
    "websockets": "denied",
    "server_sent_events": "denied",
    "long_polling": "denied"
  }
}
```

### 2.2 Проверка в background.js
```typescript
// host-api.ts - безопасные сетевые запросы
class SecureNetwork {
  async hostFetch(url: string, options: RequestInit): Promise<Response> {
    // 1. Извлечение домена
    const domain = new URL(url).hostname;
    
    // 2. Проверка белого списка
    const isAllowed = await this.checkDomainPermission(domain);
    if (!isAllowed) {
      await this.auditLog('network_request', domain, { url }, 'denied');
      throw new Error(`Access to ${domain} not allowed by plugin manifest`);
    }
    
    // 3. Проверка rate limit
    const rateLimitOk = await this.checkRateLimit(domain);
    if (!rateLimitOk) {
      await this.auditLog('network_request', domain, { url }, 'rate_limited');
      throw new Error(`Rate limit exceeded for ${domain}`);
    }
    
    // 4. Выполнение запроса
    const response = await fetch(url, options);
    
    // 5. Аудит
    await this.auditLog('network_request', domain, { url, status: response.status }, 'success');
    
    return response;
  }
}
```

## 3. Система валидации и схем

### 3.1 JSON Schema для API параметров
```json
{
  "api_schemas": {
    "openai": {
      "chat_completions": {
        "type": "object",
        "required": ["prompt"],
        "properties": {
          "prompt": {
            "type": "string",
            "maxLength": 4000,
            "description": "Текст запроса к LLM"
          },
          "model": {
            "type": "string",
            "enum": ["gpt-3.5-turbo", "gpt-4"],
            "default": "gpt-3.5-turbo"
          },
          "temperature": {
            "type": "number",
            "minimum": 0,
            "maximum": 2,
            "default": 0.7
          },
          "max_tokens": {
            "type": "integer",
            "minimum": 1,
            "maximum": 4000,
            "default": 1000
          }
        }
      }
    }
  }
}
```

### 3.2 Валидация в runtime
```typescript
class ParameterValidator {
  async validateParams(provider: string, endpoint: string, params: any): Promise<any> {
    const schema = await this.loadSchema(provider, endpoint);
    const validator = new Ajv();
    const validate = validator.compile(schema);
    
    if (!validate(params)) {
      throw new Error(`Invalid parameters: ${JSON.stringify(validate.errors)}`);
    }
    
    return params;
  }
}
```

## 4. Система аудита и мониторинга

### 4.1 Структура логов аудита
```typescript
interface AuditLog {
  id: string;
  timestamp: number;
  pluginId: string;
  action: 'api_call' | 'network_request' | 'secret_access' | 'file_access';
  resource: string;
  parameters: Record<string, any>;
  result: 'success' | 'denied' | 'error' | 'rate_limited';
  userAgent: string;
  tabId?: number;
  sessionId: string;
  ipAddress?: string;
  riskScore: number; // 0-100
}

interface SecurityMetrics {
  totalRequests: number;
  deniedRequests: number;
  suspiciousActivity: number;
  rateLimitViolations: number;
  lastUpdated: number;
}
```

### 4.2 Анализ подозрительной активности
```typescript
class SecurityAnalyzer {
  async analyzeActivity(pluginId: string): Promise<SecurityReport> {
    const logs = await this.getAuditLogs(pluginId, '24h');
    
    const report = {
      riskScore: 0,
      violations: [],
      recommendations: []
    };
    
    // Анализ частоты запросов
    const requestRate = logs.filter(l => l.action === 'api_call').length / 24;
    if (requestRate > 100) {
      report.riskScore += 30;
      report.violations.push('High request rate detected');
    }
    
    // Анализ отклоненных запросов
    const deniedRate = logs.filter(l => l.result === 'denied').length / logs.length;
    if (deniedRate > 0.1) {
      report.riskScore += 40;
      report.violations.push('High rate of denied requests');
    }
    
    // Анализ новых доменов
    const newDomains = await this.detectNewDomains(pluginId);
    if (newDomains.length > 0) {
      report.riskScore += 50;
      report.violations.push(`New domains accessed: ${newDomains.join(', ')}`);
    }
    
    return report;
  }
}
```

## 5. Пользовательский интерфейс безопасности

### 5.1 Страница управления секретами
```typescript
// options/src/components/SecuritySettings.tsx
interface SecuritySettings {
  apiKeys: {
    openai?: string;
    gemini?: string;
    weather?: string;
  };
  globalSettings: {
    enableAuditLog: boolean;
    maxRequestsPerHour: number;
    autoBlockSuspicious: boolean;
  };
  pluginPermissions: PluginPermission[];
}
```

### 5.2 Мониторинг активности плагинов
```typescript
// devtools-panel/src/SecurityMonitor.tsx
interface SecurityMonitor {
  realTimeActivity: AuditLog[];
  securityAlerts: SecurityAlert[];
  pluginRiskScores: Record<string, number>;
  systemHealth: SecurityMetrics;
}
```

## 6. Процесс установки и обновления плагинов

### 6.1 Проверка безопасности при установке
```typescript
class PluginSecurityValidator {
  async validatePlugin(pluginPath: string): Promise<SecurityValidation> {
    const manifest = await this.loadManifest(pluginPath);
    
    const validation = {
      isSafe: true,
      warnings: [],
      errors: [],
      riskScore: 0
    };
    
    // Проверка разрешений
    if (manifest.api_permissions) {
      for (const [api, config] of Object.entries(manifest.api_permissions)) {
        if (config.domains.some(d => this.isSuspiciousDomain(d))) {
          validation.warnings.push(`Suspicious domain in ${api}: ${config.domains}`);
          validation.riskScore += 20;
        }
      }
    }
    
    // Проверка кода на подозрительные паттерны
    const codeAnalysis = await this.analyzeCode(pluginPath);
    if (codeAnalysis.suspiciousPatterns.length > 0) {
      validation.warnings.push('Suspicious code patterns detected');
      validation.riskScore += 30;
    }
    
    return validation;
  }
}
```

## 7. Аварийные процедуры

### 7.1 Автоматическая блокировка
```typescript
class EmergencyController {
  async handleSecurityBreach(pluginId: string, severity: 'low' | 'medium' | 'high'): Promise<void> {
    switch (severity) {
      case 'high':
        await this.immediatelyDisablePlugin(pluginId);
        await this.notifyUser('Plugin disabled due to security concerns');
        await this.reportToSecurityTeam(pluginId, 'high_severity_breach');
        break;
        
      case 'medium':
        await this.limitPluginPermissions(pluginId);
        await this.notifyUser('Plugin permissions limited due to suspicious activity');
        break;
        
      case 'low':
        await this.logWarning(pluginId, 'suspicious_activity_detected');
        break;
    }
  }
}
```

## 8. Тестирование безопасности

### 8.1 Автоматизированные тесты
```typescript
describe('Security Tests', () => {
  test('Plugin cannot access unauthorized domains', async () => {
    const plugin = await loadTestPlugin('malicious-plugin');
    await expect(plugin.makeRequest('https://malware.com')).rejects.toThrow();
  });
  
  test('Plugin cannot access API keys directly', async () => {
    const plugin = await loadTestPlugin('key-stealer');
    const result = await plugin.tryToStealKeys();
    expect(result).not.toContain('sk-');
  });
  
  test('Rate limiting works correctly', async () => {
    const plugin = await loadTestPlugin('spammer');
    for (let i = 0; i < 150; i++) {
      if (i < 100) {
        await expect(plugin.makeRequest()).resolves.toBeDefined();
      } else {
        await expect(plugin.makeRequest()).rejects.toThrow('Rate limit exceeded');
      }
    }
  });
});
```

## Заключение

Эта архитектура обеспечивает:
- ✅ Полную изоляцию секретов
- ✅ Контроль сетевого доступа
- ✅ Валидацию всех параметров
- ✅ Полный аудит активности
- ✅ Автоматическое обнаружение угроз
- ✅ Прозрачность для пользователя
- ✅ Возможность быстрого реагирования на угрозы

Система спроектирована с учетом принципов "defense in depth" и "zero trust", обеспечивая максимальную безопасность при сохранении функциональности. 