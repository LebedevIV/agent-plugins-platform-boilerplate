#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const RULES_DIR = path.join(__dirname);
const files = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.mdc'));

let ok = true;
const seen = new Set();

for (const f of files) {
  const content = fs.readFileSync(path.join(RULES_DIR, f), 'utf8');
  if (!content.match(/^# /m)) { console.error(`${f}: missing heading`); ok = false; }
  if (!content.match(/^description:/m)) { console.error(`${f}: missing description`); ok = false; }
  if (!content.match(/^globs:/m)) { console.error(`${f}: missing globs`); ok = false; }
  if (!content.match(/^alwaysApply:/m)) { console.error(`${f}: missing alwaysApply`); ok = false; }
  if (!content.match(/^---/m)) { console.error(`${f}: missing ---`); ok = false; }
  if (seen.has(f)) { console.error(`${f}: duplicate file name`); ok = false; }
  seen.add(f);
  // Check related links
  const related = content.match(/related:[\s\S]*?description:/m);
  if (related) {
    const rels = [...related[0].matchAll(/-\s+([^\s]+)/g)].map(m => m[1]);
    for (const r of rels) {
      if (!fs.existsSync(path.join(RULES_DIR, r))) {
        console.error(`${f}: related link to missing file ${r}`);
        ok = false;
      }
    }
  }
}
if (!ok) process.exit(1);
console.log('All rules structure checks passed.'); 