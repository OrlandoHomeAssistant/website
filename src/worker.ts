export { PorchCounter } from './porch-counter';
import { robots, sitemap, agentGuide, markdownPage, structuredData } from './discovery.js';
import { parseFeed, selectSnapshot, renderMeetup, REFRESH_MS } from './feed.js';

async function readBounded(response: Pick<Response, 'body'>, maxBytes = 512 * 1024): Promise<string> {
  if (!response.body) throw new Error('Empty feed');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new RangeError('Body too large'); }
      text += decoder.decode(value, {stream: true});
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

async function calendar(request: Request, env: Env, ctx: ExecutionContext) {
  const key = new Request(new URL('/__calendar-cache-v1', request.url));
  const cached = await caches.default.match(key);
  const snapshot = cached ? await cached.json<{events: ReturnType<typeof parseFeed>; fetchedAt: number}>() : null;
  const current = selectSnapshot(snapshot);
  if (current && Date.now() - current.fetchedAt < REFRESH_MS) return current;
  try {
    const response = await fetch(env.LUMA_ICAL_URL, {
      headers: {Accept: 'text/calendar'}, signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
    const events = parseFeed(await readBounded(response));
    const fresh = {events, fetchedAt: Date.now()};
    ctx.waitUntil(caches.default.put(key, Response.json(fresh, {headers: {'Cache-Control':'public, max-age=86400'}})));
    return selectSnapshot(fresh);
  } catch (error) {
    console.warn(JSON.stringify({event:'calendar_refresh_failed',message:error instanceof Error ? error.message : 'Unknown error',cached:!!current}));
    return current;
  }
}

function headers(response: Response) {
  const result = new Response(response.body, response);
  result.headers.set('X-Robots-Tag', 'index, follow, max-image-preview:large');
  result.headers.set('X-Content-Type-Options','nosniff');
  result.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  result.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  result.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  return result;
}

async function porch(request: Request, env: Env): Promise<Response> {
  const reply = (data: unknown, status = 200) => headers(Response.json(data, {status, headers:{'Cache-Control':'no-store'}}));
  if (!['GET','HEAD','POST'].includes(request.method)) return headers(new Response('Method not allowed', {status:405, headers:{Allow:'GET, HEAD, POST'}}));
  if (request.method === 'POST') {
    const origin = request.headers.get('Origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return reply({error:'Same-origin requests only'},403);
    if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return reply({error:'Use application/json'},415);
    let action: unknown;
    try { action = JSON.parse(await readBounded(request,256)); }
    catch (error) { return reply({error:'Invalid action'},error instanceof RangeError ? 413 : 400); }
    const value = action as {direction?:unknown; id?:unknown} | null;
    if (!value || (value.direction !== 'off' && value.direction !== 'on') || typeof value.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)) return reply({error:'Invalid action'},400);
    try {
      const result = await env.PORCH_COUNTER.getByName('orlando-porch-v1').record(value.direction as 'off'|'on',value.id);
      return result.ok ? reply(result.counts) : reply({error:'Action ID already used for another direction'},409);
    } catch {
      console.warn(JSON.stringify({event:'porch_counter_unavailable'}));
      return reply({error:'Community counts temporarily unavailable'},503);
    }
  }
  try {
    const counts = await env.PORCH_COUNTER.getByName('orlando-porch-v1').read();
    const response = reply(counts);
    return request.method === 'HEAD' ? new Response(null,response) : response;
  } catch {
    return reply({error:'Community counts temporarily unavailable'},503);
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/porch') return porch(request,env);
    if (!['GET','HEAD'].includes(request.method)) return headers(new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}}));
    const text = (body: string, type = 'text/plain; charset=utf-8') => headers(new Response(body, {headers:{'Content-Type':type,'Cache-Control':'public, max-age=900'}}));
    if (url.pathname === '/health') return headers(Response.json({status:'ok',commit:env.BUILD_SHA},{headers:{'Cache-Control':'no-store'}}));
    if (url.pathname === '/robots.txt') return text(robots(url.origin));
    if (url.pathname === '/sitemap.xml') return text(sitemap(url.origin), 'application/xml; charset=utf-8');
    if (url.pathname === '/llms.txt') return text(agentGuide(url.origin));
    if (url.pathname === '/index.md') {
      const result = await calendar(request, env, ctx);
      const response = text(markdownPage(url.origin, result), 'text/markdown; charset=utf-8');
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    if (url.pathname === '/api/next-event') {
      const result = await calendar(request,env,ctx);
      return headers(Response.json(result || {event:null,unavailable:true},{status:result?200:503,headers:{'Cache-Control':'no-store'}}));
    }
    if (url.pathname === '/__calendar-cache-v1') return headers(new Response('Not found',{status:404}));
    const asset = await env.ASSETS.fetch(request);
    if (url.pathname !== '/' && url.pathname !== '/index.html') return headers(asset);
    if (asset.status !== 200) return headers(asset);
    const result = await calendar(request,env,ctx);
    const html = new HTMLRewriter().on('#meetup-ticket', {
      element(element) { element.setInnerContent(renderMeetup(result), {html:true}); },
    }).on('.hero-copy .text-link', {
      element(element) {
        if (result?.event) {
          const date = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',month:'short',day:'numeric'}).format(new Date(result.event.start));
          element.setInnerContent(`Next meetup: ${date}`);
        }
      },
    }).on('head', {
      element(element) { element.append(`<script type="application/ld+json">${structuredData(url.origin, result)}</script>`, {html:true}); },
    }).on('meta[property="og:url"]', {
      element(element) { element.setAttribute('content', new URL('/', request.url).href); },
    }).on('meta[property="og:image"], meta[name="twitter:image"]', {
      element(element) {
        const image = element.getAttribute('content');
        if (image) element.setAttribute('content', new URL(new URL(image).pathname, request.url).href);
      },
    }).transform(asset);
    const response = headers(html);
    response.headers.set('Cache-Control','no-store');
    response.headers.delete('Content-Length');
    response.headers.delete('ETag');
    return request.method === 'HEAD' ? new Response(null, response) : response;
  },
} satisfies ExportedHandler<Env>;
