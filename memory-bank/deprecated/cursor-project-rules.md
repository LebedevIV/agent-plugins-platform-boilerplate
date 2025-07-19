# 🎯 Cursor Project Rules для Agent-Plugins-Platform

## Project-Specific Rules

### Architecture Constraints
- **Plugin Structure**: manifest.json + mcp_server.py + icon.svg
- **Chat System**: per-page, per-plugin isolation with IndexedDB
- **Background Services**: Plugin Manager, Workflow Engine, Host API
- **UI Components**: React with TypeScript and Tailwind CSS
- **Communication**: chrome.runtime.sendMessage for all cross-component communication

### File Organization
- **platform-core/**: Main logic and services (keep boilerplate clean)
- **chrome-extension/src/background/**: Core background services
- **pages/*/src/**: UI components for different extension pages
- **memory-bank/**: Project documentation and context
- **public/plugins/**: Plugin implementations

### Development Patterns
- **Feature Branches**: Always create from develop branch
- **Testing**: Test before commit, use --no-verify if ESLint issues
- **Documentation**: Update memory-bank for all architectural decisions
- **Commits**: Use semantic commit messages
- **Code Quality**: TypeScript for new files, ESLint compliance

### Security Requirements
- **Zero Trust**: Plugins are not trusted by default
- **Secret Management**: API keys stored encrypted in chrome.storage.local
- **Network Control**: Whitelist domains for API calls
- **Audit Trail**: Log all plugin activities
- **Parameter Validation**: JSON Schema validation for all inputs

### Plugin Development
- **Manifest Structure**: Include required_secrets, api_permissions, network_policy
- **MCP Protocol**: Implement standard MCP server in Python
- **Error Handling**: Graceful degradation, proper error reporting
- **Performance**: Optimize for Pyodide execution time
- **Documentation**: Include usage examples and API documentation

### UI/UX Standards
- **Accessibility**: Proper ARIA labels, keyboard navigation
- **Responsive Design**: Work on different screen sizes
- **Theme Support**: Light/dark mode compatibility
- **Loading States**: Show progress indicators for async operations
- **Error States**: Clear error messages and recovery options

### Performance Guidelines
- **Pyodide Loading**: Lazy load runtime, cache results
- **Memory Management**: Clean up resources, monitor usage
- **Bundle Size**: Optimize for extension size limits
- **Caching**: Use LRU cache for frequently accessed data
- **Async Operations**: Non-blocking UI, proper loading states

### Testing Strategy
- **Unit Tests**: Test individual components and services
- **Integration Tests**: Test plugin system and chat functionality
- **E2E Tests**: Test complete user workflows
- **Security Tests**: Validate permission enforcement
- **Performance Tests**: Monitor memory and execution time

### Documentation Standards
- **Code Comments**: AI-First documentation explaining logic and decisions
- **API Documentation**: Clear interfaces and examples
- **Architecture Docs**: System design and component relationships
- **User Guides**: Installation and usage instructions
- **Developer Guides**: Plugin development and contribution

### Git Workflow
- **Branch Naming**: feature/description, bugfix/description
- **Commit Messages**: Conventional commits format
- **Pull Requests**: Include tests and documentation updates
- **Code Review**: Security and performance review required
- **Release Process**: Version bump, changelog, testing

### Error Handling
- **Graceful Degradation**: System continues working with reduced functionality
- **User Feedback**: Clear error messages and recovery options
- **Logging**: Structured logging for debugging and monitoring
- **Fallbacks**: Alternative implementations for critical features
- **Recovery**: Automatic retry mechanisms where appropriate

### Monitoring and Observability
- **Structured Logging**: Consistent log format across components
- **Performance Metrics**: Track execution time and memory usage
- **Error Tracking**: Monitor and alert on critical errors
- **User Analytics**: Track feature usage and performance
- **Health Checks**: Monitor system health and dependencies 