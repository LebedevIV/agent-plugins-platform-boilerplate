#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOTS = [
  path.join(__dirname, '../.cursor/rules'),
  path.join(__dirname, '../docs'),
  path.join(__dirname, '../memory-bank'),
];
const MD_EXTS = ['.md', '.mdc'];

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const abs = path.join(dir, f);
    if (fs.statSync(abs).isDirectory()) {
      files = files.concat(walk(abs));
    } else if (MD_EXTS.includes(path.extname(f))) {
      files.push(abs);
    }
  }
  return files;
}

function extractHeadings(content) {
  return [...content.matchAll(/^#+\s+(.+)$/gm)].map(m => m[1]);
}

function generateToc(headings) {
  if (!headings.length) return '';
  return [
    '## Table of Contents',
    ...headings.map(h => `- [${h}](#${h.toLowerCase().replace(/[^a-z0-9]+/g, '-')})`),
    ''
  ].join('\n');
}

function extractCrossRefs(content) {
  const refs = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(content))) {
    refs.push({ text: m[1], link: m[2] });
  }
  return refs;
}

function updateSection(content, section, newBlock) {
  const re = new RegExp(`(^## ${section}[^\n]*\n)([\s\S]*?)(?=^## |\n# |\n---|\n?$)`, 'm');
  if (content.match(re)) {
    return content.replace(re, `$1${newBlock}\n`);
  } else {
    // Insert after first heading
    const idx = content.indexOf('\n');
    return content.slice(0, idx+1) + newBlock + '\n' + content.slice(idx+1);
  }
}

function main() {
  let brokenLinks = [];
  for (const root of ROOTS) {
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root)) {
      let content = fs.readFileSync(file, 'utf8');
      // ToC
      const headings = extractHeadings(content).filter(h => !/^Table of Contents$/i.test(h));
      const toc = generateToc(headings);
      if (toc) content = updateSection(content, 'Table of Contents', toc);
      // Cross-References
      if (/## Cross-References/.test(content)) {
        const refs = extractCrossRefs(content);
        for (const ref of refs) {
          const target = path.resolve(path.dirname(file), ref.link);
          if (!fs.existsSync(target.split('#')[0])) {
            brokenLinks.push(`${file}: ${ref.link}`);
          }
        }
      }
      fs.writeFileSync(file, content, 'utf8');
    }
  }
  if (brokenLinks.length) {
    console.warn('Broken cross-references found:');
    for (const l of brokenLinks) console.warn('  ' + l);
    process.exit(1);
  } else {
    console.log('ToC and cross-references updated for all files.');
  }
}

if (require.main === module) {
  main();
} 