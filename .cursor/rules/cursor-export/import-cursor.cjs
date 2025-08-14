#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CursorImporter {
  constructor() {
    this.exportDir = __dirname;
    this.targetRulesDir = path.join(process.cwd(), '.cursor', 'rules');
  }

  async import() {
    console.log('📥 Importing .cursor rules...\n');
    
    // Создаем папку .cursor/rules если не существует
    if (!fs.existsSync(this.targetRulesDir)) {
      fs.mkdirSync(this.targetRulesDir, { recursive: true });
      console.log('✅ Created .cursor/rules directory');
    }
    
    // Копируем все файлы
    await this.copyFiles();
    
    // Копируем скрипты автоматизации
    await this.copyAutomationScripts();
    
    // Создаем базовую структуру если нужно
    await this.createBasicStructure();
    
    console.log('\n✅ Import completed!');
    console.log('\n🔧 Next steps:');
    console.log('   1. Customize environment.mdc for your project');
    console.log('   2. Update ai-memory.mdc with project-specific commands');
    console.log('   3. Run: cd .cursor/rules && node cursor-manager.cjs full');
  }

  async copyFiles() {
    console.log('📋 Copying rule files...');
    
    const items = fs.readdirSync(this.exportDir);
    
    for (const item of items) {
      const sourcePath = path.join(this.exportDir, item);
      const targetPath = path.join(this.targetRulesDir, item);
      
      const stat = fs.statSync(sourcePath);
      
      if (stat.isDirectory()) {
        // Копируем директории
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }
        
        const files = fs.readdirSync(sourcePath);
        for (const file of files) {
          if (file.endsWith('.mdc')) {
            const fileSource = path.join(sourcePath, file);
            const fileTarget = path.join(targetPath, file);
            fs.copyFileSync(fileSource, fileTarget);
            console.log(`   ✅ ${item}/${file}`);
          }
        }
      } else if (item.endsWith('.mdc')) {
        // Копируем .mdc файлы
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`   ✅ ${item}`);
      }
    }
  }

  async copyAutomationScripts() {
    console.log('🔧 Copying automation scripts...');
    
    const scripts = [
      'audit-cursor.cjs',
      'fix-cursor.cjs', 
      'optimize-for-ai.cjs',
      'cursor-manager.cjs'
    ];
    
    for (const script of scripts) {
      const sourcePath = path.join(this.exportDir, script);
      if (fs.existsSync(sourcePath)) {
        const targetPath = path.join(this.targetRulesDir, script);
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`   ✅ ${script}`);
      }
    }
  }

  async createBasicStructure() {
    console.log('🏗️ Creating basic structure...');
    
    const requiredDirs = ['architecture', 'dev', 'doc', 'plugin', 'security', 'ui', 'workflow'];
    
    for (const dir of requiredDirs) {
      const dirPath = path.join(this.targetRulesDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`   ✅ Created ${dir}/`);
      }
    }
  }
}

// Запуск импорта
async function main() {
  const importer = new CursorImporter();
  await importer.import();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CursorImporter;
