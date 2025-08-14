#!/usr/bin/env node

/**
 * Save Context Script
 * Automatically saves context in English for AI/LLM compatibility
 * Usage: node .cursor/rules/save-context.cjs
 */

const fs = require('fs');
const path = require('path');
const { translateContextToEnglish } = require('./command-sync.cjs');

// File paths
const ACTIVE_CONTEXT_PATH = path.join(process.cwd(), 'memory-bank', 'core', 'activeContext.md');
const PROGRESS_PATH = path.join(process.cwd(), 'memory-bank', 'core', 'progress.md');

function saveContextInEnglish() {
  console.log('💾 Saving context in English for AI/LLM compatibility...\n');
  
  // First, translate the context to English
  translateContextToEnglish();
  
  // Then commit the changes
  const { execSync } = require('child_process');
  
  try {
    // Add the translated files
    execSync('git add memory-bank/core/activeContext.md memory-bank/core/progress.md', { stdio: 'inherit' });
    console.log('✅ Added translated files to git');
    
    // Commit with a descriptive message
    const timestamp = new Date().toISOString().split('T')[0];
    const commitMessage = `docs: save context in English for AI/LLM compatibility - ${timestamp}`;
    execSync(`git commit --no-verify -m "${commitMessage}"`, { stdio: 'inherit' });
    console.log('✅ Committed translated context');
    
    console.log('\n🎉 Context saved successfully in English!');
    console.log('📝 Note: Backups created in memory-bank/core/backup/');
    
  } catch (error) {
    console.error('❌ Error during git operations:', error.message);
    console.log('💡 The context was translated but not committed. You can commit manually if needed.');
  }
}

function main() {
  const command = process.argv[2] || 'save';

  switch (command) {
    case 'save':
      saveContextInEnglish();
      break;
    case 'translate-only':
      translateContextToEnglish();
      break;
    case 'help':
      console.log(`
Save Context Script

Usage: node .cursor/rules/save-context.cjs [command]

Commands:
  save          - Save context in English and commit (default)
  translate-only - Only translate context without committing
  help          - Show this help

Examples:
  node .cursor/rules/save-context.cjs save
  node .cursor/rules/save-context.cjs translate-only
      `);
      break;
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('Use "help" to see available commands');
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { saveContextInEnglish }; 