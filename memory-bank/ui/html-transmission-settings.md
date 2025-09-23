# HTML Transmission Settings - Настройки передачи HTML

## Обзор

Настройка "Отправлять HTML целиком" определяет режим передачи HTML-контента страниц в систему плагинов. Это критически важная настройка, влияющая на производительность и стабильность обработки больших HTML-документов.

## Расположение настроек

### Frontend (Пользовательский интерфейс)

**Основной файл настроек:** `pages/options/src/components/SettingsTab.tsx`

```typescript
// Начальное состояние
const [htmlTransmissionMode, setHtmlTransmissionMode] = React.useState<HtmlTransmissionMode>('direct');

// Fallback при загрузке из хранилища
const mode = (result.htmlTransmissionMode as HtmlTransmissionMode) || 'direct';

// Логика переключателя
onChange={(checked) => saveHtmlTransmissionMode(checked ? 'direct' : 'direct')}
```

**Резервный файл:** `chrome-extension/public/options/index.html` (устаревшая версия)
```javascript
const mode = result.htmlTransmissionMode || 'direct';
```

### Backend (Серверная логика)

**Основные настройки плагинов:** `packages/storage/lib/plugin-settings.ts`
```typescript
export interface PluginSettings {
  enabled: boolean;
  autorun: boolean;
  htmlTransmissionMode?: 'chunks' | 'direct'; // Режим передачи HTML: чанками или напрямую
}

const getPluginSettingsByIdFallback = (pluginId: string, settings: PluginSettingsState): PluginSettings =>
  settings[pluginId] ?? {
    enabled: true,
    autorun: false,
    htmlTransmissionMode: 'direct', // По умолчанию прямая передача HTML
  };
```

**Глобальные настройки:** `src/background/background.ts`
```typescript
async function getGlobalSettings(): Promise<GlobalSettings> {
  const settings = await chrome.storage.local.get(['htmlTransmissionMode']);
  const htmlTransmissionMode = settings.htmlTransmissionMode || 'direct';
  return { htmlTransmissionMode };
}
```

## Цепь использования настройки

### 1. Инициализация

**При запуске расширения:**
1. `src/background/background.ts` → `getGlobalSettings()` → читает `htmlTransmissionMode` из `chrome.storage.local`
2. Fallback: `'direct'` если настройки не найдены
3. Background script готов к обработке workflow с выбранным режимом

**При открытии страницы настроек:**
1. `pages/options/src/components/SettingsTab.tsx` → `loadHtmlTransmissionMode()` → читает настройки из `chrome.storage.local`
2. Fallback: `'direct'` если настройки не найдены
3. Устанавливает состояние React компонента
4. Отображает переключатель в правильном положении

### 2. Работа с плагинами

**RUN_WORKFLOW процесс:**
1. `src/background/background.ts` → `handleRunWorkflow()` → получает `htmlTransmissionMode` из глобальных настроек
2. Если `htmlTransmissionMode === 'direct'` И размер HTML < 50MB:
   - Вызывается `sendHtmlDirectly()` для прямой передачи
   - HTML передается целиком в `EXECUTE_WORKFLOW`
3. Если `htmlTransmissionMode === 'chunks'` ИЛИ размер HTML >= 50MB:
   - Вызывается `chunkManager.sendInChunks()` для передачи чанками
   - HTML разбивается на куски по 32KB
   - Куски передаются последовательно через `HTML_CHUNK` сообщения

### 3. Обработка в оффлайн-документе

**Получение HTML:**
1. `chrome-extension/public/offscreen.js` → `handleExecuteWorkflow()`
2. Проверяет `useChunks` флаг в сообщении
3. Если `useChunks === false`: использует `assembledHtml` (прямая передача)
4. Если `useChunks === true`: собирает HTML из чанков через `handleHtmlChunk()`

**Хранение HTML:**
- Прямая передача: `htmlDirectStorage` Map в памяти
- Чанки: собираются в `assembledHtml` через `HTML_ASSEMBLED` сообщения

### 4. Выполнение плагина

**Передача в плагин:**
1. Оффлайн-документ → `EXECUTE_WORKFLOW` → передает HTML в MCP сервер
2. MCP сервер → `mcp_server.py` → обрабатывает HTML согласно настройкам плагина
3. Результаты → возвращаются через `WORKFLOW_COMPLETED`

## Режимы передачи

### Direct Mode (Прямая передача)
- **Файлы:** `src/background/background.ts` → `sendHtmlDirectly()`
- **Преимущества:** Быстрее, меньше накладных расходов
- **Ограничения:** Не работает с HTML > 50MB
- **Использование:** Подходит для большинства страниц

### Chunked Mode (Передача чанками)
- **Файлы:** `src/background/background.ts` → `chunkManager.sendInChunks()`
- **Преимущества:** Работает с любыми размерами HTML
- **Ограничения:** Медленнее, больше накладных расходов
- **Использование:** Для очень больших документов или нестабильных соединений

## Значения по умолчанию

### Новые установки
- **htmlTransmissionMode:** `'direct'` (прямая передача по умолчанию)
- **Причина:** Лучшая производительность для большинства случаев

### Существующие установки
- Сохраняют свои настройки в `chrome.storage.local`
- Fallback: `'direct'` при отсутствии сохраненных настроек

## Взаимодействие с другими системами

### Plugin Manager
- Читает настройки через `getPluginSettings()`
- Применяет их при инициализации плагинов

### Chrome Storage API
- Использует `chrome.storage.local` для persistence
- Синхронизирует настройки между всеми компонентами

### Error Handling
- Graceful fallback на `'direct'` при ошибках чтения настроек
- Логирование всех операций для отладки

## Отладка и мониторинг

### Логи
```javascript
// В SettingsTab.tsx
console.log('[SettingsTab][DEBUG] 📊 Loaded htmlTransmissionMode:', mode);

// В background.ts
console.log('[background][HTML_TRANSMISSION] ✅ Global settings loaded: htmlTransmissionMode=${htmlTransmissionMode}');

// В offscreen.js
console.log('[offscreen][EXECUTE_WORKFLOW] Using direct transmission for plugin:', pluginId);
```

### Хранение данных
- **chrome.storage.local:** `htmlTransmissionMode` → `'direct'` | `'chunks'`
- **IndexedDB:** История настроек для каждого плагина
- **Memory:** Текущие настройки в runtime

## Миграция и совместимость

### Обратная совместимость
- Старые установки продолжают работать со своими настройками
- Новый fallback `'direct'` не влияет на существующие конфигурации

### Миграция данных
- Автоматическая миграция при обновлении расширения
- Сохранение пользовательских настроек при обновлении

## Производительность

### Метрики
- **Прямая передача:** ~1-2 секунды для 1MB HTML
- **Чанки:** ~2-5 секунд для 1MB HTML (зависит от количества чанков)
- **Память:** Прямая передача использует меньше памяти при обработке

### Рекомендации
- **По умолчанию:** `'direct'` для лучшей производительности
- **Большие сайты:** `'chunks'` для стабильности
- **Слабые устройства:** `'chunks'` для снижения нагрузки на память

---

**Создано:** 2025-09-23
**Обновлено:** 2025-09-23
**Ответственный:** Frontend Team
**Статус:** Активно используется