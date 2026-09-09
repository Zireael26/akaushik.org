import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));

console.log('[build:friendsof] Running opennextjs-cloudflare build...');
execFileSync('pnpm', ['exec', 'opennextjs-cloudflare', 'build', ...process.argv.slice(2)], {
  cwd: appDir,
  stdio: 'inherit',
});
console.log('[build:friendsof] Build completed successfully.');
