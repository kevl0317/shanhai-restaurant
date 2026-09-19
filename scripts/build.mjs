import { cp, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');
// Only remove this project's generated directory; never follow a linked output.
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw new Error('无效的构建目录');
const previous=await lstat(out).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
if(previous?.isSymbolicLink())throw new Error('dist 不能是符号链接；请换用普通目录后重新构建。');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const item of ['index.html','styles.css','src','assets'])await cp(path.join(root,item),path.join(out,item),{recursive:true});
for(const dir of ['icons-256','sprites-1024'])await cp(path.join(root,'art/dishes-v1',dir),path.join(out,'art/dishes-v1',dir),{recursive:true});
const catalog=JSON.parse(await readFile(path.join(root,'art/dishes-v1/catalog.json'),'utf8'));
for(const d of catalog)for(const dir of ['icons-256','sprites-1024'])await stat(path.join(out,'art/dishes-v1',dir,path.basename(d.file)));
await writeFile(path.join(out,'.nojekyll'),'');
async function measure(dir){let bytes=0,files=0;for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){const child=await measure(file);bytes+=child.bytes;files+=child.files;}else{bytes+=(await stat(file)).size;files++;}}return {bytes,files};}
const size=await measure(out);
console.log(`已生成 dist/：${size.files} 个文件，${(size.bytes/1024/1024).toFixed(2)} MiB。29 道菜的两套运行时图片已核对，可部署到静态网站服务。`);
