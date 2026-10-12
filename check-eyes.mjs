import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('./quattro-zampe.html',import.meta.url),'utf8');
const start=html.indexOf('// Compress the button eyes smoothly;');
const source=html.slice(start,html.indexOf('// The muzzle is sculpted',start));
const draw=new Function('simTime','expression','pet','kiss',`
  const c={expression},cat={blinkStart:0,pet},hs=1,id=1,faceYaw=0,headRoll=0,fabric=0;
  const main=[],pink=[],eye=[],thread=[],hp=p=>p,color=()=>[],V={lerp:()=>[]};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t);
  const eyes=[],lids=[];
  const sphere=(position,scale,colour,material)=>{if(material===3)eyes.push(scale)};
  const curve=points=>lids.push(points),segment=()=>{};
  ${source}
  return {eyes,lids};
`);
for(const expression of ['happy','curious','sleepy']) {
  for(const time of [-1,0,.23,1]) {
    const result=draw(time,expression,0,null);
    assert.equal(result.eyes.length,6,`${expression}: both open eyes and highlights return`);
    assert.equal(result.lids.length,0,`${expression}: closed-eye embroidery must disappear after reopening`);
  }
  for(let frame=0;frame<=100;frame++) {
    const result=draw(frame*.23/100,expression,0,null);
    assert(result.eyes.length===6&&result.lids.length===0 || result.eyes.length===0&&result.lids.length===2,
      'Each frame shows either open eyes or closed eyelids, never both or neither');
  }
  for(const [time,pet,kiss] of [[.115,0,null],[1,1,null],[1,0,{t:1}]]) {
    const result=draw(time,expression,pet,kiss);
    assert.equal(result.eyes.length,0);
    assert.equal(result.lids.length,2,'Blinking, petting and kissing close both eyes');
  }
}
console.log('PASS: blink closure and reopening, no overlapping eyelids, all expressions, petting and kissing.');
