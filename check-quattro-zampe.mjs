// Execute the actual standalone scene's spring solver without a GPU or a browser.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('./quattro-zampe.html',import.meta.url),'utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const utils=section('const clamp=','const storageKey=');
const source=
  section('function sanitize(','let configs=')+
  html.match(/function tailRadius[^\n]+/)[0]+
  section('const pointers=new Map()','function material(');
const ui={disabled:false,textContent:'',classList:{add(){},remove(){}}};
const scene=new Function('$','canvas','clearTimeout','setTimeout',`
  ${utils}
  const reduced=false;let configs=defaults.map(c=>({...c})),simTime=0;
  const camera={};const cameraEye=[0,3,8];
  ${source}
  ${section('function parametric(','function uploadMesh(')}
  ${html.match(/function seeded[^\n]+/)[0]}
  ${section('function tubeFrames(','function tailRadius(')}
  ${section('function tubeMesh(','// One implicit skin,')}
  ${section('function torsoProfile(','function createMeshes(')}
  return {V,transform,restOffsets,rotate,bodyAxes,tailRadius,sculptField,sculptMesh,skinMatrices,headModel,strokeCat,pointers,applyImpulse,demonstrate,
    reset(changes=[]){configs=defaults.map((d,i)=>sanitize({...d,...changes[i]},d));resetPose();simTime=0;kissCount=0},
    step(){fixedStep(1/120)},get cats(){return cats},get configs(){return configs},
    get kiss(){return kiss},get kissCount(){return kissCount},get time(){return simTime}};
`)(()=>ui,ui,()=>{},()=>0);
const {V}=scene;
const run=seconds=>{for(let i=0;i<seconds*120;i++)scene.step()};
function finite(){assert(scene.cats.every(c=>c.nodes.every(n=>[...n.p,...n.prev].every(Number.isFinite))),'Every spring stays finite')}
function standing(){for(let cat of scene.cats){let root=cat.nodes[0].p;
  assert(root[1]>.82&&root[1]<1.03,'The body stays supported by its legs');
  for(let paw of cat.nodes.slice(2,6))assert(Math.abs(paw.p[1]-.19)<.003,'All four paws touch the floor');
  let rest=scene.restOffsets(scene.configs[cat.id],cat.id,scene.time);
  for(let i=1;i<8;i++)assert(V.len(V.sub(cat.nodes[i].p,V.add(root,scene.rotate(rest[i],cat.yaw))))<.12,'The plush returns to its recognizable shape');
}}
scene.reset();run(8);finite();standing();assert.equal(scene.kissCount,0,'Resting cats do not kiss by themselves');
let before=scene.cats[0].nodes[13].p;run(3);assert(V.len(V.sub(scene.cats[0].nodes[13].p,before))>.015,'Idle tails sway without input');
scene.strokeCat(scene.cats[0],.45,-1);run(.35);finite();
assert(scene.cats[0].pet>.4&&scene.cats[1].pet===0,'Stroking one kitten produces an independent reaction');
run(7);assert(scene.cats[0].pet<.001,'Petting relaxes when movement stops');standing();
for(let node=2;node<6;node++){
  scene.reset();run(2);let initial=[...scene.cats[0].nodes[node].p],other=[...scene.cats[1].nodes[0].p];
  scene.pointers.set(1,{type:'plush',cat:0,node,offset:[0,0,0],target:V.add(initial,[-.48,.50,.08]),history:[]});run(1);
  assert(V.len(V.sub(scene.cats[0].nodes[node].p,initial))>.20,'Each paw can be pulled independently');
  assert(V.len(V.sub(scene.cats[1].nodes[0].p,other))<.02,'Pulling one cat does not drag the other');
  scene.pointers.clear();run(6);finite();standing();
}
for(let changes of [
  [{headSize:1.18,roundness:.85,earSize:1.2,tailLength:1.3},{headSize:.85,roundness:1.18,earSize:.78,tailLength:.75}],
  [{headSize:.85,roundness:1.18,tailLength:.75},{headSize:1.18,roundness:.85,tailLength:1.3}]
]){scene.reset(changes);run(6);finite();standing();}
scene.reset();scene.applyImpulse(scene.cats[0],[3.5,2.7,.7]);run(9);finite();assert(scene.cats.every(c=>c.nodes[0].p[1]<1.03),'A gentle throw settles onto the floor');
scene.reset();scene.demonstrate();let touched=false,woven=false;
for(let frame=0;frame<120*9;frame++){
  scene.step();finite();let k=scene.kiss;if(!k)continue;
  if(k.t>.75&&k.t<2.45){let noses=scene.cats.map(c=>V.add(c.nodes[1].p,scene.rotate([0,-.17*scene.configs[c.id].headSize,.760*scene.configs[c.id].headSize],c.faceYaw)));assert(V.len(V.sub(noses[0],noses[1]))<.025,'Kiss touches noses without merging faces');touched=true;}
  if(k.wind>.99&&!woven){assert(scene.cats.every(c=>c.animatedTail.length===61&&c.animatedTail.every(p=>p.every(Number.isFinite))));let gap=Infinity;for(let a=1;a<61;a++)for(let b=1;b<61;b++)gap=Math.min(gap,V.len(V.sub(scene.cats[0].animatedTail[a],scene.cats[1].animatedTail[b]))-scene.tailRadius(a/60)-scene.tailRadius(b/60));assert(gap>0,'The knitted tail surfaces stay separate during the braid');woven=true;}
}
assert(touched&&woven,'The kiss includes nose contact and intertwined tails');assert.equal(scene.kissCount,1,'Prolonged contact produces one kiss');assert.equal(scene.kiss,null,'Animation releases control');


// Verify a single, closed, continuously weighted skin and actual deformed vertex positions.
for(let settings of [[],[{headSize:1.18,roundness:.85},{headSize:.85,roundness:1.18}]]){
 scene.reset(settings);run(3);
 for(let id=0;id<2;id++){let mesh=scene.sculptMesh(scene.configs[id],id),edges=new Map(),neighbors=Array.from({length:mesh.vertices.length/10},()=>[]);
  assert([...mesh.vertices,...mesh.skin].every(Number.isFinite),'Skin geometry and normals stay finite');
  for(let i=0;i<mesh.indices.length;i+=3){let t=mesh.indices.subarray(i,i+3);for(let j=0;j<3;j++){let a=t[j],b=t[(j+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);neighbors[a].push(b);neighbors[b].push(a);}}
  assert([...edges.values()].every(n=>n===2),'The sculpt has no open joins or intersecting sheets');
  let reached=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(let n of neighbors[queue[i]])if(!reached.has(n)){reached.add(n);queue.push(n)}
  assert.equal(reached.size,neighbors.length,'Torso, neck, head and four legs form one connected skin');
  for(let i=0;i<neighbors.length;i++){let w=mesh.skin.subarray(i*8+4,i*8+8);assert(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-6&&w.every(v=>v>=0),'Every vertex has normalized soft weights');}
  const world=()=>{let matrices=scene.skinMatrices(scene.cats[id],scene.configs[id],0,0).matrices;return neighbors.map((_,i)=>{let p=mesh.vertices.subarray(i*10,i*10+3),q=[0,0,0];for(let j=0;j<4;j++){let v=scene.transform(matrices[mesh.skin[i*8+j]],p),w=mesh.skin[i*8+4+j];q=q.map((n,k)=>n+v[k]*w)}return q;})};
  assert(world().every(p=>p[1]>-.008),'The smooth soles do not sink below the floor');
  let cat=scene.cats[id],node=2,start=[...cat.nodes[node].p];scene.pointers.set(1,{type:'plush',cat:id,node,offset:[0,0,0],target:V.add(start,[-.4,.5,.1]),history:[]});run(.8);
  assert(world().every(p=>p.every(Number.isFinite)),'The entire skin bends with a stretched paw');scene.pointers.clear();run(4);
 }
}
console.log('PASS: independent, fading petting reactions; four grounded paws, stable stretch/throw, complete kiss and separate woven tails; one closed, connected, deformable skin for each kitten.');
