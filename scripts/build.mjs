import { copyFile, lstat, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, dist, siteFiles } from './files.mjs';

// Validate the inputs before replacing this project's generated output.
const files = await siteFiles();
if (path.dirname(dist) !== path.resolve(root) || path.basename(dist) !== 'dist') {
  throw new Error('Invalid build directory');
}
const previous = await lstat(dist).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
if (previous?.isSymbolicLink()) throw new Error('dist must not be a symbolic link');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
let bytes = 0;
for (const name of files) {
  const target = path.join(dist, name);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, name), target);
  bytes += (await stat(target)).size;
}
await writeFile(path.join(dist, '.nojekyll'), '');
console.log('Built dist/: ' + files.length + ' runtime files, ' + (bytes / 1024 / 1024).toFixed(2) + ' MiB.');
