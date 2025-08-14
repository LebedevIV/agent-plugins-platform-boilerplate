#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CursorAuditor {
  constructor() {
    this.rulesDir = path.join(__dirname);
    this.issues = [];
    this.stats = {
      totalFiles: 0,
      mdcFiles: 0,
      mdFiles: 0,
      filesWithMetadata: 0,
      filesWithoutMetadata: 0,
      duplicateContent: [],
      brokenLinks: [],
      missingFiles: [],
      invalidMetadata: []
    };
  }

  // Основной метод аудита
  async audit() {
    console.log('🔍 Starting comprehensive .cursor audit...\n');
    
    await this.scanFiles();
    await this.checkMetadata();
    await this.findDuplicates();
    await this.checkLinks();
    await this.validateStructure();
    await this.generateReport();
    
    return this.stats;
  }

  // Сканирование всех файлов
  async scanFiles() {
    console.log('📁 Scanning files...');
    
    const files = this.getAllFiles(this.rulesDir);
    this.stats.totalFiles = files.length;
    
    for (const file of files) {
      const ext = path.extname(file);
      if (ext === '.mdc') {
        this.stats.mdcFiles++;
      } else if (ext === '.md') {
        this.stats.mdFiles++;
      }
    }
    
    console.log(`   Found ${this.stats.totalFiles} files (${this.stats.mdcFiles} .mdc, ${this.stats.mdFiles} .md)`);
  }

  // Проверка метаданных
  async checkMetadata() {
    console.log('📋 Checking metadata...');
    
    const mdcFiles = this.getFilesByExt('.mdc');
    
    for (const file of mdcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      if (content.startsWith('---')) {
        this.stats.filesWithMetadata++;
        
        // Проверяем валидность метаданных
        const metadataMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
        if (metadataMatch) {
          const metadata = metadataMatch[1];
          const hasDescription = metadata.includes('description:');
          const hasGlobs = metadata.includes('globs:');
          const hasAlwaysApply = metadata.includes('alwaysApply:');
          
          if (!hasDescription || !hasGlobs || !hasAlwaysApply) {
            this.stats.invalidMetadata.push({
              file: path.relative(this.rulesDir, file),
              missing: []
            });
            
            if (!hasDescription) this.stats.invalidMetadata[this.stats.invalidMetadata.length - 1].missing.push('description');
            if (!hasGlobs) this.stats.invalidMetadata[this.stats.invalidMetadata.length - 1].missing.push('globs');
            if (!hasAlwaysApply) this.stats.invalidMetadata[this.stats.invalidMetadata.length - 1].missing.push('alwaysApply');
          }
        }
      } else {
        this.stats.filesWithoutMetadata++;
      }
    }
    
    console.log(`   ${this.stats.filesWithMetadata} files with metadata, ${this.stats.filesWithoutMetadata} without`);
  }

  // Поиск дубликатов
  async findDuplicates() {
    console.log('🔄 Finding duplicates...');
    
    const files = this.getAllFiles(this.rulesDir);
    const contentMap = new Map();
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const normalizedContent = this.normalizeContent(content);
      
      if (contentMap.has(normalizedContent)) {
        this.stats.duplicateContent.push({
          original: path.relative(this.rulesDir, contentMap.get(normalizedContent)),
          duplicate: path.relative(this.rulesDir, file)
        });
      } else {
        contentMap.set(normalizedContent, file);
      }
    }
    
    console.log(`   Found ${this.stats.duplicateContent.length} duplicate files`);
  }

  // Проверка ссылок
  async checkLinks() {
    console.log('🔗 Checking links...');
    
    const files = this.getAllFiles(this.rulesDir);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const links = this.extractLinks(content);
      
      for (const link of links) {
        if (link.startsWith('./') || link.startsWith('../')) {
          const targetPath = path.resolve(path.dirname(file), link);
          
          if (!fs.existsSync(targetPath)) {
            this.stats.brokenLinks.push({
              file: path.relative(this.rulesDir, file),
              link: link
            });
          }
        }
      }
    }
    
    console.log(`   Found ${this.stats.brokenLinks.length} broken links`);
  }

  // Валидация структуры
  async validateStructure() {
    console.log('🏗️ Validating structure...');
    
    const expectedDirs = ['architecture', 'dev', 'doc', 'plugin', 'security', 'ui', 'workflow'];
    const actualDirs = fs.readdirSync(this.rulesDir)
      .filter(item => fs.statSync(path.join(this.rulesDir, item)).isDirectory());
    
    for (const expectedDir of expectedDirs) {
      if (!actualDirs.includes(expectedDir)) {
        this.stats.missingFiles.push(`Directory: ${expectedDir}`);
      }
    }
    
    // Проверяем обязательные файлы
    const requiredFiles = ['index.mdc', 'README.mdc', 'ai-memory.mdc'];
    for (const requiredFile of requiredFiles) {
      if (!fs.existsSync(path.join(this.rulesDir, requiredFile))) {
        this.stats.missingFiles.push(`File: ${requiredFile}`);
      }
    }
    
    console.log(`   Found ${this.stats.missingFiles.length} missing items`);
  }

  // Генерация отчета
  async generateReport() {
    console.log('\n📊 Generating audit report...\n');
    
    console.log('='.repeat(60));
    console.log('🔍 CURSOR AUDIT REPORT');
    console.log('='.repeat(60));
    
    // Общая статистика
    console.log('\n📈 GENERAL STATISTICS:');
    console.log(`   Total files: ${this.stats.totalFiles}`);
    console.log(`   .mdc files: ${this.stats.mdcFiles}`);
    console.log(`   .md files: ${this.stats.mdFiles}`);
    console.log(`   Files with metadata: ${this.stats.filesWithMetadata}`);
    console.log(`   Files without metadata: ${this.stats.filesWithoutMetadata}`);
    
    // Проблемы
    if (this.stats.duplicateContent.length > 0) {
      console.log('\n⚠️  DUPLICATE CONTENT:');
      for (const dup of this.stats.duplicateContent) {
        console.log(`   ${dup.duplicate} duplicates ${dup.original}`);
      }
    }
    
    if (this.stats.brokenLinks.length > 0) {
      console.log('\n🔗 BROKEN LINKS:');
      for (const link of this.stats.brokenLinks) {
        console.log(`   ${link.file}: ${link.link}`);
      }
    }
    
    if (this.stats.invalidMetadata.length > 0) {
      console.log('\n📋 INVALID METADATA:');
      for (const meta of this.stats.invalidMetadata) {
        console.log(`   ${meta.file}: missing ${meta.missing.join(', ')}`);
      }
    }
    
    if (this.stats.missingFiles.length > 0) {
      console.log('\n❌ MISSING FILES/DIRECTORIES:');
      for (const missing of this.stats.missingFiles) {
        console.log(`   ${missing}`);
      }
    }
    
    // Рекомендации
    console.log('\n💡 RECOMMENDATIONS:');
    if (this.stats.mdFiles > 0) {
      console.log('   • Consider converting .md files to .mdc for better AI integration');
    }
    if (this.stats.filesWithoutMetadata > 0) {
      console.log('   • Add metadata to .mdc files without frontmatter');
    }
    if (this.stats.duplicateContent.length > 0) {
      console.log('   • Remove duplicate files to reduce confusion');
    }
    if (this.stats.brokenLinks.length > 0) {
      console.log('   • Fix broken links in documentation');
    }
    
    console.log('\n' + '='.repeat(60));
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

  normalizeContent(content) {
    return content
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .toLowerCase()
      .trim();
  }

  extractLinks(content) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links = [];
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[2]);
    }
    
    return links;
  }
}

// Запуск аудита
async function main() {
  const auditor = new CursorAuditor();
  await auditor.audit();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CursorAuditor; 