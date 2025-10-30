# LLM Selection and Data Flow Architecture

## Overview

This document describes the comprehensive architecture for LLM selection and data flow in the Agent Plugins Platform, focusing on the ozon-analyzer plugin as the primary example. The system enables users to configure different LLM models for different analysis types (basic analysis vs deep analysis) and languages (Russian vs English), with sophisticated API key management and settings persistence.

updated: 2025.10.30-07:30:00

## 1. UI Architecture

### Plugin Options Interface

The user interface for LLM configuration is implemented in `pages/options/src/components/PluginDetails.tsx` and `pages/options/src/components/LLMSelector.tsx`. The interface provides:

#### PluginDetails Component
- **Location**: `pages/options/src/components/PluginDetails.tsx`
- **Purpose**: Main plugin configuration interface
- **Key Features**:
  - Displays plugin information (name, version, author, description)
  - Shows host permissions and extension permissions
  - Contains `PromptsEditor` component for prompt customization
  - Manages plugin enable/disable and autorun settings

#### PromptsEditor Component
- **Location**: Within `PluginDetails.tsx` (lines 48-337)
- **Purpose**: Manages prompt types and language selection
- **Features**:
  - Tab-based interface for switching between `basic_analysis` and `deep_analysis`
  - Language tabs for `ru` (Russian) and `en` (English)
  - Side-by-side display of original prompts (read-only) and custom prompts (editable)
  - Copy button to transfer original prompts to custom editing area
  - Save functionality to persist custom prompts

#### LLMSelector Component
- **Location**: `pages/options/src/components/LLMSelector.tsx`
- **Purpose**: Binds specific LLMs to prompt types and languages
- **Key Props**:
  - `promptType`: `'basic_analysis' | 'deep_analysis'`
  - `language`: `'ru' | 'en'`
  - `globalAIKeys`: Array of available platform LLM configurations
  - `defaultLLMCurl`: Default LLM model name from manifest
  - `hasDefaultLLM`: Boolean indicating if default LLM is available
  - `onLLMChange`: Callback for LLM selection changes

#### LLM Selection Options
The LLM selector provides two types of LLM configurations:

1. **Default LLM**: Uses `gemini-flash-lite` for basic analysis, `gemini-pro` for deep analysis
   - Requires API key input in a password field
   - API key stored encrypted with key ID pattern: `ozon-analyzer.{promptType}.{language}.default`

2. **Platform LLMs**: Custom LLM configurations from `globalAIKeys`
   - Pre-configured API keys managed at platform level
   - No manual API key input required

### Legacy Options Interface

A legacy options interface exists at `chrome-extension/public/options/index.html`:
- **Purpose**: Basic HTML transmission mode settings
- **Limitations**: Does not support LLM selection or prompt customization
- **Status**: Superseded by React-based interface in `pages/options/`

## 2. Data Flow Architecture

### Settings Storage Flow

1. **User Selection** → `LLMSelector.handleLLMChange()`
2. **Validation** → Update local component state
3. **Settings Update** → `usePluginSettings.updateBasicAnalysisSettings()` or `updateDeepAnalysisSettings()`
4. **Encryption** → API keys encrypted via `APIKeyManager.saveEncryptedKey()`
5. **Persistence** → Settings saved to `chrome.storage.local` with key `'plugin-ozon-analyzer-settings'`
6. **Global State** → Settings propagated to `pyodide.globals.pluginSettings`

### Settings Structure

```typescript
interface PluginSettings {
  basic_analysis: {
    ru: { llm: string; custom_prompt: string };
    en: { llm: string; custom_prompt: string };
  };
  deep_analysis: {
    ru: { llm: string; custom_prompt: string };
    en: { llm: string; custom_prompt: string };
  };
  api_keys: {
    default: string; // encrypted
    [key: string]: string; // other encrypted keys
  };
}
```

### Data Propagation Path

```
User Selection → LLMSelector → usePluginSettings → chrome.storage.local
    ↓
pyodide.globals.pluginSettings (via PluginDetails useEffect)
    ↓
Python mcp_server.py (get_user_prompts, get_selected_llm_for_analysis, get_api_key_for_analysis)
    ↓
LLM API Call (via js.llm_call in offscreen.js)
```

## 3. Plugin Configuration (manifest.json)

### LLM Configuration Structure

The `manifest.json` defines LLM options in the `ai_models` and `options.prompts` sections:

```json
{
  "ai_models": {
    "basic_analysis": "gemini-flash-lite",
    "compliance_check": "gemini-flash-lite",
    "detailed_comparison": "gemini-pro",
    "deep_analysis": "gemini-pro",
    "scraping_fallback": "gemini-flash-lite"
  },
  "options": {
    "prompts": {
      "basic_analysis": {
        "ru": {
          "type": "text",
          "default": "[Russian prompt content]",
          "label": "Базовый промпт (русский)",
          "LLM": {
            "default": {
              "curl_file": "curl-templates/basic_analysis-ru.curl"
            }
          }
        },
        "en": {
          "type": "text",
          "default": "[English prompt content]",
          "label": "Basic Prompt (English)",
          "LLM": {
            "default": {
              "curl_file": "curl-templates/basic_analysis-en.curl"
            }
          }
        }
      },
      "deep_analysis": {
        "ru": { /* similar structure */ },
        "en": { /* similar structure */ }
      }
    }
  }
}
```

### Manifest Parsing

- **Location**: `PluginDetails.tsx` (lines 65-103)
- **Functions**:
  - `getDefaultLLMForPrompt()`: Maps prompt types to default LLM models
  - `hasDefaultLLMForPrompt()`: Checks LLM availability for specific prompts
  - `getOriginalPrompt()`: Retrieves default prompts from manifest

## 4. Settings Storage

### Chrome Storage Architecture

#### Primary Storage: chrome.storage.local
- **Key**: `'plugin-ozon-analyzer-settings'`
- **Content**: Complete PluginSettings object with encrypted API keys
- **Encryption**: API keys encrypted using `APIKeyManager` before storage

#### API Key Encryption
- **Location**: `pages/options/src/utils/encryption.ts`
- **Method**: AES encryption with derived keys
- **Key IDs**: Follow pattern `ozon-analyzer.{promptType}.{language}.default`

#### Storage Flow
```
User Input → APIKeyManager.saveEncryptedKey() → chrome.storage.local
    ↓
Retrieval: chrome.storage.local → APIKeyManager.getDecryptedKey() → Component State
```

### Pyodide Globals Integration

Settings are propagated to Python execution environment:

```javascript
// In PluginDetails.tsx useEffect (lines 362-398)
const updatedPluginSettings = {
  ...pluginSettings,
  selected_llms: {
    basic_analysis: { ru: llm, en: llm },
    deep_analysis: { ru: llm, en: llm }
  },
  api_keys: { /* encrypted keys */ }
};

pyodide.globals.pluginSettings = updatedPluginSettings;
```

## 5. Python Integration (mcp_server.py)

### Settings Retrieval Functions

#### get_user_prompts()
- **Location**: `mcp_server.py` (lines 214-407)
- **Purpose**: Loads prompts from plugin settings or manifest defaults
- **Priority Order**:
  1. Custom prompts from `pluginSettings.prompts`
  2. Default prompts from `manifest.options.prompts`
  3. Built-in fallback prompts

#### get_selected_llm_for_analysis()
- **Location**: `mcp_server.py` (lines 5076-5113)
- **Purpose**: Retrieves selected LLM for specific analysis type and language
- **Returns**: LLM identifier ('default', 'gemini-flash-lite', etc.)

#### get_api_key_for_analysis()
- **Location**: `mcp_server.py` (lines 5119-5184)
- **Purpose**: Retrieves API key for specific analysis configuration
- **Key Variants Checked**:
  - `ozon-analyzer.{analysis_type}.{language}`
  - `{analysis_type}_{language}`
  - Selected LLM name
  - Fallback to global settings

### LLM Execution Flow

1. **Analysis Initiation** → `analyze_ozon_product()` function
2. **Settings Loading** → `get_user_prompts()`, `get_selected_llm_for_analysis()`
3. **API Key Retrieval** → `get_api_key_for_analysis()`
4. **LLM Call** → `js.llm_call()` with model alias and options
5. **Response Processing** → Parse and return analysis results

## 6. API Key Management

### Default LLM Keys
- **Storage**: Encrypted in `chrome.storage.local`
- **Key ID Pattern**: `ozon-analyzer.{promptType}.{language}.default`
- **Encryption**: AES via `APIKeyManager`
- **Access**: Direct from encrypted storage

### Platform LLM Keys
- **Storage**: Managed at platform level in `globalAIKeys`
- **Access**: Via background script message passing
- **Message Type**: `'GET_API_KEY'`
- **Response**: `{ apiKey: string }`

### API Key Flow in offscreen.js

#### For Default LLMs
```javascript
// Direct encrypted storage access
const apiKey = await APIKeyManager.getDecryptedKey(keyId);
```

#### For Platform LLMs
```javascript
// Message passing to background
const response = await safeSendMessage({
  type: 'GET_API_KEY',
  data: { keyId: keyId }
});
```

### Enhanced LLM Call (offscreen.js lines 2262-2413)

The `js.llm_call` function in offscreen.js provides enhanced API key management:

1. **Model Alias Processing**: Strips `:generateContent` suffix
2. **API Key Priority**:
   - Direct API key in options
   - Plugin settings API keys
   - Background script retrieval
   - Window global fallback
3. **Gemini API Integration**: Direct HTTP calls for Default LLMs
4. **Background Delegation**: Platform LLMs routed through background script

## 7. Execution Flow

### Complete Path from User Selection to LLM API Call

```
1. User selects LLM in PluginDetails.tsx LLMSelector
   ↓
2. LLMSelector.handleLLMChange() updates settings
   ↓
3. usePluginSettings saves to chrome.storage.local (encrypted)
   ↓
4. PluginDetails useEffect propagates to pyodide.globals.pluginSettings
   ↓
5. Python execution: analyze_ozon_product() called
   ↓
6. get_selected_llm_for_analysis() retrieves LLM choice
   ↓
7. get_api_key_for_analysis() retrieves API key
   ↓
8. js.llm_call() invoked with model and options
   ↓
9. offscreen.js enhanced llm_call processes request
   ↓
10. For Default LLMs: Direct Gemini API HTTP call
    For Platform LLMs: Background script delegation
    ↓
11. Response returned through Pyodide bridge
    ↓
12. Analysis results processed and displayed
```

### Key Integration Points

#### JavaScript ↔ Python Bridge
- **Location**: `offscreen.js` jsBridge object (lines 533-1111)
- **Functions**:
  - `sendMessageToChat()`: Sends messages to chat interface
  - `llm_call()`: Enhanced LLM API integration
  - `get_setting()`: Settings retrieval
  - `updateContext()`: Context management

#### Settings Propagation
- **Trigger**: PluginDetails component mount and settings changes
- **Method**: Direct assignment to `pyodide.globals.pluginSettings`
- **Content**: Complete settings object with selected LLMs and API keys

#### Error Handling
- **API Key Errors**: Graceful fallback with user-friendly messages
- **Network Errors**: Timeout handling and retry logic
- **Configuration Errors**: Validation and default fallbacks

## 8. Architecture Patterns

### Separation of Concerns
- **UI Layer**: React components handle user interaction
- **Settings Layer**: usePluginSettings manages persistence
- **Bridge Layer**: offscreen.js provides JS↔Python communication
- **Execution Layer**: Python handles LLM calls and analysis

### Security Considerations
- **API Key Encryption**: All keys encrypted at rest
- **Isolated Execution**: Python runs in Pyodide sandbox
- **Message Validation**: All cross-context communication validated

### Performance Optimizations
- **Lazy Loading**: Settings loaded on demand
- **Caching**: API key caching with TTL
- **Chunking**: Large HTML data transferred in chunks
- **Async Processing**: Non-blocking UI updates

This architecture provides a robust, scalable system for LLM configuration and execution while maintaining security, performance, and user experience standards.