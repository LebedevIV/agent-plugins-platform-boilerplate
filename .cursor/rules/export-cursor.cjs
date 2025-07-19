#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CursorExporter {
  constructor() {
    this.rulesDir = path.join(__dirname);
    this.exportDir = path.join(process.cwd(), 'cursor-export');
  }

  async export(targetProject = null) {
    console.log('📦 Exporting .cursor rules...\n');
    
    // Создаем папку для экспорта
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
    
    // Экспортируем основные файлы
    await this.exportCoreFiles();
    
    // Экспортируем правила по категориям
    await this.exportRulesByCategory();
    
    // Создаем инструкции по импорту
    await this.createImportInstructions();
    
    // Создаем скрипт импорта
    await this.createImportScript();
    
    console.log('✅ Export completed!');
    console.log(`📁 Exported to: ${this.exportDir}`);
    
    if (targetProject) {
      console.log(`\n🚀 To import to ${targetProject}:`);
      console.log(`   cd ${targetProject}`);
      console.log(`   node cursor-export/import-cursor.cjs`);
    }
  }

  async exportCoreFiles() {
    console.log('📋 Exporting core files...');
    
    const coreFiles = [
      'ai-memory.mdc',
      'environment.mdc',
      'index.mdc',
      'README.mdc',
      'ai-optimization.mdc',
      'ai-index.mdc',
      'monorepo-best-practices.mdc',
      'typescript-build-troubleshooting.mdc'
    ];
    
    for (const file of coreFiles) {
      const sourcePath = path.join(this.rulesDir, file);
      if (fs.existsSync(sourcePath)) {
        const targetPath = path.join(this.exportDir, file);
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`   ✅ ${file}`);
      }
    }
  }

  async exportRulesByCategory() {
    console.log('📁 Exporting rules by category...');
    
    const categories = ['architecture', 'dev', 'doc', 'plugin', 'security', 'ui', 'workflow'];
    
    for (const category of categories) {
      const categoryDir = path.join(this.rulesDir, category);
      if (fs.existsSync(categoryDir)) {
        const targetCategoryDir = path.join(this.exportDir, category);
        fs.mkdirSync(targetCategoryDir, { recursive: true });
        
        const files = fs.readdirSync(categoryDir);
        for (const file of files) {
          if (file.endsWith('.mdc')) {
            const sourcePath = path.join(categoryDir, file);
            const targetPath = path.join(targetCategoryDir, file);
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`   ✅ ${category}/${file}`);
          }
        }
      }
    }
  }

  async createImportInstructions() {
    console.log('📝 Creating import instructions...');
    
    const instructions = `# Import .cursor Rules

## Quick Import

1. Copy the entire \`cursor-export\` folder to your target project
2. Run the import script:
   \`\`\`bash
   node cursor-export/import-cursor.cjs
   \`\`\`

## Manual Import

1. Create \`.cursor/rules/\` directory in your target project
2. Copy files from \`cursor-export/\` to \`.cursor/rules/\`
3. Run audit and optimization:
   \`\`\`bash
   cd .cursor/rules
   node cursor-manager.cjs full
   \`\`\`

## What's Included

### Core Rules
- AI memory and commands
- Environment constraints
- Project structure guidelines
- TypeScript build troubleshooting

### Categories
- **architecture/** - System architecture rules
- **dev/** - Development principles and guidelines
- **doc/** - Documentation standards
- **plugin/** - Plugin development standards
- **security/** - Security rules
- **ui/** - UI/UX standards
- **workflow/** - Development workflow

### Automation
- Audit system
- Auto-fix capabilities
- AI optimization
- Status monitoring

## Customization

After import, customize rules for your project:
1. Update \`environment.mdc\` with your project constraints
2. Modify \`ai-memory.mdc\` with project-specific commands
3. Adjust \`monorepo-best-practices.mdc\` for your structure
4. Run \`node cursor-manager.cjs optimize\` to apply changes

## Verification

Verify successful import:
\`\`\`bash
cd .cursor/rules
node cursor-manager.cjs status
\`\`\`

All files should show as "AI-ready" with no issues.
`;

    const instructionsPath = path.join(this.exportDir, 'IMPORT-INSTRUCTIONS.md');
    fs.writeFileSync(instructionsPath, instructions);
    console.log('   ✅ IMPORT-INSTRUCTIONS.md');
  }

  async createImportScript() {
    console.log('🔧 Creating import script...');
    
    const importScript = `#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CursorImporter {
  constructor() {
    this.exportDir = __dirname;
    this.targetRulesDir = path.join(process.cwd(), '.cursor', 'rules');
  }

  async import() {
    console.log('📥 Importing .cursor rules...\\n');
    
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
    
    console.log('\\n✅ Import completed!');
    console.log('\\n🔧 Next steps:');
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
            console.log(\`   ✅ \${item}/\${file}\`);
          }
        }
      } else if (item.endsWith('.mdc')) {
        // Копируем .mdc файлы
        fs.copyFileSync(sourcePath, targetPath);
        console.log(\`   ✅ \${item}\`);
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
        console.log(\`   ✅ \${script}\`);
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
        console.log(\`   ✅ Created \${dir}/\`);
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
`;

    const importScriptPath = path.join(this.exportDir, 'import-cursor.cjs');
    fs.writeFileSync(importScriptPath, importScript);
    
    // Делаем скрипт исполняемым
    fs.chmodSync(importScriptPath, '755');
    console.log('   ✅ import-cursor.cjs');
  }
}

// CLI обработка
async function main() {
  const args = process.argv.slice(2);
  const targetProject = args[0] || null;
  
  const exporter = new CursorExporter();
  await exporter.export(targetProject);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CursorExporter; 