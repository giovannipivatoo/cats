// Read-only production smoke check: never create messages or mark real ones read.
import assert from 'node:assert/strict';
const site='https://giovannipivatoo.github.io/cats/';
const backend='https://meo-mao-plush.meo-mao-plush.workers.dev';
const origin=new URL(site).origin;
const request=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(15000)});
for(const path of ['', 'quattro-zampe.html']) {
  const page=await request(site+path);
  assert.equal(page.status,200);
  const html=await page.text();
  assert(html.includes(`fetch('${backend}'+path,`),'Published mailbox must use the shared API');
  assert(html.includes(`fetch('${backend}/api/customizations',`));
}
for(const person of ['meo','mao']) {
  const response=await request(`${backend}/api/messages?as=${person}`,{headers:{Origin:origin}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  const data=await response.json();
  assert(Array.isArray(data.messages));
  assert.equal(data.unread,data.messages.filter(m=>m.to===person&&!m.readAt).length);
}
for(const path of ['/api/messages','/api/messages/read','/api/customizations']) {
  const response=await request(backend+path,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  assert.equal(response.status,204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  assert(response.headers.get('Access-Control-Allow-Methods').includes('POST'));
  assert(response.headers.get('Access-Control-Allow-Headers').toLowerCase().includes('content-type'));
}
console.log('PASS: published Pages entry points, both online inboxes and cross-origin send/read/customization preflights.');
