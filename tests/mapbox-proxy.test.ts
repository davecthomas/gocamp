import { describe, expect, it } from 'vitest';
import { resolveUpstream } from '../lib/mapbox-proxy';

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
