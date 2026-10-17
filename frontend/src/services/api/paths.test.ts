import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every source file under src, tests left out. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('API paths', () => {
  it('never start with /api: the client adds it (so /api/api/… would be a 404)', () => {
    const root = join(__dirname, '..', '..');
    const doubled = sources(root).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => /\bapi\.(get|post|put|patch|delete)\b[^(]*\(\s*[`'"]\/api\//.test(line))
        .map((line) => `${file.slice(root.length + 1)}: ${line.trim()}`),
    );
    expect(doubled).toEqual([]);
  });
});
