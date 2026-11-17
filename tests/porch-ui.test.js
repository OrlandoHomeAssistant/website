import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';

const script=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
function demo(fetchResult=async()=>({ok:true,json:async()=>({off:1,on:0})})) {
 const element=()=>({hidden:true,textContent:'',children:[],attributes:{},listeners:{},
  classList:{values:new Set(),toggle(name,on){on?this.values.add(name):this.values.delete(name);},add(name){this.values.add(name);},remove(name){this.values.delete(name);}},
  setAttribute(name,value){this.attributes[name]=value;},getAttribute(name){return this.attributes[name];},
  addEventListener(name,callback){this.listeners[name]=callback;},replaceChildren(){this.children=[];},append(child){this.children.push(child);}});
 const nodes=Object.fromEntries(['porch-toggle','porch-counts','motion-toggle','motion-status','svg-state','house'].map(id=>[id,element()]));
 nodes['porch-toggle'].setAttribute('aria-pressed','true');
 const frames=[],timers=new Map(),requests=[],events={};let visible;
 const window={IntersectionObserver:true,scrollY:0,addEventListener(name,callback){events[name]=callback;}};
 runInNewContext(script,{document:{getElementById:id=>nodes[id],querySelector:()=>nodes.house,createElement:element},window,Intl,crypto:{randomUUID},AbortSignal,
  fetch:async(url,options)=>{requests.push({url,...options});return fetchResult(url,options);},
  requestAnimationFrame:callback=>frames.push(callback),setTimeout:callback=>{const id=Symbol();timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),
  IntersectionObserver:class{constructor(callback){visible=callback;}observe(){}},
 });
 return {nodes,requests,
  click:id=>nodes[id].listeners.click(),
  scroll:()=>{window.scrollY+=20;events.scroll();},
  frame:()=>{for(const callback of frames.splice(0))callback();},
  idle:()=>{for(const [id,callback] of timers){timers.delete(id);callback();}},
  hide:()=>visible([{isIntersecting:false}]),
  lights:()=>nodes['porch-toggle'].getAttribute('aria-pressed')==='true',
 };
}

test('manual click updates lights immediately and reveals action counts only after interaction',async()=>{
 const d=demo();assert.equal(d.nodes['porch-counts'].hidden,true);
 d.click('porch-toggle');assert.equal(d.lights(),false);assert.equal(d.nodes['porch-counts'].hidden,false);
 await setImmediate();assert.equal(d.requests.length,1);assert.equal(JSON.parse(d.requests[0].body).direction,'off');
 assert.match(d.nodes['porch-counts'].children[0].textContent,/off 1 time/);
});
test('motion lights up on scrolling and returns to idle without recording community clicks',()=>{
 const d=demo();d.click('motion-toggle');assert.equal(d.lights(),false);
 d.scroll();d.frame();assert.equal(d.lights(),true);d.idle();assert.equal(d.lights(),false);
 assert.equal(d.requests.length,0);assert.equal(d.nodes['porch-counts'].hidden,true);
});
test('queued motion cannot override manual lights after motion is disabled',async()=>{
 const d=demo();d.click('porch-toggle');await setImmediate();
 d.click('motion-toggle');d.scroll();d.click('motion-toggle');d.scroll();d.frame();
 assert.equal(d.lights(),false);assert.equal(d.requests.length,1);
});
test('queued motion cannot light the house after it leaves the viewport',()=>{
 const d=demo();d.click('motion-toggle');d.scroll();d.hide();d.frame();
 assert.equal(d.lights(),false);assert.equal(d.requests.length,0);
});
test('counter outage retries the same action and leaves the manual switch usable',async()=>{
 const d=demo(async()=>{throw new Error('Offline');});d.click('porch-toggle');await setImmediate();
 assert.equal(d.lights(),false);assert.equal(d.requests.length,2);
 assert.equal(JSON.parse(d.requests[0].body).id,JSON.parse(d.requests[1].body).id);
 assert.match(d.nodes['porch-counts'].textContent,/unavailable right now/);
 d.click('porch-toggle');assert.equal(d.lights(),true);await setImmediate();
});
