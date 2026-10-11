// Identity is chosen by the visitor; this is not an authentication system.
const people = new Set(['meo', 'mao']);
const message = row => ({id:row.id,from:row.sender,to:row.recipient,text:row.text,createdAt:row.created_at,readAt:row.read_at});
const customization = row => ({cat:row.cat,config:JSON.parse(row.config),revision:row.revision,updatedAt:row.updated_at});
function validConfig(data) {
  if (!data || typeof data!=='object' || Array.isArray(data)) return null;
  const config={};
  if (typeof data.name!=='string' || !data.name.trim() || data.name.length>24 || data.name.includes('\0')) return null;
  config.name=data.name.trim();
  for (const key of ['mainColor','patchColor','eyeColor']) {
    if (typeof data[key]!=='string' || !/^#[\da-f]{6}$/i.test(data[key])) return null;
    config[key]=data[key];
  }
  for (const [key,min,max] of [['headSize',.85,1.18],['roundness',.85,1.18],['earSize',.78,1.2],['tailLength',.75,1.3]]) {
    if (!Number.isFinite(data[key]) || data[key]<min || data[key]>max) return null;
    config[key]=data[key];
  }
  for (const [key,options] of Object.entries({pattern:['solid','patches','tabby'],fabric:['fleece','velvet','knitted'],expression:['happy','sleepy','curious']})) {
    if (!options.includes(data[key])) return null;
    config[key]=data[key];
  }
  return config;
}
const reply = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

const pagesOrigin = 'https://giovannipivatoo.github.io';
export default {
  async fetch(request,env) {
    if (!new URL(request.url).pathname.startsWith('/api/')) return handleRequest(request,env);
    const origin=request.headers.get('Origin');
    if (origin && origin!==new URL(request.url).origin && origin!==pagesOrigin) return reply({error:'Origin not allowed'},403);
    const response=request.method==='OPTIONS' ? new Response(null,{status:204}) : await handleRequest(request,env);
    if (origin!==pagesOrigin) return response;
    const headers=new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin',pagesOrigin);
    headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers','Content-Type');
    headers.set('Vary','Origin');
    return new Response(response.body,{status:response.status,headers});
  }
};
async function handleRequest(request,env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      url.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(url,request));
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!['/api/messages','/api/messages/read','/api/customizations'].includes(url.pathname)) return reply({error:'Not found'},404);
    if (!env.DB) return reply({error:'Mailbox unavailable'},503);
    try {
      if (request.method === 'GET' && url.pathname === '/api/customizations') {
        const {results}=await env.DB.prepare('SELECT * FROM customizations ORDER BY cat').all();
        return reply({customizations:results.map(customization)});
      }
      if (request.method === 'GET' && url.pathname === '/api/messages') {
        const person = url.searchParams.get('as');
        if (!people.has(person)) return reply({error:'Choose Meo or Mao'},400);
        // ponytail: full history for two people; add cursor pagination if it grows large.
        const {results} = await env.DB.prepare('SELECT * FROM messages ORDER BY id').all();
        const messages = results.map(message);
        return reply({messages,unread:messages.filter(m=>m.to===person&&!m.readAt).length});
      }
      if (request.method !== 'POST') return reply({error:'Method not allowed'},405);
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin && origin !== pagesOrigin) return reply({error:'Same-origin requests only'},403);
      if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return reply({error:'JSON required'},415);
      // Bound the stream even if a caller omits Content-Length.
      const reader = request.body?.getReader();
      if (!reader) return reply({error:'Invalid message'},400);
      let size=0,chunks=[];
      for (;;) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return reply({error:'Message too large'},413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let data;
      try {data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return reply({error:'Invalid message'},400);}
      if (url.pathname === '/api/customizations') {
        const config=validConfig(data?.config);
        if (!people.has(data?.cat) || !config || !Number.isSafeInteger(data.revision) || data.revision<0) return reply({error:'Invalid customization'},400);
        const row=await env.DB.prepare('INSERT INTO customizations (cat,config,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(cat) DO UPDATE SET config=excluded.config,revision=customizations.revision+1,updated_at=excluded.updated_at WHERE customizations.revision=? RETURNING *').bind(data.cat,JSON.stringify(config),new Date().toISOString(),data.revision).first();
        if (!row) {
          const current=await env.DB.prepare('SELECT * FROM customizations WHERE cat=?').bind(data.cat).first();
          return reply({error:'Customization changed',customization:customization(current)},409);
        }
        return reply({customization:customization(row)});
      }
      if (!data || !people.has(data.as)) return reply({error:'Choose Meo or Mao'},400);
      if (url.pathname === '/api/messages/read') {
        if (!Number.isSafeInteger(data.throughId) || data.throughId<0) return reply({error:'Invalid message ID'},400);
        const readAt=new Date().toISOString();
        await env.DB.prepare('UPDATE messages SET read_at=? WHERE recipient=? AND id<=? AND read_at IS NULL').bind(readAt,data.as,data.throughId).run();
        return reply({readAt,throughId:data.throughId});
      }
      if (typeof data.text!=='string' || !data.text.trim() || data.text.length>2000 || data.text.includes('\0')) return reply({error:'Write up to 2000 characters'},400);
      if (typeof data.clientId!=='string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(data.clientId)) return reply({error:'Invalid delivery ID'},400);
      const recipient=data.as==='meo'?'mao':'meo',text=data.text.trim();
      await env.DB.prepare('INSERT OR IGNORE INTO messages (client_id,sender,recipient,text,created_at) VALUES (?,?,?,?,?)').bind(data.clientId,data.as,recipient,text,new Date().toISOString()).run();
      const row=await env.DB.prepare('SELECT * FROM messages WHERE client_id=?').bind(data.clientId).first();
      if(row.sender!==data.as || row.text!==text)return reply({error:'Delivery ID already used'},409);
      return reply({message:message(row)});
    } catch(error) {
      console.error('Mailbox request failed:',error.name);
      return reply({error:'Mailbox temporarily unavailable; please retry'},503);
    }
}
