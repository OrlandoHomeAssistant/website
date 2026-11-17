import { CALENDAR_URL } from './feed.js';
export function robots(origin) {
 return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}
export function sitemap(origin) {
 return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`;
}
export function agentGuide(origin) {
 return `# Home Assistant Orlando\n\n> Independent, community-run Home Assistant and smart home group in Central Florida. New and experienced users are welcome. Not affiliated with the Open Home Foundation.\n\n## Community information\n\n- [Community landing page](${origin}/): server-rendered overview and next meetup; JavaScript is not required to read the information.\n- [Next meetup JSON](${origin}/api/next-event): event title, start and end in ISO 8601, venue, Luma RSVP link, fetchedAt (Unix milliseconds), and stale flag. event=null means no upcoming event. HTTP 503 with unavailable=true means the feed could not be retrieved.\n- [Plain-text community page](${origin}/index.md): community links and current meetup details in Markdown.\n- [Orlando calendar](${CALENDAR_URL}): organizer-maintained source for the full agenda, availability, prices, registrations, and changes.\n- [Discord](https://discord.gg/5wa9CASXd): community conversation.\n- [Worldwide meetups](https://luma.com/homeassistant): other Home Assistant groups.\n\n## Data freshness\n\nThe public Luma calendar feed is cached for 15 minutes per Cloudflare location and refreshed on requests. Recent cached data may be used for up to 24 hours during an upstream outage; the API reports stale=true. Ended and cancelled events are excluded. Dates on the webpage are shown in America/New_York. No personal attendee information or organizer email addresses are exposed.\n\n## Learning resources\n\n- [Getting started](https://www.home-assistant.io/getting-started/)\n- [Integrations](https://www.home-assistant.io/integrations/)\n- [Automations](https://www.home-assistant.io/docs/automation/)\n- [Global forum](https://community.home-assistant.io/)\n- [Home Assistant on Reddit](https://www.reddit.com/r/homeassistant/): the wider Home Assistant community.\n- [Homelab on Reddit](https://www.reddit.com/r/homelab/): servers, networking, and home setups.\n- [Hardware and installation](https://www.home-assistant.io/installation/): supported hardware and installation methods.\n- [Dashboards](https://www.home-assistant.io/dashboards/): build controls and views for a home.\n- [Awesome Selfhosted](https://awesome-selfhosted.net/): a directory of self-hosted software.\n- [Zigbee](https://www.home-assistant.io/integrations/zha/), [Z-Wave](https://www.home-assistant.io/integrations/zwave_js/), [Matter](https://www.home-assistant.io/integrations/matter/), and [Thread](https://www.home-assistant.io/integrations/thread/): official protocol guides. Matter can operate over Thread, Wi-Fi, or Ethernet; Thread support alone does not imply Matter support.\n`;
}
export function markdownPage(origin, result) {
 const event=result?.event;
 const meetup=event ? `## Next meetup\n\n${event.title}\n\n- Starts: ${event.start}\n- Ends: ${event.end}\n- Display timezone: America/New_York\n- Location: ${event.location || 'See Luma'}\n- Details and RSVP: ${event.url}\n- Calendar cache stale: ${result.stale}\n` : `## Next meetup\n\n${result ? 'No upcoming event is currently listed.' : 'Calendar temporarily unavailable.'} Check ${CALENDAR_URL} for current details.\n`;
 return `${agentGuide(origin).split('## Data freshness')[0]}\n${meetup}\n`;
}
export function structuredData(origin, result) {
 const organization={'@type':'Organization','@id':`${origin}/#community`,name:'Home Assistant Orlando',url:`${origin}/`,description:'Independent community-run Home Assistant and smart home group in Central Florida.',logo:`${origin}/icons/icon-512.png`,sameAs:[CALENDAR_URL,'https://discord.gg/5wa9CASXd']};
 const graph=[organization,{'@type':'WebSite','@id':`${origin}/#website`,name:'Home Assistant Orlando',url:`${origin}/`,publisher:{'@id':organization['@id']}}];
 if(result?.event) {
  const event=result.event;
  graph.push({'@type':'Event','@id':`${origin}/#next-meetup`,name:event.title,url:event.url,startDate:event.start,endDate:event.end,description:'Orlando Home Assistant community meetup. See Luma for the full agenda and registration details.',image:`${origin}/social/share-v2.png`,...(event.location ? {location:{'@type':'Place',name:event.location.split(',')[0],address:event.location}} : {})});
 }
 // JSON is embedded in an inert script element; escape HTML-sensitive characters.
 return JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/[<>&\u2028\u2029]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
}
