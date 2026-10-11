import {mkdir,readFile,writeFile} from 'node:fs/promises';
const backend='https://meo-mao-plush.meo-mao-plush.workers.dev';
const html=(await readFile('quattro-zampe.html','utf8'))
  .replace('fetch(path,',`fetch('${backend}'+path,`)
  .replace("fetch('/api/customizations',",`fetch('${backend}/api/customizations',`);
await mkdir('_site',{recursive:true});
for (const name of ['index.html','quattro-zampe.html']) await writeFile(`_site/${name}`,html);
