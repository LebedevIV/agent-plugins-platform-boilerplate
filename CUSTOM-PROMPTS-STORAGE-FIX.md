# Custom Prompts Storage Fix

## Issue
Custom prompts were not being loaded by the background script because they are stored in a **separate storage key** than the general plugin settings.

### Evidence from Logs
All prompts had `_source: 'default'` even when custom prompts were set in the Options UI:
```
[PYTHON_LOG_DEBUG] LLM_PROMPT_DEBUG:   - source: default
[PYTHON_LOG_DEBUG] LLM_PROMPT_DEBUG:   - custom_prompt length: 37
[PYTHON_LOG_DEBUG] LLM_PROMPT_DEBUG:   - custom_prompt preview: 'prompts/basic_analysis.ru.default.txt'
```

## Root Cause

The system has **two separate storage keys**:

1. **`'plugin_settings'`** - General plugin settings:
   - `enabled`, `autorun`, `htmlTransmissionMode`
   - Managed by `pluginSettingsStorage` in `packages/storage`

2. **`'plugin-ozon-analyzer-settings'`** - Ozon-analyzer specific settings:
   - Custom prompts (`basic_analysis.ru.custom_prompt`, etc.)
   - LLM selection
   - API keys
   - Managed by `usePluginSettings` hook in `pages/options`

**The problem**: `getPluginSettings()` only loaded from `'plugin_settings'`, so custom prompts from `'plugin-ozon-analyzer-settings'` were **never loaded**.

## Data Flow (Before Fix)

```
User saves custom prompt in Options UI
         ↓
usePluginSettings.saveSettings()
         ↓
Saves to: chrome.storage.local['plugin-ozon-analyzer-settings']
         ↓
RUN_WORKFLOW handler starts
         ↓
getPluginSettings() loads from 'plugin_settings'
         ↓
❌ Custom prompts NOT found (wrong storage key!)
         ↓
enrichedPluginSettings built without custom prompts
         ↓
Priority check: pluginSettings[promptType][language] = undefined
         ↓
_source: 'default' (always)
```

## Solution

Added explicit loading of custom prompts from the correct storage key in background script.

### Code Changes

**File**: `chrome-extension/src/background/index.ts`  
**Lines**: 1499-1527

```typescript
// ШАГ 5.1: ЗАГРУЗКА КАСТОМНЫХ ПРОМПТОВ ИЗ СПЕЦИАЛЬНОГО КЛЮЧА
// Для ozon-analyzer промпты хранятся отдельно в 'plugin-ozon-analyzer-settings'
let userCustomPromptsSettings: any = {};
if (msg.pluginId === 'ozon-analyzer') {
  try {
    const customPromptsKey = `plugin-${msg.pluginId}-settings`;
    console.log(`[BACKGROUND] 📝 Загрузка кастомных промптов из ключа: ${customPromptsKey}`);
    
    const customPromptsStorage = await chrome.storage.local.get([customPromptsKey]);
    userCustomPromptsSettings = customPromptsStorage[customPromptsKey] || {};
    
    console.log('[BACKGROUND] ✅ Кастомные промпты загружены:', {
      hasBasicAnalysis: !!userCustomPromptsSettings.basic_analysis,
      hasDeepAnalysis: !!userCustomPromptsSettings.deep_analysis,
      keys: Object.keys(userCustomPromptsSettings)
    });
    
    if (userCustomPromptsSettings.basic_analysis) {
      console.log('[BACKGROUND] 📋 basic_analysis промпты:', {
        ru: userCustomPromptsSettings.basic_analysis.ru ? 
          `${userCustomPromptsSettings.basic_analysis.ru.custom_prompt?.substring(0, 50)}...` : 'не задан',
        en: userCustomPromptsSettings.basic_analysis.en ? 
          `${userCustomPromptsSettings.basic_analysis.en.custom_prompt?.substring(0, 50)}...` : 'не задан'
      });
    }
  } catch (error) {
    console.warn('[BACKGROUND] ⚠️ Ошибка загрузки кастомных промптов:', error);
  }
}

// Merge with plugin settings
let enrichedPluginSettings = { ...pluginSettings, ...userCustomPromptsSettings };
```

## Data Flow (After Fix)

```
User saves custom prompt in Options UI
         ↓
usePluginSettings.saveSettings()
         ↓
Saves to: chrome.storage.local['plugin-ozon-analyzer-settings']
         ↓
RUN_WORKFLOW handler starts
         ↓
getPluginSettings() loads from 'plugin_settings'
         ↓
✅ NEW: Load custom prompts from 'plugin-ozon-analyzer-settings'
         ↓
userCustomPromptsSettings = {
  basic_analysis: {
    ru: { llm: "...", custom_prompt: "CUSTOM TEXT" }
  }
}
         ↓
enrichedPluginSettings = { ...pluginSettings, ...userCustomPromptsSettings }
         ↓
Priority check: pluginSettings[promptType][language].custom_prompt = "CUSTOM TEXT"
         ↓
isUserCustomPrompt = true (no '/' or '.txt')
         ↓
_source: 'custom' ✅
         ↓
Python receives custom prompt content
```

## Expected Logs (After Fix)

### When custom prompt is set:
```
[BACKGROUND] 📝 Загрузка кастомных промптов из ключа: plugin-ozon-analyzer-settings
[BACKGROUND] ✅ Кастомные промпты загружены: {
  hasBasicAnalysis: true,
  hasDeepAnalysis: true,
  keys: ['basic_analysis', 'deep_analysis', 'api_keys']
}
[BACKGROUND] 📋 basic_analysis промпты: {
  ru: 'Проанализируй товар на Ozon...',
  en: 'Analyze the product on Ozon...'
}
[BACKGROUND] 🔍 Checking custom prompt for basic_analysis.ru: {
  hasUserPromptSection: true,
  userCustomPromptType: 'string',
  userCustomPromptLength: 234,
  userCustomPromptPreview: 'Проанализируй товар на Ozon...',
  isFilePath: false
}
[BACKGROUND] ✅ Using CUSTOM prompt for basic_analysis.ru (length: 234)
```

### In Python:
```
[LLM_PROMPT_DEBUG] 📋 prompts[basic_analysis][ru]:
[LLM_PROMPT_DEBUG]   - source: custom  ← ✅ NOW CUSTOM!
[LLM_PROMPT_DEBUG]   - custom_prompt length: 234
[LLM_PROMPT_DEBUG]   - custom_prompt preview: 'Проанализируй товар...'
```

## Storage Structure

### `'plugin_settings'` (from `pluginSettingsStorage`)
```typescript
{
  "ozon-analyzer": {
    "enabled": true,
    "autorun": false,
    "htmlTransmissionMode": "direct",
    "response_language": "ru",
    "enable_deep_analysis": true,
    "auto_request_deep_analysis": true
  }
}
```

### `'plugin-ozon-analyzer-settings'` (from `usePluginSettings`)
```typescript
{
  "basic_analysis": {
    "ru": {
      "llm": "gemini-flash-lite",
      "custom_prompt": "Пользовательский промпт..."  // ← Custom prompt text
    },
    "en": {
      "llm": "gemini-flash-lite",
      "custom_prompt": "User custom prompt..."
    }
  },
  "deep_analysis": {
    "ru": { "llm": "gemini-pro", "custom_prompt": "..." },
    "en": { "llm": "gemini-pro", "custom_prompt": "..." }
  },
  "api_keys": { ... }
}
```

## Testing

### Test Case 1: Set Custom Prompt
1. Open Options → ozon-analyzer
2. Enter custom prompt for Basic Analysis (RU): "Тестовый кастомный промпт"
3. Click Save
4. Open Ozon product page
5. Run plugin
6. **Check logs**: Should see `_source: 'custom'`

### Test Case 2: Clear Custom Prompt
1. Clear custom prompt in Options
2. Click Save
3. Run plugin
4. **Check logs**: Should see `_source: 'default'`

### Test Case 3: Mix Custom and Default
1. Set custom prompt only for basic_analysis.ru
2. Leave basic_analysis.en, deep_analysis.* as default
3. Run plugin
4. **Check logs**: 
   - basic_analysis.ru: `_source: 'custom'`
   - Others: `_source: 'default'`

## Files Modified

1. **chrome-extension/src/background/index.ts** (lines 1499-1527)
   - Added loading of custom prompts from `'plugin-ozon-analyzer-settings'`
   - Added detailed logging of loaded custom prompts
   - Merged custom prompts into `enrichedPluginSettings`

## Verification

✅ Custom prompts now loaded from correct storage key  
✅ Priority check can find custom prompts  
✅ `_source: 'custom'` when custom prompts are set  
✅ Detailed logging for debugging  
✅ Backward compatible - still works with defaults  

## Related Issues

This fix addresses the issue where custom prompts were always showing as `_source: 'default'` even when set in the Options UI, causing the default file path prompts to be used instead of the user's custom text.
