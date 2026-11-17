# Orlando Home Assistant

A fast, responsive community landing page for Central Florida Home Assistant users. Join the conversation on [Discord](https://discord.gg/5wa9CASXd) and organize meetups on [Luma](https://luma.com/orlandohomeassistant).

## Development

Requires a current Node.js LTS release.

```sh
npm ci
npm run dev
npm test
npm run typecheck
```

The page uses plain HTML/CSS, self-hosted Figtree, original SVG artwork, and system light/dark mode. A small Cloudflare Worker renders the next meetup from the public Orlando calendar feed. No Luma API key, paid plan, visitor account, or browser-side Luma request is needed.

## How the meetup stays current

`wrangler.jsonc` contains the public iCal subscription URL, discovered through the Orlando calendar’s **Add iCal Subscription** button. Create or edit published events on that Luma calendar; no website edits or deployments are required for event updates.

Each Cloudflare location caches a successful feed for 15 minutes and retains it for up to 24 hours as an outage fallback. Refresh happens on a page/API request, rather than an unattended scheduled task. Ended and cancelled events are excluded; in-progress events stay visible until they end. No upcoming event produces a calendar/Discord invitation. If a refresh fails, recent cached data is used with a visible notice. If it is too old or unavailable, the page directs visitors to Luma.

Luma's feed includes title, start/end, venue, and an RSVP URL, but not the full agenda, ticket price, or complete event description. The page links to Luma for these details. This integration supports the calendar's current discrete-event format; recurring VEVENT rules are intentionally excluded rather than displaying an incorrect date. Time is shown in America/New_York, including daylight saving time. Use individual Luma events for each meetup.

`GET /api/next-event` exposes only the selected public event, refresh time, and stale status. Organizer email addresses are never returned. Data is parsed with `ical.js`, text is HTML-escaped, and RSVP links are restricted to Luma hosts.

## Deployment

```sh
npx wrangler login
npm run deploy:dev
```

The only configured deployment is `orlando-home-assistant-dev` on `workers.dev`. All responses have `X-Robots-Tag: noindex, nofollow`; `robots.txt` disallows crawling. This discourages indexing, but the dev URL is public, not access-protected.

There are no zone routes or custom domains in the configuration. **Keep the existing homeassistantorlando.org redirect unchanged until the production cutover is explicitly authorized.**

Future automated deployment should use a scoped Cloudflare API token in GitHub Actions secrets or a Cloudflare Git integration. No credentials belong in this repo.

## Contributions and assets

Use pull requests for changes. Run the tests, type check, and a Wrangler dry run before merging. Check long event titles and venue addresses at narrow mobile widths, both themes, and keyboard navigation. Tests cover the real feed format, event order, cancellations, expiry, stale fallback, and safe rendering.

Code and original SVG implementation are MIT licensed. The fountain-house brand rendition is based on artwork supplied by the organizers. Figtree is distributed under its included SIL Open Font License (`dist/Figtree-OFL.txt`). The community is independent and is not affiliated with the Open Home Foundation.
