# File Path Prompt Reading Fix

## Issue
When using default prompts, the system was passing the **file path** (`"prompts/basic_analysis.ru.default.txt"`) directly to the LLM instead of reading and passing the **file content**.

### Evidence from Logs
```
[DIAGNOSIS] prompt preview: prompts/basic_analysis.ru.default.txt...
[DIAGNOSIS] prompt length: 37  ← Length of path string, not file content!
[LLM_PROMPT_DEBUG] Full prompt text: prompts/basic_analysis.ru.default.txt
```

As a result, the LLM received the literal string "prompts/basic_analysis.ru.default.txt" as a prompt and returned generic information about "basic analysis stages" instead of analyzing the actual product.

## Root Cause

In `mcp_server.py` lines 441-457 (before fix):

```python
if custom_value and isinstance(custom_value, str) and len(custom_value.strip()) > 0:
    custom_value_stripped = custom_value.strip()
    
    # Check if this is a default file path
    is_default_file_path = (
        custom_value_stripped == f"prompts/{prompt_type}.{lang}.default.txt" or
        custom_value_stripped == lang_data.get('default', '') if 'lang_data' in locals() else False
    )
    
    if is_default_file_path:
        console_log(f"LLM_PROMPT_DEBUG: ℹ️ Found default file path, custom prompt not set")
        # ❌ BUG: Don't use this "custom" prompt, skip it!
    else:
        # Use as real custom prompt
        prompts[prompt_type][lang] = custom_value_stripped
```

**The problem**: 
- When the code detected a file path, it **skipped** it completely
- The code then fell through to the fallback logic, but that had issues with undefined variables
- The file path was never read, and got passed directly to the LLM

## Solution

Changed the logic to **always read file paths**, regardless of whether they're custom or default:

```python
if custom_value and isinstance(custom_value, str) and len(custom_value.strip()) > 0:
    custom_value_stripped = custom_value.strip()
    
    # Check if this is a file path (custom or default)
    is_file_path = ('/' in custom_value_stripped or '.txt' in custom_value_stripped)
    
    if is_file_path:
        console_log(f"LLM_PROMPT_DEBUG: 📁 Found prompt file path: {custom_value_stripped}")
        console_log(f"LLM_PROMPT_DEBUG: 📁 Calling read_prompt_file...")
        file_content = await read_prompt_file(plugin_dir, custom_value_stripped)
        console_log(f"LLM_PROMPT_DEBUG: 📁 read_prompt_file returned length: {len(file_content)}")
        if file_content and len(file_content.strip()) > 0:
            prompts[prompt_type][lang] = file_content  # ✅ Use file content!
            console_log(f"LLM_PROMPT_DEBUG: ✅ Loaded prompt from file")
        else:
            console_log(f"LLM_PROMPT_DEBUG: ⚠️ Failed to read prompt file")
    else:
        # Real custom prompt (text, not path)
        prompts[prompt_type][lang] = custom_value_stripped
        console_log(f"LLM_PROMPT_DEBUG: ✅ Using real custom prompt text")
```

## Key Changes

1. **Removed distinction between "default path" and "custom path"** - all file paths are now read
2. **Detection logic**: Check for `/` or `.txt` to identify file paths
3. **Always read**: If it's a file path, call `read_prompt_file()` to get the content
4. **Better logging**: Added detailed logs showing file reading process

## Data Flow (After Fix)

### For Default Prompts:
```
Background script:
  custom_prompt: "prompts/basic_analysis.ru.default.txt"
  _source: "default"
         ↓
Python finds path in plugin_settings['prompts']
         ↓
Detects '/' in path → is_file_path = True
         ↓
Calls: await read_prompt_file(plugin_dir, "prompts/basic_analysis.ru.default.txt")
         ↓
Returns: Full file content (several KB of text)
         ↓
prompts[type][lang] = file_content  ✅
         ↓
LLM receives actual prompt content
```

### For Custom Text Prompts:
```
Background script:
  custom_prompt: "Проанализируй товар на Ozon..."
  _source: "custom"
         ↓
Python finds text in plugin_settings['prompts']
         ↓
No '/' or '.txt' → is_file_path = False
         ↓
prompts[type][lang] = custom_prompt  ✅
         ↓
LLM receives custom prompt text
```

## Expected Logs (After Fix)

### When using default prompt:
```
[LLM_PROMPT_DEBUG] 📁 Обнаружен путь к файлу промпта: prompts/basic_analysis.ru.default.txt
[LLM_PROMPT_DEBUG] 📁 Вызываем read_prompt_file с plugin_dir='plugins/ozon-analyzer', file_path='prompts/basic_analysis.ru.default.txt'
[LLM_PROMPT_DEBUG] 📁 read_prompt_file вернул: длина=2543
[LLM_PROMPT_DEBUG] ✅ Загружен промпт из файла: basic_analysis.ru (длина: 2543)
[LLM_PROMPT_DEBUG] 📝 Содержимое промпта (первые 200 символов): 'Проанализируй товар на Ozon по следующим критериям...'
```

### When using custom prompt:
```
[LLM_PROMPT_DEBUG] ✅ Используем настоящий кастомный промпт: basic_analysis.ru (длина: 234)
```

## Files Modified

- `chrome-extension/public/plugins/ozon-analyzer/mcp_server.py` (lines 441-462)

## Testing

### Test Case 1: Default Prompt
1. Clear any custom prompts in Options
2. Run plugin on Ozon product page
3. **Expected**: LLM analyzes the product correctly
4. **Check logs**: Should show file reading with length > 1000 chars

### Test Case 2: Custom Text Prompt
1. Set custom prompt: "Тестовый кастомный промпт"
2. Run plugin
3. **Expected**: LLM uses custom prompt
4. **Check logs**: Should show "Используем настоящий кастомный промпт"

## Verification

✅ File paths are now read correctly  
✅ Custom text prompts are used directly  
✅ LLM receives full prompt content instead of file paths  
✅ Detailed logging for debugging  

## Related Issues

This fix addresses the issue where default prompts were returning generic "basic analysis stages" descriptions instead of analyzing the actual Ozon product.
