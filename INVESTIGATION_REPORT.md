# Исследование: Custom Prompt Override в ozon-analyzer

## Резюме проблемы
Расширение ozon-analyzer всегда использует дефолтный промпт из manifest.json, даже когда в localStorage для комбинации "Тип промпта/Язык промпта" задан кастомный промпт.

---

## 1. МЕСТО ХРАНЕНИЯ ПОЛЬЗОВАТЕЛЬСКИХ НАСТРОЕК

### 1.1 Структура localStorage для ozon-analyzer
- **Ключ хранилища**: `plugin-ozon-analyzer-settings` (chrome.storage.local)
- **Структура данных**:
  ```javascript
  {
    "plugin-ozon-analyzer-settings": {
      "basic_analysis": {
        "ru": {
          "llm": "gemini-flash-lite",
          "custom_prompt": "ПОЛЬЗОВАТЕЛЬСКИЙ ТЕКСТ ПРОМПТА"  // <-- КАСТОМНЫЙ ПРОМПТ
        },
        "en": {
          "llm": "gemini-flash-lite",
          "custom_prompt": ""  // Пусто - не установлен
        }
      },
      "deep_analysis": {
        "ru": {
          "llm": "gemini-pro",
          "custom_prompt": "ДРУГОЙ КАСТОМНЫЙ ПРОМПТ"
        },
        "en": {
          "llm": "gemini-pro", 
          "custom_prompt": ""
        }
      }
    }
  }
  ```

### 1.2 Файл с определением структуры
**Файл**: `/home/engine/project/pages/options/src/hooks/usePluginSettings.ts`
- **Строки**: 4-37 (PluginSettings интерфейс)
- **Ключ хранилища**: строка 39 - `const STORAGE_KEY = 'plugin-ozon-analyzer-settings'`

---

## 2. ГДЕ ЗАГРУЖАЕТСЯ ДЕФОЛТНЫЙ ПРОМПТ (БАГ)

### 2.1 Проблемный код в background.ts
**Файл**: `/home/engine/project/chrome-extension/src/background/index.ts`
**Строки**: 1540-1572 (обработчик RUN_WORKFLOW сообщения)

```typescript
// ПРОБЛЕМА: Код загружает промпты ТОЛЬКО из manifest.json
// и НИКОГДА не проверяет localStorage на кастомные промпты

if (manifest?.options?.prompts) {
  console.log('[BACKGROUND] 📝 Loading prompts from manifest.json for plugin:', msg.pluginId);

  const manifestPrompts = manifest.options.prompts;
  enrichedPluginSettings.prompts = {};

  // Process each prompt type (basic_analysis, deep_analysis, etc.)
  for (const [promptType, promptConfig] of Object.entries(manifestPrompts)) {
    (enrichedPluginSettings.prompts as any)[promptType] = {};

    // Process each language (ru, en, etc.)
    for (const [language, languageConfig] of Object.entries(promptConfig as any)) {
      const defaultPrompt = (languageConfig as any).default;  // <-- ЭТО ТОЛЬКО ПУТЬ К ФАЙЛУ!
      const llmConfig = (languageConfig as any).LLM;

      // ТОЧКА ПРОБЛЕМЫ: Устанавливается значение по умолчанию
      // БЕЗ ПРОВЕРКИ кастомного промпта из localStorage
      (enrichedPluginSettings.prompts as any)[promptType][language] = {
        custom_prompt: defaultPrompt,  // <-- ВСЕГДА ДЕФОЛТНОЕ ЗНАЧЕНИЕ!
        llm: defaultLLM || null
      };
    }
  }
}
```

### 2.2 Что происходит на строке 1563
- `custom_prompt` устанавливается в значение `defaultPrompt` 
- `defaultPrompt` - это СТРОКА ПУТИ к файлу (например: `"prompts/basic_analysis.ru.default.txt"`)
- Это НЕ реальный текст промпта, а путь к файлу в манифесте

### 2.3 Следующие стадии обработки
1. **Строка 1689**: `const settingsToSend = enrichedPluginSettings;` - промпты со значениями из manifest передаются дальше
2. **Строка 1728**: `await sendHtmlDirectly(...)` - эти настройки отправляются в offscreen document
3. **Строка 1755+**: В chunked mode также используется `settingsToSend` с дефолтными промптами

---

## 3. КОД ДЛЯ СОХРАНЕНИЯ КАСТОМНЫХ ПРОМПТОВ (UI)

### 3.1 Где сохраняются кастомные промпты
**Файл**: `/home/engine/project/pages/options/src/components/PluginDetails.tsx`
**Функция**: `PromptsEditor` компонента

**Строки 159-182** - функция handleSave:
```typescript
const handleSave = () => {
  try {
    const updatedPrompts: PromptsStructure = {
      basic_analysis: {
        ru: promptType === 'basic_analysis' && language === 'ru' ? customPrompt : ...,
        en: promptType === 'basic_analysis' && language === 'en' ? customPrompt : ...,
      },
      deep_analysis: {
        ru: promptType === 'deep_analysis' && language === 'ru' ? customPrompt : ...,
        en: promptType === 'deep_analysis' && language === 'en' ? customPrompt : ...,
      },
    };
    
    // Вызывает saveSettings из usePluginSettings hook
    onSave(updatedPrompts);
  } catch (error) {
    console.error('Failed to save custom prompt:', error);
  }
};
```

### 3.2 Где сохраняется в localStorage
**Файл**: `/home/engine/project/pages/options/src/hooks/usePluginSettings.ts`
**Функция**: `saveSettings` (строки 236-277)

```typescript
const saveSettings = async (newSettings: PluginSettings) => {
  // ...шифруем API ключи...
  
  const settingsToSave = { ...newSettings };
  // settingsToSave содержит структуру с custom_prompt
  
  // СОХРАНЯЕТ В STORAGE
  await chrome.storage.local.set({ [STORAGE_KEY]: settingsToSave });
  setSettings(newSettings);
};
```

**КЛЮЧЕВОЙ МОМЕНТ**: Пользовательские промпты СОХРАНЯЮТСЯ в localStorage под ключом `plugin-ozon-analyzer-settings`, но фоновый скрипт их НИКОГДА не загружает!

---

## 4. ИДЕНТИФИКАЦИЯ ПРИЧИН БАГА

### 4.1 Первичная причина
**ОТСУТСТВИЕ ПРОВЕРКИ кастомного промпта перед использованием дефолтного**

На строке 1540-1572 в `/chrome-extension/src/background/index.ts`:
- Код загружает manifest.json 
- Устанавливает `custom_prompt` в путь к файлу
- **НИКОГДА** не проверяет localStorage на наличие пользовательского промпта
- **НИКОГДА** не вызывает `chrome.storage.local.get('plugin-ozon-analyzer-settings')`

### 4.2 Вторичные проблемы
1. **Неправильный порядок приоритизации**: Дефолт используется ДО проверки кастомного
2. **Отсутствие кеширования синхронизации**: Нет механизма для отслеживания изменений в localStorage
3. **Отсутствие слоя абстракции**: Код не использует функцию для получения промпта с логикой приоритизации

### 4.3 Почему это было упущено
- `plugin-ozon-analyzer-settings` - это **специфичный для плагина** storage key
- Общий `pluginSettingsStorage` (из packages/storage) НЕ содержит эти данные
- Код background.ts использует общий `getPluginSettings()` который работает с `pluginSettingsStorage`, а не с `plugin-ozon-analyzer-settings`

---

## 5. МЕСТА В КОДЕ ТРЕБУЮЩИЕ ИЗМЕНЕНИЯ

### 5.1 Главный файл для исправления
**Файл**: `/home/engine/project/chrome-extension/src/background/index.ts`
**Строки**: 1540-1572 (и возможно области вокруг)

**Что нужно добавить**:
1. После загрузки manifest prompts (строка 1569)
2. ПЕРЕД тем как использовать prompts для отправки (строка 1689)
3. Добавить код для проверки и загрузки пользовательских промптов:

```typescript
// ПОСЛЕ строки 1569: console.log('[BACKGROUND] ✅ Prompts loaded from manifest.json:...')

// НОВЫЙ КОД: Перезаписать дефолтные промпты на кастомные (если они есть)
try {
  const pluginSpecificSettings = await chrome.storage.local.get(['plugin-ozon-analyzer-settings']);
  const customSettings = pluginSpecificSettings['plugin-ozon-analyzer-settings'];
  
  if (customSettings) {
    // Для каждой комбинации promptType/language проверить наличие custom_prompt
    for (const promptType of ['basic_analysis', 'deep_analysis']) {
      for (const language of ['ru', 'en']) {
        const customPrompt = customSettings?.[promptType]?.[language]?.custom_prompt;
        
        // Если custom_prompt НЕ пуст, используем его вместо дефолтного
        if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim().length > 0) {
          (enrichedPluginSettings.prompts as any)[promptType][language].custom_prompt = customPrompt;
          console.log(`[BACKGROUND] ✅ Loaded custom prompt for ${promptType}.${language}`);
        }
      }
    }
  }
} catch (error) {
  console.warn('[BACKGROUND] Failed to load custom prompts from localStorage:', error);
}
```

### 5.2 Файл manifest.json (для понимания структуры)
**Файл**: `/home/engine/project/chrome-extension/public/plugins/ozon-analyzer/manifest.json`
- Строки 95-160: Определение структуры промптов
- Это ТОЛЬКО для дефолтных значений

### 5.3 Связанные файлы (для контекста)
1. **usePluginSettings.ts** - сохраняет кастомные промпты
2. **PluginDetails.tsx** - UI для редактирования промптов  
3. **ai-api-client.ts** - использует промпты при вызове AI

---

## 6. РИСКИ И ПОБОЧНЫЕ ЭФФЕКТЫ

### 6.1 Если исправить наивно
**Риск**: Если просто добавить проверку localStorage, могут быть проблемы с:
- Пустыми или null значениями (нужна валидация)
- Кешированием (if data changes in localStorage, will background pick it up?)
- Синхронизацией между multiple tabs

### 6.2 Рекомендуемый подход
1. **Валидация**: Проверить что custom_prompt - это непустая строка
2. **Логирование**: Добавить подробные логи для отладки
3. **Fallback**: Если custom_prompt пуст, использовать дефолтный
4. **Тестирование**: Проверить с разными комбинациями prompt_type/language

---

## 7. РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ

### 7.1 Минимальное исправление (Quick Fix)
**Файл**: `/home/engine/project/chrome-extension/src/background/index.ts`

Добавить после строки 1569 (после логирования загрузки manifest prompts):
```typescript
// === OVERRIDE MANIFEST PROMPTS WITH CUSTOM PROMPTS FROM LOCALSTORAGE ===
try {
  const result = await chrome.storage.local.get(['plugin-ozon-analyzer-settings']);
  const ozonSettings = result['plugin-ozon-analyzer-settings'];
  
  if (ozonSettings && typeof ozonSettings === 'object') {
    console.log('[BACKGROUND] 📝 Checking for custom prompts in localStorage...');
    
    for (const promptType of ['basic_analysis', 'deep_analysis']) {
      if (!(promptType in (enrichedPluginSettings.prompts as any))) {
        (enrichedPluginSettings.prompts as any)[promptType] = {};
      }
      
      for (const language of ['ru', 'en']) {
        const customPrompt = ozonSettings?.[promptType]?.[language]?.custom_prompt;
        
        if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim().length > 0) {
          (enrichedPluginSettings.prompts as any)[promptType][language].custom_prompt = customPrompt;
          console.log(`[BACKGROUND] ✅ Using CUSTOM prompt for ${promptType}.${language}`);
        } else {
          console.log(`[BACKGROUND] ℹ️ No custom prompt for ${promptType}.${language}, using manifest default`);
        }
      }
    }
  }
} catch (error) {
  console.warn('[BACKGROUND] ⚠️ Failed to load custom prompts:', error);
  // Fallback: continue using manifest defaults
}
```

### 7.2 Оптимальное исправление (Best Practice)
1. Создать отдельную функцию для загрузки промптов с логикой приоритизации
2. Использовать эту функцию вместо инлайного кода
3. Добавить кеширование для performance

---

## 8. ПРОВЕРКА УСПЕШНОСТИ ИСПРАВЛЕНИЯ

После применения исправления нужно проверить:

1. **Сценарий 1: Custom prompt установлен**
   - Установить custom_prompt для basic_analysis.ru
   - Запустить плагин
   - Проверить логи что используется CUSTOM prompt
   - Проверить что AI получил правильный промпт

2. **Сценарий 2: Custom prompt пуст**
   - Очистить custom_prompt
   - Запустить плагин  
   - Проверить что используется MANIFEST default
   - Проверить что AI получил правильный дефолтный промпт

3. **Сценарий 3: Mixed prompts**
   - Для basic_analysis.ru установить кастомный
   - Для basic_analysis.en оставить пуст (дефолтный)
   - Проверить что каждый использует правильное значение

4. **Сценарий 4: Settings не найдены**
   - Удалить plugin-ozon-analyzer-settings из localStorage
   - Запустить плагин
   - Проверить что используется manifest default (graceful fallback)

---

## 9. ФАЙЛЫ ДЛЯ СПРАВКИ

### Структура файлов в проекте
```
/home/engine/project/
├── chrome-extension/
│   ├── src/background/
│   │   ├── index.ts (← ГЛАВНЫЙ ФАЙЛ ДЛЯ ИСПРАВЛЕНИЯ)
│   │   ├── ai-api-client.ts
│   │   └── mcp-bridge.ts
│   └── public/plugins/ozon-analyzer/
│       └── manifest.json
├── pages/
│   └── options/src/
│       ├── components/
│       │   ├── PluginDetails.tsx (← UI для редактирования)
│       │   └── LLMSelector.tsx
│       ├── hooks/
│       │   └── usePluginSettings.ts (← Сохранение в storage)
│       └── locales/
├── packages/
│   └── storage/lib/
│       └── plugin-settings.ts (← Общий storage - НЕ содержит custom prompts)
└── public/plugins/ozon-analyzer/
    └── mcp_server.py
```

### Ключевые storage keys
- `plugin-ozon-analyzer-settings` - **СПЕЦИФИЧНЫЙ ДЛЯ ПЛАГИНА** (содержит custom prompts)
- `plugin_settings` - **ОБЩИЙ** (для всех плагинов, управляет enabled/autorun)

---

## 10. SUMMARY

| Аспект | Детали |
|--------|--------|
| **Причина бага** | Background.ts загружает prompts ТОЛЬКО из manifest.json и НИКОГДА не проверяет `plugin-ozon-analyzer-settings` в localStorage |
| **Где сохраняется custom prompt** | `chrome.storage.local['plugin-ozon-analyzer-settings'][promptType][language].custom_prompt` |
| **Где загружается дефолтный** | `chrome-extension/src/background/index.ts` строки 1540-1572 |
| **Главный файл для исправления** | `/home/engine/project/chrome-extension/src/background/index.ts` |
| **Решение** | После загрузки manifest prompts (строка 1569) добавить код для проверки и перезаписи на custom prompts из localStorage |
| **Приоритет** | ВЫСОКИЙ - Custom prompts вообще не применяются |
| **Риск исправления** | НИЗКИЙ - Просто добавить fallback проверку |

