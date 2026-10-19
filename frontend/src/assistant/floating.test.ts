import { describe, expect, it } from "vitest";
import { stackedBottom, type Box } from "./floating";

const viewport = { width: 390, height: 800 };
const input = { viewport, base: 88, size: 56, inset: 16 };
const box = (o: Partial<Box>): Box => ({ top: 700, bottom: 750, left: 200, right: 374, ...o });

describe("assistant button stacking", () => {
  it("stays put with nothing in the way", () => {
    expect(stackedBottom({ ...input, obstacles: [] })).toBeNull();
    expect(stackedBottom({ ...input, obstacles: [box({ top: 100, bottom: 150 })] })).toBeNull();
    expect(stackedBottom({ ...input, obstacles: [box({ left: 10, right: 100 })] })).toBeNull();
    expect(stackedBottom({ ...input, obstacles: [box({ top: 900, bottom: 960 })] })).toBeNull();
  });

  it("sits 12 px above the extended FAB", () => {
    expect(stackedBottom({ ...input, obstacles: [box({})] })).toBe(112);
  });

  it("clears the topmost of several", () => {
    const bar = box({ top: 640, bottom: 700, left: 0, right: 390 });
    expect(stackedBottom({ ...input, obstacles: [box({}), bar] })).toBe(172);
  });
});
