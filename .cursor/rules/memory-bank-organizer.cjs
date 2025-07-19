#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class MemoryBankOrganizer {
  constructor() {
    this.memoryBankDir = path.join(process.cwd(), 'memory-bank');
    this.structurePath = path.join(this.memoryBankDir, 'MEMORY_BANK_STRUCTURE.md');
  }

  async reorganize() {
    console.log('🧠 Reorganizing Memory Bank...\n');
    
    // Создаем структуру каталогов
    await this.createDirectoryStructure();
    
    // Анализируем существующие файлы
    const fileAnalysis = await this.analyzeFiles();
    
    // Перемещаем файлы по новой структуре
    await this.moveFiles(fileAnalysis);
    
    // Создаем индексы
    await this.createIndexes();
    
    console.log('✅ Memory Bank reorganization completed!');
  }

  async createDirectoryStructure() {
    const directories = [
      'core',
      'errors',
      'architecture',
      'development',
      'ui',
      'planning',
      'context',
      'deprecated'
    ];

    for (const dir of directories) {
      const dirPath = path.join(this.memoryBankDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }
  }

  async analyzeFiles() {
    const files = fs.readdirSync(this.memoryBankDir)
      .filter(file => file.endsWith('.md') && file !== 'MEMORY_BANK_STRUCTURE.md')
      .map(file => ({
        name: file,
        path: path.join(this.memoryBankDir, file),
        category: this.categorizeFile(file)
      }));

    return files;
  }

  categorizeFile(filename) {
    const name = filename.toLowerCase();
    
    // Core файлы
    if (name.includes('activecontext') || name.includes('progress') || 
        name.includes('projectbrief') || name.includes('session-log')) {
      return 'core';
    }
    
    // Errors
    if (name.includes('error') || name.includes('graveyard') || 
        name.includes('vite-react') || name.includes('typescript-build')) {
      return 'errors';
    }
    
    // Architecture
    if (name.includes('architecture') || name.includes('systempattern') || 
        name.includes('security-architecture') || name.includes('comprehensive-architecture')) {
      return 'architecture';
    }
    
    // Development
    if (name.includes('testing') || name.includes('debug') || 
        name.includes('devtools') || name.includes('version-management')) {
      return 'development';
    }
    
    // UI
    if (name.includes('side-panel') || name.includes('chat-context') || 
        name.includes('lazy-sync') || name.includes('ui')) {
      return 'ui';
    }
    
    // Planning
    if (name.includes('future') || name.includes('plan') || 
        name.includes('optimization') || name.includes('roadmap')) {
      return 'planning';
    }
    
    // Context
    if (name.includes('tech-context') || name.includes('product-context') || 
        name.includes('environment') || name.includes('context')) {
      return 'context';
    }
    
    // Deprecated (дублирующие или устаревшие)
    if (name.includes('cursor-') || name.includes('ai-') || 
        name.includes('mdc-file-standards') || name.includes('user-commands')) {
      return 'deprecated';
    }
    
    return 'core'; // По умолчанию в core
  }

  async moveFiles(fileAnalysis) {
    for (const file of fileAnalysis) {
      const targetDir = path.join(this.memoryBankDir, file.category);
      const targetPath = path.join(targetDir, file.name);
      
      // Проверяем, не существует ли уже файл с таким именем
      if (fs.existsSync(targetPath)) {
        // Добавляем префикс для избежания конфликтов
        const newName = `migrated-${file.name}`;
        const newTargetPath = path.join(targetDir, newName);
        fs.renameSync(file.path, newTargetPath);
        console.log(`📄 Moved: ${file.name} → ${file.category}/${newName}`);
      } else {
        fs.renameSync(file.path, targetPath);
        console.log(`📄 Moved: ${file.name} → ${file.category}/`);
      }
    }
  }

  async createIndexes() {
    // Создаем индекс для каждой категории
    const categories = ['core', 'errors', 'architecture', 'development', 'ui', 'planning', 'context'];
    
    for (const category of categories) {
      await this.createCategoryIndex(category);
    }
    
    // Создаем общий индекс
    await this.createMainIndex();
  }

  async createCategoryIndex(category) {
    const categoryDir = path.join(this.memoryBankDir, category);
    const indexPath = path.join(categoryDir, 'README.md');
    
    if (!fs.existsSync(categoryDir)) return;
    
    const files = fs.readdirSync(categoryDir)
      .filter(file => file.endsWith('.md') && file !== 'README.md')
      .sort();
    
    const indexContent = `# ${this.getCategoryTitle(category)} - Index

## Files in this category:

${files.map(file => `- [${file.replace('.md', '')}](./${file})`).join('\n')}

## Description:

${this.getCategoryDescription(category)}

## Last updated: ${new Date().toISOString().split('T')[0]}
`;

    fs.writeFileSync(indexPath, indexContent);
    console.log(`📋 Created index: ${category}/README.md`);
  }

  async createMainIndex() {
    const indexPath = path.join(this.memoryBankDir, 'INDEX.md');
    
    const indexContent = `# Memory Bank - Main Index

## Categories:

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
- security.md - Архитектура безопасности
- comprehensive.md - Комплексная архитектура

### 🔧 [Development](./development/) - Процесс разработки
- testing-results.md - Результаты тестирования
- debugging-guide.md - Руководство по отладке
- devtools-guide.md - Работа с DevTools
- version-management.md - Управление версиями

### 🎨 [UI](./ui/) - UI/UX контекст
- side-panel.md - Улучшения side-panel
- chat-context.md - Контекст чата
- lazy-sync.md - Ленивая синхронизация

### 📅 [Planning](./planning/) - Планирование
- future-plans.md - Планы развития
- optimization-plans.md - Планы оптимизации
- roadmap.md - Roadmap проекта

### 🌍 [Context](./context/) - Контекстная информация
- tech-context.md - Технический контекст
- product-context.md - Продуктовый контекст
- environment.md - Окружение разработки

### 🗑️ [Deprecated](./deprecated/) - Устаревшие файлы
- Старые файлы, дубликаты, мигрированные версии

## Quick Navigation:

- **Current Status**: [activeContext.md](./core/activeContext.md)
- **Progress**: [progress.md](./core/progress.md)
- **Errors**: [errors.md](./errors/errors.md)
- **Architecture**: [decisions.md](./architecture/decisions.md)
- **Testing**: [testing-results.md](./development/testing-results.md)

## Structure Rules:

See [MEMORY_BANK_STRUCTURE.md](./MEMORY_BANK_STRUCTURE.md) for detailed organization rules.

Last updated: ${new Date().toISOString().split('T')[0]}
`;

    fs.writeFileSync(indexPath, indexContent);
    console.log(`📋 Created main index: INDEX.md`);
  }

  getCategoryTitle(category) {
    const titles = {
      'core': 'Core Files',
      'errors': 'Errors & Solutions',
      'architecture': 'Architecture Decisions',
      'development': 'Development Process',
      'ui': 'UI/UX Context',
      'planning': 'Planning & Roadmap',
      'context': 'Context Information',
      'deprecated': 'Deprecated Files'
    };
    
    return titles[category] || category;
  }

  getCategoryDescription(category) {
    const descriptions = {
      'core': 'Критически важные файлы для понимания текущего состояния проекта. Обновляются регулярно.',
      'errors': 'Проектно-специфичные ошибки и их решения. История проблем и workarounds.',
      'architecture': 'Принятые архитектурные решения с обоснованием. Влияние на проект.',
      'development': 'Результаты тестирования, руководства по отладке, процессы разработки.',
      'ui': 'UI/UX решения и улучшения. Пользовательский опыт и интерфейсные паттерны.',
      'planning': 'Планы развития проекта, roadmap, стратегические решения.',
      'context': 'Технический и продуктовый контекст. Окружение разработки.',
      'deprecated': 'Устаревшие файлы, дубликаты, мигрированные версии.'
    };
    
    return descriptions[category] || 'Category description';
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up deprecated files...');
    
    const deprecatedDir = path.join(this.memoryBankDir, 'deprecated');
    if (fs.existsSync(deprecatedDir)) {
      const files = fs.readdirSync(deprecatedDir);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(deprecatedDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Проверяем, есть ли полезная информация
          if (content.length < 1000) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Removed small file: ${file}`);
          }
        }
      }
    }
  }
}

// CLI обработка
async function main() {
  const args = process.argv.slice(2);
  
  const organizer = new MemoryBankOrganizer();
  
  if (args.includes('--cleanup')) {
    await organizer.cleanup();
  } else {
    await organizer.reorganize();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MemoryBankOrganizer; 