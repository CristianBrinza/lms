import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  garmentDescription,
  resultUrl,
  setTryonClient,
  TRYON_MESSAGES,
  tryonErrorMessage,
  tryonIdle,
  tryonPayload,
  type TryonClient,
} from '../src/modules/closet/tryon';
import { AppError } from '../src/lib/errors';
import { setupTestApp } from './helpers';

const t = setupTestApp();

const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

afterEach(() => setTryonClient());

describe('closet try-on: request and error mapping', () => {
  it('maps the piece to IDM-VTON’s /tryon inputs', () => {
    const person = new Blob(['p']);
    const garment = new Blob(['g']);
    expect(tryonPayload(person, garment, 'Navy shirt, top')).toEqual({
      dict: { background: person, layers: [], composite: null },
      garm_img: garment,
      garment_des: 'Navy shirt, top',
      is_checked: true,
      is_checked_crop: false,
      denoise_steps: 30,
      seed: 42,
    });
  });

  it('describes the garment from its name and category', () => {
    expect(garmentDescription({ name: 'Navy oxford shirt', category: 'tops' })).toBe('Navy oxford shirt, top');
    expect(garmentDescription({ name: 'Wool coat', category: 'outerwear' })).toBe('Wool coat, coat or jacket');
    expect(garmentDescription({ name: 'Winter dress', category: 'dresses' })).toBe('Winter dress');
    expect(garmentDescription({ name: '  ', category: 'tops' })).toBe('top');
  });

  it('turns Space and network errors into friendly reasons', () => {
    const quota = new Error('You have exceeded your free GPU quota (60s requested vs. 12s left)');
    expect(tryonErrorMessage(quota)).toBe(TRYON_MESSAGES.quota);
    expect(tryonErrorMessage({ message: 'ZeroGPU quota exceeded' })).toBe(TRYON_MESSAGES.quota);
    expect(tryonErrorMessage(new Error('HTTP 429'))).toBe(TRYON_MESSAGES.quota);
    expect(tryonErrorMessage(new Error('timeout'))).toBe(TRYON_MESSAGES.timeout);
    expect(tryonErrorMessage(new Error('The queue is full'))).toBe(TRYON_MESSAGES.busy);
    expect(tryonErrorMessage(new Error('Space is sleeping or building'))).toBe(TRYON_MESSAGES.asleep);
    expect(tryonErrorMessage(new Error('something odd'))).toBe(TRYON_MESSAGES.failed);
    expect(tryonErrorMessage(new AppError(413, 'PAYLOAD_TOO_LARGE', 'That photo is too large'))).toBe(
      'That photo is too large',
    );
  });

  it('finds the output picture in the Space’s answer', () => {
    expect(resultUrl([{ url: 'https://x/file=a.webp', path: '/tmp/a.webp' }, {}])).toBe('https://x/file=a.webp');
    expect(resultUrl(['https://x/b.png'])).toBe('https://x/b.png');
    expect(resultUrl([{ path: '/tmp/only-a-path.png' }])).toBeNull();
    expect(resultUrl([])).toBeNull();
  });
});

async function setup() {
  const email = 'ana@example.com';
  const user = await t.createUser({ email, name: 'Ana' });
  const b = t.browser();
  await b.login(email);
  const { item } = (await b.post('/api/closet/items', { name: 'Navy oxford shirt', category: 'tops' })).body;
  const photo = (await b.post(`/api/closet/items/${item.id}/photos`, { image: PHOTO, needsCutout: false })).body.photo;
  return { user, b, item, photo };
}

/** Stand-in mannequin pictures in a temporary folder (the real ones ship in backend/assets/tryon). */
function mannequins(files: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'lms-mannequins-'));
  for (const name of files) writeFileSync(join(dir, name), Buffer.from(PHOTO.split(',')[1]!, 'base64'));
  process.env.TRYON_ASSETS_DIR = dir;
}
afterEach(() => delete process.env.TRYON_ASSETS_DIR);

describe('closet try-on: the job', () => {
  it('asks which mannequin when the owner has not picked one', async () => {
    const { b, item } = await setup();
    mannequins(['mannequin-male.png', 'mannequin-female.png']);
    const res = await b.post(`/api/closet/items/${item.id}/tryon`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_MANNEQUIN');
  });

  it('says so when the mannequin pictures are not installed', async () => {
    const { b, item } = await setup();
    mannequins([]);
    const res = await b.post(`/api/closet/items/${item.id}/tryon`, { mannequin: 'female' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('MANNEQUIN_MISSING');
  });

  it('keeps a mannequin choice per person', async () => {
    const { b, user } = await setup();
    const none = (await b.get('/api/closet/mannequins')).body.mannequins;
    expect(none).toEqual([{ userId: user.id, mannequin: null }]);
    expect((await b.put(`/api/closet/mannequins/${user.id}`, { mannequin: 'male' })).status).toBe(200);
    expect((await b.get('/api/closet/mannequins')).body.mannequins[0].mannequin).toBe('male');
    expect((await b.put(`/api/closet/mannequins/${user.id}`, { mannequin: 'robot' })).status).toBe(400);
    expect((await b.put(`/api/closet/mannequins/${user.id}`, { mannequin: null })).status).toBe(200);
    expect((await b.put('/api/closet/mannequins/00000000-0000-4000-8000-000000000000', { mannequin: 'male' })).status).toBe(404);
  });

  it('dresses the piece in the background and stores the result as a try-on photo', async () => {
    const { b, item, photo, user } = await setup();
    mannequins(['mannequin-male.png', 'mannequin-female.png']);
    const predict = vi.fn<TryonClient['predict']>(async () => [{ url: PHOTO }, { url: PHOTO }]);
    setTryonClient(async () => ({ predict }));

    const res = await b.post(`/api/closet/items/${item.id}/tryon`, { photoId: photo.id, mannequin: 'female' });
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ status: 'running' });
    await tryonIdle();

    expect(predict).toHaveBeenCalledTimes(1);
    const [endpoint, payload] = predict.mock.calls[0]!;
    expect(endpoint).toBe('/tryon');
    expect(payload).toMatchObject({ garment_des: 'Navy oxford shirt, top', is_checked: true, denoise_steps: 30 });
    // The first pick is remembered, and a later one overrides it for that try-on only.
    expect((await b.get('/api/closet/mannequins')).body.mannequins[0]).toEqual({ userId: user.id, mannequin: 'female' });
    expect((await b.post(`/api/closet/items/${item.id}/tryon`, { mannequin: 'male' })).status).toBe(202);
    await tryonIdle();
    expect((await b.get('/api/closet/mannequins')).body.mannequins[0].mannequin).toBe('female');

    const detail = (await b.get(`/api/closet/items/${item.id}`)).body;
    expect(detail.item.tryonStatus).toBe('');
    expect(detail.photos.map((p: { kind: string }) => p.kind).sort()).toEqual(['front', 'tryon', 'tryon']);
    // Never the cover, and never counted as a photo of the piece itself.
    expect(detail.item.cover.id).toBe(photo.id);
    expect(detail.item.photos).toBe(1);
  });

  it('says why a try-on failed, in plain words', async () => {
    const { b, item } = await setup();
    mannequins(['mannequin-male.png']);
    setTryonClient(async () => ({
      predict: async () => {
        throw new Error('You have exceeded your GPU quota');
      },
    }));
    expect((await b.post(`/api/closet/items/${item.id}/tryon`, { mannequin: 'male' })).status).toBe(202);
    await tryonIdle();
    const detail = (await b.get(`/api/closet/items/${item.id}`)).body;
    expect(detail.item.tryonStatus).toBe(`failed: ${TRYON_MESSAGES.quota}`);
    expect(detail.photos.map((p: { kind: string }) => p.kind)).toEqual(['front']);
  });
});
