#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const RULES_DIR = path.join(__dirname);
const INDEX_SCRIPT = path.join(RULES_DIR, 'generate-rules-index.js');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function main() {
  const fileName = await prompt('Enter rule file name (e.g., my-rule.mdc): ');
  const filePath = path.join(RULES_DIR, fileName);
  if (fs.existsSync(filePath)) {
    console.error('File already exists!');
    process.exit(1);
  }
  const heading = await prompt('Enter rule heading/title: ');
  const description = await prompt('Enter short description: ');
  const globs = await prompt('Enter globs (comma-separated, e.g., src/*,public/*): ');
  const related = await prompt('Related rules (comma-separated file names, optional): ');
  const ruleBody = await prompt('Enter rule body (main points, use - for bullets): ');
  const examples = await prompt('Examples (optional, leave blank if none): ');

  let content = `# ${heading}\n${ruleBody ? ruleBody + '\n' : ''}`;
  if (related) {
    content += `\nrelated:\n`;
    related.split(',').map(s => s.trim()).filter(Boolean).forEach(r => content += `  - ${r}\n`);
  }
  content += `\ndescription: ${description}\nglobs:\n`;
  globs.split(',').map(s => s.trim()).filter(Boolean).forEach(g => content += `  - ${g}\n`);
  content += 'alwaysApply: false\n---\n';
  if (examples) content += `\n# Examples\n${examples}\n`;

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Created ${fileName}`);
  // Update index/README
  require(INDEX_SCRIPT);
}

if (require.main === module) {
  main();
} 