# 🎯 Cursor Saved Memories для Agent-Plugins-Platform

## 📋 Project Overview
Agent-Plugins-Platform: Browser extension enabling Python plugin execution via Pyodide and MCP protocol. Focus on security, performance, and developer experience.

## 🏗️ Architecture
- Plugin system with manifest.json + mcp_server.py structure
- Chat system per-page, per-plugin with IndexedDB storage
- Background services for plugin management and security
- React UI components with Tailwind CSS
- MCP Bridge for JS-Python communication

## 🛡️ 10 Core Development Principles
1. **Do No Harm** - security first, backward compatibility
2. **AI-First Documentation** - analytical comments for AI understanding
3. **Best Practices First** - proven patterns and standards
4. **Fail Fast, Fail Safe** - graceful degradation, early error detection
5. **Observability First** - structured logging, metrics, monitoring
6. **Configuration as Code** - versioned configs, validation
7. **Progressive Enhancement** - core functionality always works
8. **Data Integrity & Privacy** - encryption, validation, user consent
9. **Continuous Learning** - monitoring, feedback, A/B testing
10. **Ecosystem Thinking** - plugin compatibility, API stability

## 🔧 Current Status
- Basic infrastructure working
- Chat system implemented with LRU cache + IndexedDB
- Security architecture designed (Secret Manager, Network Guard, Audit System)
- 10 development principles established
- Next: Security implementation

## 📁 Key Files
- `memory-bank/activeContext.md` - current tasks and context
- `memory-bank/development-principles.md` - 10 core principles
- `chrome-extension/src/background/` - core services
- `pages/*/src/` - UI components
- `platform-core/` - main logic (keep boilerplate clean)

## 🚀 Development Workflow
- Always create feature branches from develop
- Test before commit, use --no-verify if needed
- Update memory-bank documentation
- Follow semantic commit messages
- Apply 10 principles systematically

## 🔒 Security Architecture
- Zero Trust for plugins
- Secret Manager for API keys
- Network Guard for domain control
- Audit System for monitoring
- Parameter validation with JSON schemas

## 💻 Commands
- `pnpm dev` - development mode
- `pnpm build` - production build
- `pnpm lint` - code linting
- `pnpm test` - run tests

## 🎯 Context Commands
- "Восстанови контекст" - full context restoration
- "Быстрое восстановление" - quick summary
- "Анализируй архитектуру" - architecture analysis
- "Изучи плагины" - plugin analysis

## 🔍 Important Notes
- All logic in platform-core/, boilerplate stays clean
- Use chrome.runtime.sendMessage for all communication
- IndexedDB for chat persistence, LRU cache for performance
- TypeScript for new files, ESLint compliance
- React components with proper accessibility 