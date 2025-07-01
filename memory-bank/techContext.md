# Technical Context: Agent-Plugins-Platform

## Technology Stack

### Frontend Technologies
- **JavaScript (ES6+)**: Core application logic and browser extension code
- **HTML5/CSS3**: User interface and styling
- **Vite**: Build tool and development server
- **Web Workers**: Isolated Python execution environment

### Python Technologies
- **Pyodide 0.27.7**: WebAssembly-based Python runtime
- **Python 3.11+**: Target Python version for plugin development
- **MCP Protocol**: Model Context Protocol for JS-Python communication

### Browser Extension Technologies
- **Manifest V3**: Chrome extension manifest format
- **Service Workers**: Background script for extension lifecycle
- **Content Scripts**: Page injection for DOM access
- **Web Accessible Resources**: Plugin file access

### Development Tools
- **Node.js**: JavaScript runtime environment
- **npm**: Package management
- **Vite**: Fast build tool and dev server
- **TypeScript**: Type checking (tsconfig.app.json present)

## Development Setup

### Prerequisites
```bash
# Required software
- Node.js 18+
- Python 3.11+ (for plugin development)
- Modern browser (Chrome/Firefox)
- Git
```

### Installation
```bash
# Clone repository
git clone <repository-url>
cd agent-plugins-platform

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build Process
```bash
# Development build
npm run dev

# Production build
npm run build
```

## Project Structure

### Core Directories
```
agent-plugins-platform/
├── core/                 # Core application logic
│   ├── plugin-manager.js # Plugin lifecycle management
│   ├── host-api.js       # Browser API access
│   └── workflow-engine.js # Plugin workflow execution
├── bridge/               # JS-Python communication
│   ├── mcp-bridge.js     # MCP protocol implementation
│   └── pyodide-worker.js # Pyodide WebWorker
├── public/               # Static assets
│   └── plugins/          # Python plugin directory
├── ui/                   # User interface components
├── src/                  # Source files
└── dist/                 # Build output
```

### Key Files
- `manifest.json`: Extension configuration
- `package.json`: Node.js dependencies and scripts
- `vite.config.js`: Build configuration
- `index.html`: Main application entry point
- `test-harness.js`: Development testing interface

## Dependencies

### Production Dependencies
```json
{
  "pyodide": "^0.27.7",        // Python WebAssembly runtime
  "live-server": "^1.2.2"      // Development server
}
```

### Development Dependencies
```json
{
  "vite": "^7.0.0",                    // Build tool
  "vite-plugin-static-copy": "^3.1.0"  // Static file copying
}
```

## Technical Constraints

### Browser Extension Limitations
- **Manifest V3**: Must use service workers instead of background pages
- **Content Security Policy**: Restricted script execution policies
- **Permission Model**: Limited access to browser APIs
- **Storage Limits**: Restricted local storage and memory usage

### Pyodide Constraints
- **WebAssembly Memory**: Limited memory allocation (typically 2GB)
- **Package Compatibility**: Not all Python packages work in Pyodide
- **Performance**: Slower than native Python execution
- **Startup Time**: Pyodide runtime initialization delay

### Security Constraints
- **Sandboxed Execution**: Python code runs in isolated environment
- **API Access**: Controlled access to browser capabilities
- **Network Restrictions**: Limited network access from Python
- **File System**: Virtual file system with restrictions

### Performance Constraints
- **Memory Usage**: WebAssembly memory limits
- **CPU Usage**: Single-threaded execution in WebWorker
- **Network**: Limited bandwidth for package downloads
- **Storage**: Browser storage limitations

## Development Workflow

### Plugin Development
1. **Create Plugin Directory**: `public/plugins/your-plugin/`
2. **Define Manifest**: `manifest.json` with plugin metadata
3. **Write Python Code**: `mcp_server.py` implementing MCP protocol
4. **Test Locally**: Use test harness for development
5. **Deploy**: Package and distribute plugin

### Testing Strategy
- **Unit Tests**: Individual component testing
- **Integration Tests**: Plugin system testing
- **E2E Tests**: Full workflow testing
- **Security Tests**: Permission and access control testing

### Debugging Tools
- **Browser DevTools**: Extension debugging
- **Pyodide Console**: Python code debugging
- **MCP Protocol Inspector**: Message flow debugging
- **Performance Profiler**: Memory and CPU usage monitoring

## Deployment Considerations

### Extension Distribution
- **Chrome Web Store**: Primary distribution channel
- **Firefox Add-ons**: Secondary distribution channel
- **Manual Installation**: Developer mode installation
- **Enterprise Deployment**: Group policy deployment

### Plugin Distribution
- **Plugin Registry**: Centralized plugin repository
- **Direct Installation**: Local plugin installation
- **Version Management**: Plugin versioning and updates
- **Security Scanning**: Plugin security validation

### Performance Optimization
- **Bundle Size**: Minimize extension size
- **Lazy Loading**: Load plugins on-demand
- **Caching**: Cache Pyodide packages and plugin code
- **Memory Management**: Efficient resource usage

## Monitoring and Analytics

### Performance Metrics
- **Plugin Load Time**: Time to initialize plugins
- **Execution Time**: Python code execution duration
- **Memory Usage**: WebAssembly memory consumption
- **Error Rates**: Plugin failure frequency

### Usage Analytics
- **Plugin Adoption**: Most popular plugins
- **User Engagement**: Plugin usage patterns
- **Error Tracking**: Plugin error reporting
- **Performance Monitoring**: Real-time performance data 