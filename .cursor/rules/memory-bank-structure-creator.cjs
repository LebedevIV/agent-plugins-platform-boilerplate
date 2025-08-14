#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class MemoryBankStructureCreator {
  constructor() {
    this.memoryBankDir = path.join(process.cwd(), 'memory-bank');
    this.templatesDir = path.join(__dirname, 'memory-bank', 'templates');
  }

  async createStructure(projectType = 'default') {
    console.log(`🏗️ Creating Memory Bank structure for ${projectType} project...\n`);
    
    // Создаем базовую структуру
    await this.createBaseStructure();
    
    // Создаем специфичную структуру для типа проекта
    await this.createProjectSpecificStructure(projectType);
    
    // Создаем индексы и README файлы
    await this.createIndexes(projectType);
    
    console.log('✅ Memory Bank structure created successfully!');
  }

  async createBaseStructure() {
    const baseCategories = [
      'core',
      'errors', 
      'architecture',
      'development',
      'ui',
      'planning',
      'context',
      'deprecated'
    ];

    for (const category of baseCategories) {
      const categoryPath = path.join(this.memoryBankDir, category);
      if (!fs.existsSync(categoryPath)) {
        fs.mkdirSync(categoryPath, { recursive: true });
        console.log(`📁 Created category: ${category}`);
      }
    }
  }

  async createProjectSpecificStructure(projectType) {
    const templates = this.getProjectTemplates(projectType);
    
    for (const [category, files] of Object.entries(templates)) {
      const categoryPath = path.join(this.memoryBankDir, category);
      
      for (const file of files) {
        const filePath = path.join(categoryPath, file);
        if (!fs.existsSync(filePath)) {
          const content = this.generateFileContent(file, projectType);
          fs.writeFileSync(filePath, content);
          console.log(`📄 Created: ${category}/${file}`);
        }
      }
    }
  }

  getProjectTemplates(projectType) {
    const templates = {
      'react-typescript': {
        'core': [
          'activeContext.md',
          'progress.md', 
          'projectbrief.md',
          'session-log.md'
        ],
        'errors': [
          'errors.md',
          'build-errors.md',
          'runtime-errors.md',
          'ui-errors.md',
          'typescript-errors.md'
        ],
        'architecture': [
          'decisions.md',
          'patterns.md',
          'state-management.md',
          'component-structure.md',
          'routing.md'
        ],
        'development': [
          'testing-results.md',
          'debugging-guide.md',
          'devtools-guide.md',
          'version-management.md',
          'build-process.md'
        ],
        'ui': [
          'component-library.md',
          'styling-patterns.md',
          'responsive-design.md',
          'accessibility.md',
          'performance.md'
        ],
        'planning': [
          'feature-roadmap.md',
          'optimization-plans.md',
          'migration-plans.md',
          'tech-debt.md'
        ],
        'context': [
          'tech-stack.md',
          'dependencies.md',
          'environment.md',
          'deployment.md'
        ]
      },
      'chrome-extension': {
        'core': [
          'activeContext.md',
          'progress.md',
          'projectbrief.md',
          'session-log.md'
        ],
        'errors': [
          'errors.md',
          'manifest-errors.md',
          'permission-errors.md',
          'api-errors.md',
          'content-script-errors.md'
        ],
        'architecture': [
          'decisions.md',
          'background-scripts.md',
          'content-scripts.md',
          'popup-structure.md',
          'options-page.md'
        ],
        'development': [
          'testing-results.md',
          'debugging-guide.md',
          'devtools-guide.md',
          'version-management.md',
          'packaging.md'
        ],
        'ui': [
          'popup-design.md',
          'options-page.md',
          'content-ui.md',
          'icon-design.md'
        ],
        'planning': [
          'feature-roadmap.md',
          'store-publishing.md',
          'user-feedback.md',
          'security-audit.md'
        ],
        'context': [
          'chrome-apis.md',
          'permissions.md',
          'environment.md',
          'store-requirements.md'
        ]
      },
      'node-api': {
        'core': [
          'activeContext.md',
          'progress.md',
          'projectbrief.md',
          'session-log.md'
        ],
        'errors': [
          'errors.md',
          'api-errors.md',
          'database-errors.md',
          'authentication-errors.md',
          'validation-errors.md'
        ],
        'architecture': [
          'decisions.md',
          'api-design.md',
          'database-schema.md',
          'authentication.md',
          'middleware.md'
        ],
        'development': [
          'testing-results.md',
          'debugging-guide.md',
          'devtools-guide.md',
          'version-management.md',
          'deployment.md'
        ],
        'ui': [
          'api-documentation.md',
          'swagger-spec.md',
          'client-examples.md'
        ],
        'planning': [
          'feature-roadmap.md',
          'scaling-plans.md',
          'security-plans.md'
        ],
        'context': [
          'tech-stack.md',
          'dependencies.md',
          'environment.md',
          'infrastructure.md'
        ]
      },
      'monorepo': {
        'core': [
          'activeContext.md',
          'progress.md',
          'projectbrief.md',
          'session-log.md'
        ],
        'errors': [
          'errors.md',
          'build-errors.md',
          'dependency-errors.md',
          'workspace-errors.md'
        ],
        'architecture': [
          'decisions.md',
          'workspace-structure.md',
          'package-organization.md',
          'shared-libraries.md'
        ],
        'development': [
          'testing-results.md',
          'debugging-guide.md',
          'devtools-guide.md',
          'version-management.md',
          'ci-cd.md'
        ],
        'ui': [
          'shared-components.md',
          'design-system.md',
          'storybook.md'
        ],
        'planning': [
          'feature-roadmap.md',
          'migration-plans.md',
          'refactoring-plans.md'
        ],
        'context': [
          'tech-stack.md',
          'dependencies.md',
          'environment.md',
          'workspace-config.md'
        ]
      },
      'fullstack': {
        'core': [
          'activeContext.md',
          'progress.md',
          'projectbrief.md',
          'session-log.md'
        ],
        'errors': [
          'errors.md',
          'frontend-errors.md',
          'backend-errors.md',
          'database-errors.md',
          'deployment-errors.md'
        ],
        'architecture': [
          'decisions.md',
          'system-architecture.md',
          'api-design.md',
          'database-design.md',
          'frontend-architecture.md'
        ],
        'development': [
          'testing-results.md',
          'debugging-guide.md',
          'devtools-guide.md',
          'version-management.md',
          'deployment.md'
        ],
        'ui': [
          'component-library.md',
          'design-system.md',
          'responsive-design.md',
          'accessibility.md'
        ],
        'planning': [
          'feature-roadmap.md',
          'scaling-plans.md',
          'performance-plans.md'
        ],
        'context': [
          'tech-stack.md',
          'dependencies.md',
          'environment.md',
          'infrastructure.md'
        ]
      }
    };

    return templates[projectType] || templates['react-typescript'];
  }

  generateFileContent(filename, projectType) {
    const date = new Date().toISOString().split('T')[0];
    
    const baseContent = `# ${this.getFileTitle(filename, projectType)}

## Overview

This file contains ${this.getFileDescription(filename, projectType)}.

## Entries

<!-- Entries will be added here automatically -->

---
*Generated on ${date} for ${projectType} project*
`;

    // Специальные шаблоны для ключевых файлов
    if (filename === 'activeContext.md') {
      return this.generateActiveContextTemplate(projectType);
    }
    
    if (filename === 'projectbrief.md') {
      return this.generateProjectBriefTemplate(projectType);
    }
    
    if (filename === 'errors.md') {
      return this.generateErrorsTemplate(projectType);
    }
    
    return baseContent;
  }

  generateActiveContextTemplate(projectType) {
    const date = new Date().toISOString().split('T')[0];
    
    return `# Active Context - ${projectType}

## Current Status

**Last Updated:** ${date}
**Project Type:** ${projectType}
**Phase:** Development

## Active Tasks

- [ ] Initial setup
- [ ] Core functionality
- [ ] Testing
- [ ] Documentation

## Current Focus

Describe current development focus and priorities.

## Recent Decisions

- Decision 1: Description
- Decision 2: Description

## Next Steps

- Step 1: Description
- Step 2: Description

## Blockers

- Blocker 1: Description
- Blocker 2: Description

---
*Auto-generated for ${projectType} project*
`;
  }

  generateProjectBriefTemplate(projectType) {
    const date = new Date().toISOString().split('T')[0];
    
    return `# Project Brief - ${projectType}

## Project Overview

**Name:** [Project Name]
**Type:** ${projectType}
**Created:** ${date}
**Status:** Active

## Goals

- Goal 1: Description
- Goal 2: Description
- Goal 3: Description

## Requirements

- Requirement 1: Description
- Requirement 2: Description
- Requirement 3: Description

## Constraints

- Constraint 1: Description
- Constraint 2: Description

## Success Criteria

- Criterion 1: Description
- Criterion 2: Description

---
*Auto-generated for ${projectType} project*
`;
  }

  generateErrorsTemplate(projectType) {
    const date = new Date().toISOString().split('T')[0];
    
    return `# Error Log - ${projectType}

## Error Categories

### Build Errors
<!-- Build-related errors will be logged here -->

### Runtime Errors
<!-- Runtime errors will be logged here -->

### UI/UX Errors
<!-- UI/UX related errors will be logged here -->

### ${this.getProjectSpecificErrorCategory(projectType)}
<!-- ${projectType}-specific errors will be logged here -->

## Error Resolution Workflow

1. **Document** - Record error details
2. **Analyze** - Understand root cause
3. **Solve** - Implement solution
4. **Test** - Verify resolution
5. **Document** - Update with solution

## Recent Errors

<!-- Recent errors will be listed here -->

---
*Auto-generated for ${projectType} project*
`;
  }

  getFileTitle(filename, projectType) {
    const titles = {
      'activeContext.md': `Active Context - ${projectType}`,
      'progress.md': `Progress - ${projectType}`,
      'projectbrief.md': `Project Brief - ${projectType}`,
      'session-log.md': `Session Log - ${projectType}`,
      'errors.md': `Error Log - ${projectType}`,
      'decisions.md': `Architecture Decisions - ${projectType}`,
      'patterns.md': `Design Patterns - ${projectType}`,
      'testing-results.md': `Testing Results - ${projectType}`,
      'debugging-guide.md': `Debugging Guide - ${projectType}`,
      'devtools-guide.md': `DevTools Guide - ${projectType}`,
      'version-management.md': `Version Management - ${projectType}`,
      'feature-roadmap.md': `Feature Roadmap - ${projectType}`,
      'tech-stack.md': `Tech Stack - ${projectType}`,
      'dependencies.md': `Dependencies - ${projectType}`,
      'environment.md': `Environment - ${projectType}`
    };
    
    return titles[filename] || filename.replace('.md', '').replace(/-/g, ' ');
  }

  getFileDescription(filename, projectType) {
    const descriptions = {
      'activeContext.md': 'current project context and status',
      'progress.md': 'development progress and milestones',
      'projectbrief.md': 'project overview and requirements',
      'session-log.md': 'development session logs',
      'errors.md': 'error tracking and resolution',
      'decisions.md': 'architectural decisions and rationale',
      'patterns.md': 'design patterns and best practices',
      'testing-results.md': 'testing outcomes and coverage',
      'debugging-guide.md': 'debugging procedures and tips',
      'devtools-guide.md': 'development tools usage',
      'version-management.md': 'version control and releases',
      'feature-roadmap.md': 'feature planning and roadmap',
      'tech-stack.md': 'technology stack and tools',
      'dependencies.md': 'project dependencies and versions',
      'environment.md': 'development environment setup'
    };
    
    return descriptions[filename] || 'project-specific information';
  }

  getProjectSpecificErrorCategory(projectType) {
    const categories = {
      'react-typescript': 'TypeScript Errors',
      'chrome-extension': 'Extension Errors',
      'node-api': 'API Errors',
      'monorepo': 'Workspace Errors',
      'fullstack': 'Full-stack Errors'
    };
    
    return categories[projectType] || 'Project Errors';
  }

  async createIndexes(projectType) {
    // Создаем главный индекс
    await this.createMainIndex(projectType);
    
    // Создаем индексы для каждой категории
    const categories = ['core', 'errors', 'architecture', 'development', 'ui', 'planning', 'context'];
    
    for (const category of categories) {
      await this.createCategoryIndex(category, projectType);
    }
  }

  async createMainIndex(projectType) {
    const indexPath = path.join(this.memoryBankDir, 'INDEX.md');
    const date = new Date().toISOString().split('T')[0];
    
    const content = `# Memory Bank - ${projectType} Project

## Project Information

**Type:** ${projectType}
**Created:** ${date}
**Last Updated:** ${date}

## Categories

### 📋 [Core](./core/) - Основные файлы контекста
- activeContext.md - Текущий контекст проекта
- progress.md - Прогресс разработки
- projectbrief.md - Краткое описание проекта
- session-log.md - Лог сессий разработки

### ❌ [Errors](./errors/) - Ошибки и решения
- errors.md - Кладбище ошибок (основной файл)
- build-errors.md - Ошибки сборки
- runtime-errors.md - Runtime ошибки
- ui-errors.md - UI/UX ошибки

### 🏗️ [Architecture](./architecture/) - Архитектурные решения
- decisions.md - Принятые решения
- patterns.md - Системные паттерны
- ${this.getArchitectureFiles(projectType)}

### 🔧 [Development](./development/) - Процесс разработки
- testing-results.md - Результаты тестирования
- debugging-guide.md - Руководство по отладке
- devtools-guide.md - Работа с DevTools
- version-management.md - Управление версиями

### 🎨 [UI](./ui/) - UI/UX контекст
- ${this.getUIFiles(projectType)}

### 📅 [Planning](./planning/) - Планирование
- feature-roadmap.md - Roadmap фич
- optimization-plans.md - Планы оптимизации

### 🌍 [Context](./context/) - Контекстная информация
- tech-stack.md - Технический стек
- dependencies.md - Зависимости проекта
- environment.md - Окружение разработки

## Quick Navigation

- **Current Status**: [activeContext.md](./core/activeContext.md)
- **Progress**: [progress.md](./core/progress.md)
- **Errors**: [errors.md](./errors/errors.md)
- **Architecture**: [decisions.md](./architecture/decisions.md)

## AI Commands

- \`создай запись в memory-bank\` - Создать новую запись
- \`обнови контекст\` - Обновить активный контекст
- \`восстанови контекст\` - Восстановить полный контекст
- \`аудит memory-bank\` - Провести аудит

---
*Auto-generated for ${projectType} project on ${date}*
`;

    fs.writeFileSync(indexPath, content);
    console.log('📋 Created main index: INDEX.md');
  }

  async createCategoryIndex(category, projectType) {
    const categoryDir = path.join(this.memoryBankDir, category);
    const indexPath = path.join(categoryDir, 'README.md');
    
    if (!fs.existsSync(categoryDir)) return;
    
    const files = fs.readdirSync(categoryDir)
      .filter(file => file.endsWith('.md') && file !== 'README.md')
      .sort();
    
    const content = `# ${this.getCategoryTitle(category)} - ${projectType}

## Files in this category:

${files.map(file => `- [${file.replace('.md', '')}](./${file})`).join('\n')}

## Description:

${this.getCategoryDescription(category)}

## AI Commands:

- \`добавь в ${category}\` - Добавить запись в эту категорию
- \`обнови ${category}\` - Обновить файлы в категории
- \`покажи ${category}\` - Показать содержимое категории

---
*Auto-generated for ${projectType} project*
`;

    fs.writeFileSync(indexPath, content);
    console.log(`📋 Created index: ${category}/README.md`);
  }

  getCategoryTitle(category) {
    const titles = {
      'core': 'Core Files',
      'errors': 'Errors & Solutions',
      'architecture': 'Architecture Decisions',
      'development': 'Development Process',
      'ui': 'UI/UX Context',
      'planning': 'Planning & Roadmap',
      'context': 'Context Information'
    };
    
    return titles[category] || category;
  }

  getCategoryDescription(category) {
    const descriptions = {
      'core': 'Критически важные файлы для понимания текущего состояния проекта.',
      'errors': 'Проектно-специфичные ошибки и их решения.',
      'architecture': 'Принятые архитектурные решения с обоснованием.',
      'development': 'Результаты тестирования, руководства по отладке, процессы разработки.',
      'ui': 'UI/UX решения и улучшения, пользовательский опыт.',
      'planning': 'Планы развития проекта, roadmap, стратегические решения.',
      'context': 'Технический и продуктовый контекст, окружение разработки.'
    };
    
    return descriptions[category] || 'Category description';
  }

  getArchitectureFiles(projectType) {
    const files = {
      'react-typescript': 'state-management.md - Управление состоянием\n- component-structure.md - Структура компонентов\n- routing.md - Маршрутизация',
      'chrome-extension': 'background-scripts.md - Background scripts\n- content-scripts.md - Content scripts\n- popup-structure.md - Структура popup',
      'node-api': 'api-design.md - Дизайн API\n- database-schema.md - Схема БД\n- authentication.md - Аутентификация',
      'monorepo': 'workspace-structure.md - Структура workspace\n- package-organization.md - Организация пакетов\n- shared-libraries.md - Общие библиотеки',
      'fullstack': 'system-architecture.md - Системная архитектура\n- api-design.md - Дизайн API\n- frontend-architecture.md - Архитектура фронтенда'
    };
    
    return files[projectType] || 'patterns.md - Системные паттерны';
  }

  getUIFiles(projectType) {
    const files = {
      'react-typescript': 'component-library.md - Библиотека компонентов\n- styling-patterns.md - Паттерны стилизации\n- responsive-design.md - Адаптивный дизайн',
      'chrome-extension': 'popup-design.md - Дизайн popup\n- options-page.md - Страница настроек\n- content-ui.md - UI в content scripts',
      'node-api': 'api-documentation.md - Документация API\n- swagger-spec.md - Swagger спецификация\n- client-examples.md - Примеры клиентов',
      'monorepo': 'shared-components.md - Общие компоненты\n- design-system.md - Дизайн-система\n- storybook.md - Storybook',
      'fullstack': 'component-library.md - Библиотека компонентов\n- design-system.md - Дизайн-система\n- responsive-design.md - Адаптивный дизайн'
    };
    
    return files[projectType] || 'ui-patterns.md - UI паттерны';
  }
}

// CLI обработка
async function main() {
  const args = process.argv.slice(2);
  const projectType = args[0] || 'react-typescript';
  
  const creator = new MemoryBankStructureCreator();
  await creator.createStructure(projectType);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MemoryBankStructureCreator; 