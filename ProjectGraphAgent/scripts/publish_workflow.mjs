#!/usr/bin/env node

/**
 * ProjectGraphAgent Publish Workflow
 * 
 * This script automates the complete workflow from development to publication:
 * 1. Sync changes to standalone directory
 * 2. Clean standalone from parent project data
 * 3. Prepare for GitHub publication
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Paths
const PARENT_PROJECT = '/home/igor/Документы/Проекты/agent_plugins_platform/ProjectGraphAgent';
const STANDALONE_PROJECT = '/home/igor/Документы/Проекты/ProjectGraphAgent';

function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
}

function runCommand(command, cwd = PROJECT_ROOT) {
    try {
        log(`Running: ${command}`, 'info');
        const output = execSync(command, { 
            cwd, 
            encoding: 'utf8',
            stdio: 'inherit'
        });
        return { success: true, output };
    } catch (error) {
        log(`Command failed: ${command}`, 'error');
        log(`Error: ${error.message}`, 'error');
        return { success: false, error };
    }
}

function checkGitStatus() {
    try {
        const status = execSync('git status --porcelain', { 
            cwd: STANDALONE_PROJECT, 
            encoding: 'utf8' 
        });
        return status.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
        return [];
    }
}

function main() {
    log('🚀 Starting ProjectGraphAgent Publish Workflow...');
    
    // Step 1: Sync to standalone
    log('Step 1: Syncing to standalone directory...');
    const syncResult = runCommand('npm run sync', PARENT_PROJECT);
    if (!syncResult.success) {
        log('❌ Sync failed. Aborting workflow.', 'error');
        process.exit(1);
    }
    log('✅ Sync completed successfully');
    
    // Step 2: Clean standalone
    log('Step 2: Cleaning standalone directory...');
    const cleanResult = runCommand('npm run clean', STANDALONE_PROJECT);
    if (!cleanResult.success) {
        log('❌ Clean failed. Aborting workflow.', 'error');
        process.exit(1);
    }
    log('✅ Clean completed successfully');
    
    // Step 3: Check Git status
    log('Step 3: Checking Git status...');
    const changes = checkGitStatus();
    
    if (changes.length === 0) {
        log('ℹ️ No changes detected in standalone directory');
        log('Workflow completed successfully!');
        return;
    }
    
    log(`📝 Found ${changes.length} changed files:`);
    changes.forEach(change => {
        log(`   ${change}`, 'info');
    });
    
    // Step 4: Git operations
    log('Step 4: Preparing Git commit...');
    
    // Check if Git is initialized
    if (!fs.existsSync(path.join(STANDALONE_PROJECT, '.git'))) {
        log('Initializing Git repository...');
        runCommand('git init', STANDALONE_PROJECT);
        runCommand('git remote add origin https://github.com/LebedevIV/ProjectGraphAgent.git', STANDALONE_PROJECT);
    }
    
    // Add all files
    const addResult = runCommand('git add -A', STANDALONE_PROJECT);
    if (!addResult.success) {
        log('❌ Git add failed. Aborting workflow.', 'error');
        process.exit(1);
    }
    
    // Commit
    const commitMessage = `feat: update ProjectGraphAgent - ${new Date().toISOString().split('T')[0]}`;
    const commitResult = runCommand(`git commit -m "${commitMessage}"`, STANDALONE_PROJECT);
    if (!commitResult.success) {
        log('❌ Git commit failed. Aborting workflow.', 'error');
        process.exit(1);
    }
    
    log('✅ Git operations completed successfully');
    
    // Step 5: Push to GitHub
    log('Step 5: Pushing to GitHub...');
    log('⚠️  Ready to push to GitHub. Run the following command manually:');
    log('');
    log(`cd ${STANDALONE_PROJECT}`);
    log('git push origin main');
    log('');
    log('Or run this workflow with --push flag to push automatically');
    
    // Check for --push flag
    if (process.argv.includes('--push')) {
        log('Auto-pushing to GitHub...');
        const pushResult = runCommand('git push origin main', STANDALONE_PROJECT);
        if (pushResult.success) {
            log('✅ Successfully pushed to GitHub!');
        } else {
            log('❌ Push failed. You may need to set up authentication.');
        }
    }
    
    log('🎉 Publish workflow completed successfully!');
    log('');
    log('Next steps:');
    log('1. Review the changes in the standalone directory');
    log('2. Push to GitHub: cd /home/igor/Документы/Проекты/ProjectGraphAgent && git push origin main');
    log('3. Create a release on GitHub if needed');
}

main();
