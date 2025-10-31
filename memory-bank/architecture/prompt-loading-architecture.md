# Prompt Loading Architecture Documentation

updated: 2025-10-31 07:46

## Overview

The prompt loading system is a critical component of the Ozon Analyzer plugin that manages the retrieval and processing of AI prompts for product analysis. The system implements a sophisticated 3-level fallback strategy to ensure reliable prompt access across different environments and failure scenarios.

### Key Characteristics
- **Multi-level fallback**: 3-tier fallback system for maximum reliability
- **Language support**: Dual language support (Russian/English) with automatic detection
- **Chrome extension compatibility**: Special handling for Chrome API access restrictions
- **Error resilience**: Comprehensive error handling and logging
- **Performance optimized**: Caching and memory management for Pyodide environment

## Architecture Components

### Core Files and Modules

#### 1. `mcp_server.py` - Main Python Module
**Location**: `chrome-extension/public/plugins/ozon-analyzer/mcp_server.py`
**Purpose**: Contains the main prompt loading logic and fallback implementation

Key functions:
- `read_prompt_file()` - Primary prompt file reader
- `get_user_prompts()` - User prompt configuration manager
- `analyze_ozon_product()` - Main analysis workflow function

#### 2. `offscreen.js` - JavaScript Bridge
**Location**: `chrome-extension/public/offscreen.js`
**Purpose**: Provides JavaScript bridge functions for Chrome API access

Key functions:
- `readExtensionFile()` - Chrome extension file reading bridge
- `jsBridge` - Pyodide JavaScript interface

#### 3. `manifest.json` - Plugin Configuration
**Location**: `chrome-extension/public/plugins/ozon-analyzer/manifest.json`
**Purpose**: Defines prompt file paths and plugin settings

#### 4. Prompt Files Directory
**Location**: `chrome-extension/public/plugins/ozon-analyzer/prompts/`
**Contents**:
- `basic_analysis.ru.default.txt` - Russian basic analysis prompt
- `basic_analysis.en.default.txt` - English basic analysis prompt
- `deep_analysis.ru.default.txt` - Russian deep analysis prompt
- `deep_analysis.en.default.txt` - English deep analysis prompt

## Data Flow

### Step-by-Step Flow

1. **Initialization Phase**
   - `analyze_ozon_product()` function called with input data
   - Plugin settings extracted from `input_data.pluginSettings`
   - Content language determined from settings

2. **Prompt Loading Phase**
   - `get_user_prompts(plugin_settings)` called
   - Language-specific prompt paths resolved from manifest.json
   - Fallback chain initiated if custom prompts unavailable

3. **File Reading Phase**
   - `read_prompt_file(plugin_dir, file_path)` called
   - JS bridge `readExtensionFile()` invoked for Chrome compatibility
   - File content read and validated

4. **Fallback Processing**
   - If primary method fails, fallback to alternative approaches
   - Hardcoded prompts used as final fallback
   - Error logging and user notification

5. **Analysis Execution**
   - Loaded prompts passed to LLM call functions
   - Analysis results processed and returned

## Key Functions

### `read_prompt_file(plugin_dir: str, file_path: str) -> str`

**Purpose**: Reads prompt file content with Chrome extension compatibility

**Parameters**:
- `plugin_dir`: Plugin directory path
- `file_path`: Relative path to prompt file

**Implementation**:
```python
async def read_prompt_file(plugin_dir: str, file_path: str) -> str:
    full_path = f"{plugin_dir}/{file_path}"
    response_proxy = await js.readExtensionFile(full_path)
    content = response_proxy.to_py()
    return content.strip()
```

**Error Handling**: Returns empty string on failure with detailed logging

### `get_user_prompts(plugin_settings: Optional[Dict[str, Any]]) -> Dict[str, Any]`

**Purpose**: Retrieves user-configured prompts with fallback logic

**Parameters**:
- `plugin_settings`: Plugin configuration dictionary

**Fallback Levels**:
1. **Level 1**: Custom user prompts from settings
2. **Level 2**: Default prompts from manifest.json paths
3. **Level 3**: Hardcoded fallback prompts

### `js.readExtensionFile(filePath)`

**Purpose**: JavaScript bridge function for Chrome extension file access

**Implementation** (in offscreen.js):
```javascript
readExtensionFile: async (filePath) => {
    const fullUrl = chrome.runtime.getURL(filePath);
    const response = await fetch(fullUrl);
    const content = await response.text();
    return pyodide.toPy(content);
}
```

## Error Handling

### Comprehensive Error Management

The system implements multi-layer error handling:

1. **File Access Errors**
   - Network failures during file fetch
   - File not found scenarios
   - Permission issues in Chrome extension context

2. **Parsing Errors**
   - Invalid JSON in manifest files
   - Malformed prompt content
   - Encoding issues

3. **Bridge Communication Errors**
   - Pyodide-JavaScript bridge failures
   - Chrome API access restrictions
   - Timeout scenarios

### Logging Strategy

All errors are logged using `console_log()` function with detailed context:
- Function entry/exit points
- Parameter values
- Error stack traces
- Fallback activation notifications

## Fallback Strategy

### 3-Level Fallback System

#### Level 1: Custom User Prompts
- **Source**: User-defined prompts in plugin settings
- **Access**: Via `plugin_settings.prompts` configuration
- **Validation**: Length and content checks
- **Fallback Trigger**: Missing, empty, or invalid custom prompts

#### Level 2: Manifest-Defined Default Prompts
- **Source**: Prompt files referenced in `manifest.json`
- **Paths**: `prompts/basic_analysis.{lang}.default.txt`
- **Access**: File system read via JS bridge
- **Fallback Trigger**: File read failures or missing files

#### Level 3: Hardcoded Fallback Prompts
- **Source**: Embedded prompts in Python code
- **Languages**: Russian and English variants
- **Access**: Direct string constants in code
- **Fallback Trigger**: All previous levels failed

### Fallback Flow Diagram

```
User Custom Prompts
       ↓ (fail)
Manifest Default Files
       ↓ (fail)
Hardcoded Fallback Prompts
       ↓ (fail)
Error with empty prompts
```

## Recent Changes

### JS Bridge Fix for Chrome API Access

**Issue**: Chrome extension Manifest V3 restrictions prevent direct file access from Pyodide

**Solution**: Implemented JavaScript bridge function `readExtensionFile()`

**Key Changes**:
1. **Added `readExtensionFile` to jsBridge** (offscreen.js:691-707)
2. **Modified `read_prompt_file`** to use JS bridge instead of direct file access
3. **Enhanced error handling** for bridge communication failures
4. **Added detailed logging** for debugging bridge operations

**Code Changes**:
```javascript
// Before: Direct file access (failed in Chrome)
const content = await fs.readFile(full_path, 'utf8');

// After: JS bridge with Chrome API
const response_proxy = await js.readExtensionFile(full_path);
const content = response_proxy.to_py();
```

**Benefits**:
- ✅ Compatible with Chrome Manifest V3
- ✅ Maintains Pyodide isolation
- ✅ Preserves existing Python API
- ✅ Enhanced error reporting

## Troubleshooting

### Common Issues and Solutions

#### 1. "Prompt file not found" Errors
**Symptoms**: Analysis fails with file access errors
**Causes**:
- Incorrect file paths in manifest.json
- Missing prompt files
- Chrome extension permission issues

**Solutions**:
- Verify file paths in manifest.json
- Check file existence in prompts/ directory
- Ensure proper extension permissions

#### 2. JS Bridge Communication Failures
**Symptoms**: `readExtensionFile` returns undefined or errors
**Causes**:
- Pyodide not properly initialized
- Chrome runtime not available
- Bridge function not registered

**Solutions**:
- Verify Pyodide initialization sequence
- Check Chrome extension context
- Validate jsBridge registration

#### 3. Language Detection Issues
**Symptoms**: Wrong language prompts loaded
**Causes**:
- Incorrect `response_language` setting
- Missing language in manifest configuration

**Solutions**:
- Check `plugin_settings.response_language` value
- Verify manifest.json language entries
- Use 'auto' for automatic detection

#### 4. Fallback Activation
**Symptoms**: System falls back to hardcoded prompts
**Causes**:
- File system access failures
- Network issues during file fetch
- Corrupted prompt files

**Solutions**:
- Check browser console for detailed error logs
- Verify file permissions and paths
- Test with hardcoded prompts to isolate issues

#### 5. Memory Issues in Pyodide
**Symptoms**: Out of memory errors during prompt loading
**Causes**:
- Large prompt files
- Memory leaks in Pyodide
- Concurrent operations

**Solutions**:
- Optimize prompt file sizes
- Implement proper cleanup in MemoryManager
- Use streaming for large files

### Debug Logging

Enable detailed logging by setting:
```javascript
// In offscreen.js
currentLogLevel = 3; // DEBUG level
LOG_FLAGS.PYODIDE = true;
```

Key log markers:
- `[LLM_PROMPT_DEBUG]`: Prompt loading operations
- `[API_KEY_FLOW]`: API key retrieval
- `[DIAGNOSTIC]`: Function execution tracing

### Performance Monitoring

Monitor prompt loading performance:
- File read times
- Fallback activation frequency
- Memory usage patterns
- Cache hit/miss ratios

This architecture ensures robust prompt loading across all deployment scenarios while maintaining compatibility with Chrome extension restrictions and providing comprehensive error recovery mechanisms.