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

export { ALLOWED_PREFIXES, ALLOWED_QUERY, UPSTREAM_HOSTS };
