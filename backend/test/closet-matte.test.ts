import { afterEach, describe, expect, it, vi } from 'vitest';
import { matteError, MATTE_MESSAGES, matteIdle, setMatteClient } from '../src/modules/closet/matte';
import type { SpaceClient } from '../src/modules/closet/space';
import { APP_URL, setupTestApp } from './helpers';

const t = setupTestApp();
const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

afterEach(() => {
  setMatteClient();
  vi.unstubAllGlobals();
});

describe('closet cut-out from the Space', () => {
  it('maps Space errors to short reasons', () => {
    expect(matteError(new Error('ZeroGPU quota exceeded')).status).toBe(429);
    expect(matteError(new Error('timeout')).status).toBe(504);
    expect(matteError(new Error('boom'))).toMatchObject({ status: 502, message: MATTE_MESSAGES.failed });
  });

  it('answers a photo’s cut-out as a PNG, from the Space’s second picture', async () => {
    const user = await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    expect(user).toBeTruthy();
    const b = t.browser();
    await b.login('ana@example.com');
    const { item } = (await b.post('/api/closet/items', { name: 'Tee', category: 'tops' })).body;
    const photo = (await b.post(`/api/closet/items/${item.id}/photos`, { image: PHOTO, needsCutout: true })).body.photo;
    const png = Buffer.from(PHOTO.split(',')[1]!, 'base64');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(png))));
    const predict = vi.fn<SpaceClient['predict']>(async () => [[{ url: 'https://x/a.png' }, { url: 'https://x/cut.png' }]]);
    setMatteClient(async () => ({ predict }));
    const res = await t.app.request(`/api/closet/photos/${photo.id}/matte`, {
      method: "POST",
      headers: { origin: APP_URL, "sec-fetch-site": "same-origin", cookie: [...b.jar].map(([n, v]) => `${n}=${v}`).join("; ") },
    });
    await matteIdle();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(predict).toHaveBeenCalledWith('/image', expect.objectContaining({ weights_file: 'General' }), expect.anything());
  });

  it('says why when the Space is out of quota', async () => {
    await t.createUser({ email: 'bo@example.com', name: 'Bo' });
    const b = t.browser();
    await b.login('bo@example.com');
    const { item } = (await b.post('/api/closet/items', { name: 'Tee', category: 'tops' })).body;
    const photo = (await b.post(`/api/closet/items/${item.id}/photos`, { image: PHOTO })).body.photo;
    setMatteClient(async () => ({
      predict: async () => {
        throw new Error('You have exceeded your ZeroGPU runs limit');
      },
    }));
    const res = await b.post(`/api/closet/photos/${photo.id}/matte`);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('MATTE_QUOTA');
  });
});
