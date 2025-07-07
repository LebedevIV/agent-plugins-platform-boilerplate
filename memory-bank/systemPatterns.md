# System Patterns: Agent-Plugins-Platform

## Architecture Overview

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser UI    │    │  Extension      │    │  Python Plugin  │
│   (Test Harness)│◄──►│  Background     │◄──►│  (Pyodide)      │
└─────────────────┘    │  Service Worker │    └─────────────────┘
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │  Plugin Manager │
                       │  & MCP Bridge   │
                       └─────────────────┘
```

### Core Components

#### 1. Extension Layer
- **Background Service Worker**: Manages extension lifecycle and plugin coordination
- **Content Scripts**: Inject into web pages for DOM access
- **Popup UI**: Extension management interface

#### 2. Bridge Layer
- **MCP Bridge**: Model Context Protocol implementation for JS-Python communication
- **Pyodide Worker**: Isolated WebWorker running Python environment
- **Message Routing**: Handles communication between components

#### 3. Plugin System
- **Plugin Manager**: Loads, manages, and coordinates plugins
- **Plugin Registry**: Stores plugin metadata and configurations
- **Workflow Engine**: Executes plugin workflows and sequences

#### 4. Host API
- **Browser API Access**: Controlled access to browser capabilities
- **DOM Interaction**: Safe methods for web page manipulation
- **Data Exchange**: Structured data passing between JS and Python

## Design Patterns

### 1. Plugin Pattern
```javascript
// Plugin Interface
class Plugin {
  constructor(manifest, code) {
    this.manifest = manifest;
    this.code = code;
    this.worker = null;
  }
  
  async initialize() { /* Setup Pyodide worker */ }
  async execute(input) { /* Run plugin logic */ }
  async cleanup() { /* Cleanup resources */ }
}
```

### 2. MCP Protocol Pattern
```javascript
// MCP Message Structure
{
  "type": "request|response|notification",
  "id": "unique-message-id",
  "method": "function-name",
  "params": { /* function parameters */ },
  "result": { /* function result */ }
}
```

### 3. Worker Isolation Pattern
```javascript
// Each plugin runs in isolated WebWorker
const worker = new Worker('pyodide-worker.js', {
  type: 'module',
  name: `plugin-${pluginId}`
});
```

### 4. Bridge Pattern
```javascript
// JS ↔ Python communication bridge
class MCPBridge {
  async sendToPython(message) { /* Send to Pyodide */ }
  async receiveFromPython(message) { /* Handle Python response */ }
  async callPythonFunction(name, params) { /* RPC-style calls */ }
}
```

## Key Technical Decisions

### 1. Pyodide for Python Execution
- **Rationale**: WebAssembly-based Python runtime for browser compatibility
- **Benefits**: Full Python 3.11+ support, rich ecosystem access
- **Trade-offs**: Larger bundle size, slower startup than pure JS

### 2. MCP Protocol for Communication
- **Rationale**: Standardized protocol for AI agent communication
- **Benefits**: Interoperable, well-defined message formats
- **Trade-offs**: Additional complexity, protocol overhead

### 3. WebWorker Isolation
- **Rationale**: Security and performance isolation for Python execution
- **Benefits**: Prevents UI blocking, sandboxed execution
- **Trade-offs**: Communication overhead, memory duplication

### 4. Manifest-based Plugin System
- **Rationale**: Declarative plugin configuration and permissions
- **Benefits**: Security control, easy plugin management
- **Trade-offs**: Configuration complexity, validation overhead

## Component Relationships

### Data Flow
1. **UI → Plugin Manager**: User requests plugin execution
2. **Plugin Manager → MCP Bridge**: Route request to appropriate plugin
3. **MCP Bridge → Pyodide Worker**: Send message to Python environment
4. **Pyodide Worker → Python Plugin**: Execute plugin logic
5. **Python Plugin → Host API**: Access browser capabilities
6. **Host API → Browser**: Perform browser operations
7. **Response Chain**: Results flow back through the same path

### Dependencies
```
UI Components
├── Plugin Manager (depends on)
│   ├── MCP Bridge
│   ├── Workflow Engine
│   └── Host API
└── MCP Bridge (depends on)
    ├── Pyodide Worker
    └── Message Router
```

## Security Patterns

### 1. Sandboxed Execution
- Python code runs in isolated WebWorker
- Limited access to browser APIs
- Controlled file system access

### 2. Permission-based Access
- Plugin manifests define required permissions
- Runtime permission validation
- Granular API access control

### 3. Message Validation
- All messages validated against MCP schema
- Input sanitization and type checking
- Error boundary handling

### 4. Resource Limits
- Memory usage monitoring
- Execution time limits
- Concurrent plugin limits

## Performance Patterns

### 1. Lazy Loading
- Plugins loaded on-demand
- Pyodide runtime initialized when needed
- Resource cleanup after plugin execution

### 2. Caching
- Plugin code caching
- Pyodide package caching
- Result caching for repeated operations

### 3. Async Operations
- Non-blocking plugin execution
- Concurrent plugin support
- Progress reporting for long operations

### 4. Memory Management
- Worker lifecycle management
- Garbage collection optimization
- Memory leak prevention 