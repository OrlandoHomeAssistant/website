import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const config=JSON.parse(readFileSync(new URL('../../wrangler.production.jsonc',import.meta.url),'utf8'));
let worker;
before(()=>{
 worker=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:config.compatibility_date,
  script:`export default {async fetch(request,env){const response=await env.ASSETS.fetch(request);const result=new Response(response.body,response);result.headers.set('X-Test-Worker-Invoked','yes');return result;}}`,
  assets:{directory:fileURLToPath(new URL('../../dist',import.meta.url)),binding:'ASSETS',run_worker_first:config.assets.run_worker_first,routerConfig:{has_user_worker:true}},
 }));
});
after(async()=>{await worker?.dispose();});
test('static assets bypass Worker execution while retaining their security headers',async()=>{
 for(const path of ['/app.js','/style.css','/figtree-latin.woff2','/social/share-v3.png']){
  const response=await worker.dispatchFetch('https://routing.test'+path);
  assert.equal(response.status,200);assert.equal(response.headers.get('X-Test-Worker-Invoked'),null,path);
  assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
  assert.match(response.headers.get('Content-Security-Policy'),/object-src 'none'/);
 }
});
test('the page and public APIs still invoke Worker code',async()=>{
 for(const path of ['/','/api/porch','/api/next-event','/robots.txt','/sitemap.xml','/health','/index.md','/llms.txt']){
  const response=await worker.dispatchFetch('https://routing.test'+path);
  assert.equal(response.headers.get('X-Test-Worker-Invoked'),'yes',path);
 }
});
