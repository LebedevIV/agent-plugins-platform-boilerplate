/* global console */
// tools/safe-delete.js

import fs from 'fs';
import path from 'path';

export const PROTECTED_DIRS = [
  'docs',
  '.cursor',
  'memory-bank',
  'docs/for-ai-best-practices',
  'platform-core',
  'chrome-extension/public/plugins',
];

export function safeDelete(targetPath) {
  const absTarget = path.resolve(targetPath);
  for (const protectedDir of PROTECTED_DIRS) {
    const absProtected = path.resolve(protectedDir);
    if (absTarget === absProtected || absTarget.startsWith(absProtected + path.sep)) {
      throw new Error(`❌ Attempt to delete protected directory: ${targetPath}`);
    }
  }
  if (fs.existsSync(absTarget)) {
    fs.rmSync(absTarget, { recursive: true, force: true });

    console.log(`✅ Directory ${targetPath} deleted`);
  } else {
    console.warn(`Directory ${targetPath} does not exist.`);
  }
}
