# Устранение неполадок Ozon Analyzer Plugin

## 🎯 Обзор

Это полное руководство по устранению неполадок плагина Ozon Analyzer. Система спроектирована для высокой стабильности с **100% успешностью** интеграционных тестов, однако возможны ситуации требующие диагностики и исправления.

## 🚨 Быстрая диагностика

### Автоматическая проверка здоровья
```bash
#!/bin/bash
# quick-diagnosis.sh - Быстрая диагностика проблем

echo "=== Ozon Analyzer Health Check ==="
echo "Timestamp: $(date)"

# 1. Memory check
echo -e "\n1. Memory Status:"
free -h | grep '^Mem:'
ps aux --no-headers -o pmem,pid,comm | grep -E "(chrome|node)" | head -5

# 2. Plugin service check
echo -e "\n2. Service Status:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health && echo " ✅ Main service: UP" || echo " ❌ Main service: DOWN"

# 3. Plugin health check
echo -e "\n3. Plugin Health:"
curl -s http://localhost:3000/health/plugin/ozon-analyzer | jq -r '.status' 2>/dev/null && echo " ✅ Plugin: HEALTHY" || echo " ❌ Plugin: PROBLEM"

# 4. Recent errors
echo -e "\n4. Recent Errors:"
tail -10 /var/log/ozon-analyzer/error.log 2>/dev/null || echo "No error log available"

# 5. Performance metrics
echo -e "\n5. Performance Check:"
curl -s http://localhost:3000/api/metrics/current | jq '.performance // "Metrics unavailable"' 2>/dev/null
```

### Инструменты разработчика Chrome
```javascript
// Console diagnostics commands
// Available in DevTools Console when Ozon Analyzer is loaded

// 1. System status
window.ozonAnalyzerMonitor?.getHealth()

// 2. Performance metrics
window.ozonAnalyzerMonitor?.getMetrics()

// 3. Cache status
window.ozonAnalyzerMonitor?.getComponentStatus()

// 4. Manual analysis test
const testAnalysis = async () => {
  console.log('🚀 Starting manual analysis test...');

  try {
    const response = await fetch('/api/test-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testProduct: true })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Analysis test successful:', result);
    } else {
      console.error('❌ Analysis test failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('❌ Analysis test error:', error);
  }
};
testAnalysis();
```

## ⚠️ Распространенные проблемы и решения

### 1. Plugin Not Loading (Плагин не загружается)

#### Симптомы
- Плагин не появляется в списке доступных
- Ошибка "Plugin not found"
- Иконка плагина не отображается

#### Диагностика
```bash
# 1. Проверьте структуру файлов
find . -path "*/plugins/ozon-analyzer" -type d

# 2. Проверьте manifest.json
cat chrome-extension/public/plugins/ozon-analyzer/manifest.json | jq '.name'

# 3. Проверьте workflow.json
cat chrome-extension/public/plugins/ozon-analyzer/workflow.json | jq '.name'

# 4. Logs браузера
tail -f ~/.config/chromium/chrome_debug.log | grep -i ozon
```

#### Решения
```bash
# 1. Переустановите плагин
rm -rf chrome-extension/public/plugins/ozon-analyzer
cp -r path/to/ozon-analyzer chrome-extension/public/plugins/

# 2. Проверьте синтаксис JSON
python3 -m json.tool chrome-extension/public/plugins/ozon-analyzer/manifest.json

# 3. Restart chrome extension
# Reload extension in chrome://extensions or restart browser

# 4. Clear cache
rm -rf ~/.config/chromium/Default/Extensions/your_extension_id/
```

### 2. Pyodide Worker Errors (Ошибки Pyodide)

#### Симптомы
- Время анализа > 45 сек (обычно 35-40 сек)
- Error: "Pyodide worker timeout"
- Memory errors в worker

#### Диагностика
```javascript
// 1. Check Pyodide worker status
window.pyodideMonitor?.getStatus()

// 2. Memory usage
performance.memory && {
  used: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`,
  total: `${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1)}MB`,
  limit: `${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB`
}

// 3. Worker logs
console.log('Active workers:', chrome.runtime.getBackgroundPage());
```

#### Решения
```javascript
// 1. Force restart Pyodide worker
if (window.pyodideWorker) {
  window.pyodideWorker.terminate();
  window.pyodideWorker = null;
}

// 2. Clear Pyodide cache
localStorage.removeItem('pyodide-cache');
sessionStorage.removeItem('pyodide-session');

// 3. Manual garbage collection
if (window.gc) window.gc();

// 4. Reload page
location.reload();
```

#### Production fix
```bash
# Restart worker pool
curl -X POST http://localhost:3000/api/workers/restart

# Clear all caches
curl -X POST http://localhost:3000/api/caches/clear

# Check memory status
curl http://localhost:3000/health | jq '.components.pyodide_worker'
```

### 3. AI Service Failures (Ошибки AI сервисов)

#### Симптомы
- Анализ не завершается
- Error: "AI model timeout"
- Fallback not working

#### Диагностика
```javascript
// 1. Check AI service connectivity
fetch('/api/ai/test-availability', { method: 'GET' })
  .then(r => r.json())
  .then(availability => console.log('AI Services:', availability))
  .catch(e => console.error('AI Check failed:', e));

// 2. API key validation
const hasGemini = !!localStorage.getItem('GEMINI_API_KEY');
const hasOpenAI = !!localStorage.getItem('OPENAI_API_KEY');
console.log('API Keys present:', { gemini: hasGemini, openai: hasOpenAI });

// 3. Network connectivity to AI endpoints
Promise.all([
  fetch('https://generativelanguage.googleapis.com/').then(() => 'Gemini OK'),
  fetch('https://api.openai.com/').then(() => 'OpenAI OK')
]).then(results => console.log('Network checks:', results))
  .catch(e => console.error('Network issue:', e));
```

#### Решения
```javascript
// 1. Force fallback to alternative AI provider
const config = {
  ai: {
    forceFallback: true,
    primaryProvider: 'gemini',  // or 'openai'
    secondaryProvider: 'openai' // or null to disable
  }
};

// 2. Reset AI cache
fetch('/api/ai/cache/clear', { method: 'POST' })
  .then(() => console.log('AI cache cleared'));

// 3. Manual provider switch
window.aiProviderConfig = {
  disabledProviders: ['unreliable_provider'],
  healthCheckInterval: 30000
};
```

#### Common API scenarios
```javascript
// Gemini API quota exceeded
{
  "error": {
    "code": 429,
    "message": "RESOURCE_EXHAUSTED",
    "details": [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure" }]
  }
}

// OpenAI API key invalid
{
  "error": {
    "message": "Incorrect API key provided",
    "type": "invalid_api_key",
    "param": null,
    "code": "invalid_api_key"
  }
}
```

### 4. Memory Leaks (Утечки памяти)

#### Симптомы
- Постепенное увеличение потребления памяти
- Браузер становится медленным
- GC warnings в console

#### Диагностика
```javascript
// 1. Memory timeline tracking
const trackMemory = () => {
  const initial = performance.memory?.usedJSHeapSize || 0;

  setInterval(() => {
    const current = performance.memory?.usedJSHeapSize || 0;
    const increase = ((current - initial) / initial * 100).toFixed(1);
    console.log(`Memory: ${(current / 1024 / 1024).toFixed(1)}MB (+${increase}%)`);
  }, 10000);
};
trackMemory();

// 2. Object allocation tracking
if (window.performance.memory) {
  window.memorySnapshots = window.memorySnapshots || [];
  window.memorySnapshots.push({
    timestamp: Date.now(),
    memory: performance.memory
  });
}
```

#### Решения
```javascript
// 1. Force garbage collection
const forceGC = () => {
  if (window.gc) {
    console.log('Before GC:', performance.memory?.usedJSHeapSize);
    window.gc();
    console.log('After GC:', performance.memory?.usedJSHeapSize);
  } else {
    console.log('GC not available - try refreshing page');
  }
};
forceGC();

// 2. Clear all caches
const clearAllCaches = async () => {
  const caches = ['ai-cache', 'memory-cache', 'dom-cache'];
  await Promise.all(caches.map(cache =>
    fetch(`/api/cache/clear/${cache}`, { method: 'POST' })
  ));
  console.log('All caches cleared');
};

// 3. Memory optimization
const memoryOptimization = {
  reduceBatchSize: () => batchProcessor.batch_size = Math.max(1, batchProcessor.batch_size - 1),
  disableStreaming: () => FastDOMParser.prototype.extract_product_info_streaming = null,
  clearLRUCache: () => memory_manager.lru_cache.clear()
};
```

### 5. Network Issues (Сетевые проблемы)

#### Симптомы
- Запросы к Ozon.ru блокируются
- CORS errors
- Timeout errors

#### Диагностика
```javascript
// 1. Network connectivity test
const testNetwork = async () => {
  const targets = [
    'https://ozon.ru',
    'https://generativelanguage.googleapis.com',
    'https://api.openai.com'
  ];

  for (const url of targets) {
    try {
      const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      console.log(`✅ ${url}: ${response.ok ? 'OK' : 'Partial'}`);
    } catch (error) {
      console.log(`❌ ${url}: ${error.message}`);
    }
  }
};
testNetwork();

// 2. CORS configuration check
fetch('/api/cors/test', { method: 'GET' })
  .then(() => console.log('✅ CORS configured correctly'))
  .catch(e => console.error('❌ CORS issue:', e));
```

#### Решения
```javascript
// 1. Update CORS configuration
const corsFix = {
  origins: ['https://ozon.ru', 'https://www.ozon.ru'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  headers: ['Content-Type', 'Authorization']
};

// 2. Fallback to proxy
const proxyConfig = {
  enabled: true,
  proxyUrl: '/api/proxy',
  bypassDirect: true
};

// 3. Update timeouts
const timeoutConfig = {
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retryAttempts: 3,
  exponentialBackoff: true
};
```

### 6. Cache Issues (Проблемы с кешем)

#### Симптомы
- Старые результаты анализа
- Cache hit rate = 0%
- Expiration errors

#### Диагностика
```javascript
// 1. Cache status check
const cacheStatus = await fetch('/api/cache/status');
const status = await cacheStatus.json();

// Check hit ratios
status.metrics.forEach(metric => {
  if (metric.name === 'cache_hit_ratio' && metric.value < 0.5) {
    console.warn('⚠️ Low cache hit ratio:', metric.value);
  }
});

// 2. Cache size check
status.size > status.maxSize * 0.9 && console.warn('⚠️ Cache nearly full');
```

#### Решения
```javascript
// 1. Clear problematic cache
const clearCache = async (cacheType) => {
  try {
    await fetch(`/api/cache/clear/${cacheType}`, { method: 'POST' });
    console.log(`✅ ${cacheType} cache cleared`);
  } catch (error) {
    console.error(`❌ Failed to clear ${cacheType}:`, error);
  }
};

// Clear all caches
await clearCache('ai');
await clearCache('memory');
await clearCache('lru');

// 2. Reset cache configuration
const newCacheConfig = {
  maxSize: 100,
  ttlSeconds: 3600,
  evictionPolicy: 'lru',
  compressionEnabled: true
};

// 3. Force cache warmup
const warmUpCache = async () => {
  const testProducts = [
    'creme-123', 'shampoo-456', 'supplement-789'
  ];

  for (const product of testProducts) {
    await fetch(`/api/analysis/warmup/${product}`);
  }
  console.log('✅ Cache warmup completed');
};
```

## 🔧 Advanced Debugging

### 1. Packet Capture и Network Analysis
```bash
# Capture network traffic
tcpdump -i any -s0 -w ozon_analyzer.pcap host ozon.ru or port 443

# Analyze with Wireshark
wireshark ozon_analyzer.pcap

# Filter for specific patterns
# ssl.handshake or http.request.uri contains "ozon"
```

### 2. Performance Profiling
```javascript
// Start performance recording
console.profile('OzonAnalyzer-Profile');

// Your code here
await runWorkflow();

// Stop and analyze
console.profileEnd('OzonAnalyzer-Profile');

// Memory heap snapshot
console.log('Heap snapshot requested');
if (window.devtools) {
  window.devtools.takeHeapSnapshot();
}
```

### 3. Memory Leak Detection
```javascript
// Advanced memory leak detection
const memoryDetector = {
  snapshots: [],

  takeSnapshot: function(label) {
    this.snapshots.push({
      label,
      timestamp: Date.now(),
      memory: performance.memory,
      activeObjects: Object.keys(window).length
    });
  },

  analyzeLeaks: function() {
    const analysis = this.snapshots.map((snap, i) => {
      if (i === 0) return 'Baseline';
      const prev = this.snapshots[i-1];
      const memIncrease = snap.memory.usedJSHeapSize - prev.memory.usedJSHeapSize;

      return {
        interval: `${prev.label} → ${snap.label}`,
        memoryIncrease: `${(memIncrease / 1024 / 1024).toFixed(2)}MB`,
        objectCount: snap.activeObjects,
        timeDiff: snap.timestamp - prev.timestamp
      };
    });

    console.table(analysis);
  }
};

// Usage
memoryDetector.takeSnapshot('initial');
await runAnalysis();
memoryDetector.takeSnapshot('after-analysis');
memoryDetector.analyzeLeaks();
```

## 🚨 Обработка критических ситуаций

### 1. Complete System Failure (Полный отказ системы)

```bash
#!/bin/bash
# emergency-recovery.sh

echo "🚨 CRITICAL: Starting emergency recovery..."

# 1. Stop all services
pkill -f "ozon-analyzer"
pkill -f "chrome.*extension"

# 2. Backup current state
mkdir -p emergency_backup/$(date +%Y%m%d_%H%M%S)
cp -r chrome-extension/public/plugins/ozon-analyzer emergency_backup/$(date +%Y%m%d_%H%M%S)/
cp chrome-extension/src/background/monitoring/config.production.json emergency_backup/

# 3. Clean state
rm -rf ~/.config/chromium/Default/Extensions/*/Storage/
rm -rf ~/.cache/ozon-analyzer/

# 4. Fresh start
npm run clean
npm install
npm run build

# 5. Verify recovery
curl -f http://localhost:3000/health || echo "Recovery failed"
```

### 2. Data Corruption (Повреждение данных)

```bash
#!/bin/bash
# data-recovery.sh

echo "💾 Starting data recovery..."

# 1. Check backup integrity
ls -la backup/ozon-analyzer-*.tar.gz

# 2. Restore from backup
LATEST_BACKUP=$(ls -t backup/ozon-analyzer-*.tar.gz | head -1)
tar -xzf $LATEST_BACKUP -C /

# 3. Validate restored data
python3 -c "
import json
with open('chrome-extension/public/plugins/ozon-analyzer/manifest.json') as f:
    manifest = json.load(f)
assert manifest['name'] == 'Ozon Analyzer'
print('✅ Data integrity verified')
"

# 4. Rebuild indexes
curl -X POST http://localhost:3000/api/data/rebuild-indexes
```

### 3. Security Incident Response

```bash
#!/bin/bash
# security-incident.sh

echo "🔒 SECURITY INCIDENT - Initiating response..."

# 1. Isolate affected systems
iptables -I INPUT -s ATTACKER_IP -j DROP

# 2. Log incident details
echo "$(date): Security incident detected - $(openssl x509 -in /dev/stdin -text)" >> security_incidents.log

# 3. Rotate credentials
new_gemini_key=$(openssl rand -hex 32)
new_openai_key=$(openssl rand -hex 32)

# Update environment
export GEMINI_API_KEY=$new_gemini_key
export OPENAI_API_KEY=$new_openai_key

# 4. Revoke old keys in respective consoles
curl -X POST https://generativelanguage.googleapis.com/revoke \
  -H "Authorization: Bearer $GEMINI_API_KEY"

# 5. Monitor for recurrence
echo "Monitoring enabled for 24 hours..." >> security_monitor.log
```

## 📊 Превентивные меры

### Регулярные проверки
```bash
# Weekly maintenance script
#!/bin/bash
# weekly-maintenance.sh

echo "🛠️ Weekly maintenance for Ozon Analyzer"

# 1. Update dependencies
npm audit
npm update --save

# 2. Clean old logs
find /var/log/ozon-analyzer -name "*.log" -mtime +7 -delete

# 3. Optimize database (if any)
# Your database cleanup here

# 4. Renew SSL certificates
certbot renew

# 5. Performance test
npm run benchmark:ozon-analyzer

# 6. Check monitoring alerts
curl -f http://localhost:3000/health/alerts
```

### Мониторинг трендов
```javascript
// Automatic trend analysis
const trendAnalyzer = {
  metrics: ['execution_time', 'error_rate', 'memory_usage', 'api_calls'],

  analyze: async function() {
    const trends = {};

    for (const metric of this.metrics) {
      const data = await fetch(`/api/metrics/trend/${metric}?period=30d`);
      const values = await data.json();

      trends[metric] = {
        current: values.current,
        trend: this.calculateTrend(values),
        deviation: this.calculateDeviation(values),
        prediction: this.predictNext(values)
      };
    }

    return this.generateReport(trends);
  },

  generateReport: function(trends) {
    const alerts = [];

    if (trends.execution_time.trend > 0.1) {
      alerts.push('Performance degrading - investigate execution time');
    }

    if (trends.error_rate.deviation > 0.05) {
      alerts.push('Error rate spike detected');
    }

    return { trends, alerts };
  }
};
```

## 🆘 Когда обратиться за помощью

### Community Support
- **GitHub Issues**: Открытые проблемы и решения
- **Documentation Wiki**: Подробные гайды по компонентам
- **Community Discord**: Обсуждения и live troubleshooting

### Professional Support Options
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   КОРПОРАТИВНАЯ ПОДДЕРЖКА OZON ANALYZER PLUGIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

СТАТУС                    : PRODUCTION READY
SLA ПОДДЕРЖКИ            : 24/7 PREMIUM SUPPORT
ВРЕМЯ ОТВЕТА             : < 2 часов (критические), < 8 часов (обычные)
КОНТАКТЫ                  : enterprise@ozon-analyzer.com
════════════════════════════════════════════════════════════════════════════

  🚨 CRITICAL INCIDENT RESPONSE
  ┌─ Priority 1 (P1): System Down ──────────────────────┐
  │  • Guaranteed 30-minute response time               │
  │  • Live debugging assistance                       │
  │  • On-site engineer dispatch (if required)          │
  │  • Complete incident report and RCA                │
  │  • Post-mortem analysis and prevention plan        │
  └─────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Шаблон обращения в поддержку
```text
Issue Template:
```
**Environment:**
- Ozon Analyzer Version: 1.0.0
- Browser: Chrome 120.0.6099.109
- OS: Ubuntu 22.04 LTS
- Node.js: 18.17.0

**Problem Description:**
[Detailed description of the issue]

**Expected Behavior:**
[What should happen normally]

**Actual Behavior:**
[What is actually happening]

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Logs and Screenshots:**
[Attach relevant logs, screenshots, error messages]

**Tried Solutions:**
[What have you already tried to fix it]

**Impact Assessment:**
- Users affected: [number]
- Business impact: [low/medium/high/critical]
- Downtime duration: [hours/minutes]

**Additional Context:**
[Any other relevant information]
```
```

---

## 🎯 Профилактика проблем

### Регулярные проверки качества
1. **Автоматизированные тесты** запускаются еженедельно
2. **Performance benchmarks** выполняются ежемесячно
3. **Security audits** проводятся ежеквартально
4. **Code reviews** обязательны для всех изменений
5. **Production monitoring** работает 24/7 с алертами

### Преимущества профилактического подхода
- **Среднее время восстановления (MTTR)**: < 30 минут
- **Время безотказной работы (Uptime)**: > 99.9%
- **Предиктивная диагностика**: проблемы выявляются до критичности
- **Автоматическое восстановление**: большинство проблем решается автоматически

*Это руководство обеспечивает полное покрытие сценариев устранения неполадок плагина Ozon Analyzer с акцентом на preventive maintenance и automated recovery.*