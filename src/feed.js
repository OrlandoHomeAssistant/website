import ICAL from 'ical.js';

export const CALENDAR_URL = 'https://luma.com/orlandohomeassistant';
export const REFRESH_MS = 15 * 60 * 1000;
export const MAX_STALE_MS = 24 * 60 * 60 * 1000;

export function eventLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && ['luma.com', 'lu.ma'].includes(url.hostname) && !url.username && !url.password) return url.href;
  } catch { /* Missing or unsafe link: use the group calendar. */ }
  return null;
}

export function parseFeed(text) {
  if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error('Invalid calendar');
  const calendar = new ICAL.Component(ICAL.parse(text));
  const revisions = new Map();
  for (const component of calendar.getAllSubcomponents('vevent')) {
    // Calendar subscriptions currently publish discrete events. Do not silently
    // misrepresent a recurrence rule if the upstream format changes.
    if (component.hasProperty('rrule') || component.hasProperty('recurrence-id')) continue;
    const event = new ICAL.Event(component);
    const uid = event.uid;
    if (!uid) continue;
    const sequence = Number(component.getFirstPropertyValue('sequence') || 0);
    const previous = revisions.get(uid);
    if (previous && previous.sequence > sequence) continue;
    const status = String(component.getFirstPropertyValue('status') || '').toUpperCase();
    const description = String(event.description || '');
    const url = eventLink(String(component.getFirstPropertyValue('url') || '')) ||
      eventLink(description.match(/https:\/\/(?:luma\.com|lu\.ma)\/[^\s<>]+/)?.[0] || '') || CALENDAR_URL;
    const start = event.startDate?.toJSDate().getTime();
    const end = event.endDate?.toJSDate().getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    revisions.set(uid, {
      id: uid, sequence, cancelled: status === 'CANCELLED',
      title: String(event.summary || 'Orlando Home Assistant meetup').slice(0, 220),
      start: new Date(start).toISOString(), end: new Date(end).toISOString(),
      allDay: event.startDate.isDate,
      location: String(event.location || '').slice(0, 500), url,
    });
  }
  return [...revisions.values()].filter(event => !event.cancelled)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function nextEvent(events, now = Date.now()) {
  return events.find(event => Date.parse(event.end) > now) || null;
}

export function selectSnapshot(snapshot, now = Date.now()) {
  if (!snapshot || now - snapshot.fetchedAt > MAX_STALE_MS) return null;
  return { event: nextEvent(snapshot.events, now), fetchedAt: snapshot.fetchedAt,
    stale: now - snapshot.fetchedAt >= REFRESH_MS };
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

export function renderMeetup(result) {
  const event = result?.event;
  if (!event) {
    const message = result ? 'The next meetup is in the works.' : 'Find the latest meetup on Luma.';
    return `<div class="meetup-empty"><h3 id="meetup-title">${message}</h3><p>${result ? 'Follow the Orlando calendar for the next date, or join us on Discord in the meantime.' : 'We couldn’t refresh the calendar just now. Check Luma for the current date and details.'}</p><div class="actions"><a class="button citrus" href="${CALENDAR_URL}">Open the Orlando calendar</a><a href="https://discord.gg/5wa9CASXd">Join Discord</a></div></div>`;
  }
  const date = new Date(event.start), end = new Date(event.end);
  const zone = { timeZone: 'America/New_York' };
  const format = (options) => new Intl.DateTimeFormat('en-US', {...zone, ...options}).format(date);
  const inProgress = date.getTime() <= Date.now();
  const time = event.allDay ? 'All day' : new Intl.DateTimeFormat('en-US', {...zone, hour:'numeric', minute:'2-digit'}).formatRange(date, end);
  const title = event.title.replace(/^Orlando Home Assistant Meetup\s*:\s*/i, '');
  const location = event.location || 'Location details on Luma';
  const map = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location);
  return `<div class="date-block"><span>${inProgress ? 'Happening now' : 'Next meetup'}</span><time datetime="${escapeHtml(event.start)}"><span>${format({month:'short'})}</span><strong>${format({day:'2-digit'})}</strong><span>${format({weekday:'long'})}, ${format({year:'numeric'})}</span></time><a class="date-calendar" href="${CALENDAR_URL}">Orlando on Luma</a></div>
  <div class="event-details"><div class="event-top"><span class="event-type">Orlando community meetup</span></div><h3 id="meetup-title">${escapeHtml(title)}</h3><p>Meet local Home Assistant users and smart home tinkerers. Find the agenda, registration details, and latest updates on Luma.</p><div class="event-meta"><div><strong>${escapeHtml(time)}</strong><span>Orlando time (Eastern)</span></div><div><strong>${escapeHtml(location.split(',')[0])}</strong><a href="${escapeHtml(map)}">${escapeHtml(location)} ↗</a></div></div><div class="event-bottom"><a class="button citrus" href="${escapeHtml(event.url)}">Details & RSVP on Luma <span aria-hidden="true">↗</span></a><span>${result.stale ? 'Calendar sync delayed. Confirm details on Luma.' : 'Updated automatically from Luma'}</span></div></div>`;
}
