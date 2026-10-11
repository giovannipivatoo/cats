import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('.cloudflare-assets',{recursive:true});
for (const file of ['index.html','quattro-zampe.html']) {
  await copyFile('quattro-zampe.html',`.cloudflare-assets/${file}`);
}
