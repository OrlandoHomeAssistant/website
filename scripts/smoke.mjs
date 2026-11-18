import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const base=new URL(process.argv[2] || 'https://orlando-home-assistant-dev.imagineer21.workers.dev');
const expected=process.env.EXPECTED_BUILD_SHA;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function get(path,attempts=1){
 for(let attempt=0;attempt<attempts;attempt++){
  const response=await fetch(new URL(path,base),{headers:{'User-Agent':'OrlandoHomeAssistant-Smoke/1.0','Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)});
  // A new deployment can briefly return an unavailable storage binding.
  // Retry only safe reads and transient server statuses, with a finite budget.
  if([502,503,504].includes(response.status) && attempt+1<attempts){await response.body?.cancel();await delay(2000);continue;}
  assert.equal(response.status,200,`${path}: HTTP ${response.status}`);
  return response;
 }
}
let health;
for(let attempt=0;attempt<5;attempt++){
 try{
  health=await(await get('/health')).json();assert.equal(health.status,'ok');
  if(expected)assert.equal(health.commit,expected,'Deployed commit does not match the checked commit');
  break;
 }catch(error){if(attempt===4)throw error;await delay(2000);}
}
const page=await get('/');
assert.ok(page.headers.get('Content-Security-Policy'));
const noindex=page.headers.get('X-Robots-Tag')?.includes('noindex') || false;
assert.equal(noindex,process.env.EXPECT_NOINDEX==='true','Unexpected search indexing policy');
const html=await page.text();
assert.match(html,/<h1/);assert.match(html,/https:\/\/discord.gg\/5wa9CASXd/);
const images=[...html.matchAll(/<meta property="og:image" content="([^"]+)"/g)];
assert.deepEqual(images.map(match=>match[1]),[new URL('/social/share-v3.png',base).href]);
const data=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
assert.ok(data['@graph'].some(node=>node['@type']==='Organization'));
await Promise.all(['style.css','app.js','social/share-v3.png','apple-touch-icon.png','site.webmanifest'].map(async path=>{
 const [response,local]=await Promise.all([get('/'+path),readFile(new URL('../dist/'+path,import.meta.url))]);
 const remote=Buffer.from(await response.arrayBuffer());
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(remote),sha(local),`Deployed ${path} differs from the checked source`);
 assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff',`Missing static security header for ${path}`);
 assert.ok(response.headers.get('Content-Security-Policy'),`Missing static CSP for ${path}`);
}));
assert.match(await(await get('/robots.txt')).text(),/Allow: \//);
assert.ok((await(await get('/sitemap.xml')).text()).includes(new URL('/',base).href));
assert.ok((await(await get('/llms.txt')).text()).includes(new URL('/api/next-event',base).href));
assert.match((await get('/index.md')).headers.get('Content-Type'),/text\/markdown/);
const porch=await(await get('/api/porch',10)).json();
assert.ok(Number.isSafeInteger(porch.off) && porch.off>=0 && Number.isSafeInteger(porch.on) && porch.on>=0);
const api=await fetch(new URL('/api/next-event',base),{headers:{'User-Agent':'OrlandoHomeAssistant-Smoke/1.0'},signal:AbortSignal.timeout(12000)});
const next=await api.json();
assert.ok(api.status===200 || (api.status===503 && next.unavailable===true));
if(api.status===200 && next.event){
 assert.ok(Date.parse(next.event.end)>Date.now());
 assert.ok(['luma.com','lu.ma'].includes(new URL(next.event.url).hostname));
}
console.log(`Smoke checks passed: commit ${health.commit}; page, exact asset hashes, sharing metadata, crawler endpoints and Luma availability handling.`);
