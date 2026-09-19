import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8','.ico':'image/x-icon','.webp':'image/webp'};
http.createServer((req,res)=>{
  let name;
  try {name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);} catch {res.writeHead(400).end();return;}
  if(name.includes('\\')||name.includes('\0')){res.writeHead(400).end();return;}
  if(name==='/')name='/index.html';
  const target=path.resolve(root,'.'+name);
  if(!target.startsWith(root+path.sep)||name.split('/').some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}
  fs.stat(target,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('找不到这个页面');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD'){res.end();return;}
    fs.createReadStream(target).pipe(res);
  });
}).listen(port,'127.0.0.1',()=>console.log(`山海食谱铺 http://127.0.0.1:${port}`));
