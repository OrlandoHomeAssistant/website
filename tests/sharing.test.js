import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const dist=new URL('../dist/',import.meta.url);
const html=readFileSync(new URL('index.html',dist),'utf8');
function dimensions(path) {
 const bytes=readFileSync(new URL(path,dist));
 assert.equal(bytes.subarray(1,4).toString(),'PNG',`${path} must be PNG`);
 return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
}
test('share metadata is present without JavaScript and points to real, correctly-sized public images',()=>{
 const images=[...html.matchAll(/<meta property="og:image" content="([^"]+)">\s*<meta property="og:image:width" content="(\d+)"><meta property="og:image:height" content="(\d+)">/g)];
 assert.equal(images.length,2);
 for (const [,link,width,height] of images) {
  const url=new URL(link);assert.equal(url.protocol,'https:');
  assert.deepEqual(dimensions(url.pathname.slice(1)),[Number(width),Number(height)]);
  assert.ok(Number(width)>=900);
 }
 assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
 assert.match(html,/<meta property="og:image:alt"/);
});
test('iPhone touch icon and Android manifest icons match their declared sizes',()=>{
 assert.deepEqual(dimensions('apple-touch-icon.png'),[180,180]);
 assert.match(html,/<link rel="apple-touch-icon"/);
 assert.match(html,/<link rel="manifest"/);
 const manifest=JSON.parse(readFileSync(new URL('site.webmanifest',dist)));
 assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192' && icon.purpose==='any'));
 assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512' && icon.purpose==='maskable'));
 for(const icon of manifest.icons){assert.deepEqual(dimensions(icon.src.slice(1)),icon.sizes.split('x').map(Number));}
});
