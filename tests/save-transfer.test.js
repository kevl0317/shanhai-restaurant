import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProgress, SAVE_KEY, loadProgress } from '../src/storage.js';
import { exportProgressText, parseProgressText, importProgressText, MAX_SAVE_BYTES } from '../src/save-transfer.js';

function completed(count) {
  const p = freshProgress();
  for (let id=1; id<=count; id++) p.levels[id]={stars:3,score:100,accuracy:100,passed:true};
  p.tutorials=[1];
  if(count>=5){p.decorations=[1];p.placements.left=1;}
  return p;
}

test('portable save restores earned cards, decorations and practice completion without preferences or session data', () => {
  const p=completed(5);p.settings.sound=false;p.latest={levelId:5,score:100};
  const text=exportProgressText(p),data=JSON.parse(text),restored=parseProgressText(text);
  assert.equal(data.game,'shanhai-restaurant');
  assert.equal(data.progress.settings,undefined);assert.equal(data.progress.latest,undefined);
  assert.deepEqual(restored.cards,['01','02','03','04','05']);
  assert.deepEqual(restored.tutorials,[1]);assert.deepEqual(restored.decorations,[1]);
  assert.equal(restored.placements.left,1);
  assert.deepEqual(parseProgressText(exportProgressText(freshProgress())),freshProgress());
});

test('load merges stronger results, retains local preferences and arrangements, and persists across reload', () => {
  const local=completed(5);local.settings={sound:false,motion:false};local.placements={left:null,center:1,right:null};
  local.latest={levelId:5,score:100};
  const incoming=completed(10);incoming.levels[1]={stars:1,score:80,accuracy:80,passed:true};
  incoming.decorations=[1,2];incoming.placements={left:1,center:null,right:2};incoming.tutorials=[6];
  const before=JSON.stringify(local);let saved;
  const storage={setItem(key,value){assert.equal(key,SAVE_KEY);saved=value;},getItem(){return saved;}};
  const merged=importProgressText(exportProgressText(incoming),local,storage);
  assert.equal(JSON.stringify(local),before);
  assert.equal(merged.levels[1].score,100);assert.equal(merged.cards.length,10);
  assert.deepEqual(merged.settings,local.settings);assert.deepEqual(merged.latest,local.latest);
  assert.deepEqual(merged.placements,{left:null,center:1,right:2});
  assert.deepEqual(merged.tutorials,[1,6]);assert.deepEqual(merged.decorations,[1,2]);
  assert.deepEqual(loadProgress(storage).progress,merged);
  assert.deepEqual(importProgressText(exportProgressText(incoming),merged,storage),merged);
});

test('invalid or foreign files cannot write or change existing progress', () => {
  const local=completed(3),before=JSON.stringify(local);
  const valid=JSON.parse(exportProgressText(completed(5)));
  const mutations=[
    d=>{d.game='panda-delivery';},d=>{d.version=2;},d=>{d.progress.levels=[];},
    d=>{d.progress.levels['26']=d.progress.levels['1'];},
    d=>{d.progress.levels['1'].stars=4;},d=>{d.progress.levels['1'].accuracy='100';},
    d=>{d.progress.levels['1'].passed=false;},d=>{d.progress.tutorials=[26];},
    d=>{d.progress.decorations=[5];},d=>{d.progress.placements.right=1;},
    d=>{delete d.progress.placements;},
  ];
  const files=['{broken','null','[]',' '.repeat(MAX_SAVE_BYTES+1),...mutations.map(change=>{const d=structuredClone(valid);change(d);return JSON.stringify(d);})];
  let writes=0;
  for(const text of files)assert.throws(()=>importProgressText(text,local,{setItem(){writes++;}}));
  assert.equal(writes,0);assert.equal(JSON.stringify(local),before);
});

test('a failed persistence never commits imported progress', () => {
  const local=completed(3),before=JSON.stringify(local);
  assert.throws(()=>importProgressText(exportProgressText(completed(10)),local,{setItem(){throw Error('full');}}),/原有进度未修改/);
  assert.equal(JSON.stringify(local),before);
});
