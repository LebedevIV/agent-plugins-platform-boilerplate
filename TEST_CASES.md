# Test Cases: Custom Prompt Override Fix

## Test Environment Setup

### Prerequisites
1. Chrome/Edge browser with extension loaded in development mode
2. ozon-analyzer plugin installed
3. Browser DevTools open (F12) with Background Service Worker console visible
4. Access to chrome://extensions for debugging

### Test Data Preparation

#### Create Test Prompts
- **basic_analysis.ru custom**: "CUSTOM_BASIC_RU: Analyze this product card..."
- **basic_analysis.en custom**: "CUSTOM_BASIC_EN: Analyze this product card..."
- **deep_analysis.ru custom**: "CUSTOM_DEEP_RU: Perform deep analysis..."
- **deep_analysis.en custom**: "CUSTOM_DEEP_EN: Perform deep analysis..."

#### Manifest Defaults (for comparison)
Located in: `chrome-extension/public/plugins/ozon-analyzer/manifest.json`
- basic_analysis.ru: "prompts/basic_analysis.ru.default.txt"
- basic_analysis.en: "prompts/basic_analysis.en.default.txt"
- deep_analysis.ru: "prompts/deep_analysis.ru.default.txt"
- deep_analysis.en: "prompts/deep_analysis.en.default.txt"

---

## Test Cases

### TC-001: All Custom Prompts Set (Happy Path)

**Objective**: Verify that custom prompts override manifest defaults when all are set

**Setup**:
```javascript
// Open DevTools Console and execute:
chrome.storage.local.set({
  'plugin-ozon-analyzer-settings': {
    basic_analysis: {
      ru: { llm: 'gemini-flash-lite', custom_prompt: 'CUSTOM_BASIC_RU: Test prompt' },
      en: { llm: 'gemini-flash-lite', custom_prompt: 'CUSTOM_BASIC_EN: Test prompt' }
    },
    deep_analysis: {
      ru: { llm: 'gemini-pro', custom_prompt: 'CUSTOM_DEEP_RU: Test prompt' },
      en: { llm: 'gemini-pro', custom_prompt: 'CUSTOM_DEEP_EN: Test prompt' }
    }
  }
});
```

**Steps**:
1. Navigate to ozon.ru
2. Open side panel extension
3. Select ozon-analyzer plugin
4. Click "Run" or trigger workflow
5. Check Background Service Worker console

**Expected Results**:
- ✅ Console shows: `[BACKGROUND] 🔍 Checking for custom prompts...`
- ✅ Console shows: `[BACKGROUND] 📝 Found plugin-ozon-analyzer-settings in localStorage`
- ✅ Console shows 4x: `[BACKGROUND] ✅ Using CUSTOM prompt for [type].[lang]`
- ✅ Logs show top-level sections created (e.g., entries in `basic_analysis.ru` when inspecting plugin_settings)
- ✅ Final log shows all custom_prompt values as set (not paths)
- ✅ No fallback to manifest defaults used

**Verification**:
```javascript
// Check final state in DevTools Console:
// Should print custom prompts, not file paths
console.log(enrichedPluginSettings.prompts);
// Expected: custom_prompt: 'CUSTOM_BASIC_RU: Test prompt'
// Not: custom_prompt: 'prompts/basic_analysis.ru.default.txt'
```

---

### TC-002: Mixed Custom and Manifest (Partial Override)

**Objective**: Verify that only custom prompts are overridden, others keep manifest defaults

**Setup**:
```javascript
chrome.storage.local.set({
  'plugin-ozon-analyzer-settings': {
    basic_analysis: {
      ru: { llm: 'gemini-flash-lite', custom_prompt: 'CUSTOM_BASIC_RU: Only this' },
      en: { llm: 'gemini-flash-lite', custom_prompt: '' } // Empty - use manifest
    },
    deep_analysis: {
      ru: { llm: 'gemini-pro', custom_prompt: '' }, // Empty
      en: { llm: 'gemini-pro', custom_prompt: 'CUSTOM_DEEP_EN: Only this' }
    }
  }
});
```

**Steps**:
1. Run workflow
2. Check Background console logs

**Expected Results**:
- ✅ 2x: `✅ Using CUSTOM prompt for basic_analysis.ru`
- ✅ 2x: `✅ Using CUSTOM prompt for deep_analysis.en`
- ✅ 2x: `ℹ️ No custom prompt for basic_analysis.en, using manifest default`
- ✅ 2x: `ℹ️ No custom prompt for deep_analysis.ru, using manifest default`
- ✅ Final state shows: custom prompts for ru/en, manifest paths for others

---

### TC-003: No Custom Prompts (All Empty)

**Objective**: Verify fallback to manifest when no custom prompts set

**Setup**:
```javascript
chrome.storage.local.set({
  'plugin-ozon-analyzer-settings': {
    basic_analysis: {
      ru: { llm: 'gemini-flash-lite', custom_prompt: '' },
      en: { llm: 'gemini-flash-lite', custom_prompt: '' }
    },
    deep_analysis: {
      ru: { llm: 'gemini-pro', custom_prompt: '' },
      en: { llm: 'gemini-pro', custom_prompt: '' }
    }
  }
});
```

**Steps**:
1. Run workflow
2. Check logs

**Expected Results**:
- ✅ Console shows: `Found plugin-ozon-analyzer-settings in localStorage`
- ✅ 4x: `ℹ️ No custom prompt for [type].[lang], using manifest default`
- ✅ Final state has all manifest file paths (not custom text)

---

### TC-004: Settings Not in localStorage

**Objective**: Verify graceful fallback when plugin-ozon-analyzer-settings doesn't exist

**Setup**:
```javascript
// Remove the settings
chrome.storage.local.remove('plugin-ozon-analyzer-settings');
```

**Steps**:
1. Run workflow
2. Check logs

**Expected Results**:
- ✅ Console shows: `ℹ️ No plugin-ozon-analyzer-settings found in localStorage, using manifest defaults only`
- ✅ All prompts use manifest defaults
- ✅ No errors thrown

---

### TC-005: Whitespace-Only Custom Prompts

**Objective**: Verify that whitespace-only prompts are treated as empty

**Setup**:
```javascript
chrome.storage.local.set({
  'plugin-ozon-analyzer-settings': {
    basic_analysis: {
      ru: { llm: 'gemini-flash-lite', custom_prompt: '   \n  \t  ' },
      en: { llm: 'gemini-flash-lite', custom_prompt: 'VALID_CUSTOM' }
    },
    deep_analysis: {
      ru: { llm: 'gemini-pro', custom_prompt: '   ' },
      en: { llm: 'gemini-pro', custom_prompt: '' }
    }
  }
});
```

**Steps**:
1. Run workflow
2. Check logs

**Expected Results**:
- ✅ Console shows whitespace-only prompts are NOT used
- ✅ `ℹ️ No custom prompt for basic_analysis.ru, using manifest default` (whitespace = empty)
- ✅ `✅ Using CUSTOM prompt for basic_analysis.en` (valid)
- ✅ Final state: manifest defaults for ru/ru, custom for en

**Validation**:
```javascript
// Check that whitespace is trimmed
'   '.trim().length === 0 // true - treated as empty
```

---

### TC-006: Large Custom Prompts

**Objective**: Verify no size limitations on custom prompts

**Setup**:
```javascript
// Generate large prompt (e.g., 100KB)
const largePrompt = "Start: " + "A".repeat(102400) + " :End";

chrome.storage.local.set({
  'plugin-ozon-analyzer-settings': {
    basic_analysis: {
      ru: { llm: 'gemini-flash-lite', custom_prompt: largePrompt },
      en: { llm: 'gemini-flash-lite', custom_prompt: '' }
    },
    deep_analysis: {
      ru: { llm: 'gemini-pro', custom_prompt: '' },
      en: { llm: 'gemini-pro', custom_prompt: '' }
    }
  }
});
```

**Steps**:
1. Run workflow
2. Check logs and performance

**Expected Results**:
- ✅ Console shows: `✅ Using CUSTOM prompt for basic_analysis.ru (length: 102407)`
- ✅ No timeout or performance issues
- ✅ Workflow completes normally
- ⚠️ (Optional) Warning if prompt exceeds AI model limits (depends on model)

---

### TC-007: Special Characters in Custom Prompts

**Objective**: Verify UTF-8 and special characters are preserved

**Setup**:
```javascript
chrome.storage.local.set({
  'plugin-ozon-analyzer-settings': {
    basic_analysis: {
      ru: { 
        llm: 'gemini-flash-lite', 
        custom_prompt: 'Привет 🌍 Café 中文 العربية ñ €™®' 
      },
      en: { llm: 'gemini-flash-lite', custom_prompt: '' }
    },
    deep_analysis: {
      ru: { llm: 'gemini-pro', custom_prompt: '' },
      en: { llm: 'gemini-pro', custom_prompt: '' }
    }
  }
});
```

**Steps**:
1. Run workflow
2. Check that special characters are preserved in logs

**Expected Results**:
- ✅ Console correctly displays: `✅ Using CUSTOM prompt for basic_analysis.ru (length: 35)`
- ✅ Special characters not corrupted
- ✅ Workflow handles UTF-8 correctly
- ✅ AI model receives correct prompt with special characters

---

### TC-008: Storage Read Error (Exception Handling)

**Objective**: Verify error handling when storage access fails

**Setup**:
```javascript
// Manually modify background.ts to simulate error:
// Replace: const result = await chrome.storage.local.get(...)
// With: throw new Error('Storage API failed');

// OR use Chrome DevTools to disable storage permissions
```

**Steps**:
1. Run workflow
2. Check background console

**Expected Results**:
- ✅ Console shows: `⚠️ Failed to load custom prompts from localStorage: [error]`
- ✅ Console shows: `ℹ️ Fallback: continuing with manifest defaults`
- ✅ Workflow continues with manifest defaults
- ✅ No unhandled exception thrown
- ✅ User sees normal operation

---

### TC-009: Partially Corrupted Settings Object

**Objective**: Verify handling of malformed settings

**Setup**:
```javascript
// Various corruption scenarios

// Scenario 9a: basic_analysis is null
chrome.storage.local.set({
  'plugin-ozon-analyzer-settings': {
    basic_analysis: null, // Should be object
    deep_analysis: {
      ru: { llm: 'gemini-pro', custom_prompt: 'CUSTOM' },
      en: { llm: 'gemini-pro', custom_prompt: '' }
    }
  }
});

// Scenario 9b: custom_prompt is not a string
chrome.storage.local.set({
  'plugin-ozon-analyzer-settings': {
    basic_analysis: {
      ru: { llm: 'gemini-flash-lite', custom_prompt: { text: 'CUSTOM' } }, // Should be string
      en: { llm: 'gemini-flash-lite', custom_prompt: '' }
    },
    deep_analysis: {
      ru: { llm: 'gemini-pro', custom_prompt: 123 }, // Should be string
      en: { llm: 'gemini-pro', custom_prompt: '' }
    }
  }
});

// Scenario 9c: custom_prompt is array
chrome.storage.local.set({
  'plugin-ozon-analyzer-settings': {
    basic_analysis: {
      ru: { llm: 'gemini-flash-lite', custom_prompt: ['CUSTOM'] }, // Should be string
      en: { llm: 'gemini-flash-lite', custom_prompt: '' }
    },
    deep_analysis: {
      ru: { llm: 'gemini-pro', custom_prompt: '' },
      en: { llm: 'gemini-pro', custom_prompt: '' }
    }
  }
});
```

**Steps**:
1. For each scenario, run workflow
2. Check logs

**Expected Results - Scenario 9a**:
- ✅ Console shows: `ℹ️ No settings for basic_analysis` (skipped)
- ✅ deep_analysis.ru uses custom prompt
- ✅ deep_analysis.en uses manifest default

**Expected Results - Scenario 9b**:
- ✅ Console shows: `ℹ️ No custom prompt for basic_analysis.ru` (type check failed)
- ✅ deep_analysis.ru shows same (type check failed for number)
- ✅ Fall back to manifest defaults for these

**Expected Results - Scenario 9c**:
- ✅ Console shows: `ℹ️ No custom prompt for basic_analysis.ru` (type check failed for array)
- ✅ Fall back to manifest defaults

---

### TC-010: Custom Prompts Override Verification

**Objective**: Verify that custom prompts actually reach the AI API (end-to-end)

**Setup**:
```javascript
const testPrompt = 'TESTMARKER_BASIC_RU_12345: Analyze this product card...';

chrome.storage.local.set({
  'plugin-ozon-analyzer-settings': {
    basic_analysis: {
      ru: { llm: 'gemini-flash-lite', custom_prompt: testPrompt },
      en: { llm: 'gemini-flash-lite', custom_prompt: '' }
    },
    deep_analysis: {
      ru: { llm: 'gemini-pro', custom_prompt: '' },
      en: { llm: 'gemini-pro', custom_prompt: '' }
    }
  }
});
```

**Steps**:
1. Open DevTools Network tab
2. Run workflow
3. Monitor API calls to AI services (Gemini, OpenAI, etc.)
4. Inspect request body

**Expected Results**:
- ✅ Network tab shows API request containing `TESTMARKER_BASIC_RU_12345`
- ✅ Custom prompt text is in the request payload
- ✅ NOT the manifest default path
- ✅ AI receives the custom prompt and responds accordingly

**Verification Command**:
```javascript
// In Network tab, find the AI API request and check:
// POST body contains: "TESTMARKER_BASIC_RU_12345"
// NOT: "prompts/basic_analysis.ru.default.txt"
```

---

## Regression Tests (Verify No Breaking Changes)

### RG-001: Plugins Without Custom Prompts Still Work

**Objective**: Ensure non-ozon-analyzer plugins still work

**Setup**:
- Leave `plugin-ozon-analyzer-settings` unset or empty

**Steps**:
1. Try other plugins or unrelated workflows
2. Verify they work normally

**Expected Results**:
- ✅ No impact on other plugins
- ✅ No console errors related to the fix

---

### RG-002: Plugin Manifest Still Respected

**Objective**: Ensure manifest.json is still loaded as default

**Setup**:
- Don't set any custom prompts
- Let system use manifest defaults

**Steps**:
1. Run workflow
2. Check that manifest defaults are used

**Expected Results**:
- ✅ Manifest prompts still loaded
- ✅ `[BACKGROUND] ✅ Prompts loaded from manifest.json` appears
- ✅ Default behavior unchanged

---

## Performance Tests

### PF-001: Response Time with Custom Prompts

**Objective**: Verify no significant performance degradation

**Baseline**:
- Without custom prompts: ~X ms to load settings

**Test**:
- With custom prompts: Should be similar

**Expected**: < 5ms additional overhead for storage read

---

### PF-002: Large Prompt Handling

**Objective**: Verify performance with 100KB+ custom prompts

**Test Steps**:
1. Set very large custom prompt (100KB)
2. Run workflow 5 times
3. Measure time from start to API call

**Expected**: No noticeable slowdown or timeouts

---

## Debugging Commands

### Check Current Custom Settings
```javascript
chrome.storage.local.get('plugin-ozon-analyzer-settings', result => {
  console.log('Current settings:', result['plugin-ozon-analyzer-settings']);
});
```

### Check Background Logs
```javascript
// In DevTools for Background Service Worker:
// Look for: [BACKGROUND] prefix
// Search for: "custom prompt"
```

### Clear All Settings
```javascript
chrome.storage.local.remove('plugin-ozon-analyzer-settings');
```

### View Manifest Defaults
```javascript
// In Chrome extensions folder:
// cat chrome-extension/public/plugins/ozon-analyzer/manifest.json | grep -A 50 '"prompts"'
```

---

## Acceptance Criteria Checklist

- [ ] TC-001 passed: All custom prompts used
- [ ] TC-002 passed: Mixed custom/manifest prompts
- [ ] TC-003 passed: Empty prompts → manifest defaults
- [ ] TC-004 passed: Missing settings → graceful fallback
- [ ] TC-005 passed: Whitespace handled correctly
- [ ] TC-006 passed: Large prompts work
- [ ] TC-007 passed: Special characters preserved
- [ ] TC-008 passed: Error handling works
- [ ] TC-009 passed: Corrupted data handled
- [ ] TC-010 passed: Custom prompts reach AI
- [ ] RG-001 passed: Other plugins unaffected
- [ ] RG-002 passed: Manifest still respected
- [ ] PF-001 passed: Performance acceptable
- [ ] PF-002 passed: Large prompts performant
- [ ] No console errors in background
- [ ] No unhandled exceptions
- [ ] Feature complete and ready for release

