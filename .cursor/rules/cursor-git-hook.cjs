#!/usr/bin/env node

/**
 * Cursor Git Hook Script
 * Automatically protects .cursor files on git operations
 * Usage: node .cursor/rules/cursor-git-hook.cjs [pre-commit|post-commit|pre-push]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { protectCursor, checkCursorStatus } = require('./cursor-protector.cjs');

// File paths
const CURSOR_DIR = path.join(process.cwd(), '.cursor');
const GIT_HOOKS_DIR = path.join(process.cwd(), '.git', 'hooks');

function getStagedCursorFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
    const files = output.trim().split('\n').filter(Boolean);
    return files.filter(file => file.startsWith('.cursor/'));
  } catch (error) {
    return [];
  }
}

function preCommitHook() {
  console.log('🛡️ Pre-commit: Checking .cursor files...\n');
  
  const stagedFiles = getStagedCursorFiles();
  
  if (stagedFiles.length === 0) {
    console.log('✅ No .cursor files staged for commit');
    return true;
  }
  
  console.log(`📁 Found ${stagedFiles.length} staged .cursor files:`);
  stagedFiles.forEach(file => console.log(`  - ${file}`));
  
  // Check if any staged files contain Russian content
  let hasRussianContent = false;
  
  for (const file of stagedFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (/[а-яё]/i.test(content)) {
        console.log(`⚠️  Warning: ${file} contains Russian content`);
        hasRussianContent = true;
      }
    } catch (error) {
      console.log(`❌ Error reading ${file}: ${error.message}`);
    }
  }
  
  if (hasRussianContent) {
    console.log('\n🔄 Automatically translating staged .cursor files...');
    
    // Translate staged files
    for (const file of stagedFiles) {
      try {
        const { translateText } = require('./cursor-protector.cjs');
        const content = fs.readFileSync(file, 'utf8');
        const translatedContent = translateText(content);
        
        // Create backup
        const backupDir = path.join(CURSOR_DIR, 'backup', 'pre-commit');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupPath = path.join(backupDir, path.basename(file));
        fs.copyFileSync(file, backupPath);
        
        // Write translated content
        fs.writeFileSync(file, translatedContent, 'utf8');
        
        // Stage the translated file
        execSync(`git add "${file}"`, { stdio: 'inherit' });
        
        console.log(`✅ Translated and staged: ${file}`);
      } catch (error) {
        console.log(`❌ Error translating ${file}: ${error.message}`);
      }
    }
    
    console.log('\n✅ All staged .cursor files translated to English');
  } else {
    console.log('\n✅ All staged .cursor files are already in English');
  }
  
  return true;
}

function postCommitHook() {
  console.log('🛡️ Post-commit: Ensuring .cursor protection...\n');
  
  // Check overall .cursor status
  const status = checkCursorStatus();
  
  if (status.russianContentCount > 0) {
    console.log('\n⚠️  Warning: Some .cursor files still contain Russian content');
    console.log('💡 Consider running: node .cursor/rules/cursor-protector.cjs protect');
  } else {
    console.log('\n✅ All .cursor files are protected (English only)');
  }
  
  return true;
}

function prePushHook() {
  console.log('🛡️ Pre-push: Final .cursor protection check...\n');
  
  const status = checkCursorStatus();
  
  if (status.russianContentCount > 0) {
    console.log('\n❌ Push blocked: .cursor files contain Russian content');
    console.log('💡 Please run: node .cursor/rules/cursor-protector.cjs protect');
    console.log('💡 Then commit and push again');
    return false;
  }
  
  console.log('\n✅ .cursor files are protected - push allowed');
  return true;
}

function installHooks() {
  console.log('🔧 Installing .cursor protection Git hooks...\n');
  
  const hooks = {
    'pre-commit': preCommitHook,
    'post-commit': postCommitHook,
    'pre-push': prePushHook
  };
  
  for (const [hookName, hookFunction] of Object.entries(hooks)) {
    const hookPath = path.join(GIT_HOOKS_DIR, hookName);
    const hookContent = `#!/bin/sh
# Cursor Protection Hook
node .cursor/rules/cursor-git-hook.cjs ${hookName}
`;
    
    try {
      fs.writeFileSync(hookPath, hookContent, 'utf8');
      fs.chmodSync(hookPath, '755');
      console.log(`✅ Installed: ${hookName} hook`);
    } catch (error) {
      console.log(`❌ Error installing ${hookName} hook: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Git hooks installed successfully!');
  console.log('📝 .cursor files will now be automatically protected on git operations');
}

function uninstallHooks() {
  console.log('🔧 Uninstalling .cursor protection Git hooks...\n');
  
  const hooks = ['pre-commit', 'post-commit', 'pre-push'];
  
  for (const hookName of hooks) {
    const hookPath = path.join(GIT_HOOKS_DIR, hookName);
    
    try {
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf8');
        
        // Only remove if it's our hook
        if (content.includes('Cursor Protection Hook')) {
          fs.unlinkSync(hookPath);
          console.log(`✅ Uninstalled: ${hookName} hook`);
        } else {
          console.log(`⚠️  Skipped: ${hookName} hook (not our hook)`);
        }
      } else {
        console.log(`ℹ️  No ${hookName} hook found`);
      }
    } catch (error) {
      console.log(`❌ Error uninstalling ${hookName} hook: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Git hooks uninstalled successfully!');
}

function main() {
  const command = process.argv[2] || 'pre-commit';

  switch (command) {
    case 'pre-commit':
      return preCommitHook();
    case 'post-commit':
      return postCommitHook();
    case 'pre-push':
      return prePushHook();
    case 'install':
      installHooks();
      break;
    case 'uninstall':
      uninstallHooks();
      break;
    case 'help':
      console.log(`
Cursor Git Hook Script

Usage: node .cursor/rules/cursor-git-hook.cjs [command]

Commands:
  pre-commit  - Pre-commit hook (translates staged .cursor files)
  post-commit - Post-commit hook (checks overall .cursor status)
  pre-push    - Pre-push hook (blocks push if Russian content found)
  install     - Install Git hooks
  uninstall   - Uninstall Git hooks
  help        - Show this help

Examples:
  node .cursor/rules/cursor-git-hook.cjs pre-commit
  node .cursor/rules/cursor-git-hook.cjs install
  node .cursor/rules/cursor-git-hook.cjs uninstall
      `);
      break;
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('Use "help" to see available commands');
      process.exit(1);
  }
}

if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { 
  preCommitHook, 
  postCommitHook, 
  prePushHook, 
  installHooks, 
  uninstallHooks 
}; 