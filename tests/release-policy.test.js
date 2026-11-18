import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRelease} from '../scripts/release-policy.mjs';
const release={tagName:'v1.0.0',isDraft:false,isPrerelease:false,publishedAt:'2026-11-18T12:00:00Z'};
const context={ref:'refs/tags/v1.0.0',sha:'a'.repeat(40),tagSha:'a'.repeat(40),isOnMain:true};
test('a published stable release on main resolves to the exact tagged SHA',()=>{
 assert.equal(validateRelease('v1.0.0',release,context),context.sha);
});
test('drafts, prereleases and malformed or mismatched tags cannot deploy',()=>{
 for(const tag of ['v1.0.0-rc.1','main','v01.0.0','v1.0','--help','v1.0.0\nsha=bad'])assert.throws(()=>validateRelease(tag,release,context));
 for(const change of [{isDraft:true},{isPrerelease:true},{publishedAt:null},{tagName:'v2.0.0'}])assert.throws(()=>validateRelease('v1.0.0',{...release,...change},context));
});
test('off-main commits, changed tags and branch-dispatched runs cannot access deployment',()=>{
 for(const change of [{isOnMain:false},{sha:'b'.repeat(40)},{ref:'refs/heads/main'}])assert.throws(()=>validateRelease('v1.0.0',release,{...context,...change}));
});
