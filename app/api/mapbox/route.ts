import { NextResponse } from 'next/server';
import { resolveUpstream } from '@/lib/mapbox-proxy';

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
      headers: { 'user-agent': 'rockies-line/2.0 (+https://rockies-line.vercel.app)' },
    });
    const body = await upstream.arrayBuffer();
    const headers = new Headers();
    for (const key of ['content-type', 'etag', 'last-modified']) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }
    headers.set('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    return new NextResponse(body, { status: upstream.status, headers });
  } catch (error) {
    return NextResponse.json(
      { error: 'upstream request failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
