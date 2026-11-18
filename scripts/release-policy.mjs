import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
export function validateRelease(tag,release,context) {
 assert.match(tag || '',/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,'Only stable vMAJOR.MINOR.PATCH tags can deploy');
 assert.equal(release.tagName,tag,'Release tag mismatch');
 assert.equal(release.isDraft,false,'Draft releases cannot deploy');
 assert.equal(release.isPrerelease,false,'Prereleases cannot deploy');
 assert.ok(Number.isFinite(Date.parse(release.publishedAt)),'Release must be published');
 assert.equal(context.ref,'refs/tags/'+tag,'Run this workflow from the release tag');
 assert.equal(context.sha,context.tagSha,'The workflow and tag must refer to the same commit');
 assert.equal(context.isOnMain,true,'Release commit must already belong to main');
 return context.tagSha;
}
if(import.meta.main) {
 const tag=process.env.RELEASE_TAG;
 // Validate the name before passing it to another process or constructing a ref.
 assert.match(tag || '',/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 const tagSha=git('rev-parse','--verify',`refs/tags/${tag}^{commit}`);
 let isOnMain=true;
 try{git('merge-base','--is-ancestor',tagSha,'origin/main');}catch{isOnMain=false;}
 const release=JSON.parse(execFileSync('gh',['release','view',tag,'--repo',process.env.GITHUB_REPOSITORY,'--json','tagName,isDraft,isPrerelease,publishedAt'],{encoding:'utf8'}));
 const sha=validateRelease(tag,release,{ref:process.env.GITHUB_REF,sha:process.env.GITHUB_SHA,tagSha,isOnMain});
 appendFileSync(process.env.GITHUB_OUTPUT,`sha=${sha}\ntag=${tag}\n`);
 console.log(`Verified published release ${tag} at ${sha}, already on main.`);
}
