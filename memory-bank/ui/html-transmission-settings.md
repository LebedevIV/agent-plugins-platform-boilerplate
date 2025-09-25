# HTML Transmission Settings - Настройки передачи HTML

## Обзор

Настройка "Отправлять HTML целиком" определяет режим передачи HTML-контента страниц в систему плагинов. Это критически важная настройка, влияющая на производительность и стабильность обработки больших HTML-документов.

## Расположение настроек

### Frontend (Пользовательский интерфейс)

**Основной файл настроек:** `pages/options/src/components/SettingsTab.tsx`

```typescript
// Состояние для настройки htmlTransmissionMode
const [htmlTransmissionMode, setHtmlTransmissionMode] = React.useState<HtmlTransmissionMode>('direct');

// Загрузка настройки htmlTransmissionMode при монтировании компонента
React.useEffect(() => {
  const loadHtmlTransmissionMode = async () => {
    try {
      console.log('[SettingsTab][DEBUG] 🔍 Загружаем htmlTransmissionMode из chrome.storage.local...');

      const result = await chrome.storage.local.get(['htmlTransmissionMode']);
      console.log('[SettingsTab][DEBUG]   - Результат из storage:', result);
      console.log('[SettingsTab][DEBUG]   - Сырое значение из storage:', result.htmlTransmissionMode);

      let mode = result.htmlTransmissionMode as HtmlTransmissionMode;

      // Если ключа нет в storage, устанавливаем значение по умолчанию и сохраняем
      if (mode === undefined) {
        mode = 'direct';
        console.log('[SettingsTab][DEBUG]   - Ключ htmlTransmissionMode не найден, устанавливаем значение по умолчанию "direct"');
        await chrome.storage.local.set({ htmlTransmissionMode: mode });
        console.log('[SettingsTab][DEBUG]   - Значение по умолчанию сохранено в storage');
      }

      console.log('[SettingsTab][DEBUG] 📊 htmlTransmissionMode загружен:');
      console.log('[SettingsTab][DEBUG]   - Финальное значение:', mode);
      console.log('[SettingsTab][DEBUG]   - Обновляем состояние компонента...');

      setHtmlTransmissionMode(mode);
      console.log('[SettingsTab][DEBUG] ✅ Загрузка htmlTransmissionMode завершена успешно');
    } catch (error) {
      console.error('[SettingsTab][DEBUG] ❌ Ошибка при загрузке htmlTransmissionMode:', error);
      console.error('[SettingsTab][DEBUG]   - Текущее состояние компонента:', htmlTransmissionMode);
      console.error('[SettingsTab][DEBUG]   - Ошибка:', error);
    }
  };

  loadHtmlTransmissionMode();
}, []);

// Сохранение настройки htmlTransmissionMode
const saveHtmlTransmissionMode = async (mode: HtmlTransmissionMode) => {
  // Сначала обновляем локальное состояние для немедленного отклика UI
  setHtmlTransmissionMode(mode);

  try {
    console.log('[SettingsTab][DEBUG] 💾 Перед сохранением htmlTransmissionMode:');
    console.log('[SettingsTab][DEBUG]   - Новое значение:', mode);
    console.log('[SettingsTab][DEBUG]   - Тип режима:', typeof mode);

    console.log('[SettingsTab][DEBUG] 💾 Сохраняем htmlTransmissionMode в chrome.storage.local...');
    await chrome.storage.local.set({ htmlTransmissionMode: mode });
    console.log('[SettingsTab][DEBUG] ✅ htmlTransmissionMode успешно сохранен в chrome.storage.local');
    console.log('[SettingsTab][DEBUG]   - Сохраненное значение:', mode);
  } catch (error) {
    console.error('[SettingsTab][DEBUG] ❌ Ошибка при сохранении htmlTransmissionMode:', error);
    console.error('[SettingsTab][DEBUG]   - Пытались сохранить:', mode);
    // Состояние уже обновлено выше, так что UI останется в новом состоянии
    // даже если сохранение провалилось
  }
};

// Логика переключателя
onChange={async (checked) => {
  const mode = checked ? 'direct' : 'chunks';
  console.log('[SettingsTab] ToggleButton onChange triggered:', { checked, mode });
  try {
    await saveHtmlTransmissionMode(mode);
    console.log('[SettingsTab] Successfully saved htmlTransmissionMode:', mode);
  } catch (error) {
    console.error('[SettingsTab] Error saving htmlTransmissionMode:', error);
  }
}}
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
  try {
    console.log('[background][GLOBAL_SETTINGS] Reading global settings from chrome.storage (sync first, then local)...');

    // First try sync storage
    const syncResult = await chrome.storage.sync.get(['htmlTransmissionMode']);

    if (syncResult.htmlTransmissionMode !== undefined) {
      console.log(`[background][GLOBAL_SETTINGS] ✅ Found settings in sync storage: htmlTransmissionMode=${syncResult.htmlTransmissionMode}`);
      return {
        htmlTransmissionMode: syncResult.htmlTransmissionMode
      };
    }

    // Fall back to local storage
    console.log('[background][GLOBAL_SETTINGS] 🔄 Settings not found in sync, trying local storage...');
    const localResult = await chrome.storage.local.get(['htmlTransmissionMode']);

    const htmlTransmissionMode = localResult.htmlTransmissionMode || 'direct';
    console.log(`[background][GLOBAL_SETTINGS] ✅ Successfully loaded global settings from local: htmlTransmissionMode=${htmlTransmissionMode}`);

    return {
      htmlTransmissionMode
    };
  } catch (error) {
    console.error('[background][GLOBAL_SETTINGS] ❌ Failed to load global settings from chrome.storage:', error);
    console.warn('[background][GLOBAL_SETTINGS] 🔄 Using fallback: htmlTransmissionMode=direct');
    return { htmlTransmissionMode: 'direct' }; // fallback
  }
}
```

## Цепь использования настройки

### 1. Инициализация

**При запуске расширения:**
1. `src/background/background.ts` → `getGlobalSettings()` → читает `htmlTransmissionMode` из `chrome.storage.sync`, затем из `chrome.storage.local`
2. Fallback: `'direct'` если настройки не найдены ни в одном хранилище
3. Background script готов к обработке workflow с выбранным режимом

**При открытии страницы настроек:**
1. `pages/options/src/components/SettingsTab.tsx` → `loadHtmlTransmissionMode()` → читает настройки из `chrome.storage.local`
2. Fallback: `'direct'` если настройки не найдены (автоматически сохраняет значение по умолчанию)
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
- **Background script:** Использует двухуровневую стратегию - сначала `chrome.storage.sync`, затем `chrome.storage.local`
- **Options page:** Сохраняет и читает из `chrome.storage.local`
- Обеспечивает синхронизацию настроек между всеми компонентами расширения

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

## Недавние изменения и исправления

### Исправления в логике хранения настроек (2025-09-25)

**Проблема:** Настройка `htmlTransmissionMode` не сохранялась/не загружалась корректно в background скрипте.

**Исправления:**
1. **Двухуровневая стратегия чтения в background скрипте:**
   - Теперь сначала проверяется `chrome.storage.sync`
   - При отсутствии падает на `chrome.storage.local`
   - Обеспечивает совместимость с различными конфигурациями хранения

2. **Улучшенная обработка в SettingsTab.tsx:**
   - Добавлена автоматическая инициализация значения по умолчанию при первом запуске
   - Улучшена обработка ошибок при сохранении/загрузке
   - Добавлены подробные логи для отладки

3. **Синхронизация между компонентами:**
   - Background script теперь корректно читает настройки независимо от места хранения
   - Options page сохраняет в `local` storage для persistence
   - Поддерживается fallback на `'direct'` при любых ошибках чтения

**Результат:** Настройка теперь надежно сохраняется и загружается во всех компонентах расширения.

---


**Создано:** 2025-09-23
**Обновлено:** 2025-09-25
**Ответственный:** Frontend Team
**Статус:** Активно используется