# Ozon Analyzer Plugin - Integration Guide

## Overview

This guide provides step-by-step instructions for integrating the Ozon Analyzer plugin into the Agent Plugins Platform (APP) or creating similar plugins.

## Prerequisites

### **System Requirements**
- **Browser**: Chrome v90+ or Firefox v88+
- **Platform**: Agent Plugins Platform v1.5+
- **Permissions**: Content scripts and extension API access
- **Build Tools**: Node.js 18+, pnpm, TypeScript 5.0+

### **Dependencies**
```bash
pnpm install webextension-polyfill@^0.12.0
```

## Getting Started

### **Step 1: Plugin Registration**

#### **1.1 Add to Plugin Manager**
```javascript
// core/plugin-manager.js
const PLUGIN_DIRS = [
  'ozon-analyzer',  // Add your plugin
  // ... existing plugins
];
```

#### **1.2 Plugin Directory Structure**
```
/plugins/[plugin-name]/
├── manifest.json      # Plugin configuration
├── mcp_server.py     # Python logic (required)
└── workflow.json      # Workflow definition (required)
```

### **Step 2: Plugin Configuration**

#### **2.1 manifest.json Structure**
```json
{
  "name": "Ozon Analyzer",
  "description": "Analyzes Ozon marketplace products",
  "version": "1.0.0",
  "icon": "icon.png",
  "inputs": [
    {
      "name": "page_html",
      "type": "string",
      "description": "HTML content of product page",
      "required": true
    }
  ],
  "outputs": [
    {
      "name": "analysis",
      "type": "object",
      "description": "Comprehensive product analysis"
    }
  ],
  "ai_models": {
    "basic_analysis": "gpt-4o-mini",
    "detailed_comparison": "gemini-flash",
    "deep_analysis": "gemini-pro"
  },
  "settings": {
    "enable_deep_analysis": {
      "type": "boolean",
      "default": true,
      "description": "Enable detailed AI analysis"
    },
    "analysis_timeout": {
      "type": "number",
      "default": 30000,
      "description": "AI analysis timeout in ms"
    },
    "similar_products_limit": {
      "type": "number",
      "default": 3,
      "description": "Max similar products to find"
    }
  }
}
```

## Python Implementation

### **Step 3: Core Functions**

#### **3.1 Main Analysis Function**
```python
# mcp_server.py
async def analyze_ozon_product(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point for product analysis

    Args:
        input_data: Dictionary containing 'page_html' key

    Returns:
        Dictionary with analysis results and metadata
    """
    try:
        page_html = input_data.get("page_html", "")

        # Extract product information
        extracted_data = await _extract_description_and_composition(page_html)
        categories = await _extract_categories(page_html)

        # Generate AI analysis
        analysis_prompt = f"Analyze this product: {extracted_data['description']}"
        analysis = await _call_ai_model("basic_analysis", analysis_prompt)

        return {
            "success": True,
            "analysis": analysis,
            "description": extracted_data["description"],
            "composition": extracted_data["composition"],
            "categories": categories
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "analysis": "Analysis failed"
        }
```

#### **3.2 AI Model Integration**
```python
async def _call_ai_model(model_alias: str, prompt: str) -> str:
    """
    Unified wrapper for AI model calls

    Args:
        model_alias: Model alias from manifest.json
        prompt: Prompt text to send to AI

    Returns:
        Generated response text
    """
    try:
        result = await js.llm_call(model_alias, {"prompt": prompt})
        return result.to_py()
    except Exception as e:
        return f"AI Error: {str(e)}"
```

#### **3.3 Settings Access**
```python
async def _get_settings() -> Dict[str, Any]:
    """Load plugin settings from platform"""
    try:
        # Get entire config section
        config = await js.get_setting("config").to_py()

        # Get individual setting with fallback
        analysis_enabled = await js.get_setting("config", "enable_deep_analysis", False).to_py()

        return {
            "config": config,
            "deep_analysis": analysis_enabled
        }
    except Exception as e:
        # Return default settings on error
        return {
            "config": {},
            "deep_analysis": False
        }
```

## JavaScript Bridge Setup

### **Step 4: Initialize Pyodide Worker**

#### **4.1 Browser Extension Integration**
```javascript
// pyodide-worker.js
async function initializePyodide() {
    if (pyodide) return;
    pyodide = await loadPyodide({ indexURL: '../pyodide/' });

    // Setup JavaScript bridge
    pyodide.globals.set('js', {
        sendMessageToChat: (message) => {
            const jsMessage = message.toJs({ dict_converter: Object.fromEntries });
            self.postMessage({
                type: 'host_call',
                func: 'sendMessageToChat',
                args: [jsMessage]
            });
        },

        // AI API integration
        llm_call: (modelAlias, options) => {
            return new Promise((resolve, reject) => {
                const callId = `llm_${Date.now()}`;

                self.postMessage({
                    type: 'host_call',
                    func: 'llm_call',
                    args: [
                        modelAlias.toJs({ dict_converter: Object.fromEntries }),
                        options.toJs({ dict_converter: Object.fromEntries })
                    ],
                    callId
                });

                // Store promise resolver for response
                hostCallPromises.set(callId, { resolve, reject });
            });
        },

        // Settings access
        get_setting: (settingName, defaultValue, category) => {
            return new Promise((resolve, reject) => {
                const callId = `settings_${Date.now()}`;

                self.postMessage({
                    type: 'host_call',
                    func: 'get_setting',
                    args: [settingName.to_py(), defaultValue?.to_py(), category?.to_py()],
                    callId
                });

                hostCallPromises.set(callId, { resolve, reject });
            });
        }
    });
}
```

#### **4.2 Handle Python Function Calls**
```javascript
// pyodide-worker.js - message handling
self.onmessage = async (event) => {
    if (event.data.type === 'run_python_tool') {
        const { pythonCode, toolName, toolInput, callId } = event.data;

        try {
            // Execute Python code
            await pyodide.runPythonAsync(pythonCode);

            // Get and call the requested function
            const toolFunc = pyodide.globals.get(toolName);
            if (!toolFunc) throw new Error(`Function '${toolName}' not found`);

            // Execute with input parameters
            const resultProxy = await toolFunc(toolInput);

            // Convert result to JavaScript
            const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
            resultProxy.destroy();

            // Return result
            self.postMessage({ type: 'complete', callId, result });

        } catch (e) {
            self.postMessage({ type: 'error', callId, error: e.message });
        }
    }
};
```

## Background Script Integration

### **Step 5: Extend Background API**

#### **5.1 AI API Client**
```typescript
// background/ai-api-client.ts
export class AIApiClient {
    private static readonly MODEL_CONFIGS: Record<ModelAlias, ModelConfig> = {
        'gemini-flash': {
            provider: 'gemini',
            model_name: 'gemini-1.5-flash',
            endpoint: 'https://generativelanguage.googleapis.com/v1/models/',
            api_key_env: 'GEMINI_API_KEY'
        },
        'gpt-4o-mini': {
            provider: 'openai',
            model_name: 'gpt-4o-mini',
            endpoint: 'https://api.openai.com/v1/chat/completions',
            api_key_env: 'OPENAI_API_KEY'
        }
    };

    async callModel(modelAlias: ModelAlias, prompt: string): Promise<string> {
        const modelConfig = AIApiClient.MODEL_CONFIGS[modelAlias];
        if (!modelConfig) {
            throw new Error(`Unknown model: ${modelAlias}`);
        }

        const apiKey = await this.getApiKey(modelConfig.api_key_env);
        const response = await this.makeApiCall(modelConfig, prompt, apiKey);

        return response;
    }

    private async getApiKey(envKey: string): Promise<string> {
        const result = await chrome.storage.local.get([envKey]);
        const apiKey = result[envKey];

        if (!apiKey) {
            throw new Error(`API key not found: ${envKey}`);
        }

        return apiKey;
    }

    private async makeApiCall(
        config: ModelConfig,
        prompt: string,
        apiKey: string
    ): Promise<string> {
        // Implement specific API calls for each provider
        switch (config.provider) {
            case 'gemini':
                return this.callGeminiApi(config, prompt, apiKey);
            case 'openai':
                return this.callOpenAIApi(config, prompt, apiKey);
            default:
                throw new Error(`Unsupported provider: ${config.provider}`);
        }
    }
}
```

#### **5.2 Host API Extensions**
```typescript
// background/host-api.ts
export const hostApi = {
    // ... existing functions

    llm_call: async (modelAlias: string, options: any): Promise<string> => {
        try {
            const client = new AIApiClient();
            const { prompt } = options;

            if (!prompt) {
                throw new Error('Prompt is required');
            }

            return await client.callModel(modelAlias as ModelAlias, prompt);
        } catch (error) {
            console.error('AI API call failed:', error);
            throw error;
        }
    },

    get_setting: async (settingName: string, defaultValue?: any): Promise<any> => {
        try {
            const { pluginId } = context;

            if (!pluginId) {
                throw new Error('Plugin context not available');
            }

            // Load plugin manifest
            const manifestPath = `/plugins/${pluginId}/manifest.json`;
            const response = await fetch(manifestPath);

            if (!response.ok) {
                throw new Error(`Manifest not found: ${pluginId}`);
            }

            const manifest = await response.json();
            const settings = manifest.settings || {};

            // Navigate through setting path (e.g., "config.ai_model")
            const path = settingName.split('.');
            let current = { settings };

            for (const part of path) {
                if (current[part] === undefined) {
                    return defaultValue !== undefined ? defaultValue : null;
                }
                current = current[part];
            }

            return current;
        } catch (error) {
            console.error('Settings access failed:', error);
            return defaultValue || null;
        }
    }
};
```

## Workflow Configuration

### **Step 6: Define Workflow**

#### **6.1 workflow.json Structure**
```json
{
  "steps": [
    {
      "id": "analyze",
      "description": "Analyze Ozon product",
      "tool": "python.analyze_ozon_product",
      "inputs": {
        "page_html": "{{input.page_html}}"
      }
    },
    {
      "id": "deep-analysis",
      "description": "Perform deep analysis",
      "tool": "python.perform_deep_analysis",
      "inputs": {
        "description": "{{step.analyze.description}}",
        "composition": "{{step.analyze.composition}}"
      }
    }
  ]
}
```

#### **6.2 Template Syntax**
```json
{
  "inputs": {
    // Direct input reference
    "page_html": "{{input.page_html}}",

    // Reference previous step output
    "description": "{{step.analyze.description}}",

    // Access nested properties
    "product_id": "{{input.selected_product.id}}"
  }
}
```

#### **6.3 Conditional Steps**
```json
{
  "steps": [
    {
      "id": "pre-check",
      "description": "Check if analysis is enabled",
      "tool": "python.check_analysis_enabled",
      "run_if": "{{input.enable_deep_analysis}} == true"
    }
  ]
}
```

## Testing & Validation

### **Step 7: Plugin Testing**

#### **7.1 Unit Testing**
```javascript
// test-ozon-plugin.js
import { runPythonTool } from '../bridge/mcp-bridge.js';
import { getAvailablePlugins } from '../core/plugin-manager.js';

async function testPlugin() {
    console.log('Testing Ozon Analyzer plugin...');

    try {
        // Test plugin discovery
        const plugins = await getAvailablePlugins();
        console.log('Available plugins:', plugins);

        // Test basic analysis
        const testHtml = `
        <div class="product-details">
            <h1>Organic Coffee Beans</h1>
            <p>Description: Premium organic coffee...</p>
            <p>Composition: 100% Arabica beans...</p>
        </div>
        `;

        const pluginId = 'ozon-analyzer';
        const toolName = 'analyze_ozon_product';
        const toolInput = { page_html: testHtml };

        const result = await runPythonTool(pluginId, toolName, toolInput);
        console.log('Analysis result:', result);

        return true;

    } catch (error) {
        console.error('Plugin test failed:', error);
        return false;
    }
}

// Run test
testPlugin();
```

#### **7.2 Integration Testing**
```typescript
// chrome-extension/src/background/index.ts
export async function testPluginIntegration(): Promise<boolean> {
    try {
        console.log('Running plugin integration tests...');

        // Test 1: Manifest loading
        const manifestUrl = chrome.runtime.getURL('plugins/ozon-analyzer/manifest.json');
        const response = await fetch(manifestUrl);
        const manifest = await response.json();
        console.log('✅ Manifest loaded successfully');

        // Test 2: Workflow loading
        const workflowUrl = chrome.runtime.getURL('plugins/ozon-analyzer/workflow.json');
        const workflowResponse = await fetch(workflowUrl);
        const workflow = await workflowResponse.json();
        console.log('✅ Workflow loaded successfully');

        // Test 3: Python execution
        const { runWorkflow } = await import('./workflow-engine.js');
        const result = await runWorkflow('ozon-analyzer');
        console.log('✅ Plugin execution successful');

        return true;

    } catch (error) {
        console.error('❌ Integration test failed:', error);
        return false;
    }
}
```

## Error Handling & Debugging

### **Step 8: Troubleshooting**

#### **8.1 Common Issues**

**Issue: Plugin not loading**
```bash
# Check file paths
ls -la chrome-extension/public/plugins/ozon-analyzer/

# Verify permissions in manifest.json
grep -A 5 "permissions" chrome-extension/public/manifest.json
```

**Issue: Python function not found**
```javascript
// Check function is exported in mcp_server.py
console.log('Available Python functions:');
await pyodide.runPythonAsync('print(dir())');

// Verify tool name in workflow.json
grep -A 5 "tool" chrome-extension/public/plugins/ozon-analyzer/workflow.json
```

**Issue: AI API call failing**
```javascript
// Check API key configuration
chrome.storage.local.get(['OPENAI_API_KEY', 'GEMINI_API_KEY'], result => {
    console.log('API keys configured:', Object.keys(result));
});

// Verify model configuration in manifest
const manifest = await (await fetch('plugins/ozon-analyzer/manifest.json')).json();
console.log('AI models:', manifest.ai_models);
```

#### **8.2 Debug Logging**
```typescript
// Enable verbose logging
const logger = createRunLogger('DEBUG');
logger.addMessage('DEBUG', 'Starting plugin execution...');

// Add debug points in Python
# In mcp_server.py
print(f"[DEBUG] Processing input: {input_data}")
# ... rest of function ...

// Log API calls
console.log('[AI] Calling model:', modelAlias, 'with options:', options);
```

## Deployment Checklist

### **Step 9: Pre-deployment Verification**

#### **✅ Prerequisite Checks**
- [ ] Plugin directory exists in correct location
- [ ] manifest.json is valid JSON with required fields
- [ ] workflow.json references correct function names
- [ ] mcp_server.py contains `analyze_ozon_product` function
- [ ] AI model aliases match manifest configuration

#### **✅ Integration Tests**
- [ ] Plugin appears in plugin manager
- [ ] Workflow execution completes without errors
- [ ] AI API calls use correct model aliases
- [ ] Settings are accessible via `js.get_setting()`

#### **✅ Performance Verification**
- [ ] Cold start time < 3 seconds
- [ ] Hot execution time < 2 seconds
- [ ] Memory usage < 50MB
- [ ] No memory leaks in Pyodide

#### **✅ Error Handling**
- [ ] Graceful degradation when AI APIs fail
- [ ] Proper error messages for invalid inputs
- [ ] Timeout handling for long-running operations
- [ ] Recovery from network connectivity issues

## Advanced Features

### **Step 10: Extensions & Customizations**

#### **10.1 Custom HTML Parsers**
```python
# mcp_server.py
from bs4 import BeautifulSoup

async def _custom_html_parser(page_html: str) -> Dict[str, Any]:
    """Advanced HTML parsing with BeautifulSoup"""
    soup = BeautifulSoup(page_html, 'html.parser')

    return {
        'title': soup.find('h1').text if soup.find('h1') else '',
        'price': float(soup.find('span', {'class': 'price'}).text.replace('р.', '')),
        'rating': float(soup.find('div', {'class': 'rating'}).text),
    }
```

#### **10.2 Multiple Analysis Types**
```python
# mcp_server.py
async def analyze_market_demand(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze market demand for product type"""

async def compare_with_market(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Compare product with market leaders"""

async def predict_sales_volume(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Predict potential sales volume"""
```

#### **10.3 Custom AI Models**
```json
// manifest.json
{
  "ai_models": {
    "market_analysis": "claude-3-haiku",
    "demand_forecast": "oenai/gpt-4",
    "sentiment_analysis": "anthropic/claude-2"
  },
  "model_configs": {
    "market_analysis": {
      "temperature": 0.3,
      "max_tokens": 2000,
      "system_prompt": "You are a market analyst..."
    }
  }
}
```

#### **10.4 Scheduled Analysis**
```javascript
// Automatic recurring analysis
chrome.alarms.create('ozon-analysis', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'ozon-analysis') {
        runWorkflow('ozon-analyzer');
    }
});
```

## Best Practices

### **Code Quality**
- **Error Handling**: Always wrap async operations in try-catch
- **Type Safety**: Use TypeScript interfaces for data structures
- **Documentation**: Document all public functions with JSDoc
- **Testing**: Include unit tests for critical paths

### **Performance**
- **Lazy Loading**: Initialize heavy components on demand
- **Caching**: Cache repeated AI responses when appropriate
- **Background Tasks**: Use background scripts for long operations
- **Resource Cleanup**: Properly dispose of Pyodide objects

### **Security**
- **Input Validation**: Validate all user inputs thoroughly
- **API Keys**: Never expose API keys in client-side code
- **Sanitization**: Clean HTML inputs before processing
- **Rate Limiting**: Prevent excessive API calls

### **Maintainability**
- **Modular Design**: Break large functions into smaller ones
- **Configuration**: Keep configuration separate from code
- **Versioning**: Use semantic versioning for plugins
- **Documentation**: Maintain up-to-date documentation

## Conclusion

Following this integration guide will result in a fully functional Ozon Analyzer plugin integrated into the Agent Plugins Platform. The plugin will be able to:

- ✅ Extract product information from Ozon pages
- ✅ Perform AI-powered analysis using multiple models
- ✅ Handle errors gracefully with fallback strategies
- ✅ Maintain performance standards for user experience
- ✅ Support future enhancements through modular design

For additional help or specific integration challenges, refer to the troubleshooting section or contact the development team.