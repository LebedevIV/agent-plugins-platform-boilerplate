#!/usr/bin/env node

/**
 * Script to translate .cursor and memory-bank files to English
 * Usage: node .cursor/rules/translate-to-english.cjs
 */

const fs = require('fs');
const path = require('path');

// Translation mappings
const translations = {
  // Metadata translations
  'description: Главная документация по правилам проекта и AI onboarding': 'description: Main project rules documentation and AI onboarding',
  'description: Пользовательские команды для AI-ассистента': 'description: User commands for AI assistant',
  'description: AI-оптимизированный индекс правил': 'description: AI-optimized index of rules',
  
  // Common phrases
  'Критические ограничения окружения': 'Critical environment constraints',
  'Правило Git workflow': 'Git workflow rule',
  'Лучшие практики для работы с монорепозиторием': 'Best practices for monorepo work',
  'Руководство по устранению ошибок TypeScript сборки': 'TypeScript build error troubleshooting guide',
  
  // Memory bank translations
  'Основные файлы контекста': 'Core context files',
  'Текущий контекст проекта': 'Current project context',
  'Прогресс разработки': 'Development progress',
  'Ошибки и решения': 'Errors and solutions',
  'Кладбище ошибок': 'Error graveyard',
  'Архитектурные решения': 'Architectural decisions',
  'Процесс разработки': 'Development process',
  'UI/UX контекст': 'UI/UX context',
  'Планирование': 'Planning',
  'Контекстная информация': 'Contextual information',
  'Устаревшие файлы': 'Deprecated files',
  
  // File content translations
  'Организационные знания и правила': 'Organizational knowledge and rules',
  'Перенос best practices в новый проект': 'Transferring best practices to new projects',
  'Для быстрого внедрения организационных best practices': 'For quick implementation of organizational best practices',
  'Следуйте шагам из инструкции': 'Follow the steps from the guide',
  'Содержание': 'Contents',
  'Организационные нарративы': 'Organizational narratives',
  'Контекст продукта': 'Product context',
  'Прогресс и автоматизация': 'Progress and automation',
  'Инструкция по переносу best practices': 'Best practices transfer guide',
  'политика полного доступа AI-ассистента': 'policy of full AI assistant access',
  'Кладбище ошибок (Resolved Issues)': 'Error Graveyard (Resolved Issues)',
  'основной файл для всех общих и кросс-тематических проблем': 'main file for all general and cross-topic problems',
  'Тематические ошибки': 'Topic-specific errors',
  'подробные разборы и решения должны дублироваться': 'detailed analysis and solutions should be duplicated'
};

function translateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let translatedContent = content;
    
    // Apply translations
    for (const [russian, english] of Object.entries(translations)) {
      translatedContent = translatedContent.replace(new RegExp(russian, 'g'), english);
    }
    
    // Write translated content
    fs.writeFileSync(filePath, translatedContent, 'utf8');
    console.log(`✅ Translated: ${filePath}`);
    
  } catch (error) {
    console.error(`❌ Error translating ${filePath}:`, error.message);
  }
}

function findFiles(dir, extensions = ['.md', '.mdc']) {
  const files = [];
  
  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  scan(dir);
  return files;
}

function main() {
  console.log('🌍 Starting translation to English...\n');
  
  // Translate .cursor/rules files
  const cursorRulesDir = path.join(process.cwd(), '.cursor', 'rules');
  if (fs.existsSync(cursorRulesDir)) {
    console.log('📁 Translating .cursor/rules files...');
    const cursorFiles = findFiles(cursorRulesDir);
    cursorFiles.forEach(translateFile);
  }
  
  // Translate memory-bank files
  const memoryBankDir = path.join(process.cwd(), 'memory-bank');
  if (fs.existsSync(memoryBankDir)) {
    console.log('\n📁 Translating memory-bank files...');
    const memoryFiles = findFiles(memoryBankDir);
    memoryFiles.forEach(translateFile);
  }
  
  console.log('\n✅ Translation completed!');
  console.log('\n📝 Note: Some files may need manual review for complete translation.');
}

if (require.main === module) {
  main();
}

module.exports = { translateFile, translations }; 