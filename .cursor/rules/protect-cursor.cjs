#!/usr/bin/env node

/**
 * Protect Cursor Script
 * Complete protection system for .cursor directory
 * Usage: node .cursor/rules/protect-cursor.cjs [protect|install-hooks|check|restore]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { protectCursor, checkCursorStatus } = require('./cursor-protector.cjs');
const { installHooks } = require('./cursor-git-hook.cjs');

function protectCursorComplete() {
  console.log('🛡️ Complete .cursor protection system\n');
  
  // Step 1: Check current status
  console.log('📊 Step 1: Checking current .cursor status...');
  const status = checkCursorStatus();
  
  if (status.russianContentCount === 0) {
    console.log('✅ All .cursor files are already in English!');
    console.log('💡 Installing Git hooks for future protection...');
    installHooks();
    return;
  }
  
  // Step 2: Protect all files
  console.log('\n🔄 Step 2: Translating all .cursor files to English...');
  const result = protectCursor();
  
  // Step 3: Install Git hooks
  console.log('\n🔧 Step 3: Installing Git hooks for automatic protection...');
  installHooks();
  
  // Step 4: Commit changes
  console.log('\n💾 Step 4: Committing protected .cursor files...');
  try {
    execSync('git add .cursor/', { stdio: 'inherit' });
    const timestamp = new Date().toISOString().split('T')[0];
    const commitMessage = `feat: protect .cursor directory - translate all files to English for AI/LLM compatibility - ${timestamp}`;
    execSync(`git commit --no-verify -m "${commitMessage}"`, { stdio: 'inherit' });
    console.log('✅ Committed protected .cursor files');
  } catch (error) {
    console.log('⚠️  Could not commit changes automatically');
    console.log('💡 You can commit manually if needed');
  }
  
  console.log('\n🎉 Complete .cursor protection system activated!');
  console.log('📝 All files translated to English');
  console.log('🔧 Git hooks installed for automatic protection');
  console.log('💾 Changes committed to git');
}

function installProtectionSystem() {
  console.log('🔧 Installing complete .cursor protection system...\n');
  
  // Install Git hooks
  installHooks();
  
  // Create protection script in package.json
  const packagePath = path.join(process.cwd(), 'package.json');
  
  if (fs.existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      packageJson.scripts['protect-cursor'] = 'node .cursor/rules/protect-cursor.cjs protect';
      packageJson.scripts['check-cursor'] = 'node .cursor/rules/cursor-protector.cjs check';
      packageJson.scripts['install-cursor-hooks'] = 'node .cursor/rules/cursor-git-hook.cjs install';
      
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log('✅ Added protection scripts to package.json');
    } catch (error) {
      console.log('⚠️  Could not update package.json: ' + error.message);
    }
  }
  
  // Create .cursorignore if it doesn't exist
  const cursorIgnorePath = path.join(process.cwd(), '.cursorignore');
  if (!fs.existsSync(cursorIgnorePath)) {
    const ignoreContent = `# Cursor Protection System
# Files that should not be automatically translated

# Backup files
.cursor/backup/

# Temporary files
*.tmp
*.temp

# Log files
*.log

# Cache files
.cache/
node_modules/
`;
    
    fs.writeFileSync(cursorIgnorePath, ignoreContent, 'utf8');
    console.log('✅ Created .cursorignore file');
  }
  
  console.log('\n🎉 Protection system installed successfully!');
  console.log('📝 Available commands:');
  console.log('  npm run protect-cursor    - Protect all .cursor files');
  console.log('  npm run check-cursor      - Check .cursor status');
  console.log('  npm run install-cursor-hooks - Install Git hooks');
}

function checkProtectionStatus() {
  console.log('🔍 Checking .cursor protection status...\n');
  
  // Check file status
  const status = checkCursorStatus();
  
  // Check Git hooks
  const hooksDir = path.join(process.cwd(), '.git', 'hooks');
  const hooks = ['pre-commit', 'post-commit', 'pre-push'];
  const installedHooks = [];
  
  for (const hook of hooks) {
    const hookPath = path.join(hooksDir, hook);
    if (fs.existsSync(hookPath)) {
      const content = fs.readFileSync(hookPath, 'utf8');
      if (content.includes('Cursor Protection Hook')) {
        installedHooks.push(hook);
      }
    }
  }
  
  // Check package.json scripts
  const packagePath = path.join(process.cwd(), 'package.json');
  let hasScripts = false;
  
  if (fs.existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      hasScripts = packageJson.scripts && (
        packageJson.scripts['protect-cursor'] ||
        packageJson.scripts['check-cursor'] ||
        packageJson.scripts['install-cursor-hooks']
      );
    } catch (error) {
      // Ignore errors
    }
  }
  
  // Check .cursorignore
  const cursorIgnorePath = path.join(process.cwd(), '.cursorignore');
  const hasCursorIgnore = fs.existsSync(cursorIgnorePath);
  
  console.log('📊 Protection Status Report:');
  console.log(`📁 Total .cursor files: ${status.totalFiles}`);
  console.log(`🇺🇸 English-only files: ${status.totalFiles - status.russianContentCount}`);
  console.log(`🇷🇺 Files with Russian content: ${status.russianContentCount}`);
  console.log(`🔧 Installed Git hooks: ${installedHooks.length}/${hooks.length}`);
  console.log(`📦 Package.json scripts: ${hasScripts ? '✅' : '❌'}`);
  console.log(`📄 .cursorignore file: ${hasCursorIgnore ? '✅' : '❌'}`);
  
  if (installedHooks.length > 0) {
    console.log(`\n📋 Installed hooks: ${installedHooks.join(', ')}`);
  }
  
  if (status.russianContentCount > 0) {
    console.log('\n⚠️  Action required: Some files need translation');
    console.log('💡 Run: npm run protect-cursor');
  } else {
    console.log('\n✅ All files are protected!');
  }
  
  if (installedHooks.length < hooks.length) {
    console.log('\n⚠️  Action required: Git hooks not fully installed');
    console.log('💡 Run: npm run install-cursor-hooks');
  }
  
  return {
    filesProtected: status.russianContentCount === 0,
    hooksInstalled: installedHooks.length === hooks.length,
    scriptsAdded: hasScripts,
    ignoreFileExists: hasCursorIgnore
  };
}

function restoreFromBackup(backupPath) {
  console.log('🔄 Restoring .cursor from backup...\n');
  
  const { restoreFromBackup: restore } = require('./cursor-protector.cjs');
  const success = restore(backupPath);
  
  if (success) {
    console.log('✅ Restoration completed successfully');
  } else {
    console.log('❌ Restoration failed');
  }
  
  return success;
}

function main() {
  const command = process.argv[2] || 'protect';
  const backupPath = process.argv[3];

  switch (command) {
    case 'protect':
      protectCursorComplete();
      break;
    case 'install':
      installProtectionSystem();
      break;
    case 'check':
      checkProtectionStatus();
      break;
    case 'restore':
      if (!backupPath) {
        console.log('❌ Please specify backup path');
        console.log('Usage: node .cursor/rules/protect-cursor.cjs restore <backup-path>');
        return;
      }
      restoreFromBackup(backupPath);
      break;
    case 'help':
      console.log(`
Protect Cursor Script

Usage: node .cursor/rules/protect-cursor.cjs [command] [backup-path]

Commands:
  protect  - Complete protection: translate files, install hooks, commit (default)
  install  - Install protection system (hooks, scripts, .cursorignore)
  check    - Check protection status
  restore  - Restore from backup (requires backup path)
  help     - Show this help

Examples:
  node .cursor/rules/protect-cursor.cjs protect
  node .cursor/rules/protect-cursor.cjs install
  node .cursor/rules/protect-cursor.cjs check
  node .cursor/rules/protect-cursor.cjs restore .cursor/backup/rules/ai-memory.mdc
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

module.exports = { 
  protectCursorComplete, 
  installProtectionSystem, 
  checkProtectionStatus, 
  restoreFromBackup 
}; 