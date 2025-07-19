#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CursorManager {
  constructor() {
    this.cursorDir = path.join(process.cwd(), '.cursor', 'rules');
    this.memoryBankDir = path.join(process.cwd(), 'memory-bank');
  }

  async executeCommand(command, options = {}, args = []) {
    console.log(`🚀 Executing: ${command}\n`);
    
    try {
      switch (command) {
        case 'audit':
          await this.auditCursor();
          break;
        case 'fix':
          await this.fixCursor();
          break;
        case 'optimize':
          await this.optimizeCursor();
          break;
        case 'full':
          await this.fullWorkflow();
          break;
        case 'status':
          await this.showStatus();
          break;
        case 'create-rule':
          await this.createRule(options.name, options.content);
          break;
        case 'export':
          await this.exportRules(options.project);
          break;
        case 'import':
          await this.importRules();
          break;
        case 'memory-add':
          await this.memoryAdd(options.content, options);
          break;
        case 'memory-update':
          await this.memoryUpdate(options);
          break;
        case 'memory-restore':
          await this.memoryRestore(options);
          break;
        case 'memory-audit':
          await this.memoryAudit();
          break;
        case 'memory-structure':
          await this.memoryStructure(options.type);
          break;
        case 'memory-report':
          await this.memoryReport(options.type);
          break;
        case 'memory-search':
          const query = args[1];
          await this.memorySearch(query, options);
          break;
        case 'document':
          await this.document(options.content, options.type);
          break;
        default:
          console.log(`❌ Unknown command: ${command}`);
          this.showHelp();
      }
    } catch (error) {
      console.error(`❌ Error executing ${command}:`, error.message);
      process.exit(1);
    }
  }

  async auditCursor() {
    console.log('🔍 Auditing .cursor rules...\n');
    
    const DocumentationHelper = require('./documentation-helper.cjs');
    const helper = new DocumentationHelper();
    
    // Проверяем структуру .cursor
    const issues = [];
    
    // Проверяем наличие обязательных файлов
    const requiredFiles = [
      'cursor-export/ai-memory.mdc',
      'doc/documentation-map.mdc',
      'dev/development-principles.mdc'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(this.cursorDir, file);
      if (!fs.existsSync(filePath)) {
        issues.push(`Missing required file: ${file}`);
      }
    }
    
    // Проверяем метаданные в .mdc файлах
    const mdcFiles = this.findMdcFiles();
    for (const file of mdcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes('description:') || !content.includes('aiPriority:')) {
        issues.push(`Missing metadata in: ${path.relative(this.cursorDir, file)}`);
      }
    }
    
    if (issues.length === 0) {
      console.log('✅ .cursor rules audit passed - no issues found');
    } else {
      console.log('❌ Found issues:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    return issues;
  }

  async fixCursor() {
    console.log('🔧 Fixing .cursor rules...\n');
    
    const issues = await this.auditCursor();
    
    if (issues.length === 0) {
      console.log('✅ No fixes needed');
      return;
    }
    
    // Автоматические исправления
    for (const issue of issues) {
      if (issue.includes('Missing metadata')) {
        await this.fixMetadata(issue);
      }
    }
    
    console.log('✅ Fixes applied');
  }

  async optimizeCursor() {
    console.log('⚡ Optimizing .cursor rules...\n');
    
    // Оптимизация структуры
    await this.optimizeStructure();
    
    // Оптимизация метаданных
    await this.optimizeMetadata();
    
    console.log('✅ Optimization completed');
  }

  async fullWorkflow() {
    console.log('🔄 Running full workflow...\n');
    
    await this.auditCursor();
    await this.fixCursor();
    await this.optimizeCursor();
    
    console.log('✅ Full workflow completed');
  }

  async showStatus() {
    console.log('📊 .cursor rules status:\n');
    
    const mdcFiles = this.findMdcFiles();
    const categories = this.getCategories();
    
    console.log(`📁 Total .mdc files: ${mdcFiles.length}`);
    console.log(`📂 Categories: ${Object.keys(categories).length}`);
    
    for (const [category, count] of Object.entries(categories)) {
      console.log(`  - ${category}: ${count} files`);
    }
    
    // Проверяем memory-bank
    if (fs.existsSync(this.memoryBankDir)) {
      const memoryFiles = this.findMemoryFiles();
      console.log(`\n🧠 Memory bank files: ${memoryFiles.length}`);
    }
  }

  async createRule(name, content) {
    console.log(`📝 Creating rule: ${name}\n`);
    
    const DocumentationHelper = require('./documentation-helper.cjs');
    const helper = new DocumentationHelper();
    
    await helper.documentExperience(content, 'general-practice');
    
    console.log(`✅ Rule created: ${name}`);
  }

  async exportRules(project = 'default') {
    console.log(`📤 Exporting rules to cursor-export...\n`);
    
    const exportDir = path.join(this.cursorDir, 'cursor-export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const mdcFiles = this.findMdcFiles();
    let exportedCount = 0;
    
    for (const file of mdcFiles) {
      const relativePath = path.relative(this.cursorDir, file);
      const exportPath = path.join(exportDir, relativePath);
      
      const dir = path.dirname(exportPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.copyFileSync(file, exportPath);
      exportedCount++;
    }
    
    // Создаем индекс экспорта
    const exportIndex = this.generateExportIndex(mdcFiles, project);
    const indexPath = path.join(exportDir, 'EXPORT_INDEX.md');
    fs.writeFileSync(indexPath, exportIndex);
    
    console.log(`✅ Exported ${exportedCount} rules to cursor-export`);
  }

  async importRules() {
    console.log('📥 Importing rules from cursor-export...\n');
    
    const exportDir = path.join(this.cursorDir, 'cursor-export');
    if (!fs.existsSync(exportDir)) {
      console.log('❌ No cursor-export directory found');
      return;
    }
    
    const exportedFiles = this.findExportedFiles();
    let importedCount = 0;
    
    for (const file of exportedFiles) {
      const relativePath = path.relative(exportDir, file);
      const importPath = path.join(this.cursorDir, relativePath);
      
      const dir = path.dirname(importPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.copyFileSync(file, importPath);
      importedCount++;
    }
    
    console.log(`✅ Imported ${importedCount} rules from cursor-export`);
  }

  // Memory Bank Management

  async memoryAdd(content, options = {}) {
    const MemoryBankManager = require('./memory-bank-manager.cjs');
    const manager = new MemoryBankManager();
    
    await manager.addEntry(content, options);
  }

  async memoryUpdate(options = {}) {
    const MemoryBankManager = require('./memory-bank-manager.cjs');
    const manager = new MemoryBankManager();
    
    await manager.updateContext(options);
  }

  async memoryRestore(options = {}) {
    const MemoryBankManager = require('./memory-bank-manager.cjs');
    const manager = new MemoryBankManager();
    
    const context = await manager.restoreContext(options);
    console.log(JSON.stringify(context, null, 2));
  }

  async memoryAudit() {
    const MemoryBankAuditor = require('./memory-bank-auditor.cjs');
    const auditor = new MemoryBankAuditor();
    
    await auditor.audit();
  }

  async memoryStructure(type = 'react-typescript') {
    const MemoryBankStructureCreator = require('./memory-bank-structure-creator.cjs');
    const creator = new MemoryBankStructureCreator();
    
    await creator.createStructure(type);
  }

  async memoryReport(type = 'full') {
    const MemoryBankManager = require('./memory-bank-manager.cjs');
    const manager = new MemoryBankManager();
    
    const report = await manager.generateReport({ type });
    console.log(JSON.stringify(report, null, 2));
  }

  async memorySearch(query, options = {}) {
    const MemoryBankManager = require('./memory-bank-manager.cjs');
    const manager = new MemoryBankManager();
    
    const results = await manager.searchMemory(query, options);
    console.log(JSON.stringify(results, null, 2));
  }

  async document(content, type = 'auto') {
    const DocumentationHelper = require('./documentation-helper.cjs');
    const helper = new DocumentationHelper();
    
    await helper.documentExperience(content, type);
  }

  // Вспомогательные методы

  findMdcFiles() {
    const files = [];
    
    function scanDir(dir) {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (item.endsWith('.mdc')) {
          files.push(fullPath);
        }
      }
    }
    
    scanDir(this.cursorDir);
    return files;
  }

  findMemoryFiles() {
    const files = [];
    
    function scanDir(dir) {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (item.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    }
    
    scanDir(this.memoryBankDir);
    return files;
  }

  findExportedFiles() {
    const exportDir = path.join(this.cursorDir, 'cursor-export');
    const files = [];
    
    function scanDir(dir) {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (item.endsWith('.mdc')) {
          files.push(fullPath);
        }
      }
    }
    
    scanDir(exportDir);
    return files;
  }

  getCategories() {
    const categories = {};
    const mdcFiles = this.findMdcFiles();
    
    for (const file of mdcFiles) {
      const relativePath = path.relative(this.cursorDir, file);
      const category = relativePath.split(path.sep)[0];
      categories[category] = (categories[category] || 0) + 1;
    }
    
    return categories;
  }

  async fixMetadata(issue) {
    const filePath = issue.match(/in: (.+)/)[1];
    const fullPath = path.join(this.cursorDir, filePath);
    
    if (!fs.existsSync(fullPath)) return;
    
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Добавляем базовые метаданные если их нет
    if (!content.includes('description:')) {
      const newContent = content.replace(
        /^---\n/,
        `---
description: Auto-generated rule
globs: ["**/*"]
alwaysApply: false
aiPriority: normal
aiCategory: general
---
`
      );
      fs.writeFileSync(fullPath, newContent);
    }
  }

  async optimizeStructure() {
    // Оптимизация структуры каталогов
    const categories = ['dev', 'doc', 'ui', 'workflow', 'architecture', 'security', 'plugin'];
    
    for (const category of categories) {
      const categoryDir = path.join(this.cursorDir, category);
      if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
      }
    }
  }

  async optimizeMetadata() {
    const mdcFiles = this.findMdcFiles();
    
    for (const file of mdcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Оптимизируем метаданные
      let optimized = content;
      
      // Добавляем aiPriority если нет
      if (!content.includes('aiPriority:')) {
        optimized = optimized.replace(
          /^---\n/,
          `---
aiPriority: normal
`
        );
      }
      
      // Добавляем aiCategory если нет
      if (!content.includes('aiCategory:')) {
        optimized = optimized.replace(
          /^---\n/,
          `---
aiCategory: general
`
        );
      }
      
      if (optimized !== content) {
        fs.writeFileSync(file, optimized);
      }
    }
  }

  generateExportIndex(files, project) {
    const date = new Date().toISOString().split('T')[0];
    
    let index = `# Cursor Rules Export - ${project}

**Exported:** ${date}
**Total files:** ${files.length}

## Files

`;
    
    const categories = {};
    for (const file of files) {
      const relativePath = path.relative(this.cursorDir, file);
      const category = relativePath.split(path.sep)[0];
      
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(relativePath);
    }
    
    for (const [category, categoryFiles] of Object.entries(categories)) {
      index += `### ${category}\n`;
      for (const file of categoryFiles) {
        index += `- [${file}](./${file})\n`;
      }
      index += '\n';
    }
    
    return index;
  }

  showHelp() {
    console.log(`
Cursor Manager - CLI Tool

Usage:
  node cursor-manager.cjs <command> [options]

Commands:
  audit              - Audit .cursor rules
  fix                - Fix .cursor issues
  optimize           - Optimize .cursor rules
  full               - Run full workflow (audit + fix + optimize)
  status             - Show .cursor status
  create-rule <name> - Create new rule
  export [project]   - Export rules to cursor-export
  import             - Import rules from cursor-export

Memory Bank Commands:
  memory-add <content> [options]     - Add entry to memory-bank
  memory-update [options]            - Update active context
  memory-restore [options]           - Restore context from memory-bank
  memory-audit                       - Audit memory-bank structure
  memory-structure <type>            - Create memory-bank structure
  memory-report [type]               - Generate memory-bank report

Documentation Commands:
  document <content> [type]          - Document experience

Options:
  --type=<type>       Entry type (error, decision, progress, etc.)
  --category=<cat>    Category (core, errors, architecture, etc.)
  --priority=<pri>    Priority (critical, high, medium, low)
  --tags=<tags>       Comma-separated tags
  --full              Full context restoration
  --content=<text>    Content for rule or entry
    `);
  }
}

// CLI обработка
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    const manager = new CursorManager();
    manager.showHelp();
    process.exit(1);
  }
  
  const command = args[0];
  const options = parseOptions(args.slice(1));
  
  const manager = new CursorManager();
  await manager.executeCommand(command, options, args);
}

function parseOptions(args) {
  const options = {};
  
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value;
    } else if (!options.name) {
      options.name = arg;
    } else if (!options.content) {
      options.content = arg;
    }
  }
  
  return options;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CursorManager; 