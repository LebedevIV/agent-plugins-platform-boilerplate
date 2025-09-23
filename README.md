# Agent Plugins Platform v1.0.964

Browser extension that enables Python plugin execution using Pyodide and MCP protocol with automatic internationalization and protection systems.

Modern development platform featuring React 19, TypeScript, Vite, and advanced AI integration capabilities.

## 🌍 **Internationalization & Protection Systems**

### **Automatic Context Translation**
- **Command**: `Сохрани контекст` / `Save context`
- **Automatic translation** of context to English for AI/LLM compatibility
- **Backup creation** before translation
- **Git integration** with automatic commits

### **Complete .cursor Protection**
- **Automatic protection** of all `.cursor` files
- **Real-time translation** to English
- **Git hooks** for automatic protection on commits/pushes
- **Comprehensive coverage** of technical terminology

### **Auto Translate Requests**
- **Automatic translation** of user requests to English
- **Rule creation** with English templates
- **Interactive mode** for guided creation
- **Command-line interface** for quick creation

## 🚀 **Quick Start**

### **System Requirements**
- **Node.js**: ≥20.0.0
- **PNPM**: ≥10.11.0
- **Modern Browser**: Chrome/Firefox with extension support

### **1. Installation & Setup**
```bash
# Clone repository
git clone https://github.com/your-username/agent-plugins-platform.git
cd agent-plugins-platform

# Install dependencies
pnpm install

# Copy environment files
pnpm copy-env

# Set global environment variables
pnpm set-global-env
```

### **2. Development**
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Build for Firefox
pnpm build:firefox

# Create distribution packages
pnpm zip
```

### **3. Cursor Protection System**
```bash
# Complete .cursor protection (recommended)
pnpm protect-cursor

# Check protection status
pnpm check-cursor

# Install Git hooks for automatic protection
pnpm install-cursor-hooks
```

### **4. Testing & Quality**
```bash
# Run type checking
pnpm type-check

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Run end-to-end tests
pnpm e2e
```

## 🏗️ **Architecture & Technology Stack**

### **Core Technologies**
- **Browser Extension**: Chrome/Firefox extension with Manifest V3
- **Python Runtime**: Pyodide (Python in WebAssembly)
- **MCP Protocol**: Model Context Protocol for AI agent communication
- **Frontend Framework**: React 19 with TypeScript
- **Build System**: Vite with SWC for fast development
- **Package Manager**: PNPM with workspace support
- **Monorepo**: Turbo for orchestrating multiple packages

### **AI Integration**
- **Plugin System**: Extensible architecture for AI agents
- **Context Management**: Automatic translation and protection
- **Workflow Engine**: Declarative task execution with conditional logic
- **Memory Management**: LRU caching and object pooling
- **Batch Processing**: Optimized AI request grouping

### **Development Features**
- **Hot Reload**: Instant updates during development
- **Type Safety**: Full TypeScript support
- **Code Quality**: ESLint, Prettier, and automated formatting
- **Testing**: End-to-end testing framework
- **Version Management**: Automated version bumping

## 🛡️ **Protection & Security Features**

### **For .cursor Directory**
- ✅ **Automatic translation** of all files to English
- ✅ **Git hooks** for real-time protection
- ✅ **Backup system** with timestamped files
- ✅ **Comprehensive terminology** coverage (500+ terms)
- ✅ **Error handling** with safe fallbacks

### **For Context Files**
- ✅ **Automatic translation** of context to English
- ✅ **Backup creation** before translation
- ✅ **Git integration** with automatic commits
- ✅ **AI/LLM compatibility** optimization

### **For User Requests**
- ✅ **Automatic translation** of requests to English
- ✅ **Rule creation** with English templates
- ✅ **Interactive mode** for guided creation
- ✅ **Command-line interface** for quick creation

## 📋 **Available Commands**

### **Development Commands**
- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production with version update
- `pnpm build:firefox` - Build for Firefox
- `pnpm zip` - Create distribution packages
- `pnpm type-check` - Run TypeScript type checking
- `pnpm lint` - Lint code for quality issues
- `pnpm lint:fix` - Automatically fix linting issues
- `pnpm format` - Format code with Prettier

### **Cursor Protection Commands**
- `pnpm protect-cursor` - Complete .cursor directory protection
- `pnpm check-cursor` - Check protection status
- `pnpm install-cursor-hooks` - Install Git hooks for automatic protection

### **Environment Commands**
- `pnpm copy-env` - Copy environment configuration files
- `pnpm set-global-env` - Set global environment variables
- `pnpm update-version` - Update project version

### **Testing Commands**
- `pnpm e2e` - Run end-to-end tests
- `pnpm e2e:firefox` - Run tests for Firefox build

### **Natural Language Commands**

### **Context Management**
- `Сохрани контекст` - Save context in English (automatic translation)
- `Обнови прогресс` - Update project progress
- `Восстанови контекст` - Restore full project context
- `Быстрое восстановление` - Quick context summary

### **Development**
- `Анализируй архитектуру` - Analyze project architecture
- `Изучи плагины` - Study existing plugins
- `Проверь сборку` - Check project build
- `Создай плагин [название]` - Create new plugin

### **Project Management**
- `Увеличь версию [patch|minor|major]` - Bump version
- `Очисти проект` - Clean project files
- `Анализируй производительность` - Performance analysis
- `Проверь безопасность` - Security analysis

## 🔧 **System Components**

### **Cursor Protection System**
- **`cursor-protector.cjs`** - Main translation engine
- **`cursor-git-hook.cjs`** - Git hooks for automatic protection
- **`protect-cursor.cjs`** - Complete protection manager
- **`context-translator.cjs`** - Context translation system

### **Auto Translate Requests System**
- **`request-translator.cjs`** - Request translation engine
- **`auto-translate-requests.cjs`** - Interactive system management
- **`create-rule.cjs`** - Quick rule creation utility

### **Command Synchronization**
- **`command-sync.cjs`** - Synchronize commands across all sources
- **`save-context.cjs`** - Save context with automatic translation
- **`USER_COMMANDS.md`** - User-friendly command reference

## 📁 **File Structure**

```
agent-plugins-platform/
├── .cursor/                           # Cursor protection system
│   ├── rules/                         # Protection scripts
│   ├── backup/                        # Translation backups
│   └── [protected files]              # All files in English
├── memory-bank/                       # Project knowledge base
│   ├── core/                          # Core documentation
│   └── [other memory-bank files]      # Specialized docs
├── chrome-extension/                  # Main extension code
├── platform-core/                     # Core platform logic
├── packages/                          # Shared packages
├── docs/                              # Documentation
├── bash-scripts/                      # Build and utility scripts
├── ProjectGraphAgent/                 # Project control system
└── [config files]                     # Package.json, tsconfig, etc.

Core Components:
├── chrome-extension/public/plugins/   # Python plugins (Pyodide)
├── core/                              # Core JavaScript modules
├── bridge/                            # Pyodide communication bridge
├── src/                               # Source code
└── tests/                             # Test suites
```

## 🌟 **Key Benefits**

### **For AI/LLM Compatibility**
- **Universal accessibility** - Any AI assistant can read all files
- **Language consistency** - All content in English
- **Better understanding** - Clear terminology for AI processing
- **Reduced confusion** - No mixed language content

### **For International Community**
- **Global accessibility** - Ready for international developers
- **Standardized format** - Consistent English documentation
- **Easy sharing** - No language barriers
- **Professional appearance** - English for global audience

### **For Development Workflow**
- **Automatic process** - No manual translation needed
- **Safe operation** - Backups created automatically
- **Git integration** - Seamless workflow integration
- **Error prevention** - Blocks problematic commits/pushes

## 🔄 **Workflow Integration**

### **Automatic Protection**
1. **Write in any language** - System automatically translates
2. **Git operations** - Hooks ensure protection
3. **Commit/push** - Automatic translation and validation
4. **Backup safety** - Original files always preserved

### **Rule Creation**
1. **Write request in Russian** - System automatically translates
2. **Review translation** - Check confidence and accuracy
3. **Confirm creation** - Rule is created in English
4. **Edit as needed** - Add specific content and details
5. **Commit changes** - Git integration handles the rest

### **Manual Protection**
```bash
# Protect .cursor directory
npm run protect-cursor

# Save context in English
npm run save-context

# Create rule with auto translation
npm run create-rule "your request"

# Check protection status
npm run check-cursor
```

## 📚 **Documentation**

- **`.cursor/rules/doc/cursor-protection-system.mdc`** - Complete protection system guide
- **`.cursor/rules/doc/context-translation-system.mdc`** - Context translation guide
- **`.cursor/rules/doc/auto-translate-requests.mdc`** - Auto translate requests guide
- **`.cursor/rules/doc/command-synchronization.mdc`** - Command system guide
- **`USER_COMMANDS.md`** - User command reference

## 🛠️ **Troubleshooting**

### **Common Issues**
1. **Files not translated** - Check `.cursorignore` exclusions
2. **Git hooks not working** - Run `npm run install-cursor-hooks`
3. **Translation quality** - Check backup files for original content
4. **Rule creation fails** - Check file permissions and git status

### **Debug Commands**
```bash
# Check protection status
node .cursor/rules/protect-cursor.cjs check

# Test translation
node .cursor/rules/cursor-protector.cjs protect

# Test request translation
node .cursor/rules/request-translator.cjs analyze "your request"

# Verify Git hooks
ls -la .git/hooks/
```

## 🔌 **Plugin System**

### **Python Plugins with Pyodide**
- **Full Python runtime** in browser via WebAssembly
- **MCP Protocol** for seamless AI agent communication
- **Workflow Engine** with declarative task definitions
- **Batch Processing** for optimized AI requests
- **Memory Management** with LRU caching and pooling

### **Available Plugins**
- **Ozon Analyzer** - E-commerce data analysis and optimization
- **Extensible Architecture** - Easy plugin development
- **Hot Reload** - Instant plugin updates during development
- **Error Handling** - Robust error recovery and logging

### **Plugin Development**
```bash
# Plugin structure
chrome-extension/public/plugins/
├── [plugin-name]/
│   ├── mcp_server.py          # Main plugin logic
│   ├── workflow.json          # Declarative workflow
│   ├── requirements.txt       # Python dependencies
│   └── [plugin files]         # Additional resources
```

## 🔮 **Current Features & Roadmap**

### **Implemented Features**
- ✅ **React 19 + TypeScript** - Modern frontend stack
- ✅ **Pyodide Integration** - Python in browser
- ✅ **MCP Protocol** - AI agent communication
- ✅ **Workflow Engine** - Declarative task execution
- ✅ **Cursor Protection** - Automatic translation system
- ✅ **Multi-browser Support** - Chrome and Firefox
- ✅ **Development Tools** - Hot reload, linting, formatting
- ✅ **Testing Framework** - End-to-end testing
- ✅ **Version Management** - Automated versioning
- ✅ **Performance Optimization** - Caching, batching, pooling

### **Planned Enhancements**
- 🔄 **Enhanced AI Integration** - More AI service providers
- 🔄 **Plugin Marketplace** - Community plugin sharing
- 🔄 **Advanced Debugging** - Plugin debugging tools
- 🔄 **Performance Monitoring** - Real-time metrics
- 🔄 **Mobile Support** - Extension for mobile browsers

## 🤝 **Contributing**

We welcome contributions from the international developer community! To contribute:

### **Development Setup**
```bash
# Fork the repository
git clone https://github.com/your-username/agent-plugins-platform.git
cd agent-plugins-platform

# Install dependencies
pnpm install

# Set up development environment
pnpm copy-env && pnpm set-global-env

# Start development
pnpm dev
```

### **Contribution Guidelines**
- **Language**: Use English for all code, documentation, and comments
- **Protection**: Follow the Cursor protection system for all contributions
- **Testing**: Add tests for new features and ensure existing tests pass
- **Documentation**: Update documentation for any changes
- **Commits**: Use conventional commit messages
- **AI Compatibility**: Ensure all content is AI/LLM friendly

### **Plugin Development**
```bash
# Create new plugin structure
mkdir chrome-extension/public/plugins/your-plugin-name
cd chrome-extension/public/plugins/your-plugin-name

# Add mcp_server.py with your plugin logic
# Add workflow.json for declarative workflows
# Add requirements.txt for Python dependencies
```

## 📄 **License & Repository**

- **License**: MIT License - see LICENSE file for details
- **Repository**: https://github.com/your-username/agent-plugins-platform.git
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions on GitHub Discussions

## 🎯 **Support & Community**

- **Documentation**: Comprehensive guides in `/docs` folder
- **Examples**: Sample plugins and usage examples
- **Troubleshooting**: Common issues and solutions in documentation
- **Community**: International developer community support

---

**🌍🤖 Modern AI Agent Platform - Ready for International Collaboration!**

*Version 1.0.964 • React 19 • TypeScript • Pyodide • MCP Protocol • Multi-browser Support*
