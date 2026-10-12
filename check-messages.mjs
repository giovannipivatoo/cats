// Real Cloudflare runtime + D1, using temporary data; no browser storage or mocks.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

const directory=await mkdtemp(join(tmpdir(),'meo-mao-check-'));
const options=convertV4MiniflareOptions({name:'check-messages',modules:true,scriptPath:'worker.js',compatibilityDate:'2026-10-08',d1Databases:{DB:'meo-mao-test'},resourcePersistencePath:directory});
let runtime=new Miniflare(options);
const call=(path,data,headers={})=>runtime.dispatchFetch('https://meo-mao.test'+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...headers},body:data?JSON.stringify(data):undefined});
const send=(as,text,id=crypto.randomUUID())=>({as,text,clientId:id});
try {
  const db=await runtime.getD1Database('DB');
  const schema=await readFile('schema.sql','utf8');
  await db.batch(schema.split(';').filter(sql=>sql.trim()).map(sql=>db.prepare(sql)));
  const origin='https://giovannipivatoo.github.io';
  const preflight=await runtime.dispatchFetch('https://meo-mao.test/api/customizations',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
  const cors=await call('/api/messages',send('meo','Pages connection'),{Origin:origin});
  assert.equal(cors.status,200);
  assert.equal(cors.headers.get('Access-Control-Allow-Origin'),origin);
  await db.prepare('DELETE FROM messages').run();
  const html=await readFile('quattro-zampe.html','utf8');
  // Execute the actual refresh hooks, including their hidden/sending guards.
  const hooks=new Map();let poll,loads=0;
  const refresh=new Function('window','document','setInterval','loadMail',`
    let person='mao',welcome={open:false},sending=false;
    ${html.slice(html.indexOf('function refreshMail()'),html.indexOf('welcome.showModal();\n</script>'))}
    return {setPerson:value=>person=value,setWelcome:value=>welcome.open=value,setSending:value=>sending=value};
  `)({addEventListener:(name,callback)=>hooks.set(name,callback)},
    {get hidden(){return hidden}},(callback,delay)=>{assert.equal(delay,3000);poll=callback},()=>{loads++});
  let hidden=false;
  hooks.get('online')();hooks.get('focus')();poll();
  assert.equal(loads,3,'Reconnect, focus and polling all fetch new messages');
  hidden=true;poll();hidden=false;
  refresh.setSending(true);hooks.get('online')();refresh.setSending(false);
  refresh.setWelcome(true);poll();refresh.setWelcome(false);
  refresh.setPerson(null);poll();
  assert.equal(loads,3,'No background requests while hidden, sending or choosing identity');
  const defaults=new Function('return '+html.match(/const defaults=(\[[^\n]+\]);/)[1])();
  assert.equal((await (await call('/api/customizations')).json()).customizations.length,0);
  const initial=(await (await call('/api/customizations',{cat:'meo',config:defaults[0],revision:0})).json()).customization;
  assert.equal(initial.revision,1);
  const competing=await Promise.all([
    call('/api/customizations',{cat:'meo',config:{...defaults[0],mainColor:'#c9ddc0'},revision:1}),
    call('/api/customizations',{cat:'meo',config:{...defaults[0],eyeColor:'#24725e'},revision:1})
  ]);
  assert.deepEqual(competing.map(r=>r.status).sort(),[200,409],'Concurrent clients cannot overwrite an unseen configuration');
  const conflict=await competing.find(r=>r.status===409).json();
  assert.equal(conflict.customization.revision,2);
  await call('/api/customizations',{cat:'mao',config:defaults[1],revision:0});
  assert.equal((await call('/api/customizations',{cat:'meo',config:{...defaults[0],headSize:9},revision:2})).status,400);
  assert.equal((await call('/api/customizations',{cat:'meo',config:{...defaults[0],fabric:'unknown'},revision:2})).status,400);
  assert.equal((await call('/api/customizations',{cat:'other',config:defaults[0],revision:0})).status,400);
  assert.equal((await call('/api/customizations',{cat:'meo',config:defaults[0],revision:2},{Origin:'https://elsewhere.test'})).status,403);

  // Run the actual editor save queue against D1, delaying one response while the user edits again.
  const source=html.slice(html.indexOf('// Shared kitten customization.'),html.indexOf('function refreshEditor()'));
  const sanitizeSource=html.slice(html.indexOf('function sanitize('),html.indexOf('let configs='));
  const ui={innerHTML:'',title:'',textContent:'',hidden:false,setAttribute(){}};
  const cache=new Map();let hold=false,offline=false,requestStarted,releaseRequest;
  const fetchClient=async(path,options)=>{if(offline)throw new Error('Offline');const response=await runtime.dispatchFetch('https://meo-mao.test'+path,options);if(hold&&options.method==='POST'){hold=false;requestStarted();await new Promise(resolve=>releaseRequest=resolve);}return response;};
  const makeClient=(fetcher=fetchClient,savedData=null)=>new Function('fetch','localStorage','$','$$','defaults','savedData',`
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));${sanitizeSource}
    const storageKey='test';let storageOK=true,configs=defaults.map(c=>({...c})),palette=0,active=0,rendering=true;
    const refreshEditor=()=>{};${source}
    return {loadSettings,flushSettings,save,settingsPending,get configs(){return configs},get writing(){return settingsWriting}};
  `)(fetcher,{setItem:(key,value)=>cache.set(key,value)},()=>ui,()=>[],defaults,savedData);
  const client=makeClient();
  await client.loadSettings();
  const started=new Promise(resolve=>requestStarted=resolve);hold=true;
  client.configs[0].name='Meo condiviso';client.save(0,['name']);
  const saving=client.flushSettings();await started;
  client.configs[0].mainColor='#d6c0ee';client.save(0,['mainColor']);
  client.configs[1].expression='sleepy';client.save(1,['expression']);
  releaseRequest();await saving;
  let shared=(await (await call('/api/customizations')).json()).customizations;
  assert.equal(shared.find(c=>c.cat==='meo').config.name,'Meo condiviso');
  assert.equal(shared.find(c=>c.cat==='meo').config.mainColor,'#d6c0ee','Edits made while saving are not rolled back');
  assert.equal(shared.find(c=>c.cat==='mao').config.expression,'sleepy','Both kittens save independently');
  const latest=shared.find(c=>c.cat==='meo');
  await call('/api/customizations',{cat:'meo',config:{...latest.config,eyeColor:'#123456'},revision:latest.revision});
  client.configs[0].roundness=1.12;client.save(0,['roundness']);await client.flushSettings();
  shared=(await (await call('/api/customizations')).json()).customizations;
  assert.equal(shared.find(c=>c.cat==='meo').config.eyeColor,'#123456','Rebasing preserves another device’s untouched fields');
  assert.equal(shared.find(c=>c.cat==='meo').config.roundness,1.12);
  assert(client.settingsPending.every(p=>Object.keys(p).length===0));
  offline=true;client.configs[1].tailLength=1.2;client.save(1,['tailLength']);await client.flushSettings();
  assert.equal(client.settingsPending[1].tailLength,1.2,'Failed saves retain the unsent edit');
  assert.equal(JSON.parse(cache.get('test')).pending[1].tailLength,1.2,'Interrupted saves retain a local draft');
  assert(ui.innerHTML.includes('Non salvato'),'Offline changes are never reported as saved');
  offline=false;await client.flushSettings();
  assert.equal((await (await call('/api/customizations')).json()).customizations.find(c=>c.cat==='mao').config.tailLength,1.2,'Retry saves the retained edit');

  await db.prepare("DELETE FROM customizations WHERE cat='mao'").run();
  let starts=0,releaseLoads;const loaded=new Promise(resolve=>releaseLoads=resolve);
  const simultaneousFetch=async(path,options)=>{const response=await runtime.dispatchFetch('https://meo-mao.test'+path,options);if(options.method==='GET'&&++starts<=2){if(starts===2)releaseLoads();await loaded;}return response;};
  const visitors=['#aabbcc','#ccbbaa'].map(mainColor=>makeClient(simultaneousFetch,{cats:[defaults[0],{...defaults[1],mainColor}]}));
  await Promise.all(visitors.map(v=>v.loadSettings()));
  for(let i=0;visitors.some(v=>v.writing)&&i<1000;i++)await new Promise(resolve=>setTimeout(resolve,1));
  assert(visitors.every(v=>!v.writing),'Initial saves finish');
  const initialized=(await (await call('/api/customizations')).json()).customizations.find(c=>c.cat==='mao');
  assert.equal(initialized.revision,1,'Concurrent first visits adopt the first saved configuration instead of overwriting it');
  assert(visitors.every(v=>v.configs[1].mainColor===initialized.config.mainColor));

  const first=send('meo','Ciao Mao ♡\n<script>non eseguirmi</script>');
  const deliveries=await Promise.all(Array.from({length:4},()=>call('/api/messages',first)));
  assert(deliveries.every(r=>r.status===200),'Concurrent delivery retries succeed');
  let inbox=await (await call('/api/messages?as=mao')).json();
  assert.equal(inbox.messages.length,1,'Retries never duplicate a message');
  assert.equal(inbox.unread,1);
  assert.equal(inbox.messages[0].text,first.text,'Text and newlines are preserved');
  const firstId=inbox.messages[0].id;
  // Opening a new runtime proves messages survive closing the sender's session.
  await runtime.dispose();runtime=new Miniflare(options);
  assert.equal((await (await call('/api/customizations')).json()).customizations.find(c=>c.cat==='meo').config.roundness,1.12,'Refresh and another runtime load the last database configuration');
  inbox=await (await call('/api/messages?as=mao')).json();
  assert.equal(inbox.unread,1,'Another client sees the persisted message');
  await call('/api/messages/read',{as:'meo',throughId:firstId});
  assert.equal((await (await call('/api/messages?as=mao')).json()).unread,1,'Sender cannot acknowledge the recipient inbox');
  await call('/api/messages/read',{as:'mao',throughId:firstId});
  assert((await (await call('/api/messages?as=meo')).json()).messages[0].readAt,'The sender sees the read receipt');
  await call('/api/messages',send('mao','Ciao Meo, ricevuto!'));
  await call('/api/messages',send('meo','Un altro piccolo pensiero.'));
  assert.equal((await (await call('/api/messages?as=meo')).json()).unread,1,'Replies go to the other kitten');
  assert.equal((await (await call('/api/messages?as=mao')).json()).unread,1,'Later messages stay unread');
  const nextCloud=(await (await call('/api/messages',send('meo','Un pensiero successivo.'))).json()).message;
  inbox=await (await call('/api/messages?as=mao')).json();
  const shown=inbox.messages.find(m=>m.to==='mao'&&!m.readAt);
  await call('/api/messages/read',{as:'mao',throughId:shown.id});
  inbox=await (await call('/api/messages?as=mao')).json();
  assert.equal(inbox.unread,1,'Reading one speech bubble leaves the next one unread');
  assert.equal(inbox.messages.find(m=>m.id===nextCloud.id).readAt,null);
  // Exercise the real bubble and read handler with a newest-first API response.
  // FIFO must be a client invariant, not depend on transport array order.
  const fifoMessages=[nextCloud];
  for(const text of ['FIFO secondo','FIFO terzo'])fifoMessages.push((await (await call('/api/messages',send('meo',text))).json()).message);
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,dataset:{},textContent:'',scrollTop:0});return elements.get(id)};
  const bubbleClient=new Function('api','el',`
    let person='mao',letters=[],generation=0,fetching=null,reading=null;
    const names={meo:'Meo',mao:'Mao'},cloud=el('mail-cloud'),welcome={open:false},panel={open:false},document={hidden:false};
    const status=()=>{},renderMail=()=>renderCloud();
    ${html.slice(html.indexOf('function renderCloud()'),html.indexOf('function renderMail('))}
    ${html.slice(html.indexOf('async function markRead('),html.indexOf('function openMail('))}
    ${html.slice(html.indexOf('async function loadMail('),html.indexOf('function choosePerson('))}
    return {loadMail,markRead};
  `)(async(path,data)=>{const result=await (await call(path,data)).json();if(result.messages)result.messages.reverse();return result},element);
  await bubbleClient.loadMail();
  for(const message of fifoMessages){
    assert.equal(element('mail-cloud').dataset.message,String(message.id),'Bubble shows oldest unread message first even when responses are reversed');
    assert.equal(element('cloud-text').textContent,message.text);
    await bubbleClient.markRead(message.id);
    const remaining=(await (await call('/api/messages?as=mao')).json()).messages.filter(m=>m.to==='mao'&&!m.readAt);
    assert.deepEqual(remaining.map(m=>m.id),fifoMessages.filter(m=>m.id>message.id).map(m=>m.id),'Next acknowledges only the displayed FIFO item');
    await bubbleClient.loadMail();
  }
  assert(element('mail-cloud').hidden,'Bubble disappears after the last unread message');
  assert.equal((await call('/api/messages',send('meo','   '))).status,400);
  assert.equal((await call('/api/messages',send('meo','x'.repeat(2001)))).status,400);
  assert.equal((await call('/api/messages',send('other','Hello'))).status,400);
  assert.equal((await call('/api/messages',{...first,text:'Changed text'})).status,409);
  assert.equal((await call('/api/messages',send('meo','Hello'),{Origin:'https://elsewhere.test'})).status,403);
  assert.equal((await call('/api/messages',send('meo','x'.repeat(18000)))).status,413);
  console.log('PASS: shared customization persistence, concurrent editor rebasing and save queue; persisted delivery, two identities, read receipts, concurrent retry safety, validation and same-origin requests.');
} finally {
  await runtime.dispose();await rm(directory,{recursive:true,force:true});
}
