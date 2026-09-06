import { describe, expect, it } from 'vitest';
import { proxiedTileTemplate, resolveUpstream, rewriteTileJson, scrubToken } from '../lib/mapbox-proxy';

const TOKEN = 'pk.test-token-value';
const STYLE = 'https://api.mapbox.com/styles/v1/mapbox/outdoors-v12';

/**
 * ADR-0001. These are the security properties of the proxy, so they are asserted
 * rather than assumed: an open proxy carrying the account token would be the same
 * leak in a different shape.
 */
describe('mapbox proxy URL policy', () => {
  it('attaches the token to an allowed upstream', () => {
    const result = resolveUpstream(STYLE, TOKEN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url.searchParams.get('access_token')).toBe(TOKEN);
    expect(result.url.hostname).toBe('api.mapbox.com');
  });

  it('refuses a missing target', () => {
    expect(resolveUpstream(null, TOKEN)).toMatchObject({ ok: false });
    expect(resolveUpstream('', TOKEN)).toMatchObject({ ok: false });
  });

  it('refuses anything that is not a URL', () => {
    expect(resolveUpstream('not-a-url', TOKEN)).toMatchObject({ ok: false });
  });

  it('refuses hosts outside the allow list, so it cannot be used as an open proxy', () => {
    for (const url of [
      'https://example.com/',
      'https://evil.test/steal',
      'https://api.mapbox.com.evil.test/styles/v1/x',
      'https://notmapbox.com/styles/v1/mapbox/outdoors-v12',
    ]) {
      expect(resolveUpstream(url, TOKEN), url).toMatchObject({ ok: false });
    }
  });

  it('refuses plaintext', () => {
    expect(resolveUpstream('http://api.mapbox.com/styles/v1/mapbox/outdoors-v12', TOKEN)).toMatchObject({ ok: false });
  });

  it('refuses account and token endpoints even on an allowed host', () => {
    for (const path of ['/tokens/v2/someone', '/accounts/v1/someone', '/uploads/v1/someone', '/datasets/v1/someone']) {
      expect(resolveUpstream(`https://api.mapbox.com${path}`, TOKEN), path).toMatchObject({ ok: false });
    }
  });

  it('allows exactly the prefixes the map needs', () => {
    for (const path of [
      '/styles/v1/mapbox/outdoors-v12',
      '/styles/v1/mapbox/outdoors-v12/sprite@2x.png',
      '/fonts/v1/mapbox/DIN%20Offc%20Pro/0-255.pbf',
      '/v4/mapbox.mapbox-terrain-dem-v1/8/40/90.pngraw',
      '/raster/v1/x/1/2/3.png',
      '/models/v1/mapbox/tree',
    ]) {
      expect(resolveUpstream(`https://api.mapbox.com${path}`, TOKEN), path).toMatchObject({ ok: true });
    }
  });

  it('strips a token supplied by the caller and substitutes the real one', () => {
    const result = resolveUpstream(`${STYLE}?access_token=attacker-supplied`, TOKEN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url.searchParams.getAll('access_token')).toEqual([TOKEN]);
    expect(result.url.toString()).not.toContain('attacker-supplied');
  });

  it('drops query keys that are not on the allow list', () => {
    const result = resolveUpstream(`${STYLE}?sku=abc&evil=1&redirect=https%3A%2F%2Fevil.test`, TOKEN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url.searchParams.get('sku')).toBe('abc');
    expect(result.url.searchParams.has('evil')).toBe(false);
    expect(result.url.searchParams.has('redirect')).toBe(false);
  });

  it('does not carry a fragment or credentials through', () => {
    const result = resolveUpstream(`https://user:pass@api.mapbox.com/styles/v1/x#frag`, TOKEN);
    if (result.ok) {
      expect(result.url.username).toBe('');
      expect(result.url.password).toBe('');
      expect(result.url.hash).toBe('');
    }
  });

  it('allows the telemetry host the SDK uses', () => {
    expect(resolveUpstream('https://events.mapbox.com/map-sessions/v1', TOKEN)).toMatchObject({ ok: true });
  });
});

/**
 * The TileJSON body is the other half of ADR-0001. Mapbox writes the account token
 * into every entry of `tiles`, so a proxy that only guards the request URL still
 * hands the browser the credential — this is the regression that shipped.
 */
describe('mapbox proxy TileJSON rewriting', () => {
  const ORIGIN = 'https://gocamp-us.vercel.app';
  const tileJson = (tiles: string[]) => JSON.stringify({ tilejson: '2.2.0', minzoom: 0, maxzoom: 16, tiles });

  it('never lets the token through in a tile URL', () => {
    const body = tileJson([
      `http://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${TOKEN}`,
    ]);
    const out = rewriteTileJson(body, ORIGIN, TOKEN);
    expect(out).not.toContain(TOKEN);
    expect(JSON.parse(out).tiles[0]).toContain(`${ORIGIN}/api/mapbox?u=`);
  });

  it('rewrites the http shards to https on our own origin, so nothing is mixed content', () => {
    const url = proxiedTileTemplate(
      'http://b.tiles.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw?access_token=secret',
      ORIGIN,
    );
    expect(url).toBeTruthy();
    expect(url!.startsWith(`${ORIGIN}/api/mapbox?u=`)).toBe(true);
    const target = new URL(new URL(url!).searchParams.get('u')!);
    expect(target.protocol).toBe('https:');
    expect(target.hostname).toBe('api.mapbox.com');
    expect(target.searchParams.has('access_token')).toBe(false);
  });

  it('leaves the z/x/y placeholders literal, since GL JS substitutes them by string replace', () => {
    const url = proxiedTileTemplate(
      'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf',
      ORIGIN,
    )!;
    expect(url).toContain('{z}');
    expect(url).toContain('{x}');
    expect(url).toContain('{y}');
    expect(url).not.toContain('%7B');
  });

  it('produces a tile URL the proxy itself accepts once the placeholders are filled', () => {
    const template = proxiedTileTemplate(
      'http://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=secret',
      ORIGIN,
    )!;
    const filled = template.replace('{z}', '6').replace('{x}', '12').replace('{y}', '23');
    const target = new URL(filled).searchParams.get('u');
    const result = resolveUpstream(target, TOKEN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url.pathname).toBe('/v4/mapbox.mapbox-streets-v8/6/12/23.vector.pbf');
    expect(result.url.searchParams.get('access_token')).toBe(TOKEN);
  });

  it('refuses to rewrite a host that is not one Mapbox serves tiles from', () => {
    expect(proxiedTileTemplate('https://evil.test/{z}/{x}/{y}.pbf', ORIGIN)).toBeNull();
  });

  it('refuses to rewrite a path the proxy would go on to refuse', () => {
    // The two allow lists would otherwise drift: rewriting a path outside
    // ALLOWED_PREFIXES swaps a working URL for one the proxy answers 400 to,
    // and the layer silently never draws.
    expect(proxiedTileTemplate('https://api.mapbox.com/3dtiles/v1/mapbox/{z}/{x}/{y}.glb', ORIGIN)).toBeNull();
    expect(proxiedTileTemplate('https://api.mapbox.com/tokens/v2/someone', ORIGIN)).toBeNull();
  });

  it('leaves an entry it will not rewrite in place, with the token gone', () => {
    const body = tileJson([`https://api.mapbox.com/3dtiles/v1/x/{z}/{x}/{y}.glb?access_token=${TOKEN}`]);
    const out = rewriteTileJson(body, ORIGIN, TOKEN);
    expect(out).not.toContain(TOKEN);
    expect(JSON.parse(out).tiles[0]).toContain('api.mapbox.com/3dtiles/v1/');
  });

  it('scrubs the token from a body it cannot parse or rewrite', () => {
    expect(rewriteTileJson(`not json ${TOKEN}`, ORIGIN, TOKEN)).not.toContain(TOKEN);
    expect(rewriteTileJson(JSON.stringify({ attribution: `x ${TOKEN}` }), ORIGIN, TOKEN)).not.toContain(TOKEN);
    expect(scrubToken(`a ${TOKEN} b ${TOKEN}`, TOKEN)).toBe('a proxied b proxied');
  });

  it('asks upstream for https tile URLs by letting `secure` through', () => {
    const result = resolveUpstream('https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json?secure=1', TOKEN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url.searchParams.get('secure')).toBe('1');
  });
});
