export const SAVE_KEY='shanhai-restaurant-v1';
export function freshProgress(){return {version:1,levels:{},cards:[],tutorials:[],decorations:[],placements:{left:null,center:null,right:null},settings:{sound:true,motion:true},latest:null};}
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const unique=(v,p)=>Array.isArray(v)?[...new Set(v.filter(p))]:[];
export function sanitizeProgress(raw){
  const p=freshProgress();
  if(!raw||raw.version!==1)return p;
  for(let id=1;id<=25;id++){
    const x=raw.levels?.[id];
    if(x&&typeof x==='object'&&int(x.stars,0,3)&&int(x.score,0,100))p.levels[id]={stars:x.stars,score:x.score,accuracy:Math.max(0,Math.min(100,Number(x.accuracy)||0)),passed:x.passed===true&&x.stars>0};
  }
  p.cards=Object.keys(p.levels).filter(id=>p.levels[id].passed).map(id=>String(id).padStart(2,'0'));
  p.tutorials=unique(raw.tutorials,v=>int(v,1,25));
  p.decorations=unique(raw.decorations,v=>int(v,1,5)&&p.levels[v*5]?.passed===true);
  for(const spot of ['left','center','right'])if(p.decorations.includes(raw.placements?.[spot]))p.placements[spot]=raw.placements[spot];
  p.settings={sound:raw.settings?.sound!==false,motion:raw.settings?.motion!==false};
  if(raw.latest&&typeof raw.latest==='object'&&int(raw.latest.levelId,1,25)&&int(raw.latest.score,0,100))p.latest=raw.latest;
  return p;
}
export function loadProgress(storage){try{return {progress:sanitizeProgress(JSON.parse(storage.getItem(SAVE_KEY))),available:true};}catch{return {progress:freshProgress(),available:false};}}
export function persistProgress(progress,storage){try{storage.setItem(SAVE_KEY,JSON.stringify(progress));return true;}catch{return false;}}
export function recordResult(progress,levelId,result,session,answers){
  const old=progress.levels[levelId]||{stars:0,score:0,accuracy:0,passed:false};
  progress.levels[levelId]={stars:Math.max(old.stars,result.stars),score:Math.max(old.score,result.score),accuracy:Math.max(old.accuracy,result.accuracy),passed:old.passed||result.passed};
  const id=String(levelId).padStart(2,'0');
  if(result.passed&&!progress.cards.includes(id))progress.cards.push(id);
  progress.latest={levelId,...result,seed:session.seed,orders:session.orders,answers:answers.map(x=>[...x]),finishedAt:new Date().toISOString()};
}
