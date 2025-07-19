#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class DocumentationHelper {
  constructor() {
    this.rulesDir = path.join(__dirname);
    this.memoryBankDir = path.join(process.cwd(), 'memory-bank');
    this.documentationMapPath = path.join(this.rulesDir, 'doc', 'documentation-map.mdc');
  }

  async documentExperience(content, type = 'auto') {
    console.log('📝 Documenting experience...\n');
    
    // Определяем тип контента
    const contentType = type === 'auto' ? this.analyzeContent(content) : type;
    
    // Определяем файл назначения
    const targetFile = this.getTargetFile(contentType, content);
    
    // Создаем или обновляем файл
    await this.addToFile(targetFile, content, contentType);
    
    console.log(`✅ Documented in: ${targetFile}`);
    console.log(`📋 Content type: ${contentType}`);
  }

  analyzeContent(content) {
    const text = content.toLowerCase();
    
    // Ошибки и решения
    if (text.includes('ошибка') || text.includes('error') || text.includes('failed') || text.includes('решение')) {
      if (text.includes('безопасность') || text.includes('security')) {
        return 'security-error';
      }
      if (text.includes('производительность') || text.includes('performance')) {
        return 'performance-error';
      }
      if (text.includes('ui') || text.includes('ux') || text.includes('интерфейс')) {
        return 'ui-error';
      }
      return 'general-error';
    }
    
    // Best practices
    if (text.includes('best practice') || text.includes('практика') || text.includes('паттерн')) {
      if (text.includes('разработка') || text.includes('development') || text.includes('принципы')) {
        return 'dev-principles';
      }
      if (text.includes('документация') || text.includes('documentation')) {
        return 'doc-practice';
      }
      if (text.includes('тестирование') || text.includes('testing')) {
        return 'testing-practice';
      }
      if (text.includes('ci') || text.includes('cd') || text.includes('автоматизация')) {
        return 'ci-practice';
      }
      if (text.includes('плагин') || text.includes('plugin')) {
        return 'plugin-practice';
      }
      if (text.includes('дата') || text.includes('время') || text.includes('date') || text.includes('time')) {
        return 'date-patterns';
      }
      if (text.includes('файл') || text.includes('структура') || text.includes('file') || text.includes('structure')) {
        return 'file-patterns';
      }
      return 'general-practice';
    }
    
    // Автоматизация
    if (text.includes('автоматизация') || text.includes('automation') || text.includes('workflow')) {
      if (text.includes('ci') || text.includes('cd')) {
        return 'ci-automation';
      }
      if (text.includes('сборка') || text.includes('build')) {
        return 'build-automation';
      }
      if (text.includes('тестирование') || text.includes('testing')) {
        return 'testing-automation';
      }
      if (text.includes('деплой') || text.includes('deploy')) {
        return 'deploy-automation';
      }
      return 'general-automation';
    }
    
    // Архитектурные решения
    if (text.includes('архитектура') || text.includes('architecture') || text.includes('структура')) {
      if (text.includes('безопасность') || text.includes('security')) {
        return 'security-architecture';
      }
      if (text.includes('производительность') || text.includes('performance')) {
        return 'performance-architecture';
      }
      if (text.includes('плагин') || text.includes('plugin')) {
        return 'plugin-architecture';
      }
      return 'general-architecture';
    }
    
    // Проектно-специфичное
    if (text.includes('проект') || text.includes('текущий') || text.includes('статус')) {
      return 'project-specific';
    }
    
    return 'general';
  }

  getTargetFile(contentType, content) {
    const date = new Date().toISOString().split('T')[0];
    
    switch (contentType) {
      // Ошибки → memory-bank/errors.md
      case 'general-error':
      case 'build-error':
      case 'runtime-error':
        return path.join(this.memoryBankDir, 'errors.md');
      
      // Безопасность → .cursor/rules/security/validation.mdc
      case 'security-error':
        return path.join(this.rulesDir, 'security', 'validation.mdc');
      
      // Производительность → .cursor/rules/architecture/architecture-performance.mdc
      case 'performance-error':
        return path.join(this.rulesDir, 'architecture', 'architecture-performance.mdc');
      
      // UI/UX → .cursor/rules/ui/ui-*.mdc
      case 'ui-error':
        return path.join(this.rulesDir, 'ui', 'ui-error-handling.mdc');
      
      // Best practices → .cursor/rules/
      case 'dev-principles':
        return path.join(this.rulesDir, 'dev', 'development-principles.mdc');
      case 'dev-practice':
        return path.join(this.rulesDir, 'dev', 'development-guidelines.mdc');
      case 'doc-practice':
        return path.join(this.rulesDir, 'doc', 'ai-first.mdc');
      case 'testing-practice':
        return path.join(this.rulesDir, 'dev', 'testing-troubleshooting.mdc');
      case 'ci-practice':
        return path.join(this.rulesDir, 'workflow', 'ci-automation.mdc');
      case 'plugin-practice':
        return path.join(this.rulesDir, 'plugin', 'plugin-best-practices.mdc');
      case 'date-patterns':
        return path.join(this.rulesDir, 'dev', 'date-time-patterns.mdc');
      case 'file-patterns':
        return path.join(this.rulesDir, 'architecture', 'file-relationships.mdc');
      
      // Автоматизация → .cursor/rules/workflow/
      case 'ci-automation':
        return path.join(this.rulesDir, 'workflow', 'ci-automation.mdc');
      case 'build-automation':
        return path.join(this.rulesDir, 'dev', 'typescript-build-troubleshooting.mdc');
      case 'testing-automation':
        return path.join(this.rulesDir, 'dev', 'testing-troubleshooting.mdc');
      case 'deploy-automation':
        return path.join(this.rulesDir, 'workflow', 'automation.mdc');
      
      // Архитектура → .cursor/rules/architecture/
      case 'security-architecture':
        return path.join(this.rulesDir, 'architecture', 'architecture-security.mdc');
      case 'performance-architecture':
        return path.join(this.rulesDir, 'architecture', 'architecture-performance.mdc');
      case 'plugin-architecture':
        return path.join(this.rulesDir, 'architecture', 'architecture-plugin.mdc');
      
      // Проектно-специфичное → memory-bank/
      case 'project-specific':
        return path.join(this.memoryBankDir, 'activeContext.md');
      
      // По умолчанию → memory-bank/errors.md
      default:
        return path.join(this.memoryBankDir, 'errors.md');
    }
  }

  async addToFile(targetFile, content, contentType) {
    // Создаем директорию если не существует
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const date = new Date().toISOString();
    const timestamp = `[${date}]`;
    
    // Определяем формат файла
    const isMdcFile = targetFile.endsWith('.mdc');
    const isMemoryBank = targetFile.includes('memory-bank');
    
    if (isMdcFile && !isMemoryBank) {
      // .cursor/rules/ файл - добавляем в структурированном виде
      await this.addToMdcFile(targetFile, content, contentType, timestamp);
    } else {
      // memory-bank файл - добавляем в хронологическом порядке
      await this.addToMemoryBankFile(targetFile, content, contentType, timestamp);
    }
  }

  async addToMdcFile(filePath, content, contentType, timestamp) {
    let fileContent = '';
    
    if (fs.existsSync(filePath)) {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } else {
      // Создаем новый .mdc файл с метаданными
      fileContent = this.createMdcTemplate(contentType);
    }
    
    // Добавляем контент в соответствующую секцию
    const newSection = `\n## ${this.getSectionTitle(contentType)} (${timestamp})\n\n${content}\n`;
    
    // Ищем место для вставки (перед последней секцией)
    const lines = fileContent.split('\n');
    const insertIndex = lines.length - 2; // Перед последней строкой
    
    lines.splice(insertIndex, 0, newSection);
    
    fs.writeFileSync(filePath, lines.join('\n'));
  }

  async addToMemoryBankFile(filePath, content, contentType, timestamp) {
    let fileContent = '';
    
    if (fs.existsSync(filePath)) {
      fileContent = fs.readFileSync(filePath, 'utf8');
    }
    
    // Добавляем в начало файла (новые записи сверху)
    const newEntry = `\n## ${timestamp} - ${this.getEntryTitle(contentType)}\n\n${content}\n\n---\n`;
    
    fileContent = newEntry + fileContent;
    
    fs.writeFileSync(filePath, fileContent);
  }

  createMdcTemplate(contentType) {
    const description = this.getDescription(contentType);
    const category = this.getCategory(contentType);
    
    return `---
description: ${description}
globs: ["**/*"]
alwaysApply: true
aiPriority: high
aiCategory: ${category}
---

# ${this.getTitle(contentType)}

${this.getInitialContent(contentType)}
`;
  }

  getSectionTitle(contentType) {
    const titles = {
      'security-error': 'Security Issue',
      'performance-error': 'Performance Issue',
      'ui-error': 'UI/UX Issue',
      'dev-practice': 'Development Practice',
      'doc-practice': 'Documentation Practice',
      'testing-practice': 'Testing Practice',
      'ci-practice': 'CI/CD Practice',
      'plugin-practice': 'Plugin Practice',
      'ci-automation': 'CI/CD Automation',
      'build-automation': 'Build Automation',
      'testing-automation': 'Testing Automation',
      'deploy-automation': 'Deployment Automation',
      'security-architecture': 'Security Architecture',
      'performance-architecture': 'Performance Architecture',
      'plugin-architecture': 'Plugin Architecture'
    };
    
    return titles[contentType] || 'New Entry';
  }

  getEntryTitle(contentType) {
    const titles = {
      'general-error': 'General Error',
      'build-error': 'Build Error',
      'runtime-error': 'Runtime Error',
      'project-specific': 'Project Update'
    };
    
    return titles[contentType] || 'New Entry';
  }

  getDescription(contentType) {
    const descriptions = {
      'security-error': 'Security validation and error handling',
      'performance-error': 'Performance optimization and monitoring',
      'ui-error': 'UI/UX error handling and best practices',
      'dev-practice': 'Development best practices and guidelines',
      'doc-practice': 'Documentation standards and practices',
      'testing-practice': 'Testing strategies and troubleshooting',
      'ci-practice': 'CI/CD practices and automation',
      'plugin-practice': 'Plugin development best practices',
      'ci-automation': 'CI/CD automation and workflows',
      'build-automation': 'Build automation and optimization',
      'testing-automation': 'Testing automation and tools',
      'deploy-automation': 'Deployment automation and processes',
      'security-architecture': 'Security architecture principles',
      'performance-architecture': 'Performance architecture guidelines',
      'plugin-architecture': 'Plugin architecture patterns'
    };
    
    return descriptions[contentType] || 'General guidelines and best practices';
  }

  getCategory(contentType) {
    if (contentType.includes('error')) return 'error-handling';
    if (contentType.includes('practice')) return 'development-practices';
    if (contentType.includes('automation')) return 'process-management';
    if (contentType.includes('architecture')) return 'system-design';
    return 'general';
  }

  getTitle(contentType) {
    const titles = {
      'security-error': 'Security Validation',
      'performance-error': 'Performance Guidelines',
      'ui-error': 'UI Error Handling',
      'dev-practice': 'Development Guidelines',
      'doc-practice': 'Documentation Standards',
      'testing-practice': 'Testing & Troubleshooting',
      'ci-practice': 'CI/CD Practices',
      'plugin-practice': 'Plugin Best Practices',
      'ci-automation': 'CI/CD Automation',
      'build-automation': 'Build Automation',
      'testing-automation': 'Testing Automation',
      'deploy-automation': 'Deployment Automation',
      'security-architecture': 'Security Architecture',
      'performance-architecture': 'Performance Architecture',
      'plugin-architecture': 'Plugin Architecture'
    };
    
    return titles[contentType] || 'General Guidelines';
  }

  getInitialContent(contentType) {
    return `## Overview

This file contains ${contentType.replace('-', ' ')} guidelines and best practices.

## Guidelines

<!-- Content will be added here automatically -->
`;
  }
}

// Memory Bank Management
const memoryCommands = {
  'memory-add': 'Добавить запись в memory-bank',
  'memory-update': 'Обновить запись в memory-bank',
  'memory-restore': 'Восстановить контекст из memory-bank',
  'memory-search': 'Поиск в memory-bank',
  'memory-audit': 'Аудит memory-bank',
  'memory-structure': 'Создать структуру memory-bank',
  'memory-report': 'Генерировать отчет по memory-bank'
};

// CLI обработка
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node documentation-helper.cjs <content> [type]');
    console.log('Types: auto, error, practice, automation, architecture, project');
    console.log('\nMemory Bank Commands:');
    console.log('  memory-add <content> [options] - Add entry to memory-bank');
    console.log('  memory-update <context> - Update active context');
    console.log('  memory-restore [options] - Restore context from memory-bank');
    console.log('  memory-search <query> [options] - Search in memory-bank');
    console.log('  memory-audit - Audit memory-bank structure');
    console.log('  memory-structure <type> - Create memory-bank structure');
    console.log('  memory-report [type] - Generate memory-bank report');
    process.exit(1);
  }
  
  const command = args[0];
  
  // Обработка memory-bank команд
  if (command.startsWith('memory-')) {
    const MemoryBankManager = require('./memory-bank-manager.cjs');
    const manager = new MemoryBankManager();
    
    switch (command) {
      case 'memory-add':
        const content = args[1];
        const options = parseOptions(args.slice(2));
        await manager.addEntry(content, options);
        break;
      case 'memory-update':
        const contextData = parseContextData(args.slice(1));
        await manager.updateContext(contextData);
        break;
      case 'memory-restore':
        const restoreOptions = parseOptions(args.slice(1));
        const context = await manager.restoreContext(restoreOptions);
        console.log(JSON.stringify(context, null, 2));
        break;
      case 'memory-search':
        const query = args[1];
        const searchOptions = parseOptions(args.slice(2));
        const results = await manager.searchMemory(query, searchOptions);
        console.log(JSON.stringify(results, null, 2));
        break;
      case 'memory-audit':
        const MemoryBankAuditor = require('./memory-bank-auditor.cjs');
        const auditor = new MemoryBankAuditor();
        await auditor.audit();
        break;
      case 'memory-structure':
        const projectType = args[1] || 'react-typescript';
        const MemoryBankStructureCreator = require('./memory-bank-structure-creator.cjs');
        const creator = new MemoryBankStructureCreator();
        await creator.createStructure(projectType);
        break;
      case 'memory-report':
        const reportOptions = parseOptions(args.slice(1));
        const report = await manager.generateReport(reportOptions);
        console.log(JSON.stringify(report, null, 2));
        break;
      default:
        console.log(`Unknown memory command: ${command}`);
        process.exit(1);
    }
    return;
  }
  
  // Стандартная обработка документации
  const content = args[0];
  const type = args[1] || 'auto';
  
  const helper = new DocumentationHelper();
  await helper.documentExperience(content, type);
}

function parseOptions(args) {
  const options = {};
  
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value;
    }
  }
  
  return options;
}

function parseContextData(args) {
  const contextData = {};
  
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      contextData[key] = value;
    }
  }
  
  return contextData;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DocumentationHelper; 