/**
 * Mapbox proxy.
 *
 * The browser never receives a Mapbox credential. Mapbox GL is configured with
 * `transformRequest` so every style, sprite, glyph, tile and terrain request is
 * rewritten to this endpoint, which appends the token server-side from the
 * MAPBOX_TOKEN environment variable and streams the upstream response back.
 *
 * This is a pass-through, not a cache: every request still reaches Mapbox and is
 * still billed to the account that owns the token. It exists to keep the
 * credential off the client, not to avoid metering.
 *
 * The endpoint is deliberately narrow. An open proxy that forwards anything with
 * your token attached is the same leak wearing a different hat, so the upstream
 * URL is rebuilt from an allow-listed host and path prefix rather than taken from
 * the caller.
 */

const UPSTREAM_HOSTS = new Set(['api.mapbox.com', 'events.mapbox.com']);

// Path prefixes the map legitimately needs. Anything else is refused.
const ALLOWED_PREFIXES = [
  '/styles/v1/',        // style documents, sprites, glyph ranges
  '/fonts/v1/',         // glyph PBFs
  '/v4/',               // raster and terrain-RGB tiles
  '/raster/v1/',
  '/rasterarrays/v1/',
  '/map-sessions/',     // GL JS session tracking
  '/models/v1/',        // 3D models used by standard styles
];

// Query keys forwarded upstream. The token is added here, never accepted from the caller.
const ALLOWED_QUERY = new Set([
  'sku', 'optimize', 'events', 'fresh', 'style', 'limit', 'language', 'worldview',
  'start', 'end', 'quality', 'setfilter', 'layer_id', 'filter',
]);

function badRequest(res, message) {
  res.statusCode = 400;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message }));
}

export default async function handler(req, res) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'MAPBOX_TOKEN is not configured on this deployment' }));
    return;
  }

  const incoming = new URL(req.url, 'http://localhost');
  const target = incoming.searchParams.get('u');
  if (!target) return badRequest(res, 'missing u parameter');

  let upstream;
  try {
    upstream = new URL(target);
  } catch {
    return badRequest(res, 'u is not a valid URL');
  }

  if (upstream.protocol !== 'https:' || !UPSTREAM_HOSTS.has(upstream.hostname)) {
    return badRequest(res, 'host not allowed');
  }
  if (!ALLOWED_PREFIXES.some((p) => upstream.pathname.startsWith(p))) {
    return badRequest(res, 'path not allowed');
  }

  // Rebuild the query from scratch so a caller cannot smuggle parameters through.
  const clean = new URL(`https://${upstream.hostname}${upstream.pathname}`);
  for (const [key, value] of upstream.searchParams) {
    if (ALLOWED_QUERY.has(key)) clean.searchParams.set(key, value);
  }
  clean.searchParams.set('access_token', token);

  try {
    const upstreamRes = await fetch(clean, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: { 'user-agent': 'rockies-line/1.0 (+https://rockies-line.vercel.app)' },
    });

    res.statusCode = upstreamRes.status;
    const passthrough = ['content-type', 'content-length', 'etag', 'last-modified'];
    for (const header of passthrough) {
      const value = upstreamRes.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    // Tiles and glyphs are immutable for a given URL; let the CDN and browser hold them
    // so a pan does not become a function invocation storm.
    res.setHeader('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');

    if (req.method === 'HEAD' || upstreamRes.status === 204) {
      res.end();
      return;
    }

    const body = Buffer.from(await upstreamRes.arrayBuffer());
    res.end(body);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'upstream request failed', detail: String(err && err.message) }));
  }
}
