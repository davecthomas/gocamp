/**
 * Upstream URL policy for the Mapbox proxy (ADR-0001).
 *
 * Kept separate from the route handler so it can be tested directly. An open proxy
 * carrying the account's token is the same leak in a different shape, so the
 * upstream URL is rebuilt from an allow list rather than taken from the caller.
 */

const UPSTREAM_HOSTS = new Set(['api.mapbox.com', 'events.mapbox.com']);

/** Path prefixes the map legitimately needs. Anything else is refused. */
const ALLOWED_PREFIXES = [
  '/styles/v1/',
  '/fonts/v1/',
  '/v4/',
  '/raster/v1/',
  '/rasterarrays/v1/',
  '/map-sessions/',
  '/models/v1/',
] as const;

/** Query keys forwarded upstream. A token is never accepted from the caller. */
const ALLOWED_QUERY = new Set([
  'sku',
  'secure',
  'optimize',
  'events',
  'fresh',
  'style',
  'limit',
  'language',
  'worldview',
  'start',
  'end',
  'quality',
  'setfilter',
  'layer_id',
  'filter',
]);

export type ResolveResult = { ok: true; url: URL } | { ok: false; reason: string };

/**
 * Validates a requested upstream URL and rebuilds it with the token attached.
 * Returns a reason rather than throwing, so the caller decides the status code.
 */
export function resolveUpstream(target: string | null, token: string): ResolveResult {
  if (!target) return { ok: false, reason: 'missing u parameter' };

  let requested: URL;
  try {
    requested = new URL(target);
  } catch {
    return { ok: false, reason: 'u is not a valid URL' };
  }

  if (requested.protocol !== 'https:') return { ok: false, reason: 'https required' };
  if (!UPSTREAM_HOSTS.has(requested.hostname)) return { ok: false, reason: 'host not allowed' };
  if (!ALLOWED_PREFIXES.some((prefix) => requested.pathname.startsWith(prefix))) {
    return { ok: false, reason: 'path not allowed' };
  }

  // Rebuilt from scratch: a caller cannot smuggle parameters, including a token, through.
  const clean = new URL(`https://${requested.hostname}${requested.pathname}`);
  for (const [key, value] of requested.searchParams) {
    if (ALLOWED_QUERY.has(key)) clean.searchParams.set(key, value);
  }
  clean.searchParams.set('access_token', token);
  return { ok: true, url: clean };
}

/** Path the browser calls. Tile templates in a rewritten TileJSON point back here. */
export const PROXY_PATH = '/api/mapbox';

/**
 * The session endpoint GL JS calls to account for a map load.
 *
 * It builds this URL from its own config and fetches it directly, so transformRequest
 * never sees it and it has to be recognised by prefix instead. Already covered by
 * ALLOWED_PREFIXES, so the proxy answers it once the request arrives.
 */
export const MAPBOX_SESSION_PREFIX = 'https://api.mapbox.com/map-sessions/';

/** Hosts Mapbox names inside a TileJSON body. The legacy a/b shards are http-only. */
const TILE_HOSTS = /^(?:[a-d]\.)?tiles\.mapbox\.com$|^api\.mapbox\.com$/;

/**
 * `{z}`, `{x}` and `{y}` have to survive percent-encoding. GL JS substitutes them
 * with a plain string replace over the whole URL, so an encoded brace never matches
 * and the tile request goes out with the placeholder still in it.
 */
const keepPlaceholders = (value: string) => value.replace(/%7B/gi, '{').replace(/%7D/gi, '}');

/**
 * Points one TileJSON tile template back at the proxy, or returns null if the host
 * is not one Mapbox serves tiles from.
 */
export function proxiedTileTemplate(raw: string, origin: string): string | null {
  let upstream: URL;
  try {
    upstream = new URL(raw);
  } catch {
    return null;
  }
  if (!TILE_HOSTS.test(upstream.hostname)) return null;

  // TileJSON still hands back http:// on the a/b shards, which an https page blocks
  // as mixed content and which transformRequest would not recognise as ours to rewrite.
  upstream.protocol = 'https:';
  upstream.hostname = 'api.mapbox.com';
  upstream.searchParams.delete('access_token');

  // Only rewrite what resolveUpstream would go on to accept. The two allow lists
  // are otherwise free to drift: a style naming a path outside ALLOWED_PREFIXES
  // would have its working URL replaced by one the proxy itself answers 400 to,
  // and the layer would silently never draw. Leaving the entry alone keeps a URL
  // that at least works, and the caller scrubs the token from it either way.
  if (!ALLOWED_PREFIXES.some((prefix) => upstream.pathname.startsWith(prefix))) return null;

  const target = keepPlaceholders(upstream.toString());
  return `${origin}${PROXY_PATH}?u=${keepPlaceholders(encodeURIComponent(target))}`;
}

/**
 * Last line of defence: no body the proxy returns may carry the token, whatever
 * shape upstream chose to put it in.
 */
export function scrubToken(body: string, token: string): string {
  return token ? body.split(token).join('proxied') : body;
}

/**
 * Rewrites a TileJSON body so the browser receives proxy URLs rather than Mapbox's.
 *
 * Mapbox embeds the account token in every entry of `tiles`, so streaming the body
 * through untouched hands the browser the exact credential the proxy exists to keep
 * from it (ADR-0001) — and the URLs it leaks are plaintext http on a host the map's
 * transformRequest does not rewrite, so the base tiles never load either.
 */
export function rewriteTileJson(body: string, origin: string, token: string): string {
  let doc: unknown;
  try {
    doc = JSON.parse(body);
  } catch {
    return scrubToken(body, token);
  }
  const tiles = (doc as { tiles?: unknown } | null)?.tiles;
  if (Array.isArray(tiles)) {
    (doc as { tiles: unknown[] }).tiles = tiles.map((entry) =>
      typeof entry === 'string' ? (proxiedTileTemplate(entry, origin) ?? entry) : entry,
    );
  }
  return scrubToken(JSON.stringify(doc), token);
}

export { ALLOWED_PREFIXES, ALLOWED_QUERY, UPSTREAM_HOSTS };
