import { NextResponse } from 'next/server';
import { cacheControlFor, isNullBodyStatus, resolveUpstream, rewriteTileJson } from '@/lib/mapbox-proxy';

export const runtime = 'nodejs';

/**
 * Mapbox proxy (ADR-0001). The browser never receives a credential: Mapbox GL
 * rewrites every request here via transformRequest, and the token is attached
 * server-side from MAPBOX_TOKEN.
 *
 * A pass-through, not a cache. Requests still reach Mapbox and are still billed
 * to the token's account; the long s-maxage keeps panning on the CDN rather than
 * spending a function invocation per tile.
 */
export async function GET(request: Request) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'MAPBOX_TOKEN is not configured on this deployment' }, { status: 503 });
  }

  const resolved = resolveUpstream(new URL(request.url).searchParams.get('u'), token);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.reason }, { status: 400 });
  }

  try {
    const upstream = await fetch(resolved.url, {
      headers: { 'user-agent': 'gocamp/2.0 (+https://gocamp-us.vercel.app)' },
    });
    const contentType = upstream.headers.get('content-type') ?? '';
    const headers = new Headers();
    headers.set('cache-control', cacheControlFor(resolved.url.pathname));
    if (contentType) headers.set('content-type', contentType);

    // A body of any kind is refused on these statuses, an empty one included, so
    // a successful upstream call would otherwise be caught below and answered 502.
    if (isNullBodyStatus(upstream.status)) {
      return new NextResponse(null, { status: upstream.status, headers });
    }

    // A TileJSON body names the tile URLs and Mapbox writes the account token into
    // every one of them, so a text body is rewritten rather than streamed (ADR-0001).
    // The path decides alongside the content type: an error path answering a .json
    // request as text/plain would otherwise stream the token straight through, and
    // that is the one case this is here to make impossible.
    if (/\b(?:json|text|xml)\b/i.test(contentType) || resolved.url.pathname.endsWith('.json')) {
      const rewritten = rewriteTileJson(await upstream.text(), publicOrigin(request), token);
      // The rewritten tile URLs name this deployment's own origin, so a shared cache
      // must not hand one host's body to another.
      headers.set('vary', 'Host');
      // The validators describe the upstream body, not the one we return, so they go.
      return new NextResponse(rewritten, { status: upstream.status, headers });
    }

    for (const key of ['etag', 'last-modified']) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers });
  } catch (error) {
    return NextResponse.json(
      { error: 'upstream request failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}

/**
 * The origin the browser will use to reach this deployment.
 *
 * It is baked into the rewritten tile templates, so it has to be reachable from
 * the client rather than from the server. On Vercel, Next trusts the Host header
 * and `request.url` already carries the public origin. A self-hosted `next start`
 * behind a TLS-terminating proxy does not: there `request.url` is the bind address,
 * and every tile template would come out pointing at localhost. PUBLIC_ORIGIN is
 * the override for that shape.
 */
function publicOrigin(request: Request): string {
  const configured = process.env.PUBLIC_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(request.url).origin;
}
