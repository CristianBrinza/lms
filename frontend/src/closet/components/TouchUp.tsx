import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointer } from 'react';
import { Button } from '@/components/ui';
import { cx } from '@/lib/cx';
import { decodeRaster, encodeRaster } from '../images';
import { useClosetT } from '../i18n';
import { cropToGarment, type Raster } from '../refine';
import { alphaOf, erase, History, restore, setAlpha, wandErase, type Dirty } from '../touchup';

type Tool = 'erase' | 'restore' | 'wand';
type Point = { x: number; y: number };

const CHECKER =
  'repeating-conic-gradient(#d9d9de 0% 25%, #f4f4f7 0% 50%) 50% / 20px 20px';

/**
 * Full-screen touch-up for a cut-out: erase, restore and a magic wand over a checkerboard (or a
 * dark ground, so white edges show). One finger draws, two fingers pan and zoom; 20 undo steps.
 * "Restore" brings back what the cut-out had when this editor opened (a full reset too).
 */
export function TouchUp({
  source,
  onClose,
  onSave,
}: {
  source: Blob | null;
  onClose: () => void;
  onSave: (result: Blob) => Promise<void>;
}) {
  const t = useClosetT();
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const work = useRef<Raster | null>(null);
  const base = useRef<Raster | null>(null);
  const history = useRef(new History(20));
  const [loaded, setLoaded] = useState<Blob | null>(null);
  const ready = loaded !== null && loaded === source;
  const [tool, setTool] = useState<Tool>('wand');
  const [size, setSize] = useState(48);
  const [tolerance, setTolerance] = useState(24);
  const [dark, setDark] = useState(false);
  const [saving, setSaving] = useState(false);
  const [can, setCan] = useState({ undo: false, redo: false });
  const sync = () => setCan({ undo: history.current.canUndo, redo: history.current.canRedo });
  const view = useRef({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ dist: number; mid: Point; scale: number; x: number; y: number } | null>(null);
  const stroke = useRef<{ id: number; last: Point; moved: boolean; start: Point } | null>(null);

  const applyView = () => {
    const { scale, x, y } = view.current;
    if (stage.current) stage.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };

  const paint = useCallback((area?: Dirty) => {
    const raster = work.current;
    const node = canvas.current;
    if (!raster || !node) return;
    const context = node.getContext('2d')!;
    const image = new ImageData(raster.data as Uint8ClampedArray<ArrayBuffer>, raster.width, raster.height);
    if (area) context.putImageData(image, 0, 0, area.x, area.y, area.w, area.h);
    else context.putImageData(image, 0, 0);
  }, []);

  // Load the cut-out (and keep a copy to restore from).
  useEffect(() => {
    let live = true;
    work.current = base.current = null;
    history.current = new History(20);
    if (!source) return;
    void decodeRaster(source).then((raster) => {
      if (!live) return;
      work.current = raster;
      base.current = { ...raster, data: new Uint8ClampedArray(raster.data) };
      const node = canvas.current;
      if (node) {
        node.width = raster.width;
        node.height = raster.height;
      }
      view.current = { scale: 1, x: 0, y: 0 };
      applyView();
      paint();
      setLoaded(source);
    });
    return () => {
      live = false;
    };
  }, [source, paint]);

  /** Screen point → pixel of the picture. */
  const toImage = (p: Point): Point => {
    const rect = canvas.current!.getBoundingClientRect();
    const raster = work.current!;
    return { x: ((p.x - rect.left) / rect.width) * raster.width, y: ((p.y - rect.top) / rect.height) * raster.height };
  };
  const brushRadius = () => {
    const rect = canvas.current!.getBoundingClientRect();
    return Math.max(1, ((size / 2) * work.current!.width) / rect.width);
  };

  const dab = (from: Point, to: Point) => {
    const raster = work.current!;
    const radius = brushRadius();
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (radius / 3)));
    for (let i = 1; i <= steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps;
      paint(tool === 'erase' ? erase(raster, x, y, radius) : restore(raster, base.current!, x, y, radius));
    }
  };

  const onDown = (e: ReactPointer<HTMLDivElement>) => {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // A second finger: drop the stroke in progress, switch to pan/zoom.
      if (stroke.current) {
        setAlpha(work.current!, history.current.discard() ?? alphaOf(work.current!), base.current!);
        paint();
        stroke.current = null;
      }
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ...view.current };
      return;
    }
    if (pointers.current.size === 1) {
      const point = { x: e.clientX, y: e.clientY };
      stroke.current = { id: e.pointerId, last: toImage(point), moved: false, start: point };
    }
  };

  const onMove = (e: ReactPointer<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = Math.min(8, Math.max(1, (g.scale * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, g.dist)));
      const box = viewport.current!.getBoundingClientRect();
      view.current = {
        scale,
        x: mid.x - box.left - ((g.mid.x - box.left - g.x) / g.scale) * scale,
        y: mid.y - box.top - ((g.mid.y - box.top - g.y) / g.scale) * scale,
      };
      applyView();
      return;
    }
    const s = stroke.current;
    if (!s || s.id !== e.pointerId || tool === 'wand') return;
    const point = toImage({ x: e.clientX, y: e.clientY });
    if (!s.moved) {
      if (Math.hypot(e.clientX - s.start.x, e.clientY - s.start.y) < 3) return;
      s.moved = true;
      history.current.push(alphaOf(work.current!));
      sync();
    }
    dab(s.last, point);
    s.last = point;
  };

  const onUp = (e: ReactPointer<HTMLDivElement>) => {
    const s = stroke.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (!s || s.id !== e.pointerId) return;
    stroke.current = null;
    const raster = work.current!;
    const at = toImage({ x: e.clientX, y: e.clientY });
    if (!s.moved) {
      // A tap: the wand fills, a brush leaves one dab.
      history.current.push(alphaOf(raster));
      if (tool === 'wand') {
        if (wandErase(raster, Math.floor(at.x), Math.floor(at.y), tolerance) === 0) history.current.discard();
        paint();
      } else {
        dab(s.last, s.last);
      }
      sync();
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const box = viewport.current!.getBoundingClientRect();
    const { scale, x, y } = view.current;
    const next = Math.min(8, Math.max(1, scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    view.current = {
      scale: next,
      x: e.clientX - box.left - ((e.clientX - box.left - x) / scale) * next,
      y: e.clientY - box.top - ((e.clientY - box.top - y) / scale) * next,
    };
    applyView();
  };

  const step = (direction: 'undo' | 'redo') => {
    const raster = work.current;
    if (!raster) return;
    const current = alphaOf(raster);
    const snapshot = direction === 'undo' ? history.current.undo(current) : history.current.redo(current);
    if (!snapshot) return;
    setAlpha(raster, snapshot, base.current!);
    paint();
    sync();
  };

  const reset = () => {
    const raster = work.current;
    if (!raster || !base.current) return;
    history.current.push(alphaOf(raster));
    raster.data.set(base.current.data);
    paint();
    sync();
  };

  const save = async () => {
    if (!work.current) return;
    setSaving(true);
    try {
      await onSave(await encodeRaster(cropToGarment(work.current, 0.04)));
    } finally {
      setSaving(false);
    }
  };

  if (!source) return null;
  const tools: [Tool, string][] = [
    ['wand', t.wand],
    ['erase', t.erase],
    ['restore', t.restoreBrush],
  ];
  return (
    <div data-no-pull className="fixed inset-0 z-[70] flex flex-col bg-ink-900 text-white" role="dialog" aria-label={t.touchUp}>
      <div className="flex items-center gap-2 px-3 py-2">
        <Button size="sm" variant="tint" onClick={onClose}>
          {t.cancel}
        </Button>
        <span className="flex-1 text-center text-sm font-semibold">{t.touchUp}</span>
        <Button size="sm" loading={saving} disabled={!ready} onClick={() => void save()}>
          {t.save}
        </Button>
      </div>

      <div
        ref={viewport}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        style={{ touchAction: 'none', background: dark ? '#17171c' : CHECKER }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <div ref={stage} className="flex size-full origin-top-left items-center justify-center">
          <canvas ref={canvas} className="max-h-full max-w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {tools.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tool === id}
              onClick={() => setTool(id)}
              className={cx(
                'press rounded-pill px-3.5 py-1.5 text-sm font-semibold',
                tool === id ? 'bg-white text-ink-900' : 'bg-white/15 text-white',
              )}
            >
              {label}
            </button>
          ))}
          <span className="flex-1" />
          <Button size="sm" variant="tint" disabled={!can.undo} onClick={() => step('undo')}>
            {t.undo}
          </Button>
          <Button size="sm" variant="tint" disabled={!can.redo} onClick={() => step('redo')}>
            {t.redo}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="shrink-0">{tool === 'wand' ? t.tolerance : t.brushSize}</span>
            <input
              type="range"
              min={tool === 'wand' ? 1 : 8}
              max={tool === 'wand' ? 80 : 120}
              value={tool === 'wand' ? tolerance : size}
              onChange={(e) => (tool === 'wand' ? setTolerance(Number(e.target.value)) : setSize(Number(e.target.value)))}
              className="min-w-0 flex-1"
            />
          </label>
          <Button size="sm" variant="tint" onClick={() => setDark((v) => !v)}>
            {dark ? t.lightGround : t.darkGround}
          </Button>
          <Button size="sm" variant="tint" onClick={reset}>
            {t.resetAll}
          </Button>
        </div>
      </div>
    </div>
  );
}
