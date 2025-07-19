#!/usr/bin/env node

const CursorAuditor = require('./audit-cursor.cjs');
const CursorFixer = require('./fix-cursor.cjs');
const AIOptimizer = require('./optimize-for-ai.cjs');
const CursorExporter = require('./export-cursor.cjs');

class CursorManager {
  constructor() {
    this.auditor = new CursorAuditor();
    this.fixer = new CursorFixer();
    this.optimizer = new AIOptimizer();
    this.exporter = new CursorExporter();
  }

  async run(command, options = {}) {
    console.log('🎯 Cursor Manager - .cursor automation system\n');
    
    switch (command) {
      case 'audit':
        await this.audit(options);
        break;
      case 'fix':
        await this.fix(options);
        break;
      case 'optimize':
        await this.optimize(options);
        break;
      case 'full':
        await this.fullWorkflow(options);
        break;
      case 'status':
        await this.status();
        break;
      case 'export':
        await this.export(options);
        break;
      case 'help':
        this.showHelp();
        break;
      default:
        console.log('❌ Unknown command. Use "help" to see available commands.');
        process.exit(1);
    }
  }

  async audit(options = {}) {
    console.log('🔍 Running .cursor audit...\n');
    
    const stats = await this.auditor.audit();
    
    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
    }
    
    return stats;
  }

  async fix(options = {}) {
    console.log('🔧 Running .cursor fixes...\n');
    
    if (options.auditFirst !== false) {
      await this.audit();
    }
    
    await this.fixer.fix();
    
    if (options.auditAfter !== false) {
      console.log('\n🔍 Post-fix audit...\n');
      await this.audit();
    }
  }

  async optimize(options = {}) {
    console.log('🤖 Running AI optimization...\n');
    
    if (options.auditFirst !== false) {
      await this.audit();
    }
    
    await this.optimizer.optimize();
    
    if (options.auditAfter !== false) {
      console.log('\n🔍 Post-optimization audit...\n');
      await this.audit();
    }
  }

  async fullWorkflow(options = {}) {
    console.log('🚀 Running full .cursor workflow...\n');
    
    // 1. Аудит
    console.log('Step 1: Audit');
    const initialStats = await this.audit();
    
    // 2. Исправления
    console.log('\nStep 2: Fixes');
    await this.fix({ auditFirst: false, auditAfter: false });
    
    // 3. Оптимизация
    console.log('\nStep 3: AI Optimization');
    await this.optimize({ auditFirst: false, auditAfter: false });
    
    // 4. Финальный аудит
    console.log('\nStep 4: Final Audit');
    const finalStats = await this.audit();
    
    // 5. Отчет о результатах
    this.generateWorkflowReport(initialStats, finalStats);
  }

  async status() {
    console.log('📊 .cursor status report...\n');
    
    const stats = await this.audit();
    
    console.log('='.repeat(50));
    console.log('📈 CURRENT STATUS');
    console.log('='.repeat(50));
    
    // Общая статистика
    console.log(`📁 Total files: ${stats.totalFiles}`);
    console.log(`📋 .mdc files: ${stats.mdcFiles}`);
    console.log(`📄 .md files: ${stats.mdFiles}`);
    console.log(`✅ Files with metadata: ${stats.filesWithMetadata}`);
    console.log(`⚠️ Files without metadata: ${stats.filesWithoutMetadata}`);
    
    // Проблемы
    const totalIssues = stats.duplicateContent.length + 
                       stats.brokenLinks.length + 
                       stats.invalidMetadata.length + 
                       stats.missingFiles.length;
    
    console.log(`\n🔍 Issues found: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('🎉 .cursor is in perfect condition!');
    } else {
      console.log('🔧 Run "fix" to resolve issues');
    }
    
    // Рекомендации
    console.log('\n💡 Recommendations:');
    
    if (stats.mdFiles > 0) {
      console.log('   • Convert .md files to .mdc for better AI integration');
    }
    
    if (stats.filesWithoutMetadata > 0) {
      console.log('   • Add metadata to .mdc files');
    }
    
    if (stats.duplicateContent.length > 0) {
      console.log('   • Remove duplicate files');
    }
    
    if (stats.brokenLinks.length > 0) {
      console.log('   • Fix broken links');
    }
    
    console.log('\n' + '='.repeat(50));
  }

  async export(options = {}) {
    console.log('📦 Running .cursor export...\n');
    
    const targetProject = options.targetProject || null;
    await this.exporter.export(targetProject);
  }

  generateWorkflowReport(initialStats, finalStats) {
    console.log('\n📊 WORKFLOW REPORT');
    console.log('='.repeat(50));
    
    const initialIssues = initialStats.duplicateContent.length + 
                         initialStats.brokenLinks.length + 
                         initialStats.invalidMetadata.length + 
                         initialStats.missingFiles.length;
    
    const finalIssues = finalStats.duplicateContent.length + 
                       finalStats.brokenLinks.length + 
                       finalStats.invalidMetadata.length + 
                       finalStats.missingFiles.length;
    
    console.log(`🔧 Issues resolved: ${initialIssues - finalIssues}`);
    console.log(`📈 Metadata improvement: ${finalStats.filesWithMetadata - initialStats.filesWithMetadata} files`);
    console.log(`🤖 AI optimization: Applied to all .mdc files`);
    
    if (finalIssues === 0) {
      console.log('\n🎉 .cursor is now fully optimized for AI and Cursor!');
    } else {
      console.log(`\n⚠️ ${finalIssues} issues remain (may require manual attention)`);
    }
    
    console.log('\n' + '='.repeat(50));
  }

  showHelp() {
    console.log(`
🎯 Cursor Manager - .cursor automation system

USAGE:
  node cursor-manager.cjs <command> [options]

COMMANDS:
  audit     - Run comprehensive audit of .cursor directory
  fix       - Apply automatic fixes to found issues
  optimize  - Optimize rules for AI and Cursor
  full      - Run complete workflow (audit + fix + optimize)
  status    - Show current status and recommendations
  export    - Export .cursor rules for transfer to another project
  help      - Show this help message

OPTIONS:
  --json          - Output audit results as JSON
  --no-audit-first  - Skip audit before fixes/optimization
  --no-audit-after   - Skip audit after fixes/optimization
  --target=PROJECT - Target project for export

EXAMPLES:
  node cursor-manager.cjs audit
  node cursor-manager.cjs fix
  node cursor-manager.cjs optimize
  node cursor-manager.cjs full
  node cursor-manager.cjs status
  node cursor-manager.cjs export
  node cursor-manager.cjs export my-new-project
  node cursor-manager.cjs audit --json

WORKFLOW:
  1. audit    - Find issues and generate report
  2. fix      - Automatically resolve common issues
  3. optimize - Add AI-specific optimizations
  4. full     - Complete workflow for maximum optimization

FEATURES:
  ✅ Comprehensive file scanning
  ✅ Metadata validation and fixing
  ✅ Duplicate content detection
  ✅ Broken link detection and fixing
  ✅ AI-specific optimizations
  ✅ Priority and category assignment
  ✅ Automatic index generation
  ✅ Detailed reporting and recommendations
`);
  }
}

// CLI обработка
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};
  
  // Парсим опции
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--no-audit-first') {
      options.auditFirst = false;
    } else if (arg === '--no-audit-after') {
      options.auditAfter = false;
    } else if (arg.startsWith('--target=')) {
      options.targetProject = arg.split('=')[1];
    } else if (!command && arg !== 'help') {
      // Если это не опция и не команда help, считаем это целевым проектом
      options.targetProject = arg;
    }
  }
  
  const manager = new CursorManager();
  await manager.run(command, options);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CursorManager; 