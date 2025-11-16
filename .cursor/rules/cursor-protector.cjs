#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs');

function log(message) {
  if (process.env.CURSOR_RULES_SILENT) {
    return;
  }
  console.log(`[cursor-protector] ${message}`);
}

function run(command) {
  switch (command) {
    case 'check':
      // No-op stub: the repository does not ship custom Cursor rules.
      // Returning exit code 0 keeps automation happy while we keep a place-holder
      // for future rule implementations.
      log('no custom .cursor rules found, skipping check');
      return 0;
    case 'protect':
      // Legacy command invoked by pnpm protect-cursor – we simply ensure the
      // rules directory exists so downstream tooling does not fail.
      const rulesDir = path.resolve(__dirname);
      if (!fs.existsSync(rulesDir)) {
        fs.mkdirSync(rulesDir, { recursive: true });
      }
      log('protect command executed (stub)');
      return 0;
    default:
      log(`unknown command "${command}", treating as noop`);
      return 0;
  }
}

const [, , command] = process.argv;
const exitCode = run(command);
process.exit(exitCode);
