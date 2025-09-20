# Инструкции по тестированию системы передачи HTML

## Подготовка к тестированию

### 1. Сборка расширения
```bash
cd chrome-extension
pnpm build
```

### 2. Загрузка расширения в Chrome
1. Откройте `chrome://extensions/`
2. Включите "Developer mode"
3. Нажмите "Load unpacked"
4. Выберите папку `dist` из chrome-extension

### 3. Открытие DevTools
- Откройте расширение в новой вкладке
- Нажмите F12 для открытия DevTools
- Перейдите на вкладку Console

## Тестовые сценарии

### Тест 1: Сохранение настроек
```javascript
// Откройте страницу настроек расширения
// chrome-extension://[ID_РАСШИРЕНИЯ]/options/index.html

// В консоли выполните:
await chrome.storage.local.set({htmlTransmissionMode: 'direct'});
const result = await chrome.storage.local.get(['htmlTransmissionMode']);
console.log('Saved setting:', result);
```

### Тест 2: Переключатель UI
1. Откройте страницу настроек
2. Переключите "Отправлять HTML целиком" ON/OFF
3. Проверьте логи в консоли DevTools
4. Проверьте изменение режима в интерфейсе

### Тест 3: Функциональное тестирование
```javascript
// Откройте тестовую страницу
// chrome-extension://[ID_РАСШИРЕНИЯ]/test-small-page.html

// Запустите тест:
await chrome.runtime.sendMessage({
  type: 'RUN_WORKFLOW',
  pluginId: 'test-plugin',
  requestId: 'test_' + Date.now()
});
```

### Тест 4: Автоматизированное тестирование
```javascript
// Загрузите тестовый скрипт
const script = document.createElement('script');
script.src = chrome.runtime.getURL('test-html-transmission.js');
document.head.appendChild(script);

// После загрузки выполните:
await HTMLTransmissionTests.runAll();
```

## Проверка логов

### В Options (настройки):
```
[options][DEBUG] 📊 Loaded htmlTransmissionMode: "direct" (from storage: direct)
[options][DEBUG] 🎯 Checkbox checked state: true
[options][DEBUG] 💾 Saving htmlTransmissionMode: "direct" (checkbox checked: true)
```

### В Background (RUN_WORKFLOW):
```
[background][WORKFLOW][DEBUG] 🔍 Checking htmlTransmissionMode settings...
[background][WORKFLOW][DEBUG] 📊 Current htmlTransmissionMode setting: direct
[background][WORKFLOW][DEBUG] 🎯 Should use direct transmission: true
[background][WORKFLOW][DEBUG] 🚀 Starting CHUNKED transmission (current workflow method)
```

### В createChunks:
```
[createChunks][DEBUG] 🔄 createChunks called with HTML length: 12345 chunkSize: 262144
[createChunks][DEBUG] ✅ Created 1 chunks from 12345 chars
```

## Ожидаемые результаты

### ✅ Успешные сценарии:
- Настройки сохраняются в chrome.storage.local
- UI переключатель корректно отражает состояние
- RUN_WORKFLOW читает настройки и логирует их
- createChunks вызывается только при режиме chunks

### ⚠️ Предупреждения:
- Логи показывают несоответствие между настройками и методом передачи
- Настройки не применяются в RUN_WORKFLOW

### ❌ Ошибки:
- Ошибки чтения/записи chrome.storage
- Отсутствие логов в определенных местах
- createChunks вызывается при режиме direct

## Диагностика проблем

### Проблема 1: Настройки не сохраняются
```
Решение: Проверьте разрешения расширения в manifest.json
Проверьте: chrome.storage доступен?
```

### Проблема 2: RUN_WORKFLOW игнорирует настройки
```
Решение: Проверьте логи чтения настроек в RUN_WORKFLOW
Проверьте: htmlTransmissionMode читается корректно?
```

### Проблема 3: createChunks вызывается всегда
```
Решение: RUN_WORKFLOW не использует логику выбора режима
Нужно: Добавить условную логику в RUN_WORKFLOW
```

## Метрики производительности

### Сравнение режимов:
- **Direct mode**: Быстрее для маленьких HTML (< 10MB)
- **Chunks mode**: Стабильнее для больших HTML (> 10MB)

### Измерение:
```javascript
// В консоли для измерения времени
console.time('HTML Transmission');
await chrome.runtime.sendMessage({type: 'RUN_WORKFLOW', ...});
console.timeEnd('HTML Transmission');
```

## Отчет о тестировании

### Структура отчета:
```
📊 HTML Transmission System Test Report
========================================

✅ PASSED TESTS:
- Settings Persistence: 245ms
- Workflow Trigger: 1200ms
- Options Page UI: 890ms

❌ FAILED TESTS:
- Direct Transmission: Settings ignored in RUN_WORKFLOW

⚠️ WARNINGS:
- createChunks called unnecessarily

📈 PERFORMANCE:
- Chunks mode: ~800ms for 5MB HTML
- Direct mode: ~200ms for 5MB HTML

🔧 RECOMMENDATIONS:
1. Fix RUN_WORKFLOW to respect htmlTransmissionMode setting
2. Add fallback logic for large HTML in direct mode
3. Improve error handling in settings storage
```

## Ручное тестирование

### Тест 1: Маленькая страница (< 1MB)
1. Откройте test-small-page.html
2. Установите режим "direct"
3. Запустите RUN_WORKFLOW
4. Проверьте логи: должен быть direct mode

### Тест 2: Большая страница (> 10MB)
1. Откройте test-large-page.html
2. Установите режим "direct"
3. Запустите RUN_WORKFLOW
4. Проверьте логи: должен быть chunks mode (fallback)

### Тест 3: Переключение режимов
1. Измените настройки во время работы
2. Запустите новый RUN_WORKFLOW
3. Проверьте применение изменений

## Ожидаемые исправления

На основе анализа кода, наиболее вероятные проблемы:

1. **RUN_WORKFLOW не читает настройки** - основной баг
2. **Отсутствие логики выбора режима** - архитектурная проблема
3. **createChunks вызывается всегда** - следствие проблемы 1

### Критичные исправления:
```javascript
// Добавить в RUN_WORKFLOW:
const globalSettings = await getGlobalSettings();
if (globalSettings.htmlTransmissionMode === 'direct' && htmlSize < MAX_DIRECT_SIZE) {
  // Использовать direct transmission
} else {
  // Использовать chunks
}