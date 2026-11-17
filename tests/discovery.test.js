import {test} from 'node:test';
import assert from 'node:assert/strict';
import {robots,sitemap,agentGuide,markdownPage,structuredData} from '../src/discovery.js';
const origin='https://community.example';
const result={stale:false,event:{title:'A meetup </script><script>bad</script>',start:'2027-01-09T14:00:00.000Z',end:'2027-01-09T17:00:00.000Z',location:'Stardust Video & Coffee, Orlando, FL',url:'https://luma.com/qpe49nll'}};
test('crawler discovery permits access and advertises the serving origin',()=>{
 assert.match(robots(origin),/User-agent: \*\nAllow: \//);assert.doesNotMatch(robots(origin),/Disallow/);
 assert.ok(robots(origin).includes(origin+'/sitemap.xml'));
 assert.ok(sitemap(origin).includes('<loc>'+origin+'/</loc>'));
 assert.ok(agentGuide(origin).includes(origin+'/api/next-event'));
 assert.ok(agentGuide(origin).includes('stale=true'));
});
test('structured event data matches the feed without adding unverified prices',()=>{
 const text=structuredData(origin,result);assert.ok(!text.includes('</script>'));
 const data=JSON.parse(text),event=data['@graph'].find(item=>item['@type']==='Event');
 assert.equal(event.name,result.event.title);assert.equal(event.startDate,result.event.start);assert.equal(event.url,result.event.url);
 assert.equal(event.location.address,result.event.location);assert.ok(!('offers' in event));
 assert.ok(!JSON.parse(structuredData(origin,{event:null}))['@graph'].some(item=>item['@type']==='Event'));
});
test('Markdown distinguishes an empty calendar from unavailable upstream data',()=>{
 assert.ok(markdownPage(origin,result).includes(result.event.start));
 assert.match(markdownPage(origin,{event:null}),/No upcoming event/);
 assert.match(markdownPage(origin,null),/temporarily unavailable/);
});
