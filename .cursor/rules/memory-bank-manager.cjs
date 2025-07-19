#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class MemoryBankManager {
  constructor() {
    this.memoryBankDir = path.join(process.cwd(), 'memory-bank');
    this.cursorRulesDir = path.join(process.cwd(), '.cursor', 'rules');
  }

  async addEntry(content, options = {}) {
    const {
      type = 'info',
      category = 'core',
      priority = 'medium',
      tags = options.tags ? options.tags.split(',') : [],
      relatedFiles = []
    } = options;

    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];
    const time = timestamp.split('T')[1].split('.')[0];

    // Определяем файл назначения
    const targetFile = this.getTargetFile(type, category);
    const targetPath = path.join(this.memoryBankDir, targetFile);

    // Создаем запись
    const entry = this.formatEntry({
      content,
      type,
      category,
      priority,
      tags,
      relatedFiles,
      timestamp: `${date} ${time}`,
      date
    });

    // Добавляем запись в файл
    await this.appendToFile(targetPath, entry);

    console.log(`✅ Added entry to ${targetFile}`);
    console.log(`📝 Type: ${type}, Category: ${category}, Priority: ${priority}`);
    
    return { targetFile, entry };
  }

  async updateContext(contextData) {
    const contextFile = path.join(this.memoryBankDir, 'core', 'activeContext.md');
    const timestamp = new Date().toISOString().split('T')[0];
    
    let content = fs.existsSync(contextFile) 
      ? fs.readFileSync(contextFile, 'utf8')
      : this.generateActiveContextTemplate();

    // Обновляем секцию Current Status
    content = this.updateSection(content, 'Current Status', {
      'Last Updated': timestamp,
      'Current Focus': contextData.focus || 'Development',
      'Active Tasks': contextData.tasks || ['Initial setup'],
      'Next Steps': contextData.nextSteps || ['Continue development'],
      'Blockers': contextData.blockers || []
    });

    // Добавляем новую запись в Recent Decisions
    if (contextData.decisions) {
      content = this.addToSection(content, 'Recent Decisions', contextData.decisions);
    }

    fs.writeFileSync(contextFile, content);
    console.log('✅ Updated active context');
  }

  async restoreContext(options = {}) {
    const { full = false, category = null } = options;
    
    if (full) {
      return await this.restoreFullContext();
    }
    
    if (category) {
      return await this.restoreCategoryContext(category);
    }
    
    return await this.restoreQuickContext();
  }

  async restoreFullContext() {
    const context = {
      activeContext: await this.readFile('core/activeContext.md'),
      progress: await this.readFile('core/progress.md'),
      errors: await this.readFile('errors/errors.md'),
      decisions: await this.readFile('architecture/decisions.md'),
      recentActivity: await this.getRecentActivity()
    };

    console.log('📚 Full context restored');
    return context;
  }

  async restoreQuickContext() {
    const context = {
      activeContext: await this.readFile('core/activeContext.md'),
      recentErrors: await this.getRecentErrors(),
      recentDecisions: await this.getRecentDecisions()
    };

    console.log('⚡ Quick context restored');
    return context;
  }

  async restoreCategoryContext(category) {
    const categoryDir = path.join(this.memoryBankDir, category);
    if (!fs.existsSync(categoryDir)) {
      throw new Error(`Category ${category} not found`);
    }

    const files = fs.readdirSync(categoryDir)
      .filter(file => file.endsWith('.md'))
      .map(file => path.join(category, file));

    const context = {};
    for (const file of files) {
      context[file] = await this.readFile(file);
    }

    console.log(`📁 Category context restored: ${category}`);
    return context;
  }

  async searchMemory(query, options = {}) {
    const { category = null, type = null, limit = 10 } = options;
    
    const results = [];
    const searchDirs = category 
      ? [path.join(this.memoryBankDir, category)]
      : this.getAllCategoryDirs();

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      
      const files = fs.readdirSync(dir)
        .filter(file => file.endsWith('.md'));
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (content.toLowerCase().includes(query.toLowerCase())) {
          const relativePath = path.relative(this.memoryBankDir, filePath);
          results.push({
            file: relativePath,
            content: this.extractRelevantContent(content, query),
            lastModified: fs.statSync(filePath).mtime
          });
        }
      }
    }

    // Сортируем по дате изменения и ограничиваем результаты
    results.sort((a, b) => b.lastModified - a.lastModified);
    return results.slice(0, limit);
  }

  async generateReport(options = {}) {
    const { type = 'full' } = options;
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: await this.generateSummary(),
      categories: await this.generateCategoryReport(),
      recentActivity: await this.getRecentActivity(),
      errorStats: await this.generateErrorStats(),
      recommendations: await this.generateRecommendations()
    };

    if (type === 'errors') {
      return { errorStats: report.errorStats };
    }
    
    if (type === 'progress') {
      return { 
        summary: report.summary, 
        recentActivity: report.recentActivity 
      };
    }

    return report;
  }

  // Вспомогательные методы

  getTargetFile(type, category) {
    const fileMap = {
      'error': 'errors/errors.md',
      'build-error': 'errors/build-errors.md',
      'runtime-error': 'errors/runtime-errors.md',
      'ui-error': 'errors/ui-errors.md',
      'decision': 'architecture/decisions.md',
      'pattern': 'architecture/patterns.md',
      'progress': 'core/progress.md',
      'context': 'core/activeContext.md',
      'plan': 'planning/feature-roadmap.md',
      'test-result': 'development/testing-results.md',
      'debug-note': 'development/debugging-guide.md'
    };

    return fileMap[type] || `${category}/general.md`;
  }

  formatEntry(data) {
    const {
      content,
      type,
      category,
      priority,
      tags,
      relatedFiles,
      timestamp,
      date
    } = data;

    const tagsArray = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',') : []);
    const tagsStr = tagsArray.length > 0 ? tagsArray.map(tag => `#${tag.trim()}`).join(' ') : '';
    const relatedStr = relatedFiles.length > 0 
      ? relatedFiles.map(file => `- ${file}`).join('\n') 
      : '';

    const title = content ? content.split('\n')[0] : 'New Entry';
    
    return `
## [${timestamp}] - ${title}

**Тип:** ${type}
**Категория:** ${category}
**Приоритет:** ${priority}

**Контекст:** ${content || 'No content provided'}

**Статус:** 🔄 В процессе

${relatedStr ? `**Связанные файлы:**\n${relatedStr}\n` : ''}
${tagsStr ? `**Теги:** ${tagsStr}\n` : ''}
**AI Команды:**
- \`обнови контекст\` - для обновления активного контекста
- \`задокументируй\` - для создания документации

---
`;
  }

  async appendToFile(filePath, content) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
      const header = this.generateFileHeader(filePath);
      fs.writeFileSync(filePath, header);
    }

    const existingContent = fs.readFileSync(filePath, 'utf8');
    const newContent = existingContent + content;
    fs.writeFileSync(filePath, newContent);
  }

  generateFileHeader(filePath) {
    const filename = path.basename(filePath, '.md');
    const category = path.dirname(filePath).split(path.sep).pop();
    
    return `# ${filename.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${category}

## Overview

This file contains ${category}-related information and entries.

## Entries

<!-- Entries will be added here automatically -->

---
*Auto-generated file*
`;
  }

  updateSection(content, sectionName, updates) {
    const lines = content.split('\n');
    const sectionStart = lines.findIndex(line => 
      line.trim().startsWith(`## ${sectionName}`)
    );
    
    if (sectionStart === -1) return content;

    let sectionEnd = lines.findIndex((line, index) => 
      index > sectionStart && line.trim().startsWith('## ')
    );
    
    if (sectionEnd === -1) sectionEnd = lines.length;

    const beforeSection = lines.slice(0, sectionStart + 1);
    const afterSection = lines.slice(sectionEnd);

    const newSection = [`## ${sectionName}\n`];
    
    for (const [key, value] of Object.entries(updates)) {
      if (Array.isArray(value)) {
        newSection.push(`**${key}:**`);
        value.forEach(item => newSection.push(`- ${item}`));
        newSection.push('');
      } else {
        newSection.push(`**${key}:** ${value}`);
      }
    }

    return [...beforeSection, ...newSection, ...afterSection].join('\n');
  }

  addToSection(content, sectionName, items) {
    const lines = content.split('\n');
    const sectionStart = lines.findIndex(line => 
      line.trim().startsWith(`## ${sectionName}`)
    );
    
    if (sectionStart === -1) return content;

    const beforeSection = lines.slice(0, sectionStart + 1);
    const afterSection = lines.slice(sectionStart + 1);

    const newItems = Array.isArray(items) ? items : [items];
    const formattedItems = newItems.map(item => `- ${item}`);

    return [...beforeSection, ...formattedItems, '', ...afterSection].join('\n');
  }

  async readFile(relativePath) {
    const fullPath = path.join(this.memoryBankDir, relativePath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf8');
  }

  getAllCategoryDirs() {
    const categories = ['core', 'errors', 'architecture', 'development', 'ui', 'planning', 'context'];
    return categories.map(cat => path.join(this.memoryBankDir, cat));
  }

  extractRelevantContent(content, query) {
    const lines = content.split('\n');
    const queryLower = query.toLowerCase();
    
    const relevantLines = lines.filter(line => 
      line.toLowerCase().includes(queryLower)
    );
    
    return relevantLines.slice(0, 5).join('\n');
  }

  async getRecentActivity() {
    const allFiles = [];
    
    for (const dir of this.getAllCategoryDirs()) {
      if (!fs.existsSync(dir)) continue;
      
      const files = fs.readdirSync(dir)
        .filter(file => file.endsWith('.md'))
        .map(file => path.join(dir, file));
      
      allFiles.push(...files);
    }

    const fileStats = allFiles.map(file => ({
      file: path.relative(this.memoryBankDir, file),
      lastModified: fs.statSync(file).mtime
    }));

    return fileStats
      .sort((a, b) => b.lastModified - a.lastModified)
      .slice(0, 10);
  }

  async getRecentErrors() {
    const errorsFile = path.join(this.memoryBankDir, 'errors', 'errors.md');
    if (!fs.existsSync(errorsFile)) return [];
    
    const content = fs.readFileSync(errorsFile, 'utf8');
    const entries = content.split('## [');
    
    return entries
      .slice(1) // Пропускаем заголовок
      .slice(-5) // Последние 5 ошибок
      .map(entry => entry.split('\n')[0]);
  }

  async getRecentDecisions() {
    const decisionsFile = path.join(this.memoryBankDir, 'architecture', 'decisions.md');
    if (!fs.existsSync(decisionsFile)) return [];
    
    const content = fs.readFileSync(decisionsFile, 'utf8');
    const entries = content.split('## [');
    
    return entries
      .slice(1) // Пропускаем заголовок
      .slice(-5) // Последние 5 решений
      .map(entry => entry.split('\n')[0]);
  }

  async generateSummary() {
    const categories = ['core', 'errors', 'architecture', 'development', 'ui', 'planning', 'context'];
    const summary = {};
    
    for (const category of categories) {
      const categoryDir = path.join(this.memoryBankDir, category);
      if (!fs.existsSync(categoryDir)) {
        summary[category] = 0;
        continue;
      }
      
      const files = fs.readdirSync(categoryDir)
        .filter(file => file.endsWith('.md'));
      
      summary[category] = files.length;
    }
    
    return summary;
  }

  async generateCategoryReport() {
    const categories = ['core', 'errors', 'architecture', 'development', 'ui', 'planning', 'context'];
    const report = {};
    
    for (const category of categories) {
      const categoryDir = path.join(this.memoryBankDir, category);
      if (!fs.existsSync(categoryDir)) continue;
      
      const files = fs.readdirSync(categoryDir)
        .filter(file => file.endsWith('.md'))
        .map(file => ({
          name: file,
          path: path.join(category, file),
          size: fs.statSync(path.join(categoryDir, file)).size
        }));
      
      report[category] = files;
    }
    
    return report;
  }

  async generateErrorStats() {
    const errorsFile = path.join(this.memoryBankDir, 'errors', 'errors.md');
    if (!fs.existsSync(errorsFile)) {
      return { total: 0, resolved: 0, unresolved: 0 };
    }
    
    const content = fs.readFileSync(errorsFile, 'utf8');
    const entries = content.split('## [');
    const total = entries.length - 1; // Пропускаем заголовок
    
    const resolved = (content.match(/✅ Решено/g) || []).length;
    const unresolved = total - resolved;
    
    return { total, resolved, unresolved };
  }

  async generateRecommendations() {
    const recommendations = [];
    
    // Проверяем активность
    const recentActivity = await this.getRecentActivity();
    if (recentActivity.length === 0) {
      recommendations.push('Добавить первую запись в memory-bank');
    }
    
    // Проверяем ошибки
    const errorStats = await this.generateErrorStats();
    if (errorStats.unresolved > 5) {
      recommendations.push('Обработать нерешенные ошибки');
    }
    
    // Проверяем контекст
    const activeContext = await this.readFile('core/activeContext.md');
    if (!activeContext || activeContext.includes('Initial setup')) {
      recommendations.push('Обновить активный контекст проекта');
    }
    
    return recommendations;
  }

  generateActiveContextTemplate() {
    const date = new Date().toISOString().split('T')[0];
    
    return `# Active Context

## Current Status

**Last Updated:** ${date}
**Phase:** Development

## Active Tasks

- [ ] Initial setup

## Current Focus

Describe current development focus and priorities.

## Recent Decisions

- Decision 1: Description

## Next Steps

- Step 1: Description

## Blockers

- Blocker 1: Description

---
*Auto-generated template*
`;
  }
}

// CLI обработка
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const manager = new MemoryBankManager();

  try {
    switch (command) {
      case 'add':
        const content = args[1];
        const options = parseOptions(args.slice(2));
        await manager.addEntry(content, options);
        break;
        
      case 'update-context':
        const contextData = parseContextData(args.slice(1));
        await manager.updateContext(contextData);
        break;
        
      case 'restore':
        const restoreOptions = parseOptions(args.slice(1));
        const context = await manager.restoreContext(restoreOptions);
        console.log(JSON.stringify(context, null, 2));
        break;
        
      case 'search':
        const query = args[1];
        const searchOptions = parseOptions(args.slice(2));
        const results = await manager.searchMemory(query, searchOptions);
        console.log(JSON.stringify(results, null, 2));
        break;
        
      case 'report':
        const reportOptions = parseOptions(args.slice(1));
        const report = await manager.generateReport(reportOptions);
        console.log(JSON.stringify(report, null, 2));
        break;
        
      default:
        console.log(`
Memory Bank Manager - CLI Tool

Usage:
  node memory-bank-manager.cjs add "content" [options]
  node memory-bank-manager.cjs update-context [options]
  node memory-bank-manager.cjs restore [options]
  node memory-bank-manager.cjs search "query" [options]
  node memory-bank-manager.cjs report [options]

Options:
  --type=<type>       Entry type (error, decision, progress, etc.)
  --category=<cat>    Category (core, errors, architecture, etc.)
  --priority=<pri>    Priority (critical, high, medium, low)
  --tags=<tags>       Comma-separated tags
  --full              Full context restoration
  --category=<cat>    Specific category for restore/search
  --limit=<num>       Limit search results
        `);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
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

module.exports = MemoryBankManager; 