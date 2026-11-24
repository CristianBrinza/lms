import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { fitToLimit, MAX_SIDE, PhotoTooLarge, UPLOAD_LIMIT } from './optimizeImage';

// The same search the browser runs, with sharp as the encoder in place of a canvas, on a real picture.
describe('fitToLimit', () => {
  it('brings a 30 MB photo under the upload limit at the highest quality that fits', async () => {
    const width = 6600;
    const height = 5000;
    const source = await sharp({
      create: { width, height, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 40 } },
    })
      .jpeg({ quality: 97 })
      .toBuffer();
    expect(source.length).toBeGreaterThan(29 * 1024 * 1024);

    const encode = async (w: number, h: number, quality: number) => {
      const data = await sharp(source).resize(w, h).webp({ quality: Math.round(quality * 100), effort: 0 }).toBuffer();
      return { size: data.length, data };
    };
    const fitted = await fitToLimit(width, height, encode, { maxSide: MAX_SIDE.photo });

    expect(fitted.out.size).toBeLessThanOrEqual(UPLOAD_LIMIT);
    expect(Math.max(fitted.width, fitted.height)).toBeLessThanOrEqual(MAX_SIDE.photo);
    expect(fitted.quality).toBeGreaterThanOrEqual(0.6);
    console.info(
      `before ${(source.length / 1048576).toFixed(1)} MB ${width}×${height}, after ` +
        `${(fitted.out.size / 1048576).toFixed(1)} MB ${fitted.width}×${fitted.height} WebP q${fitted.quality}`,
    );
  }, 240_000);

  it('keeps a picture that fits at full size and top quality, and never enlarges', async () => {
    const fitted = await fitToLimit(800, 600, async () => ({ size: 1000 }), { maxSide: MAX_SIDE.photo });
    expect(fitted).toMatchObject({ width: 800, height: 600, quality: 0.98 });
  });

  it('gives up rather than loop forever', async () => {
    await expect(fitToLimit(10, 10, async () => ({ size: Infinity }), { maxSide: 4000 })).rejects.toBeInstanceOf(
      PhotoTooLarge,
    );
  });
});
