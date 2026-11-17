import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
const root = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const icon = readFileSync(new URL('favicon.svg', root), 'utf8')
  .replace(/^.*?<style>.*?<\/style>/s, '')
  .replace(/<\/svg>\s*$/, '');
mkdirSync(new URL('icons/', root), {recursive:true});
mkdirSync(new URL('social/', root), {recursive:true});
function png(name, svg, size) {
  const image = new Resvg(svg, size ? {fitTo:{mode:'width',value:size}} : {}).render().asPng();
  writeFileSync(new URL(name, root), image);
  console.log(`${name}: ${image.length} bytes`);
}
function iconSvg(scale) {
 const offset = (44 - 44 * scale) / 2;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" color="#13b5df"><rect width="44" height="44" fill="#10252f"/><g transform="translate(${offset} ${offset}) scale(${scale})">${icon}</g></svg>`;
}
png('apple-touch-icon.png',iconSvg(.86),180);
png('icons/icon-192.png',iconSvg(.86),192);
png('icons/icon-512.png',iconSvg(.86),512);
// The complete mark fits inside Android's central 80%-diameter safe circle.
png('icons/maskable-512.png',iconSvg(.60),512);
png('favicon-32.png',iconSvg(.92),32);
const favicon = readFileSync(new URL('favicon-32.png',root));
const ico = Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);
ico[6]=32;ico[7]=32;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);
ico.writeUInt32LE(favicon.length,14);ico.writeUInt32LE(22,18);
writeFileSync(new URL('favicon.ico',root),Buffer.concat([ico,favicon]));
const house = html.match(/<svg class="neighborhood"[\s\S]*?<\/svg>/)[0]
 .replace(/<svg[^>]*>/,'').replace(/<\/svg>$/,'')
 .replace(/<title[\s\S]*?<\/title>/,'').replace(/<desc[\s\S]*?<\/desc>/,'')
 .replace(/<g class="demo-label">[\s\S]*?<\/g>/,'');
for (const [name,w,h,scale,x,y] of [
 ['share-v2.png',1200,630,1.15,243.5,44.75],
]) {
 png('social/'+name,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#edf6f8"/><g transform="translate(${x} ${y}) scale(${scale})">${house}</g></svg>`);
}
