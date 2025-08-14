#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class AIOptimizer {
  constructor() {
    this.rulesDir = path.join(__dirname);
  }

  async optimize() {
    console.log('🤖 Optimizing .cursor for AI and Cursor...\n');
    
    await this.optimizeMetadata();
    await this.addAITags();
    await this.optimizeStructure();
    await this.createAIIndex();
    await this.validateAIReadiness();
    
    console.log('\n✅ AI optimization completed!');
  }

  async optimizeMetadata() {
    console.log('📋 Optimizing metadata for AI...');
    
    const mdcFiles = this.getFilesByExt('.mdc');
    
    for (const file of mdcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const optimizedContent = this.optimizeFileMetadata(content, file);
      
      if (optimizedContent !== content) {
        fs.writeFileSync(file, optimizedContent);
        console.log(`   ✅ Optimized ${path.relative(this.rulesDir, file)}`);
      }
    }
  }

  optimizeFileMetadata(content, filePath) {
    const metadataMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!metadataMatch) return content;
    
    const metadata = metadataMatch[1];
    const fileName = path.basename(filePath, '.mdc');
    const dirName = path.basename(path.dirname(filePath));
    
    // Оптимизируем globs для лучшего понимания AI
    let optimizedGlobs = this.getOptimizedGlobs(fileName, dirName);
    let optimizedAlwaysApply = this.shouldAlwaysApply(fileName, dirName);
    
    // Добавляем AI-специфичные метаданные
    let newMetadata = metadata;
    
    // Обновляем globs если нужно
    if (!metadata.includes('globs:') || !metadata.includes(optimizedGlobs)) {
      newMetadata = newMetadata.replace(/globs:.*\n/, `globs: ${optimizedGlobs}\n`);
      if (!newMetadata.includes('globs:')) {
        newMetadata = `globs: ${optimizedGlobs}\n${newMetadata}`;
      }
    }
    
    // Обновляем alwaysApply если нужно
    if (!metadata.includes('alwaysApply:') || !metadata.includes(optimizedAlwaysApply.toString())) {
      newMetadata = newMetadata.replace(/alwaysApply:.*\n/, `alwaysApply: ${optimizedAlwaysApply}\n`);
      if (!newMetadata.includes('alwaysApply:')) {
        newMetadata = `${newMetadata}alwaysApply: ${optimizedAlwaysApply}\n`;
      }
    }
    
    // Добавляем AI-специфичные поля
    if (!metadata.includes('aiPriority:')) {
      newMetadata = `${newMetadata}aiPriority: ${this.getAIPriority(fileName, dirName)}\n`;
    }
    
    if (!metadata.includes('aiCategory:')) {
      newMetadata = `${newMetadata}aiCategory: ${this.getAICategory(dirName)}\n`;
    }
    
    if (newMetadata !== metadata) {
      return content.replace(metadataMatch[0], `---\n${newMetadata}---\n\n`);
    }
    
    return content;
  }

  getOptimizedGlobs(fileName, dirName) {
    const globMap = {
      'architecture': '["platform-core/**/*", "chrome-extension/src/background/*", "**/*.ts", "**/*.js"]',
      'dev': '["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py", "**/*.md"]',
      'doc': '["**/*.md", "**/*.mdc", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]',
      'plugin': '["public/plugins/**/*", "**/*.py", "**/*.json", "**/*.ts", "**/*.js"]',
      'security': '["**/*.ts", "**/*.js", "**/*.py", "**/*.json", "platform-core/**/*"]',
      'ui': '["pages/**/*", "**/*.tsx", "**/*.css", "**/*.scss", "packages/ui/**/*"]',
      'workflow': '["**/*.ts", "**/*.js", "**/*.json", "**/*.md", "**/*.mdc"]'
    };
    
    return globMap[dirName] || '["**/*"]';
  }

  shouldAlwaysApply(fileName, dirName) {
    const alwaysApplyFiles = [
      'ai-memory', 'environment', 'index', 'README',
      'principle', 'architecture', 'workflow', 'security',
      'ai-first', 'ai-fallback', 'mdc-file-standards'
    ];
    
    return alwaysApplyFiles.some(pattern => fileName.includes(pattern)) || dirName === 'architecture';
  }

  getAIPriority(fileName, dirName) {
    if (fileName.includes('ai-memory') || fileName.includes('environment')) {
      return 'critical';
    } else if (fileName.includes('principle') || fileName.includes('architecture')) {
      return 'high';
    } else if (dirName === 'doc' || dirName === 'workflow') {
      return 'medium';
    } else {
      return 'normal';
    }
  }

  getAICategory(dirName) {
    const categoryMap = {
      'architecture': 'system-design',
      'dev': 'development-practices',
      'doc': 'documentation',
      'plugin': 'plugin-development',
      'security': 'security',
      'ui': 'user-interface',
      'workflow': 'process-management'
    };
    
    return categoryMap[dirName] || 'general';
  }

  async addAITags() {
    console.log('🏷️ Adding AI-specific tags...');
    
    const mdcFiles = this.getFilesByExt('.mdc');
    
    for (const file of mdcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const taggedContent = this.addAITagsToContent(content, file);
      
      if (taggedContent !== content) {
        fs.writeFileSync(file, taggedContent);
        console.log(`   ✅ Added AI tags to ${path.relative(this.rulesDir, file)}`);
      }
    }
  }

  addAITagsToContent(content, filePath) {
    const fileName = path.basename(filePath, '.mdc');
    const dirName = path.basename(path.dirname(filePath));
    
    // Добавляем AI-специфичные комментарии в начало файла
    let aiHeader = '';
    
    if (fileName.includes('principle')) {
      aiHeader = `<!-- AI: This is a development principle that should be applied to all code -->
<!-- AI: Priority: ${this.getAIPriority(fileName, dirName)} -->
<!-- AI: Category: ${this.getAICategory(dirName)} -->

`;
    } else if (fileName.includes('architecture')) {
      aiHeader = `<!-- AI: This is an architectural rule that defines system structure -->
<!-- AI: Priority: ${this.getAIPriority(fileName, dirName)} -->
<!-- AI: Category: ${this.getAICategory(dirName)} -->

`;
    } else if (fileName.includes('ai-')) {
      aiHeader = `<!-- AI: This is an AI-specific rule or instruction -->
<!-- AI: Priority: ${this.getAIPriority(fileName, dirName)} -->
<!-- AI: Category: ${this.getAICategory(dirName)} -->

`;
    }
    
    if (aiHeader && !content.includes('<!-- AI:')) {
      return aiHeader + content;
    }
    
    return content;
  }

  async optimizeStructure() {
    console.log('🏗️ Optimizing structure for AI...');
    
    // Создаем файл с AI-специфичными инструкциями
    const aiInstructions = `---
description: AI-specific instructions and optimizations for .cursor rules
globs: ["**/*"]
alwaysApply: true
aiPriority: critical
aiCategory: ai-optimization
---

# AI Optimization Instructions

## How AI Should Use These Rules

### Priority Levels
- **critical**: Must be applied to all code and decisions
- **high**: Should be applied to most code and decisions
- **medium**: Apply when relevant to the task
- **normal**: Apply when appropriate

### Categories
- **system-design**: Architecture and system structure
- **development-practices**: Coding standards and principles
- **documentation**: Documentation and communication
- **plugin-development**: Plugin-specific rules
- **security**: Security and safety rules
- **user-interface**: UI/UX standards
- **process-management**: Workflow and process rules
- **ai-optimization**: AI-specific optimizations

### Usage Patterns
1. Always check critical rules first
2. Apply high-priority rules to most tasks
3. Use category-specific rules for targeted tasks
4. Reference related rules when making decisions

### AI Memory Integration
- These rules are automatically loaded into AI memory-bank
- Use \`alwaysApply: true\` rules without explicit reference
- Reference specific rules when explaining decisions
- Update rules when patterns change or improve

## Optimization Status
- ✅ All rules have proper metadata
- ✅ AI-specific tags added
- ✅ Priority levels assigned
- ✅ Categories defined
- ✅ Structure optimized for AI understanding
`;

    const aiInstructionsPath = path.join(this.rulesDir, 'ai-optimization.mdc');
    fs.writeFileSync(aiInstructionsPath, aiInstructions);
    console.log('   ✅ Created ai-optimization.mdc');
  }

  async createAIIndex() {
    console.log('📝 Creating AI-optimized index...');
    
    const files = this.getAllFiles(this.rulesDir);
    const aiIndex = this.generateAIIndex(files);
    
    const aiIndexPath = path.join(this.rulesDir, 'ai-index.mdc');
    fs.writeFileSync(aiIndexPath, aiIndex);
    console.log('   ✅ Created ai-index.mdc');
  }

  generateAIIndex(files) {
    const categories = {
      'critical': [],
      'high': [],
      'medium': [],
      'normal': []
    };
    
    for (const file of files) {
      if (file.endsWith('.mdc')) {
        const content = fs.readFileSync(file, 'utf8');
        const priority = this.extractPriority(content);
        const relativePath = path.relative(this.rulesDir, file);
        const fileName = path.basename(file, '.mdc');
        
        categories[priority].push({
          name: fileName,
          path: relativePath,
          description: this.extractDescription(content)
        });
      }
    }
    
    let index = `---
description: AI-optimized index of rules by priority and category
globs: ["**/*"]
alwaysApply: true
aiPriority: critical
aiCategory: ai-optimization
---

# AI-Optimized Rules Index

## Critical Priority Rules
*Must be applied to all code and decisions*

`;
    
    for (const rule of categories.critical) {
      index += `- [${this.formatName(rule.name)}](${rule.path}) — ${rule.description}\n`;
    }
    
    index += '\n## High Priority Rules\n*Should be applied to most code and decisions*\n\n';
    
    for (const rule of categories.high) {
      index += `- [${this.formatName(rule.name)}](${rule.path}) — ${rule.description}\n`;
    }
    
    index += '\n## Medium Priority Rules\n*Apply when relevant to the task*\n\n';
    
    for (const rule of categories.medium) {
      index += `- [${this.formatName(rule.name)}](${rule.path}) — ${rule.description}\n`;
    }
    
    index += '\n## Normal Priority Rules\n*Apply when appropriate*\n\n';
    
    for (const rule of categories.normal) {
      index += `- [${this.formatName(rule.name)}](${rule.path}) — ${rule.description}\n`;
    }
    
    return index;
  }

  extractPriority(content) {
    const priorityMatch = content.match(/aiPriority:\s*(\w+)/);
    return priorityMatch ? priorityMatch[1] : 'normal';
  }

  extractDescription(content) {
    const descMatch = content.match(/description:\s*(.+)/);
    return descMatch ? descMatch[1] : 'Rule description';
  }

  formatName(fileName) {
    return fileName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async validateAIReadiness() {
    console.log('✅ Validating AI readiness...');
    
    const mdcFiles = this.getFilesByExt('.mdc');
    let readyCount = 0;
    
    for (const file of mdcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      const hasMetadata = content.startsWith('---');
      const hasDescription = content.includes('description:');
      const hasGlobs = content.includes('globs:');
      const hasAlwaysApply = content.includes('alwaysApply:');
      const hasAIPriority = content.includes('aiPriority:');
      const hasAICategory = content.includes('aiCategory:');
      
      if (hasMetadata && hasDescription && hasGlobs && hasAlwaysApply && hasAIPriority && hasAICategory) {
        readyCount++;
      }
    }
    
    console.log(`   ${readyCount}/${mdcFiles.length} files are AI-ready`);
    
    if (readyCount === mdcFiles.length) {
      console.log('   🎉 All files are optimized for AI!');
    } else {
      console.log('   ⚠️ Some files need additional optimization');
    }
  }

  // Вспомогательные методы
  getAllFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getAllFiles(fullPath));
      } else if (item.endsWith('.mdc') || item.endsWith('.md')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  getFilesByExt(ext) {
    return this.getAllFiles(this.rulesDir).filter(file => file.endsWith(ext));
  }
}

// Запуск оптимизации
async function main() {
  const optimizer = new AIOptimizer();
  await optimizer.optimize();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = AIOptimizer; 