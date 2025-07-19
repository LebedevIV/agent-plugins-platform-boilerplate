#!/usr/bin/env node

/**
 * Auto Translate Requests Script
 * Automatically translates user requests to English for .cursor rule creation
 * Usage: node .cursor/rules/auto-translate-requests.cjs [interactive|translate|setup]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { translateRequest, analyzeRequest, generateEnglishPrompt } = require('./request-translator.cjs');

// File paths
const CURSOR_DIR = path.join(process.cwd(), '.cursor');
const RULES_DIR = path.join(CURSOR_DIR, 'rules');

function createInteractiveMode() {
  console.log('🤖 Auto Translate Requests - Interactive Mode\n');
  console.log('This mode will help you create .cursor rules in English.');
  console.log('Type your request in Russian, and the system will translate it to English.\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  function askQuestion(question) {
    return new Promise((resolve) => {
      rl.question(question, resolve);
    });
  }
  
  async function interactiveLoop() {
    try {
      while (true) {
        const userRequest = await askQuestion('📝 Enter your request (or "quit" to exit): ');
        
        if (userRequest.toLowerCase() === 'quit' || userRequest.toLowerCase() === 'exit') {
          console.log('\n👋 Goodbye!');
          break;
        }
        
        if (!userRequest.trim()) {
          console.log('⚠️  Please enter a valid request.\n');
          continue;
        }
        
        console.log('\n🔄 Processing your request...\n');
        
        // Analyze the request
        const analysis = analyzeRequest(userRequest);
        const prompt = generateEnglishPrompt(userRequest);
        
        // Display results
        console.log('📊 Request Analysis:');
        console.log(`Original: ${analysis.originalText}`);
        console.log(`Translated: ${analysis.translatedText}`);
        console.log(`Confidence: ${analysis.translationConfidence.toFixed(1)}%`);
        console.log(`Patterns: ${analysis.detectedPatterns.join(', ')}`);
        
        if (prompt.shouldTranslate) {
          console.log('\n🤖 Generated English Prompt:');
          console.log('='.repeat(60));
          console.log(prompt.englishPrompt);
          console.log('='.repeat(60));
          
          const proceed = await askQuestion('\n✅ Proceed with creating the rule? (y/n): ');
          
          if (proceed.toLowerCase() === 'y' || proceed.toLowerCase() === 'yes') {
            await createRuleFromPrompt(prompt);
          } else {
            console.log('❌ Rule creation cancelled.\n');
          }
        } else {
          console.log('\n✅ Request is already in English. Proceeding with rule creation...\n');
          await createRuleFromPrompt(prompt);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
      }
    } catch (error) {
      console.error('❌ Error in interactive mode:', error.message);
    } finally {
      rl.close();
    }
  }
  
  interactiveLoop();
}

async function createRuleFromPrompt(prompt) {
  try {
    console.log('📝 Creating .cursor rule...\n');
    
    // Generate filename based on request
    const filename = generateFilename(prompt.translatedRequest || prompt.originalRequest);
    const filepath = path.join(RULES_DIR, filename);
    
    // Create rule content
    const ruleContent = generateRuleContent(prompt);
    
    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the rule file
    fs.writeFileSync(filepath, ruleContent, 'utf8');
    
    console.log(`✅ Rule created: ${path.relative(process.cwd(), filepath)}`);
    console.log(`📁 Location: ${filepath}`);
    
    // Stage the file for git
    const { execSync } = require('child_process');
    try {
      execSync(`git add "${filepath}"`, { stdio: 'inherit' });
      console.log('📦 File staged for git');
    } catch (error) {
      console.log('⚠️  Could not stage file for git');
    }
    
    return filepath;
  } catch (error) {
    console.error('❌ Error creating rule:', error.message);
    throw error;
  }
}

function generateFilename(request) {
  // Extract key terms from request
  const terms = request.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 3);
  
  // Create filename
  const baseName = terms.join('-') || 'new-rule';
  return `${baseName}.mdc`;
}

function generateRuleContent(prompt) {
  const timestamp = new Date().toISOString();
  const originalRequest = prompt.originalRequest;
  const translatedRequest = prompt.translatedRequest || prompt.originalRequest;
  
  return `---
description: ${translatedRequest}
globs: ["**/*"]
alwaysApply: false
aiPriority: normal
aiCategory: rules
createdFrom: "${originalRequest}"
translatedAt: "${timestamp}"
---

# ${translatedRequest}

## Overview

This rule was created based on the request: "${originalRequest}"

## Description

${translatedRequest}

## Implementation

<!-- Add implementation details here -->

## Usage

<!-- Add usage examples here -->

## Examples

<!-- Add code examples here -->

## Notes

<!-- Add additional notes here -->

---
*Generated automatically from user request: "${originalRequest}"*
*Translated to English for AI/LLM compatibility*
`;
}

function setupAutoTranslation() {
  console.log('🔧 Setting up auto translation for .cursor requests...\n');
  
  // Create configuration file
  const configPath = path.join(CURSOR_DIR, 'auto-translate-config.json');
  const config = {
    enabled: true,
    autoTranslate: true,
    createEnglishPrompts: true,
    backupOriginalRequests: true,
    confidenceThreshold: 70,
    patterns: {
      ruleCreation: ['создай', 'добавь', 'напиши', 'сделай'],
      fileCreation: ['файл', 'документ', 'правило'],
      cursorRequests: ['.cursor', 'cursor', 'rules']
    }
  };
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log('✅ Configuration created: .cursor/auto-translate-config.json');
  
  // Create helper script
  const helperPath = path.join(CURSOR_DIR, 'rules', 'create-rule.cjs');
  const helperContent = `#!/usr/bin/env node

/**
 * Quick Rule Creation Helper
 * Usage: node .cursor/rules/create-rule.cjs "your request in Russian"
 */

const { generateEnglishPrompt } = require('./request-translator.cjs');
const { createRuleFromPrompt } = require('./auto-translate-requests.cjs');

async function main() {
  const request = process.argv[2];
  
  if (!request) {
    console.log('❌ Please provide a request');
    console.log('Usage: node .cursor/rules/create-rule.cjs "создай правило для архитектуры"');
    process.exit(1);
  }
  
  try {
    const prompt = generateEnglishPrompt(request);
    await createRuleFromPrompt(prompt);
    console.log('\\n🎉 Rule created successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
`;
  
  fs.writeFileSync(helperPath, helperContent, 'utf8');
  console.log('✅ Helper script created: .cursor/rules/create-rule.cjs');
  
  // Update package.json scripts
  const packagePath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      packageJson.scripts['create-rule'] = 'node .cursor/rules/create-rule.cjs';
      packageJson.scripts['translate-request'] = 'node .cursor/rules/request-translator.cjs translate';
      packageJson.scripts['interactive-rules'] = 'node .cursor/rules/auto-translate-requests.cjs interactive';
      
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log('✅ Package.json scripts updated');
    } catch (error) {
      console.log('⚠️  Could not update package.json:', error.message);
    }
  }
  
  console.log('\n🎉 Auto translation setup completed!');
  console.log('\n📝 Available commands:');
  console.log('  npm run create-rule "your request"');
  console.log('  npm run translate-request "your request"');
  console.log('  npm run interactive-rules');
  console.log('  node .cursor/rules/auto-translate-requests.cjs interactive');
}

function main() {
  const command = process.argv[2] || 'help';

  switch (command) {
    case 'interactive':
      createInteractiveMode();
      break;
      
    case 'translate':
      const text = process.argv[3];
      if (!text) {
        console.log('❌ Please provide text to translate');
        console.log('Usage: node .cursor/rules/auto-translate-requests.cjs translate "текст"');
        return;
      }
      const prompt = generateEnglishPrompt(text);
      console.log('🤖 Generated English Prompt:');
      console.log('='.repeat(60));
      console.log(prompt.englishPrompt);
      console.log('='.repeat(60));
      break;
      
    case 'setup':
      setupAutoTranslation();
      break;
      
    case 'help':
      console.log(`
Auto Translate Requests Script

Usage: node .cursor/rules/auto-translate-requests.cjs [command] [text]

Commands:
  interactive - Start interactive mode for creating rules
  translate   - Translate request to English prompt
  setup       - Setup auto translation system
  help        - Show this help

Examples:
  node .cursor/rules/auto-translate-requests.cjs interactive
  node .cursor/rules/auto-translate-requests.cjs translate "создай правило"
  node .cursor/rules/auto-translate-requests.cjs setup
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
  createInteractiveMode, 
  createRuleFromPrompt, 
  generateFilename, 
  generateRuleContent, 
  setupAutoTranslation 
}; 