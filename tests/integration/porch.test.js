import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
let worker, options, storage;
const origin='https://community.test';
before(async()=>{
 storage=await mkdtemp(join(tmpdir(),'orlando-porch-test-'));
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../../src/worker.ts',import.meta.url))],bundle:true,external:['cloudflare:*'],format:'esm',platform:'browser',target:'es2022',write:false});
 options={name:'porch-test-worker',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-11-16',compatibilityFlags:['nodejs_compat'],
  durableObjects:{PORCH_COUNTER:{className:'PorchCounter',useSQLite:true}},
  bindings:{BUILD_SHA:'first-test-build'},
 };
 worker=new Miniflare({...convertV4MiniflareOptions(options),resourcePersistencePath:storage});
});
after(async()=>{await worker?.dispose();if(storage)await rm(storage,{recursive:true,force:true});});
const request=(options)=>worker.dispatchFetch(origin+'/api/porch',options);
const counts=async()=>{
 const response=await request();assert.equal(response.status,200);return response.json();
};
const click=(direction,id=randomUUID(),headers={})=>request({method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify({direction,id})});

test('reading and HEAD never increment community totals',async()=>{
 assert.deepEqual(await counts(),{off:0,on:0});
 const head=await request({method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 assert.equal(head.headers.get('Cache-Control'),'no-store');assert.deepEqual(await counts(),{off:0,on:0});
});
test('rejects cross-site, malformed, oversized and unsupported writes without changing totals',async()=>{
 assert.equal((await click('off',randomUUID(),{Origin:'https://other.test'})).status,403);
 assert.equal((await click('off',randomUUID(),{'Content-Type':'text/plain'})).status,415);
 assert.equal((await click('sideways')).status,400);
 assert.equal((await click('off','not-an-action-id')).status,400);
 assert.equal((await request({method:'POST',headers:{'Content-Type':'application/json'},body:'null'})).status,400);
 assert.equal((await request({method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(257)})).status,413);
 assert.equal((await request({method:'DELETE'})).status,405);
 assert.deepEqual(await counts(),{off:0,on:0});
});
test('simultaneous clicks are all recorded atomically',async()=>{
 const results=await Promise.all([...Array.from({length:20},()=>click('off')),...Array.from({length:15},()=>click('on'))]);
 assert.ok(results.every(response=>response.status===200));
 assert.deepEqual(await counts(),{off:20,on:15});
});
test('retrying an action is idempotent and reusing its ID for a different direction is rejected',async()=>{
 const id=randomUUID();const responses=await Promise.all(Array.from({length:8},()=>click('off',id)));
 assert.ok(responses.every(response=>response.status===200));
 assert.deepEqual(await counts(),{off:21,on:15});
 assert.equal((await click('on',id)).status,409);
 assert.deepEqual(await counts(),{off:21,on:15});
});
test('totals and retry protection survive a stopped runtime and a new build',async()=>{
 const id=randomUUID();await click('on',id);const before=await counts();
 await worker.dispose();
 worker=new Miniflare({...convertV4MiniflareOptions({...options,script:options.script+'\n// Another build',bindings:{BUILD_SHA:'second-test-build'}}),resourcePersistencePath:storage});
 assert.deepEqual(await counts(),before);
 await click('on',id);assert.deepEqual(await counts(),before);
 await click('off');assert.deepEqual(await counts(),{off:before.off+1,on:before.on});
});
