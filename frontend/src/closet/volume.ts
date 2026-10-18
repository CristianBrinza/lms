/**
 * The "3D" look for a cut-out garment (a ghost mannequin, without any extra AI): soft volume
 * shading inside the silhouette (lighter in the middle, darker toward the edges), a gentle inner
 * shadow along the edge and a soft shadow under the piece. Pure canvas, transparent PNG out.
 */

type Source = ImageBitmap | HTMLCanvasElement;

const make = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png'))), 'image/png'),
  );

export async function addVolume(source: Source): Promise<Blob> {
  const w = source.width;
  const h = source.height;
  const size = Math.max(w, h);
  const pad = Math.round(size * 0.07);
  const W = w + pad * 2;
  const H = h + pad * 2;

  // The garment alone, centred with room for the shadow.
  const garment = make(W, H);
  garment.getContext('2d')!.drawImage(source, pad, pad);

  const out = make(W, H);
  const ctx = out.getContext('2d')!;

  // 1. Soft shadow under the piece.
  ctx.save();
  ctx.shadowColor = 'rgba(20, 16, 40, 0.32)';
  ctx.shadowBlur = size * 0.035;
  ctx.shadowOffsetY = size * 0.022;
  ctx.drawImage(garment, 0, 0);
  ctx.restore();

  // 2. The garment itself, then shading and edge shadow only where it is opaque (source-atop).
  const body = make(W, H);
  const b = body.getContext('2d')!;
  b.drawImage(garment, 0, 0);
  b.globalCompositeOperation = 'source-atop';

  // Volume: lighter in the middle, darker toward the sides and the hem.
  const cx = W / 2;
  const cy = pad + h * 0.42;
  const radial = b.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
  radial.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  radial.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  radial.addColorStop(1, 'rgba(20, 16, 40, 0.3)');
  b.fillStyle = radial;
  b.fillRect(0, 0, W, H);
  const vertical = b.createLinearGradient(0, pad, 0, pad + h);
  vertical.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  vertical.addColorStop(1, 'rgba(20, 16, 40, 0.12)');
  b.fillStyle = vertical;
  b.fillRect(0, 0, W, H);

  // Inner shadow: the shadow of everything outside the piece, falling just inside its edge.
  const outside = make(W, H);
  const o = outside.getContext('2d')!;
  o.fillStyle = '#000';
  o.fillRect(0, 0, W, H);
  o.globalCompositeOperation = 'destination-out';
  o.drawImage(garment, 0, 0);
  const far = W + H;
  const rim = make(W, H);
  const r = rim.getContext('2d')!;
  r.shadowColor = 'rgba(20, 16, 40, 0.5)';
  r.shadowBlur = size * 0.03;
  r.shadowOffsetX = far;
  r.drawImage(outside, -far, 0);
  b.drawImage(rim, 0, 0);

  ctx.drawImage(body, 0, 0);
  return toPng(out);
}
