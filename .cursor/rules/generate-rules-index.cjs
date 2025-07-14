#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const RULES_DIR = path.join(__dirname);
const INDEX_FILE = path.join(RULES_DIR, 'index.mdc');
const README_FILE = path.join(RULES_DIR, 'README.md');

function getRuleFiles(dir = RULES_DIR, rel = '') {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const abs = path.join(dir, f);
    const relPath = rel ? path.join(rel, f) : f;
    if (fs.statSync(abs).isDirectory()) {
      files = files.concat(getRuleFiles(abs, relPath));
    } else if (f.endsWith('.mdc') && !['index.mdc', 'generate-rules-index.js'].includes(f)) {
      files.push(relPath);
    }
  }
  return files;
}

function extractMeta(filePath) {
  const content = fs.readFileSync(path.join(RULES_DIR, filePath), 'utf8');
  const lines = content.split('\n');
  const heading = lines.find(l => l.startsWith('#')) || '';
  const descLine = lines.find(l => l.startsWith('description:')) || '';
  const description = descLine.replace('description:', '').trim();
  return { heading: heading.replace(/^#+\s*/, ''), description };
}

function generateIndex(ruleFiles) {
  let out = '# Index of Modular Rules\n\n';
  // Group by top-level folder
  const groups = {};
  for (const f of ruleFiles) {
    const parts = f.split(path.sep);
    const group = parts.length > 1 ? parts[0] : 'root';
    if (!groups[group]) groups[group] = [];
    groups[group].push(f);
  }
  for (const group of Object.keys(groups).sort()) {
    if (group !== 'root') out += `## ${group}\n`;
    groups[group].sort().forEach(f => {
      const meta = extractMeta(f);
      out += `- [${meta.heading || f}](${f})${meta.description ? ' — ' + meta.description : ''}\n`;
    });
    out += '\n';
  }
  out += 'description:\nglobs:\nalwaysApply: false\n---\n';
  return out;
}

function updateReadmeStructure(ruleFiles) {
  // Build tree structure
  function tree(files) {
    const t = {};
    for (const f of files) {
      const parts = f.split(path.sep);
      let cur = t;
      for (let i = 0; i < parts.length; ++i) {
        if (!cur[parts[i]]) cur[parts[i]] = (i === parts.length - 1) ? null : {};
        cur = cur[parts[i]];
      }
    }
    return t;
  }
  function printTree(t, indent = '    ') {
    let out = [];
    for (const k of Object.keys(t).sort()) {
      out.push(indent + k + (t[k] ? '/' : ''));
      if (t[k]) out.push(printTree(t[k], indent + '  '));
    }
    return out.join('\n');
  }
  const t = tree(ruleFiles);
  const structure = [
    '```',
    '.cursor/',
    '  rules/',
    printTree(t),
    '```',
    ''
  ].join('\n');
  let readme = fs.readFileSync(README_FILE, 'utf8');
  readme = readme.replace(/```[\s\S]*?```/, structure);
  fs.writeFileSync(README_FILE, readme, 'utf8');
}

function main() {
  const ruleFiles = getRuleFiles();
  const indexContent = generateIndex(ruleFiles);
  fs.writeFileSync(INDEX_FILE, indexContent, 'utf8');
  updateReadmeStructure(ruleFiles);
  console.log('index.mdc and README.md structure updated.');
}

if (require.main === module) {
  main();
} 