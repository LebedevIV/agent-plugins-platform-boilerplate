# Agent-Plugins-Platform Development Rules

## Core Principles
- Always apply 10 development principles from memory-bank/development-principles.md
- Follow "Do No Harm" principle - prioritize security and backward compatibility
- Use AI-First documentation - add analytical comments for AI understanding
- Apply best practices first in all decisions

## Project Context
- This is a browser extension for Python plugin execution via Pyodide
- Uses MCP protocol for JS-Python communication
- Focus on security, performance, and developer experience
- All logic is in platform-core/, boilerplate stays clean

## Code Standards
- TypeScript for new files, ESLint compliance
- React components with proper accessibility
- Structured logging and error handling
- Comprehensive documentation with examples

## Security First
- Zero Trust architecture for plugins
- Validate all inputs and API calls
- Encrypt sensitive data (API keys, user data)
- Audit all plugin activities

## Architecture Patterns
- Plugin system with manifest.json + mcp_server.py structure
- Chat system per-page, per-plugin with IndexedDB storage
- Background services for plugin management and security
- React UI components with Tailwind CSS

## Development Workflow
- Always create feature branches from develop
- Test before commit, use --no-verify if needed
- Update memory-bank documentation
- Follow semantic commit messages

## Key Files
- memory-bank/activeContext.md - current tasks and context
- memory-bank/development-principles.md - 10 core principles
- chrome-extension/src/background/ - core services
- pages/*/src/ - UI components

## Security Architecture
- Secret Manager for API keys
- Network Guard for domain control
- Audit System for monitoring
- Parameter validation with JSON schemas

## Commands
- pnpm dev - development mode
- pnpm build - production build
- pnpm lint - code linting
- pnpm test - run tests

## Context Commands
- "Восстанови контекст" - full context restoration
- "Быстрое восстановление" - quick summary
- "Анализируй архитектуру" - architecture analysis
- "Изучи плагины" - plugin analysis

## Important Notes
- All logic in platform-core/, boilerplate stays clean
- Use chrome.runtime.sendMessage for all communication
- IndexedDB for chat persistence, LRU cache for performance
- TypeScript for new files, ESLint compliance
- React components with proper accessibility 