/* Technical export only: preserves generated artwork and alpha; no drawing or retouching. */
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require(require.resolve('sharp', { paths: [process.env.NODE_PATH || '', 'C:/Users/24510/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const root = __dirname;
const xml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const svgBuffer = s => Buffer.from(s);
async function main() {
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'catalog.json'), 'utf8'));
  if (catalog.length !== 29 || new Set(catalog.map(d => d.id)).size !== 29) throw Error('Expected 29 unique dishes');
  for (const d of catalog) await fs.access(path.join(root, d.file));
  for (const dir of ['sprites-1024', 'icons-256', 'icons-128']) await fs.mkdir(path.join(root, dir), {recursive:true});
  const rows=[];
  for (const d of catalog) {
    const src=path.join(root,d.file), bytes=await fs.readFile(src), meta=await sharp(bytes).metadata();
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let zero=0,partial=0,opaque=0;
    for(let i=3;i<data.length;i+=4){if(data[i]===0)zero++;else if(data[i]===255)opaque++;else partial++;}
    if(!meta.hasAlpha || zero===0 || opaque===0) throw Error('Missing real transparent alpha: '+d.id);
    const stem=path.basename(d.file), exports={};
    for(const size of [1024,256,128]){
      const rel=(size===1024?'sprites-1024':'icons-'+size)+'/'+stem;
      await sharp(bytes).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9}).toFile(path.join(root,rel));
      exports[size]=rel;
    }
    rows.push({...d,sourceSize:[meta.width,meta.height],format:'png',alpha:true,transparentFraction:Number((zero/(info.width*info.height)).toFixed(4)),partialAlphaPixels:partial,sourceSha256:createHash('sha256').update(bytes).digest('hex'),exports,prompt:'prompts/'+stem.replace('.png','.txt')});
  }
  const manifest={version:1,title:'山海食谱铺 · 全部菜品美术资源',count:29,method:'built-in image_gen',style:'统一国风食物手绘，浅青边米白瓷器，透明背景，无烘焙文字',generatedDate:'2026-09-19',assets:rows};
  await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const groups=[['粤菜','广东 · 早茶初见',1],['川菜','四川 · 百味迎客',2],['鲁菜','山东 · 丰盛上桌',3],['苏菜','江苏 · 清雅成宴',4],['浙菜','浙江 · 江南时鲜',5],['共用','全章节 · 家常四味',0]];
  const w=1800,h=2450,pad=70,cell=332,rowH=350,start=260;
  let background=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#f7f2e7"/><path d="M70 205H1730" stroke="#c7cbb6" stroke-width="2"/><text x="70" y="105" fill="#304b3c" font-size="60" font-family="Microsoft YaHei, sans-serif" font-weight="700">山海食谱铺</text><text x="72" y="162" fill="#7a806b" font-size="28" font-family="Microsoft YaHei, sans-serif">二十九味 · 菜品美术资源全览</text><text x="1730" y="152" text-anchor="end" fill="#7a806b" font-size="22" font-family="Microsoft YaHei, sans-serif">25 道名菜 + 4 道共用菜</text>`;
  const overlay=[];
  for(let g=0;g<groups.length;g++){
    const [name,sub,ch]=groups[g], y=start+g*rowH;
    background+=`<text x="${pad}" y="${y}" fill="#355440" font-size="29" font-weight="700" font-family="Microsoft YaHei, sans-serif">${name}</text><text x="${pad+90}" y="${y}" fill="#858a76" font-size="20" font-family="Microsoft YaHei, sans-serif">${sub}</text>`;
    const dishes=rows.filter(d=>d.chapter===ch);
    for(let i=0;i<dishes.length;i++){
      const d=dishes[i],x=pad+i*cell;
      background+=`<rect x="${x}" y="${y+20}" width="312" height="276" rx="22" fill="#fffcf6" stroke="#e4e5d5"/><text x="${x+156}" y="${y+276}" text-anchor="middle" fill="#34473a" font-size="25" font-family="Microsoft YaHei, sans-serif">${d.id}  ${xml(d.name)}</text>`;
      overlay.push({input:await sharp(path.join(root,d.exports[256])).resize(235,235).toBuffer(),left:x+38,top:y+28});
    }
  }
  background+=`<text x="70" y="2410" fill="#92947e" font-size="19" font-family="Microsoft YaHei, sans-serif">透明 PNG 原图 / 1024 标准图 / 256 与 128 小图标 · 名称由界面独立渲染</text></svg>`;
  await sharp(svgBuffer(background)).composite(overlay).png().toFile(path.join(root,'00-全菜品总览.png'));
  const dataJSON=JSON.stringify(rows).replace(/</g,'\\u003c');
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>山海食谱铺 · 二十九味</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f7f2e7;color:#314b3d;font-family:"Microsoft YaHei",sans-serif}main{max-width:1380px;margin:auto;padding:52px 34px}header{border-bottom:1px solid #cbd0b9;padding-bottom:30px;margin-bottom:24px}small{font-size:12px;letter-spacing:3px;color:#8a8f77}h1{font-size:42px;margin:12px 0}p{color:#7c826e;line-height:1.8}nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:24px 0}button,input{font:inherit;border:1px solid #cbd1ba;border-radius:24px;padding:10px 20px;background:#fffdf7;color:inherit}button{cursor:pointer}button[aria-pressed=true]{background:#36543f;color:white}input{margin-left:auto;min-width:160px}#grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}.card{padding:12px 14px 18px;border:1px solid #e0e3d1;border-radius:22px;background:#fffcf7;text-align:center}.art{border-radius:14px;background-color:#f8f5eb;aspect-ratio:1;display:flex;align-items:center}.art img{width:100%;height:100%;object-fit:contain}.dark .art{background:#263e34}.check .art{background:conic-gradient(#e3e6dd 25%,#fafaf4 0 50%,#e3e6dd 0 75%,#fafaf4 0) 0 0/22px 22px}h2{font-size:18px;margin:12px 0 6px}.tag{font-size:12px;color:#8b917c}.links{display:flex;justify-content:center;gap:12px;margin-top:12px}.links a,a{color:#507655;font-size:13px;text-decoration:none}.links a:hover,a:hover{text-decoration:underline}.detail{font-size:12px;line-height:1.5;min-height:36px;margin-top:8px;color:#8a8f7c}.tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap}footer{padding:36px 0;font-size:13px;line-height:1.8;color:#91977f}@media(max-width:1050px){#grid{grid-template-columns:repeat(4,1fr)}}@media(max-width:750px){#grid{grid-template-columns:repeat(3,1fr)}main{padding:24px 16px}h1{font-size:32px}}@media(max-width:490px){#grid{grid-template-columns:repeat(2,1fr)}input{width:100%}h2{font-size:16px}}
  </style><main><header><small>SHANHAI RECIPE HOUSE / FOOD ART COLLECTION</small><h1>二十九味，山海成宴。</h1><p>五大菜系的 25 道名菜，与贯穿全章的 4 道家常菜。<br>统一手绘风格 · 完整器皿 · 透明背景 · 无文字素材</p><div class="tools"><a href="00-全菜品总览.png" target="_blank">查看全部菜品总览 ↗</a><a href="manifest.json" target="_blank">资源清单 JSON ↗</a><button id="backdrop">背景：米白</button><span id="count"></span></div></header><nav aria-label="菜系筛选"><button data-group="全部" aria-pressed="true">全部 29</button><button data-group="粤菜">粤菜</button><button data-group="川菜">川菜</button><button data-group="鲁菜">鲁菜</button><button data-group="苏菜">苏菜</button><button data-group="浙菜">浙菜</button><button data-group="共用">共用菜</button><input id="search" placeholder="搜索菜名" aria-label="搜索菜名"></nav><div id="grid"></div><footer>图片由内置 image_gen 逐道生成。1024、256、128 版本仅作尺寸导出，保留原透明通道。<br>看单、换单、配单、反馈请复用同一资产；菜名由界面独立显示，4 道共用菜不归入某一地方菜系。</footer></main><script>
  const dishes=${dataJSON};let group='全部',backdrop=0;const grid=document.querySelector('#grid');function render(){const query=document.querySelector('#search').value.trim();const shown=dishes.filter(d=>(group==='全部'||d.cuisine===group)&&d.name.includes(query));grid.innerHTML=shown.map(d=>'<article class="card"><a class="art" href="'+d.exports[1024]+'" target="_blank" aria-label="查看'+d.name+'原尺寸"><img src="'+d.exports[256]+'" alt="'+d.name+'" width="256" height="256"></a><h2>'+d.name+'</h2><div class="tag">'+d.id+' / '+(d.province?d.cuisine+' · '+d.province:'全章节共用')+'</div><div class="detail">'+d.recognition+'</div><div class="links"><a download href="'+d.exports[1024]+'">1024 PNG</a><a download href="'+d.exports[256]+'">256</a><a download href="'+d.exports[128]+'">128</a></div></article>').join('');document.querySelector('#count').textContent=shown.length+' / 29 道';}document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{group=b.dataset.group;document.querySelectorAll('[data-group]').forEach(x=>x.setAttribute('aria-pressed',x===b));render()});document.querySelector('#search').oninput=render;document.querySelector('#backdrop').onclick=e=>{backdrop=(backdrop+1)%3;document.body.className=['','dark','check'][backdrop];e.target.textContent='背景：'+['米白','深绿','透明棋盘'][backdrop]};render();
  </script></html>`;
  await fs.writeFile(path.join(root,'index.html'),html);
  console.log(JSON.stringify({count:rows.length,transparent:rows.every(d=>d.alpha),sourceSizes:[...new Set(rows.map(d=>d.sourceSize.join('x')))],outputs:['00-全菜品总览.png','index.html','manifest.json','sprites-1024/','icons-256/','icons-128/']},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
