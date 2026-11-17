import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFeed, nextEvent, selectSnapshot, renderMeetup, eventLink, MAX_STALE_MS } from '../src/feed.js';
const wrap = (...events) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR`;
const event = (id, date, extra='') => `BEGIN:VEVENT\r\nUID:${id}\r\nDTSTART:202701${date}T140000Z\r\nDTEND:202701${date}T170000Z\r\nSUMMARY:Test event\r\n${extra}\r\nEND:VEVENT`;
test('real Luma fixture unfolds description and extracts RSVP, time, and venue', () => {
 const events=parseFeed(readFileSync(new URL('./orlando.ics',import.meta.url),'utf8'));
 assert.equal(events.length,1);assert.equal(events[0].url,'https://luma.com/qpe49nll');
 assert.equal(events[0].start,'2027-01-09T14:00:00.000Z');assert.match(events[0].location,/1842 Winter Park Rd/);
});
test('selects earliest remaining meetup; retains in-progress events and expires finished ones', () => {
 const events=parseFeed(wrap(event('later','23'),event('first','09')));
 assert.equal(nextEvent(events,Date.parse('2027-01-09T15:00Z')).id,'first');
 assert.equal(nextEvent(events,Date.parse('2027-01-09T17:00Z')).id,'later');
 assert.equal(nextEvent(events,Date.parse('2027-02-01T00:00Z')),null);
});
test('a newer cancellation supersedes an earlier event revision', () => {
 const events=parseFeed(wrap(event('a','09','SEQUENCE:1'),event('a','09','SEQUENCE:2\r\nSTATUS:CANCELLED')));
 assert.equal(events.length,0);
});
test('stale cache never resurfaces ended events or data older than 24 hours', () => {
 const now=Date.parse('2027-01-10T00:00Z');const events=parseFeed(wrap(event('a','09')));
 assert.equal(selectSnapshot({events,fetchedAt:now-3600000},now).event,null);
 assert.equal(selectSnapshot({events,fetchedAt:now-MAX_STALE_MS-1},now),null);
});
test('rejects unsafe links and escapes event content in rendered HTML', () => {
 assert.equal(eventLink('javascript:alert(1)'),null);assert.equal(eventLink('https://luma.com.evil.test/x'),null);
 const e=parseFeed(wrap(event('a','09','URL:javascript:alert(1)')))[0];e.title='<script>bad</script>';
 assert.match(renderMeetup({event:e,stale:false}),/&lt;script&gt;/);assert.doesNotMatch(renderMeetup({event:e,stale:false}),/<script>/);
});
test('invalid upstream content fails rather than looking like an empty calendar', () => {
 assert.throws(()=>parseFeed('<html>upstream failed</html>'));
 assert.match(renderMeetup(null),/couldn’t refresh/);assert.match(renderMeetup({event:null}),/in the works/);
});
