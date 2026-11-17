import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deletePreview} from '../scripts/delete-preview.mjs';
const env={CLOUDFLARE_ACCOUNT_ID:'1'.repeat(32),CLOUDFLARE_API_TOKEN:'unit-test-only'};
test('cleanup targets only the named disposable preview under this Worker',async()=>{
 const removed=await deletePreview('12',env,async(url,options)=>{
  assert.equal(url,`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/workers/orlando-home-assistant-dev/previews/pr-12`);
  assert.equal(options.method,'DELETE');assert.equal(options.headers.Authorization,'Bearer unit-test-only');
  return Response.json({success:true});
 });assert.equal(removed,true);
});
test('cleanup rejects invalid PR names and absent credentials before making a request',async()=>{
 const never=()=>{assert.fail('Must not send a request');};
 for(const pr of ['0','-1','main','../dev','12/foo','1e2',undefined])await assert.rejects(deletePreview(pr,env,never),/Invalid PR/);
 await assert.rejects(deletePreview('12',{},never),/credentials/);
});
test('cleanup tolerates an absent preview but surfaces authorization and service failures',async()=>{
 assert.equal(await deletePreview('12',env,async()=>new Response(null,{status:404})),false);
 for(const status of [401,403,500])await assert.rejects(deletePreview('12',env,async()=>new Response(null,{status})),/cleanup failed/);
 await assert.rejects(deletePreview('12',env,async()=>Response.json({success:false})),/cleanup failed/);
});
