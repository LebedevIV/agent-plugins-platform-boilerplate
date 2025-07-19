#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class MemoryBankAuditor {
  constructor() {
    this.memoryBankDir = path.join(process.cwd(), 'memory-bank');
    this.cursorRulesDir = path.join(process.cwd(), '.cursor', 'rules');
  }

  async audit() {
    console.log('🔍 Auditing Memory Bank for files that should be in .cursor/rules/...\n');
    
    const files = await this.getAllFiles();
    const analysis = await this.analyzeFiles(files);
    
    this.printReport(analysis);
    
    return analysis;
  }

  async getAllFiles() {
    const files = [];
    
    const walkDir = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (item.endsWith('.md')) {
          files.push({
            path: fullPath,
            relativePath: path.relative(this.memoryBankDir, fullPath),
            name: item,
            category: path.dirname(path.relative(this.memoryBankDir, fullPath))
          });
        }
      }
    };
    
    walkDir(this.memoryBankDir);
    return files;
  }

  async analyzeFiles(files) {
    const analysis = {
      shouldMoveToCursor: [],
      shouldStayInMemoryBank: [],
      unclear: [],
      totalFiles: files.length
    };

    for (const file of files) {
      const content = fs.readFileSync(file.path, 'utf8');
      const decision = this.analyzeFile(file, content);
      
      switch (decision.category) {
        case 'cursor':
          analysis.shouldMoveToCursor.push({ ...file, reason: decision.reason });
          break;
        case 'memory-bank':
          analysis.shouldStayInMemoryBank.push({ ...file, reason: decision.reason });
          break;
        case 'unclear':
          analysis.unclear.push({ ...file, reason: decision.reason });
          break;
      }
    }

    return analysis;
  }

  analyzeFile(file, content) {
    const text = content.toLowerCase();
    const name = file.name.toLowerCase();
    
    // Критерии для .cursor/rules/
    const cursorIndicators = [
      // Универсальные принципы и правила
      'принципы разработки', 'development principles', 'best practices',
      'паттерны', 'patterns', 'стандарты', 'standards',
      'правила', 'rules', 'guidelines', 'руководства',
      
      // Автоматизация и workflow
      'автоматизация', 'automation', 'workflow', 'процессы',
      'ci/cd', 'continuous integration', 'deployment',
      
      // Документация и структуры
      'документация', 'documentation', 'структура', 'structure',
      'форматы', 'formats', 'шаблоны', 'templates',
      
      // UI/UX стандарты
      'ui/ux', 'user interface', 'user experience', 'интерфейс',
      'стили', 'styles', 'компоненты', 'components',
      
      // Безопасность
      'безопасность', 'security', 'валидация', 'validation',
      
      // Технические паттерны
      'паттерны работы', 'date patterns', 'time patterns',
      'file relationships', 'взаимосвязи файлов'
    ];
    
    // Критерии для memory-bank/
    const memoryBankIndicators = [
      // Проектно-специфичное
      'agent-plugins-platform', 'текущий проект', 'current project',
      'статус проекта', 'project status', 'прогресс', 'progress',
      
      // Конкретные ошибки и решения
      'ошибка', 'error', 'баг', 'bug', 'решение', 'solution',
      'vite-react19', 'typescript-build', 'конкретная проблема',
      
      // Архитектурные решения проекта
      'архитектура проекта', 'project architecture', 'решения проекта',
      'принятые решения', 'decisions made',
      
      // Результаты тестирования
      'результаты тестов', 'test results', 'отладка', 'debugging',
      
      // Планы развития
      'планы развития', 'development plans', 'roadmap', 'roadmap проекта',
      
      // Контекст проекта
      'контекст проекта', 'project context', 'окружение', 'environment'
    ];
    
    // Проверяем индикаторы
    const cursorScore = cursorIndicators.filter(indicator => 
      text.includes(indicator) || name.includes(indicator)
    ).length;
    
    const memoryBankScore = memoryBankIndicators.filter(indicator => 
      text.includes(indicator) || name.includes(indicator)
    ).length;
    
    // Специальные случаи
    if (name.includes('readme') || name.includes('index')) {
      return { category: 'memory-bank', reason: 'README и INDEX файлы должны оставаться в memory-bank' };
    }
    
    if (name.includes('development-principles') || text.includes('принципы разработки')) {
      return { category: 'cursor', reason: 'Универсальные принципы разработки применимы к любым проектам' };
    }
    
    if (name.includes('file-relationships') || text.includes('взаимосвязи файлов')) {
      return { category: 'cursor', reason: 'Паттерны организации файлов универсальны' };
    }
    
    if (name.includes('date-time-patterns') || text.includes('паттерны работы с датами')) {
      return { category: 'cursor', reason: 'Универсальные паттерны работы с датами и временем' };
    }
    
    if (name.includes('errors') || name.includes('error') || name.includes('graveyard')) {
      return { category: 'memory-bank', reason: 'Проектно-специфичные ошибки и решения' };
    }
    
    if (name.includes('architecture') || name.includes('systempattern')) {
      return { category: 'memory-bank', reason: 'Архитектурные решения конкретного проекта' };
    }
    
    if (name.includes('testing') || name.includes('debug')) {
      return { category: 'memory-bank', reason: 'Результаты тестирования и отладки проекта' };
    }
    
    if (name.includes('progress') || name.includes('activecontext')) {
      return { category: 'memory-bank', reason: 'Текущий статус и прогресс проекта' };
    }
    
    // Принимаем решение на основе баллов
    if (cursorScore > memoryBankScore && cursorScore > 0) {
      return { 
        category: 'cursor', 
        reason: `Найдено ${cursorScore} индикаторов для .cursor/rules/ (vs ${memoryBankScore} для memory-bank/)` 
      };
    } else if (memoryBankScore > cursorScore && memoryBankScore > 0) {
      return { 
        category: 'memory-bank', 
        reason: `Найдено ${memoryBankScore} индикаторов для memory-bank/ (vs ${cursorScore} для .cursor/rules/)` 
      };
    } else {
      return { 
        category: 'unclear', 
        reason: `Неясно: cursorScore=${cursorScore}, memoryBankScore=${memoryBankScore}` 
      };
    }
  }

  printReport(analysis) {
    console.log('📊 MEMORY BANK AUDIT REPORT');
    console.log('='.repeat(60));
    
    console.log(`📁 Total files analyzed: ${analysis.totalFiles}`);
    console.log(`🔄 Should move to .cursor/rules/: ${analysis.shouldMoveToCursor.length}`);
    console.log(`🧠 Should stay in memory-bank/: ${analysis.shouldStayInMemoryBank.length}`);
    console.log(`❓ Unclear: ${analysis.unclear.length}`);
    
    if (analysis.shouldMoveToCursor.length > 0) {
      console.log('\n🔄 FILES THAT SHOULD MOVE TO .cursor/rules/:');
      console.log('-'.repeat(60));
      
      for (const file of analysis.shouldMoveToCursor) {
        console.log(`📄 ${file.relativePath}`);
        console.log(`   Reason: ${file.reason}`);
        console.log(`   Suggested location: .cursor/rules/${this.getSuggestedLocation(file)}`);
        console.log('');
      }
    }
    
    if (analysis.unclear.length > 0) {
      console.log('\n❓ UNCLEAR FILES (need manual review):');
      console.log('-'.repeat(60));
      
      for (const file of analysis.unclear) {
        console.log(`📄 ${file.relativePath}`);
        console.log(`   Reason: ${file.reason}`);
        console.log('');
      }
    }
    
    if (analysis.shouldMoveToCursor.length === 0 && analysis.unclear.length === 0) {
      console.log('\n✅ All files are in the correct location!');
    } else {
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('-'.repeat(60));
      
      if (analysis.shouldMoveToCursor.length > 0) {
        console.log('1. Move identified files to .cursor/rules/ with proper metadata');
        console.log('2. Update documentation-helper.cjs to handle new file types');
        console.log('3. Update documentation-map.mdc if needed');
      }
      
      if (analysis.unclear.length > 0) {
        console.log('4. Manually review unclear files');
        console.log('5. Update analysis criteria based on findings');
      }
    }
    
    console.log('\n' + '='.repeat(60));
  }

  getSuggestedLocation(file) {
    const name = file.name.toLowerCase();
    
    if (name.includes('development-principles')) {
      return 'dev/dev-principle-01-do-no-harm.mdc';
    }
    
    if (name.includes('file-relationships')) {
      return 'architecture/architecture-project-structure.mdc';
    }
    
    if (name.includes('date-time-patterns')) {
      return 'dev/date-time-patterns.mdc';
    }
    
    if (name.includes('patterns')) {
      return 'dev/patterns.mdc';
    }
    
    if (name.includes('standards')) {
      return 'doc/standards.mdc';
    }
    
    return 'general/';
  }

  async generateMigrationScript(analysis) {
    if (analysis.shouldMoveToCursor.length === 0) {
      console.log('No files to migrate.');
      return;
    }
    
    const scriptPath = path.join(process.cwd(), 'migrate-to-cursor.sh');
    let script = '#!/bin/bash\n\n';
    script += '# Migration script for memory-bank files to .cursor/rules/\n';
    script += '# Generated by memory-bank-auditor.cjs\n\n';
    
    for (const file of analysis.shouldMoveToCursor) {
      const targetPath = this.getSuggestedLocation(file);
      script += `# ${file.reason}\n`;
      script += `# mv "${file.path}" ".cursor/rules/${targetPath}"\n\n`;
    }
    
    fs.writeFileSync(scriptPath, script);
    console.log(`📝 Migration script generated: ${scriptPath}`);
  }
}

// CLI обработка
async function main() {
  const args = process.argv.slice(2);
  
  const auditor = new MemoryBankAuditor();
  
  if (args.includes('--generate-script')) {
    const analysis = await auditor.audit();
    await auditor.generateMigrationScript(analysis);
  } else {
    await auditor.audit();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MemoryBankAuditor; 