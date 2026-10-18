import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Sheet } from '@/components/ui';
import { decodeRaster, encodeRaster } from '../images';
import { useClosetT } from '../i18n';
import type { Raster } from '../refine';
import { silhouetteKeystone } from '../perspective';
import { autoTilt, rotateRaster, straighten } from '../straighten';

const PREVIEW = 520;

/** Downscales a raster so the live preview stays quick. */
function shrink(raster: Raster): Raster {
  const scale = Math.min(1, PREVIEW / Math.max(raster.width, raster.height));
  if (scale === 1) return raster;
  const w = Math.round(raster.width * scale);
  const h = Math.round(raster.height * scale);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const from = (Math.floor(y / scale) * raster.width + Math.floor(x / scale)) * 4;
      out.set(raster.data.subarray(from, from + 4), (y * w + x) * 4);
    }
  return { data: out, width: w, height: h };
}

/**
 * Straighten a cut-out: tilt (±15°) and perspective (±25%) with a live preview, "Auto" for both
 * found from the piece itself (sliders stay for fine-tuning). Save hands back the result as a PNG blob.
 */
export function StraightenSheet({
  source,
  onClose,
  onSave,
}: {
  source: Blob | null;
  onClose: () => void;
  onSave: (result: Blob) => Promise<void>;
}) {
  const t = useClosetT();
  const [full, setFull] = useState<Raster | null>(null);
  const [tilt, setTilt] = useState(0);
  const [perspective, setPerspective] = useState(0);
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let live = true;
    void (source ? decodeRaster(source) : Promise.resolve(null)).then((raster) => {
      if (!live) return;
      setFull(raster);
      setTilt(0);
      setPerspective(0);
    });
    return () => {
      live = false;
    };
  }, [source]);

  const small = useMemo(() => (full ? shrink(full) : null), [full]);

  useEffect(() => {
    const node = canvas.current;
    if (!node || !small) return;
    const shown = straighten(small, tilt, perspective / 100);
    node.width = shown.width;
    node.height = shown.height;
    node
      .getContext('2d')!
      .putImageData(new ImageData(shown.data as Uint8ClampedArray<ArrayBuffer>, shown.width, shown.height), 0, 0);
  }, [small, tilt, perspective]);

  const save = async () => {
    if (!full) return;
    setSaving(true);
    try {
      await onSave(await encodeRaster(straighten(full, tilt, perspective / 100)));
    } finally {
      setSaving(false);
    }
  };

  /** Auto: the tilt from the piece's axis, then the perspective that evens out its own sides (the cut-out already had the towel's perspective corrected when it was made). */
  const auto = () => {
    if (!small) return;
    const turn = Math.round(autoTilt(small));
    setTilt(turn);
    const level = turn ? rotateRaster(small, turn) : small;
    setPerspective(Math.round(silhouetteKeystone(level) * 100));
  };

  const slider = (label: string, value: number, min: number, max: number, set: (n: number) => void, unit: string) => (
    <label className="block">
      <span className="flex justify-between text-sm font-semibold text-ink-900">
        {label}
        <span className="font-normal text-ink-600">
          {value > 0 ? '+' : ''}
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--color-lav-600)]"
      />
    </label>
  );

  return (
    <Sheet open={source !== null} onClose={onClose} title={t.straighten}>
      <div className="flex flex-col gap-4">
        <div className="flex h-64 items-center justify-center rounded-2xl bg-ink-50">
          <canvas ref={canvas} className="max-h-full max-w-full object-contain" />
        </div>
        {slider(t.tilt, tilt, -15, 15, setTilt, '°')}
        {slider(t.perspective, perspective, -25, 25, setPerspective, '%')}
        <div className="flex flex-wrap gap-2">
          <Button variant="tint" disabled={!small} onClick={auto}>
            {t.auto}
          </Button>
          <span className="flex-1" />
          <Button variant="tint" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button loading={saving} disabled={!full || (tilt === 0 && perspective === 0)} onClick={() => void save()}>
            {t.save}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
