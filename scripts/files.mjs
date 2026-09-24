import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from './site.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const dist = path.join(root, 'dist');
const types = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2', '.mp3', '.wav', '.ogg', '.md']);

// The same explicit runtime list controls both local serving and deployment.
export async function siteFiles(base = root) {
  const files = [];
  const resolvedBase = await realpath(base);
  async function visit(name) {
    const full = path.resolve(base, name);
    const relative = path.relative(base, full);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) ||
        relative.split(path.sep).some(part => part.startsWith('.'))) {
      throw new Error('Invalid public path: ' + name);
    }
    const info = await lstat(full);
    if (info.isSymbolicLink()) throw new Error('Public files cannot be symbolic links: ' + name);
    const resolved = await realpath(full);
    if (!resolved.startsWith(resolvedBase + path.sep)) throw new Error('Public path is outside the site: ' + name);
    if (info.isDirectory()) {
      for (const child of await readdir(full)) await visit(path.posix.join(name, child));
    } else if (info.isFile() && types.has(path.extname(name).toLowerCase())) {
      files.push(name);
    } else {
      throw new Error('Unexpected public file: ' + name);
    }
  }
  for (const name of site.publicPaths) await visit(name);
  return [...new Set(files)].sort();
}
