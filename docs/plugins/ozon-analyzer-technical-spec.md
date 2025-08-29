# Ozon Analyzer Plugin - Technical Specification

## Overview

Ozon Analyzer is a browser extension plugin designed to analyze products on the Ozon marketplace. It extracts product information from HTML pages, performs AI-powered analysis, and provides compliance checking between product descriptions and compositions.

## Architecture

### **Plugin Structure**
```
chrome-extension/public/plugins/ozon-analyzer/
├── manifest.json          # Plugin metadata & AI models configuration
├── mcp_server.py         # Main Python logic
└── workflow.json          # Workflow definition for APP platform
```

### **Integration Points**

#### 1. APP Platform Integration
```javascript
// Workflow-engine.js calls the plugin
const result = await runWorkflow("ozon-analyzer");

// Which triggers Python code execution
analyze_ozon_product(input_data)
perform_deep_analysis(input_data)
```

#### 2. JavaScript-Python Bridge
```javascript
// Inside pyodide-worker.js
pyodide.globals.set('js', {
  llm_call: (modelAlias, options) => { /* AI API calls */ },
  get_setting: (settingName, defaultValue) => { /* Config access */ },
  sendMessageToChat: (message) => { /* UI communication */ }
});

// Inside mcp_server.py
analysis = await _call_ai_model("basic_analysis", prompt)
enable_deep = await js.get_setting("enable_deep_analysis").to_py()
```

## Technical Implementation

### **1. Main Function: analyze_ozon_product**

#### **Input Format**
```typescript
interface ProductInput {
  page_html: string;        // Raw HTML of product page
}

interface DeepAnalysisInput {
  description: string;      // Product description
  composition: string;      // Product composition
}
```

#### **Output Format**
```typescript
interface ProductAnalysis {
  success: boolean;
  analysis: string;          // AI-generated analysis
  description?: string;      // Extracted description
  composition?: string;      // Extracted composition
  categories?: string[];     // Product categories
  error?: string;           // Error message if failed
}
```

#### **Processing Pipeline**
1. **HTML Parsing**: Extract description and composition
2. **Category Analysis**: Determine product categories
3. **AI Analysis**: Generate product evaluation
4. **Response Formatting**: Structure data for UI

### **2. Main Function: perform_deep_analysis**

#### **Deep Analysis Process**
1. **Data Validation**: Ensure input data is complete
2. **Settings check**: Verify deep analysis is enabled
3. **Similar Products**: AI-powered search for alternatives
4. **Composition Analysis**: Compare description vs composition
5. **Recommendation Generation**: Provide purchase suggestions

### **3. AI Model Integration**

#### **Supported Models**
```json
{
  "basic_analysis": "gpt-4o-mini",
  "detailed_comparison": "gemini-flash",
  "deep_analysis": "gemini-25"
}
```

#### **Model Usage Patterns**
- **basic_analysis**: 2-3 sentence product overview
- **detailed_comparison**: Comprehensive product comparison
- **deep_analysis**: Detailed recommendations with alternatives

#### **Fallback Strategy**
- Primary model → Fallback model → Error handling
- API key rotation between providers
- Graceful degradation for network issues

### **4. Configuration Management**

#### **Plugin Configuration Structure**
```json
{
  "config": {
    "enable_deep_analysis": true,
    "ai_model": "gpt-4o-mini",
    "similar_products_limit": 3,
    "analysis_timeout": 30000
  }
}
```

#### **Settings Access Patterns**
```python
# Get single setting
model_alias = await js.get_setting("config", "ai_model", "gpt-4o-mini").to_py()

# Get entire config section
config = await js.get_setting("config").to_py()

# Get with fallback
timeout = await js.get_setting("analysis_timeout", default=30000).to_py()
```

## Error Handling

### **Error Types & Handling Strategies**

#### **Network Errors**
- **API Timeout**: Retry with exponential backoff
- **Rate Limiting**: Automatic queue management
- **Service Unavailable**: Graceful degradation

#### **Data Errors**
- **Invalid HTML**: Fallback parsing with regex
- **Missing Data**: Default values and partial analysis
- **Malformed JSON**: Validation before processing

#### **AI Errors**
- **Model Failure**: Fallback to alternative model
- **Quota Exceeded**: Notify user and suggest alternatives
- **MalformResponse**: Retry with simplified prompt

### **Error Propagation**
```typescript
// Error handling patterns
if (!response.success) {
  logger.addMessage('ERROR', response.error);
  return false;
}

// Error recovery
try {
  result = await callAiModel(model, prompt);
} catch (error) {
  logger.addMessage('WARNING', `Model failed: ${model}, trying fallback`);
  result = await callAiModel(fallbackModel, prompt);
}
```

## Security Considerations

### **Data Protection**
- **No permanent storage**: Analysis results are transient
- **Isolated execution**: Pyodide Web Worker sandbox
- **API key management**: Secure storage in background script
- **Input sanitization**: Strip potentially dangerous scripts

### **Privacy Measures**
- **No tracking**: User behavior is not monitored
- **Local processing**: All analysis happens in browser
- **Opt-in settings**: Deep analysis must be explicitly enabled

## Performance Optimization

### **Metrics & Benchmarks**
- **Cold start**: <3 seconds (Pyodide initialization + model load)
- **Warm analysis**: <2 seconds (HTML parsing + AI call)
- **Memory usage**: <50MB for Pyodide + models
- **Error rate**: <1% with proper error handling

### **Optimization Strategies**
- **Lazy loading**: Pyodide loads only when needed
- **Model caching**: Keep loaded models in memory
- **Parallel processing**: Multiple analysis requests concurrently
- **Resource management**: Web Worker cleanup after use

## API Reference

### **Python Functions**

#### **analyze_ozon_product(input_data: Dict[str, Any]) -> Dict[str, Any]**
Main analysis function processing Ozon product pages.

**Parameters:**
- `input_data` (dict): Contains page_html with product page content

**Returns:**
- Dictionary with success status, analysis text, and extracted data

#### **perform_deep_analysis(input_data: Dict[str, Any]) -> Dict[str, Any]**
Enhanced analysis function with AI recommendations and comparison.

**Parameters:**
- `input_data` (dict): Contains description and composition from analyze step

**Returns:**
- Dictionary with deep analysis, similar products, and recommendations

### **JavaScript Bridge Functions**

#### **js.llm_call(model_alias: str, options: object) -> Promise**
Executes AI model with specified prompt and parameters.

**Parameters:**
- `model_alias` (string): Alias of AI model from manifest configuration
- `options` (object): Prompt text and additional parameters

**Returns:**
- Promise resolving to generated text response

#### **js.get_setting(setting_name: str, default_value?: any) -> Promise**
Retrieves plugin configuration settings.

**Parameters:**
- `setting_name` (string): Path to setting in configuration object
- `default_value` (optional): Default value if setting not found

**Returns:**
- Promise resolving to setting value

## Deployment & Integration

### **Plugin Installation**
1. Place plugin files in `/plugins/ozon-analyzer/`
2. Add plugin to PLUGIN_DIRS in `plugin-manager.js`
3. Update manifest.json with required AI models
4. Configure API keys in extension settings

### **Version Compatibility**
- **Platform**: Agent Plugins Platform v1.5+
- **Python**: Pyodide 3.8+ (auto-managed)
- **JavaScript**: ES2020+ (TypeScript 5.0+)
- **AI APIs**: OpenAI GPT-4, Google Gemini

### **Dependency Requirements**
- **Runtime**: Chrome Browser v90+
- **Libraries**: webextension-polyfill v0.12.0
- **Python Packages**: aiohttp, requests (via Pyodide)
- **Build Tools**: esbuild, TypeScript tsc

## Testing & Validation

### **Unit Testing**
- Python functions with mock inputs
- JavaScript bridge with controlled responses
- Error handling with various failure modes
- AI model response validation

### **Integration Testing**
- Complete workflow from UI to Python execution
- Data flow validation between components
- Performance benchmarking under load
- Error recovery from API failures

### **End-to-End Testing**
- Browser extension functionality
- User workflow completion
- Data accuracy validation
- Cross-browser compatibility

## Future Enhancements

### **Planned Features**
- **Batch Analysis**: Multiple products at once
- **Export Reports**: PDF/Excel format generation
- **Real-time Monitoring**: Price tracking and alerts
- **Mobile Support**: Responsive design for mobile devices

### **Architectural Improvements**
- **Plugin Marketplace**: Discovery and installation system
- **AI Model Marketplace**: Dynamic model selection
- **Analytics Dashboard**: Usage and performance metrics
- **Offline Support**: Cache AI responses for offline use