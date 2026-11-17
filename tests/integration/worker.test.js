import {test, before, after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {parseFeed} from '../../src/feed.js';

const origin='https://community.test';
const fixture=readFileSync(new URL('../orlando.ics',import.meta.url),'utf8')
  .replaceAll('20270109','20990109'); // Keep the fixture upcoming as the test suite ages.
let worker, cache, upstream, calls;
before(async()=>{
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../../src/worker.ts',import.meta.url))],bundle:true,external:['cloudflare:*'],format:'esm',platform:'browser',target:'es2022',write:false});
 worker=new Miniflare(convertV4MiniflareOptions({
  modules:true,script:bundle.outputFiles[0].text,
  compatibilityDate:'2026-11-16',compatibilityFlags:['nodejs_compat'],
  assets:{directory:fileURLToPath(new URL('../../dist',import.meta.url)),binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},
  bindings:{LUMA_ICAL_URL:'https://luma-feed.test/orlando.ics',BUILD_SHA:'integration-test'},
  outboundService:async(request)=>{
   assert.equal(request.url,'https://luma-feed.test/orlando.ics');calls++;
   return upstream();
  },
 }));
 cache=(await worker.getCaches()).default;
});
after(async()=>{await worker?.dispose();});
beforeEach(async()=>{
 await cache.delete(origin+'/__calendar-cache-v1');calls=0;
 upstream=()=>new Response(fixture,{headers:{'Content-Type':'text/calendar'}});
});
const request=(path='/',options)=>worker.dispatchFetch(origin+path,options);
async function seed(age){
 await cache.put(origin+'/__calendar-cache-v1',new Response(JSON.stringify({events:parseFeed(fixture),fetchedAt:Date.now()-age}),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=86400'}}));
}

test('renders live meetup, one share image, structured data and correct origin without JavaScript',async()=>{
 const response=await request();assert.equal(response.status,200);
 const html=await response.text();assert.match(html,/Get-Together &amp; Gear Swap/);
 assert.match(html,/https:\/\/luma.com\/qpe49nll/);
 const images=[...html.matchAll(/<meta property="og:image" content="([^"]+)"/g)];
 assert.deepEqual(images.map(match=>match[1]),[origin+'/social/share-v2.png']);
 const data=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
 assert.equal(data['@graph'].find(node=>node['@type']==='Event').startDate,'2099-01-09T14:00:00.000Z');
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.ok(response.headers.get('Content-Security-Policy').includes("object-src 'none'"));
});

test('fresh cache avoids an upstream request',async()=>{
 await seed(1000);const response=await request('/api/next-event');
 const result=await response.json();assert.equal(result.stale,false);assert.equal(calls,0);
 assert.match(result.event.location,/Stardust/);
});

test('upstream outage uses recent stale data with a notice',async()=>{
 await seed(60*60*1000);upstream=()=>new Response('Unavailable',{status:503});
 const response=await request();const html=await response.text();
 assert.equal(response.status,200);assert.match(html,/Calendar sync delayed/);assert.equal(calls,1);
});

test('expired cache and failed upstream return an unavailable API and usable fallback page',async()=>{
 await seed(25*60*60*1000);upstream=()=>new Response('Unavailable',{status:503});
 const api=await request('/api/next-event');assert.equal(api.status,503);
 assert.equal((await api.json()).unavailable,true);
 const page=await request();assert.equal(page.status,200);assert.match(await page.text(),/Find the latest meetup on Luma/);
});

test('empty calendar is an ordinary no-upcoming-events state',async()=>{
 upstream=()=>new Response('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR');
 const api=await request('/api/next-event');assert.equal(api.status,200);assert.equal((await api.json()).event,null);
 const html=await(await request()).text();assert.match(html,/next meetup is in the works/);
});

test('invalid and oversized upstream responses fail safely',async()=>{
 for(const body of ['<html>not a calendar</html>','x'.repeat(512*1024+1)]) {
  upstream=()=>new Response(body);const response=await request('/api/next-event');
  assert.equal(response.status,503);assert.equal((await response.json()).unavailable,true);
 }
});

test('crawler and agent endpoints expose public information with correct MIME types',async()=>{
 const robots=await request('/robots.txt');assert.match(await robots.text(),/Allow: \//);
 assert.ok(!(robots.headers.get('X-Robots-Tag')||'').includes('noindex'));
 const sitemap=await request('/sitemap.xml');assert.match(sitemap.headers.get('Content-Type'),/application\/xml/);
 assert.ok((await sitemap.text()).includes(origin+'/'));
 const guide=await request('/llms.txt');assert.ok((await guide.text()).includes(origin+'/api/next-event'));
 const markdown=await request('/index.md');assert.match(markdown.headers.get('Content-Type'),/text\/markdown/);
 assert.match(await markdown.text(),/2099-01-09/);
});

test('asset responses preserve PNG MIME type and size',async()=>{
 const response=await request('/apple-touch-icon.png');assert.equal(response.status,200);
 assert.equal(response.headers.get('Content-Type'),'image/png');
 const image=Buffer.from(await response.arrayBuffer());assert.deepEqual([image.readUInt32BE(16),image.readUInt32BE(20)],[180,180]);
});

test('rejects write methods and hides internal cache paths',async()=>{
 const post=await request('/',{method:'POST'});assert.equal(post.status,405);assert.equal(post.headers.get('Allow'),'GET, HEAD');
 assert.equal((await request('/__calendar-cache-v1')).status,404);
 assert.equal((await request('/does-not-exist')).status,404);
});

test('HEAD is bodyless and health identifies the deployed commit',async()=>{
 const head=await request('/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 const health=await request('/health');assert.equal(health.status,200);
 assert.deepEqual(await health.json(),{status:'ok',commit:'integration-test'});
});
