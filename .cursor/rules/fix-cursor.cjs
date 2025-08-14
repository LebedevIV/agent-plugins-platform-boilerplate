#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const CursorAuditor = require('./audit-cursor.cjs');

class CursorFixer {
  constructor() {
    this.rulesDir = path.join(__dirname);
    this.auditor = new CursorAuditor();
  }

  async fix() {
    console.log('🔧 Starting automatic .cursor fixes...\n');
    
    // Сначала проводим аудит
    const stats = await this.auditor.audit();
    
    console.log('\n🔧 Applying fixes...\n');
    
    // Исправляем метаданные
    if (stats.invalidMetadata.length > 0 || stats.filesWithoutMetadata > 0) {
      await this.fixMetadata();
    }
    
    // Удаляем дубликаты
    if (stats.duplicateContent.length > 0) {
      await this.removeDuplicates(stats.duplicateContent);
    }
    
    // Исправляем ссылки
    if (stats.brokenLinks.length > 0) {
      await this.fixLinks(stats.brokenLinks);
    }
    
    // Обновляем индекс
    await this.updateIndex();
    
    console.log('\n✅ All fixes applied!');
  }

  async fixMetadata() {
    console.log('📋 Fixing metadata...');
    
    const mdcFiles = this.auditor.getFilesByExt('.mdc');
    
    for (const file of mdcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      if (!content.startsWith('---')) {
        // Добавляем метаданные
        const fileName = path.basename(file, '.mdc');
        const metadata = this.generateMetadata(fileName, file);
        
        const newContent = metadata + content;
        fs.writeFileSync(file, newContent);
        console.log(`   ✅ Added metadata to ${path.relative(this.rulesDir, file)}`);
      } else {
        // Проверяем и исправляем существующие метаданные
        const fixedContent = this.fixExistingMetadata(content, file);
        if (fixedContent !== content) {
          fs.writeFileSync(file, fixedContent);
          console.log(`   ✅ Fixed metadata in ${path.relative(this.rulesDir, file)}`);
        }
      }
    }
  }

  generateMetadata(fileName, filePath) {
    const dirName = path.basename(path.dirname(filePath));
    
    let description = '';
    let globs = '["**/*"]';
    let alwaysApply = 'false';
    
    // Определяем описание на основе имени файла и директории
    if (fileName.includes('principle')) {
      description = `Development principle ${fileName.split('-').pop()} - ${fileName.replace(/-/g, ' ')}`;
      alwaysApply = 'true';
    } else if (fileName.includes('architecture')) {
      description = `Architecture rule for ${fileName.replace('architecture-', '')}`;
      alwaysApply = 'true';
    } else if (fileName.includes('ui-')) {
      description = `UI standard for ${fileName.replace('ui-', '')}`;
      globs = '["pages/**/*", "**/*.tsx", "**/*.css"]';
    } else if (fileName.includes('plugin')) {
      description = `Plugin standard for ${fileName.replace('plugin-', '')}`;
      globs = '["plugins/**/*", "**/*.py", "**/*.json"]';
    } else if (fileName.includes('workflow')) {
      description = `Workflow rule for ${fileName.replace('workflow', '')}`;
      alwaysApply = 'true';
    } else if (fileName.includes('security')) {
      description = `Security rule for ${fileName.replace('security', '')}`;
      alwaysApply = 'true';
    } else if (fileName.includes('validation')) {
      description = 'Input validation and data sanitization rules';
      alwaysApply = 'true';
    } else if (fileName.includes('testing')) {
      description = 'Testing and debugging standards';
      globs = '["tests/**/*", "**/*.test.*", "**/*.spec.*"]';
    } else if (fileName.includes('typescript')) {
      description = 'TypeScript-specific guidelines';
      globs = '["**/*.ts", "**/*.tsx", "**/*.json"]';
    } else if (fileName.includes('development')) {
      description = 'General development guidelines';
      alwaysApply = 'true';
    } else if (fileName.includes('automation')) {
      description = 'Automation and synchronization rules';
      alwaysApply = 'true';
    } else if (fileName.includes('branches')) {
      description = 'Git branch management rules';
      alwaysApply = 'true';
    } else if (fileName.includes('knowledge')) {
      description = 'Project knowledge structure';
      alwaysApply = 'true';
    } else if (fileName.includes('memorybank')) {
      description = 'Quality standards for memory-bank';
      alwaysApply = 'true';
    } else if (fileName.includes('restore')) {
      description = 'Context restoration procedures';
      alwaysApply = 'true';
    } else if (fileName.includes('ai-first')) {
      description = 'AI-oriented documentation standards';
      globs = '["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py", "**/*.md"]';
      alwaysApply = 'true';
    } else if (fileName.includes('ai-fallback')) {
      description = 'Fallback procedures for AI';
      alwaysApply = 'true';
    } else if (fileName.includes('mdc-file-standards')) {
      description = 'Standards for .mdc file creation';
      alwaysApply = 'true';
    } else if (fileName === 'index') {
      description = 'Rules index and navigation';
      alwaysApply = 'true';
    } else if (fileName === 'README') {
      description = 'Main documentation and structure';
      alwaysApply = 'true';
    } else if (fileName === 'ai-memory') {
      description = 'User commands and AI instructions';
      alwaysApply = 'true';
    } else if (fileName === 'environment') {
      description = 'Critical environment limitations';
      alwaysApply = 'true';
    } else if (fileName === 'monorepo-best-practices') {
      description = 'Monorepo structure and guidelines';
      alwaysApply = 'true';
    } else if (fileName === 'typescript-build-troubleshooting') {
      description = 'TypeScript build error solutions';
      alwaysApply = 'true';
    } else {
      description = `${fileName.replace(/-/g, ' ')} rule`;
    }
    
    return `---
description: ${description}
globs: ${globs}
alwaysApply: ${alwaysApply}
---

`;
  }

  fixExistingMetadata(content, filePath) {
    const metadataMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!metadataMatch) return content;
    
    const metadata = metadataMatch[1];
    const fileName = path.basename(filePath, '.mdc');
    
    let newMetadata = metadata;
    let hasChanges = false;
    
    // Проверяем и добавляем недостающие поля
    if (!metadata.includes('description:')) {
      const description = this.generateMetadata(fileName, filePath).match(/description: (.*)/)[1];
      newMetadata = `description: ${description}\n${newMetadata}`;
      hasChanges = true;
    }
    
    if (!metadata.includes('globs:')) {
      newMetadata = `${newMetadata}globs: ["**/*"]\n`;
      hasChanges = true;
    }
    
    if (!metadata.includes('alwaysApply:')) {
      newMetadata = `${newMetadata}alwaysApply: false\n`;
      hasChanges = true;
    }
    
    if (hasChanges) {
      return content.replace(metadataMatch[0], `---\n${newMetadata}---\n\n`);
    }
    
    return content;
  }

  async removeDuplicates(duplicates) {
    console.log('🔄 Removing duplicates...');
    
    for (const dup of duplicates) {
      const duplicatePath = path.join(this.rulesDir, dup.duplicate);
      
      if (fs.existsSync(duplicatePath)) {
        fs.unlinkSync(duplicatePath);
        console.log(`   ✅ Removed duplicate: ${dup.duplicate}`);
      }
    }
  }

  async fixLinks(brokenLinks) {
    console.log('🔗 Fixing broken links...');
    
    // Группируем по файлам
    const linksByFile = {};
    for (const link of brokenLinks) {
      if (!linksByFile[link.file]) {
        linksByFile[link.file] = [];
      }
      linksByFile[link.file].push(link.link);
    }
    
    for (const [file, links] of Object.entries(linksByFile)) {
      const filePath = path.join(this.rulesDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      
      for (const link of links) {
        // Пытаемся найти правильную ссылку
        const fixedLink = this.findCorrectLink(link);
        if (fixedLink) {
          content = content.replace(new RegExp(`\\(${link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'), `(${fixedLink})`);
          console.log(`   ✅ Fixed link in ${file}: ${link} → ${fixedLink}`);
        }
      }
      
      fs.writeFileSync(filePath, content);
    }
  }

  findCorrectLink(brokenLink) {
    // Простые исправления для типичных случаев
    const fixes = {
      'doc/user-commands.mdc': 'ai-memory.mdc',
      'dev/dev-principle-02-ai-first-docs.mdc': 'doc/ai-first.mdc',
      'ui/accessibility.mdc': 'ui/ui-accessibility.mdc'
    };
    
    return fixes[brokenLink] || null;
  }

  async updateIndex() {
    console.log('📝 Updating index...');
    
    // Генерируем новый индекс на основе существующих файлов
    const indexContent = this.generateIndex();
    const indexPath = path.join(this.rulesDir, 'index.mdc');
    
    fs.writeFileSync(indexPath, indexContent);
    console.log('   ✅ Updated index.mdc');
  }

  generateIndex() {
    const files = this.auditor.getAllFiles(this.rulesDir);
    const structure = {};
    
    // Группируем файлы по директориям
    for (const file of files) {
      const relativePath = path.relative(this.rulesDir, file);
      const dir = path.dirname(relativePath);
      const name = path.basename(file, path.extname(file));
      
      if (!structure[dir]) {
        structure[dir] = [];
      }
      
      structure[dir].push({
        name: name,
        path: relativePath,
        ext: path.extname(file)
      });
    }
    
    // Генерируем содержимое индекса
    let content = `---
description: Rules index and navigation
globs: ["**/*"]
alwaysApply: true
---

# Index of Modular Rules

`;
    
    // Корневые файлы
    if (structure['.']) {
      content += '## root\n';
      for (const file of structure['.'].filter(f => f.ext === '.mdc')) {
        const description = this.getFileDescription(file.name);
        content += `- [${this.formatName(file.name)}](${file.path}) — ${description}\n`;
      }
      content += '\n';
    }
    
    // Директории
    const dirs = ['architecture', 'dev', 'doc', 'plugin', 'security', 'ui', 'workflow'];
    for (const dir of dirs) {
      if (structure[dir] && structure[dir].length > 0) {
        content += `## ${dir}\n`;
        for (const file of structure[dir].filter(f => f.ext === '.mdc')) {
          const description = this.getFileDescription(file.name);
          content += `- [${this.formatName(file.name)}](${file.path}) — ${description}\n`;
        }
        content += '\n';
      }
    }
    
    return content;
  }

  getFileDescription(fileName) {
    const descriptions = {
      'ai-memory': 'User commands and AI instructions',
      'environment': 'Critical environment limitations',
      'monorepo-best-practices': 'Monorepo structure and guidelines',
      'typescript-build-troubleshooting': 'TypeScript build error solutions',
      'README': 'Main documentation and structure',
      'index': 'Rules index and navigation'
    };
    
    return descriptions[fileName] || `${fileName.replace(/-/g, ' ')} rule`;
  }

  formatName(fileName) {
    return fileName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Запуск исправлений
async function main() {
  const fixer = new CursorFixer();
  await fixer.fix();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CursorFixer; 