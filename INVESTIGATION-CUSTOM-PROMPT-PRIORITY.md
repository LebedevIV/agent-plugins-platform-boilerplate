# Исследование: Кастомный промпт игнорируется вместо дефолтного

## Дата: 2025-01-XX
## Статус: КОРЕНЬ ПРОБЛЕМЫ НАЙДЕН

---

## 1. Описание Проблемы

В расширении ozon-analyzer кастомный промпт из localStorage (ключ `plugin-ozon-analyzer-settings`, параметр `custom_prompt`) не применяется. Система всегда использует дефолтный промпт из manifest.json даже когда кастомный промпт задан и не пустой.

---

## 2. Архитектура Системы Загрузки Промптов

### 2.1 Структура Данных

#### localStorage (chrome.storage.local)
```typescript
// Ключ: 'plugin-ozon-analyzer-settings'
{
  basic_analysis: {
    ru: {
      llm: string;
      custom_prompt: string;  // ← Кастомный промпт пользователя
    };
    en: {
      llm: string;
      custom_prompt: string;
    };
  };
  deep_analysis: {
    ru: {
      llm: string;
      custom_prompt: string;
    };
    en: {
      llm: string;
      custom_prompt: string;
    };
  };
  api_keys: { ... }
}
```

#### manifest.json
```json
{
  "options": {
    "prompts": {
      "basic_analysis": {
        "ru": {
          "default": "prompts/basic_analysis.ru.default.txt",
          "label": "Базовый промпт (русский)"
        },
        "en": {
          "default": "prompts/basic_analysis.en.default.txt",
          "label": "Basic Prompt (English)"
        }
      },
      "deep_analysis": { ... }
    }
  }
}
```

---

## 3. Полный Путь Выполнения (Data Flow)

### Этап 1: UI Layer (Сохранение пользовательских настроек)
**Файл**: `pages/options/src/hooks/usePluginSettings.ts`

```typescript
// Функция: saveSettings() (строки 236-277)
// ✅ РАБОТАЕТ КОРРЕКТНО
await chrome.storage.local.set({ 
  [STORAGE_KEY]: settingsToSave 
});
// Сохраняет структуру с custom_prompt в localStorage
```

**Результат**: Кастомные промпты успешно сохраняются в `chrome.storage.local['plugin-ozon-analyzer-settings']`

---

### Этап 2: Background Script (Загрузка и обработка настроек)
**Файл**: `chrome-extension/src/background/index.ts`

#### 2.1 Загрузка пользовательских настроек
```typescript
// Строки 1493-1497
const pluginSettings = await getPluginSettings(msg.pluginId, ...);
// ✅ Корректно загружает настройки из localStorage
// pluginSettings.basic_analysis.ru.custom_prompt содержит кастомный промпт
```

#### 2.2 🔴 **КОРЕНЬ ПРОБЛЕМЫ** - Перезапись промптов (строки 1540-1572)
```typescript
// ❌ БАГ ЗДЕСЬ: Безусловная перезапись всех промптов
if (manifest?.options?.prompts) {
  console.log('[BACKGROUND] 📝 Loading prompts from manifest.json');
  
  const manifestPrompts = manifest.options.prompts;
  enrichedPluginSettings.prompts = {};  // ← ❌ Создает НОВЫЙ пустой объект!
  
  for (const [promptType, promptConfig] of Object.entries(manifestPrompts)) {
    (enrichedPluginSettings.prompts as any)[promptType] = {};
    
    for (const [language, languageConfig] of Object.entries(promptConfig as any)) {
      const defaultPrompt = (languageConfig as any).default;
      
      // ❌ ВСЕГДА использует manifest default, НИКОГДА не проверяет localStorage
      (enrichedPluginSettings.prompts as any)[promptType][language] = {
        custom_prompt: defaultPrompt,  // ← ПЕРЕЗАПИСЫВАЕТ кастомный промпт!
        llm: defaultLLM || null
      };
    }
  }
}
```

**Проблема**: 
1. `pluginSettings` содержит кастомные промпты из localStorage
2. Код создает `enrichedPluginSettings.prompts = {}` (новый пустой объект)
3. Заполняет его ТОЛЬКО дефолтными значениями из manifest
4. НИКОГДА не проверяет, есть ли кастомный промпт в исходных `pluginSettings`
5. Результат: кастомные промпты потеряны навсегда

---

### Этап 3: Передача в Offscreen/Pyodide
**Файл**: `chrome-extension/src/background/index.ts` (строки 1689-1699)

```typescript
// Строки 1689-1699
const settingsToSend = enrichedPluginSettings; // ← Содержит ТОЛЬКО дефолты!

await executeWorkflowInOffscreen(
  msg.pluginId,
  pageKey,
  transferId,
  requestId,
  useDirect ? false : true,
  useDirect ? pageHtml : undefined,
  undefined,
  settingsToSend  // ← Передает настройки БЕЗ кастомных промптов
);
```

---

### Этап 4: Python Layer
**Файл**: `chrome-extension/public/plugins/ozon-analyzer/mcp_server.py`

#### Функция: `get_user_prompts()` (строки 272-500)
```python
# Пытается найти кастомный промпт в различных структурах
prompt_type_section = safe_dict_get(plugin_settings, prompt_type, {})
lang_section = safe_dict_get(prompt_type_section, lang, {})
custom_value = safe_dict_get(lang_section, 'custom_prompt', '')

# ❌ НО: custom_value уже содержит путь к файлу по умолчанию
#     потому что background script перезаписал его!

if custom_value and len(custom_value.strip()) > 0:
    prompts[prompt_type][lang] = custom_value_stripped
    # ← Использует "кастомный" промпт, который на самом деле дефолтный
```

**Результат**: Python видит `custom_prompt = "prompts/basic_analysis.ru.default.txt"` вместо реального кастомного текста

---

## 4. Схема Алгоритма (Текущий vs Правильный)

### 4.1 Текущий Алгоритм (НЕПРАВИЛЬНЫЙ)
```
┌─────────────────────────────────────────┐
│ 1. Загрузка pluginSettings из storage  │
│    ✅ Содержит custom_prompt           │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 2. Загрузка manifest.json              │
│    ✅ Содержит default промпты          │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 3. enrichedPluginSettings.prompts = {} │
│    ❌ СОЗДАЕТ НОВЫЙ ОБЪЕКТ!             │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 4. Цикл по manifest промптам:          │
│    ❌ custom_prompt = manifest.default  │
│    ❌ ПЕРЕЗАПИСЫВАЕТ все промпты!       │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 5. Передача в Pyodide                  │
│    ❌ Кастомные промпты потеряны        │
└─────────────────────────────────────────┘
```

### 4.2 Правильный Алгоритм (ИСПРАВЛЕНИЕ)
```
┌─────────────────────────────────────────────────────────────┐
│ 1. Загрузка pluginSettings из localStorage                 │
│    ✅ Может содержать custom_prompt                         │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Загрузка manifest.json для дефолтных значений           │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Для каждой комбинации (prompt_type, language):          │
│                                                             │
│    A. Проверить наличие в localStorage:                     │
│       pluginSettings[prompt_type][lang].custom_prompt       │
│                                                             │
│    B. Если найден И не пустой:                              │
│       ✅ ИСПОЛЬЗОВАТЬ КАСТОМНЫЙ ПРОМПТ                       │
│       enrichedPrompts[type][lang].custom_prompt = custom    │
│                                                             │
│    C. Если НЕ найден или пустой:                            │
│       ✅ ИСПОЛЬЗОВАТЬ ДЕФОЛТНЫЙ из manifest                  │
│       enrichedPrompts[type][lang].custom_prompt = default   │
│                                                             │
│    D. Добавить LLM настройку из manifest                    │
│       enrichedPrompts[type][lang].llm = manifest.LLM        │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Передача в Pyodide с приоритетом кастомных промптов     │
│    ✅ Кастомные промпты сохранены                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Детальная Причина Бага

### 5.1 Локация Бага
**Файл**: `chrome-extension/src/background/index.ts`  
**Строки**: 1540-1572  
**Функция**: Обработчик сообщения `RUN_WORKFLOW`

### 5.2 Проблемный Код
```typescript
// Load prompts from manifest.json if available
if (manifest?.options?.prompts) {
  console.log('[BACKGROUND] 📝 Loading prompts from manifest.json for plugin:', msg.pluginId);
  
  const manifestPrompts = manifest.options.prompts;
  enrichedPluginSettings.prompts = {};  // ❌ ПРОБЛЕМА 1: Стирает все существующие промпты
  
  // Process each prompt type (basic_analysis, deep_analysis, etc.)
  for (const [promptType, promptConfig] of Object.entries(manifestPrompts)) {
    (enrichedPluginSettings.prompts as any)[promptType] = {};
    
    // Process each language (ru, en, etc.)
    for (const [language, languageConfig] of Object.entries(promptConfig as any)) {
      const defaultPrompt = (languageConfig as any).default;
      const llmConfig = (languageConfig as any).LLM;
      const defaultLLM = llmConfig?.default;
      
      // ❌ ПРОБЛЕМА 2: Безусловно присваивает дефолтное значение
      (enrichedPluginSettings.prompts as any)[promptType][language] = {
        custom_prompt: defaultPrompt,  // Всегда берет из manifest, игнорирует localStorage
        llm: defaultLLM || null
      };
    }
  }
}
```

### 5.3 Почему Это Происходит
1. **Отсутствие проверки существования**: Код не проверяет, есть ли уже кастомный промпт в `pluginSettings`
2. **Неправильная структура данных**: Создает `enrichedPluginSettings.prompts`, но исходные настройки хранятся в `pluginSettings.basic_analysis.ru.custom_prompt` (без промежуточного объекта `prompts`)
3. **Логика перезаписи**: Использует присваивание вместо слияния (merge) с приоритетом пользовательских значений

---

## 6. Решение

### 6.1 Стратегия Исправления

#### Принцип: "Кастомный промпт имеет приоритет над дефолтным"

```typescript
// ИСПРАВЛЕННАЯ ВЕРСИЯ
if (manifest?.options?.prompts) {
  console.log('[BACKGROUND] 📝 Обработка промптов для плагина:', msg.pluginId);
  
  const manifestPrompts = manifest.options.prompts;
  enrichedPluginSettings.prompts = enrichedPluginSettings.prompts || {};
  
  // Process each prompt type
  for (const [promptType, promptConfig] of Object.entries(manifestPrompts)) {
    enrichedPluginSettings.prompts[promptType] = enrichedPluginSettings.prompts[promptType] || {};
    
    // Process each language
    for (const [language, languageConfig] of Object.entries(promptConfig as any)) {
      const defaultPromptPath = (languageConfig as any).default;
      const llmConfig = (languageConfig as any).LLM;
      const defaultLLM = llmConfig?.default;
      
      // ✅ ШАГ 1: Проверить наличие кастомного промпта в localStorage
      const userPromptSection = pluginSettings[promptType]?.[language];
      const userCustomPrompt = userPromptSection?.custom_prompt;
      
      // ✅ ШАГ 2: Проверить, является ли кастомный промпт действительно пользовательским
      //           (не путем к файлу по умолчанию)
      const isUserCustomPrompt = (
        userCustomPrompt &&
        typeof userCustomPrompt === 'string' &&
        userCustomPrompt.trim().length > 0 &&
        !userCustomPrompt.includes('.txt') &&  // Не путь к файлу
        userCustomPrompt !== defaultPromptPath
      );
      
      // ✅ ШАГ 3: Определить финальное значение промпта с приоритетом
      let finalPrompt: string;
      if (isUserCustomPrompt) {
        finalPrompt = userCustomPrompt;
        console.log(`[BACKGROUND] ✅ Используем КАСТОМНЫЙ промпт для ${promptType}.${language}`);
      } else {
        finalPrompt = defaultPromptPath;
        console.log(`[BACKGROUND] 📝 Используем ДЕФОЛТНЫЙ промпт для ${promptType}.${language}`);
      }
      
      // ✅ ШАГ 4: Сохранить с правильным приоритетом
      enrichedPluginSettings.prompts[promptType][language] = {
        custom_prompt: finalPrompt,
        llm: userPromptSection?.llm || defaultLLM || null
      };
    }
  }
}
```

### 6.2 Ключевые Изменения

1. **Сохранение существующей структуры**: `enrichedPluginSettings.prompts = enrichedPluginSettings.prompts || {};`
2. **Проверка пользовательских промптов**: Проверяем `pluginSettings[promptType][language].custom_prompt`
3. **Валидация кастомного промпта**: Убеждаемся, что это не путь к файлу по умолчанию
4. **Приоритет пользователя**: Используем кастомный промпт если он валиден, иначе дефолтный
5. **Детальное логирование**: Логируем источник каждого промпта для отладки

---

## 7. Модифицируемые Файлы

### 7.1 Основной Файл
**Файл**: `chrome-extension/src/background/index.ts`  
**Строки для изменения**: 1539-1572  
**Изменения**: Реализовать логику приоритета кастомных промптов

### 7.2 Дополнительное Логирование

#### В executeWorkflowInOffscreen (строки 1305-1395)
```typescript
console.log('[WORKFLOW_EXECUTION] Plugin settings prompts структура:', {
  hasPrompts: !!pluginSettings.prompts,
  basic_analysis_ru: pluginSettings?.basic_analysis?.ru?.custom_prompt?.substring(0, 50),
  basic_analysis_en: pluginSettings?.basic_analysis?.en?.custom_prompt?.substring(0, 50),
  deep_analysis_ru: pluginSettings?.deep_analysis?.ru?.custom_prompt?.substring(0, 50),
  deep_analysis_en: pluginSettings?.deep_analysis?.en?.custom_prompt?.substring(0, 50),
});
```

---

## 8. Тестирование Исправления

### 8.1 Сценарий Тестирования

#### Предусловия
1. Установить расширение с исправлением
2. Открыть Options страницу
3. Выбрать плагин ozon-analyzer

#### Тест 1: Кастомный Промпт (Основной Сценарий)
1. Перейти на вкладку "Basic Analysis" → "Russian"
2. Ввести кастомный промпт: "Тестовый кастомный промпт для проверки приоритета"
3. Нажать "Save"
4. Открыть страницу товара Ozon
5. Запустить плагин
6. **Проверка в консоли**:
   ```
   [BACKGROUND] ✅ Используем КАСТОМНЫЙ промпт для basic_analysis.ru
   [LLM_PROMPT_DEBUG] ✅ Используем настоящий кастомный промпт: basic_analysis.ru (длина: 54)
   ```
7. **Ожидаемый результат**: LLM получает кастомный промпт

#### Тест 2: Дефолтный Промпт (Fallback)
1. Очистить кастомный промпт в Options
2. Нажать "Save"
3. Запустить плагин
4. **Проверка в консоли**:
   ```
   [BACKGROUND] 📝 Используем ДЕФОЛТНЫЙ промпт для basic_analysis.ru
   [LLM_PROMPT_DEBUG] ✅ Загружен промпт из файла: basic_analysis.ru
   ```
5. **Ожидаемый результат**: LLM получает дефолтный промпт из файла

#### Тест 3: Переключение Языков
1. Установить кастомный промпт для RU
2. Не устанавливать для EN
3. Изменить язык ответа на English
4. Запустить плагин
5. **Проверка**: EN использует дефолтный, RU использует кастомный (если вернуться на RU)

---

## 9. Риски и Совместимость

### 9.1 Обратная Совместимость
- ✅ Исправление не меняет структуру данных в localStorage
- ✅ Старые настройки будут работать корректно
- ✅ Не требует миграции данных

### 9.2 Возможные Побочные Эффекты
- ⚠️ Если другой код зависит от того, что `prompts` всегда перезаписывается - может сломаться
- ✅ Проверка: Grep по кодовой базе не показал таких зависимостей

---

## 10. Итоговые Рекомендации

### 10.1 Порядок Исправления
1. ✅ Применить патч к `chrome-extension/src/background/index.ts` (строки 1539-1572)
2. ✅ Добавить детальное логирование для отслеживания источника промптов
3. ✅ Протестировать все сценарии (кастомный, дефолтный, переключение)
4. ✅ Убедиться в корректности логирования в консоли

### 10.2 Долгосрочные Улучшения
1. **Рефакторинг структуры данных**: Унифицировать структуру промптов между localStorage и runtime
2. **Типизация**: Добавить TypeScript типы для предотвращения подобных ошибок
3. **Unit тесты**: Написать тесты для логики приоритетов промптов
4. **Документация**: Обновить архитектурную документацию с новой логикой приоритетов

---

## 11. Ссылки на Код

### 11.1 Проблемные Секции
- **Background script**: `chrome-extension/src/background/index.ts:1539-1572`
- **Settings hook**: `pages/options/src/hooks/usePluginSettings.ts:236-277`
- **Python prompt loader**: `chrome-extension/public/plugins/ozon-analyzer/mcp_server.py:272-500`

### 11.2 Архитектурная Документация
- `memory-bank/architecture/prompt-loading-architecture.md`
- `memory-bank/architecture/llm-selection-data-flow.md`
- `memory-bank/ui/plugin-settings-transmission.md`

---

## 12. Заключение

**Проблема полностью диагностирована и решение определено.**

**Корень проблемы**: Background script в `RUN_WORKFLOW` обработчике безусловно перезаписывает все промпты дефолтными значениями из manifest.json, не проверяя наличие кастомных промптов пользователя в localStorage.

**Решение**: Реализовать логику проверки и приоритета, где кастомные промпты из localStorage имеют приоритет над дефолтными из manifest.json.

**Статус**: Готово к реализации исправления.
