#!/usr/bin/env node

/**
 * Quick Rule Creation Helper
 * Automatically translates user requests and creates .cursor rules in English
 * Usage: node .cursor/rules/create-rule.cjs "your request in Russian"
 */

const fs = require('fs');
const path = require('path');
const { generateEnglishPrompt } = require('./request-translator.cjs');

// File paths
const CURSOR_DIR = path.join(process.cwd(), '.cursor');
const RULES_DIR = path.join(CURSOR_DIR, 'rules');

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

async function createRule(request) {
  try {
    console.log('🤖 Processing your request...\n');
    
    // Generate English prompt
    const prompt = generateEnglishPrompt(request);
    
    // Display translation info
    console.log('📊 Translation Info:');
    console.log(`Original: ${prompt.originalRequest}`);
    console.log(`Translated: ${prompt.translatedRequest}`);
    console.log(`Confidence: ${prompt.confidence.toFixed(1)}%`);
    
    if (prompt.shouldTranslate) {
      console.log('\n✅ Request translated to English for AI/LLM compatibility');
    } else {
      console.log('\n✅ Request already in English');
    }
    
    // Generate filename and content
    const filename = generateFilename(prompt.translatedRequest || prompt.originalRequest);
    const filepath = path.join(RULES_DIR, filename);
    const ruleContent = generateRuleContent(prompt);
    
    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the rule file
    fs.writeFileSync(filepath, ruleContent, 'utf8');
    
    console.log(`\n✅ Rule created: ${path.relative(process.cwd(), filepath)}`);
    console.log(`📁 Location: ${filepath}`);
    
    // Stage the file for git
    const { execSync } = require('child_process');
    try {
      execSync(`git add "${filepath}"`, { stdio: 'inherit' });
      console.log('📦 File staged for git');
    } catch (error) {
      console.log('⚠️  Could not stage file for git');
    }
    
    // Show the created content
    console.log('\n📝 Created Rule Content:');
    console.log('='.repeat(60));
    console.log(ruleContent);
    console.log('='.repeat(60));
    
    return filepath;
  } catch (error) {
    console.error('❌ Error creating rule:', error.message);
    throw error;
  }
}

function main() {
  const request = process.argv[2];
  
  if (!request) {
    console.log('❌ Please provide a request');
    console.log('\nUsage: node .cursor/rules/create-rule.cjs "your request"');
    console.log('\nExamples:');
    console.log('  node .cursor/rules/create-rule.cjs "создай правило для архитектуры"');
    console.log('  node .cursor/rules/create-rule.cjs "добавь файл в .cursor"');
    console.log('  node .cursor/rules/create-rule.cjs "напиши правило безопасности"');
    console.log('\nOr use npm script:');
    console.log('  npm run create-rule "your request"');
    process.exit(1);
  }
  
  createRule(request)
    .then(() => {
      console.log('\n🎉 Rule created successfully!');
      console.log('\n💡 Next steps:');
      console.log('  1. Edit the rule file to add your specific content');
      console.log('  2. Commit the changes: git commit -m "feat: add new rule"');
      console.log('  3. The rule will be automatically protected by the cursor protection system');
    })
    .catch((error) => {
      console.error('\n❌ Failed to create rule:', error.message);
      process.exit(1);
    });
}

if (require.main === module) {
  main();
}

module.exports = { createRule, generateFilename, generateRuleContent }; 