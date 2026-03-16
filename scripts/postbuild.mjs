import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve('out');
if (!existsSync(outDir)) {
  throw new Error('Expected Next export output directory "out" to exist.');
}
mkdirSync(resolve(outDir), { recursive: true });
cpSync(resolve('cloudflare/_worker.js'), resolve(outDir, '_worker.js'));
console.log('Copied Cloudflare Pages worker to out/_worker.js');
