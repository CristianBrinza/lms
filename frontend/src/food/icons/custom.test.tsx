import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { foodKeys } from '../api';
import type { CustomIcon } from './custom';
import { drawShapes } from './custom';
import { Icon } from './Icon';
import { ICON_ART } from './registry';

const TOAST: CustomIcon = {
  key: 'custom:toast-bread',
  name: 'Toast bread',
  translations: { ro: { name: 'Pâine de toast' } },
  createdAt: '2026-10-17T10:00:00.000Z',
  shapes: [
    { tag: 'path', attrs: { d: 'M12 38V20h24v18z', fill: '#b87a4b' } },
    {
      tag: 'g',
      attrs: { transform: 'rotate(-8 24 27)' },
      children: [{ tag: 'circle', attrs: { cx: 20, cy: 27, r: 1, 'stroke-width': 1.3 } }],
    },
  ],
};

function withIcons(icons: CustomIcon[], node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(foodKeys.icons, icons);
  return renderToStaticMarkup(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('the kitchen’s own icons', () => {
  it('are drawn from their shapes on the 48×48 grid with the ink outline', () => {
    const html = withIcons([TOAST], <Icon name="custom:toast-bread" className="size-8" />);
    expect(html).toContain('viewBox="0 0 48 48"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('color="var(--color-ink-900, #1d1d24)"');
    expect(html).toContain('<path d="M12 38V20h24v18z" fill="#b87a4b"></path>');
    expect(html).toContain(
      '<g transform="rotate(-8 24 27)"><circle cx="20" cy="27" r="1" stroke-width="1.3"></circle></g>',
    );
    expect(html).toContain('size-8');
  });

  it('fall back to the basket when the key is unknown', () => {
    const html = withIcons([TOAST], <Icon name="custom:gone" />);
    expect(html).toContain(ICON_ART.basket!.inner.slice(0, 40));
  });

  it('drop anything outside the whitelist, even if the server let it through', () => {
    const html = renderToStaticMarkup(
      <svg>
        {drawShapes([
          { tag: 'script', attrs: { d: 'M1 1' } },
          { tag: 'foreignObject', children: [{ tag: 'path', attrs: { d: 'M1 1' } }] },
          { tag: 'image', attrs: { href: 'https://x.test/a.png' } },
          {
            tag: 'path',
            attrs: {
              d: 'M1 1h4',
              fill: 'url(#evil)',
              stroke: 'javascript:alert(1)',
              style: 'fill:red',
              onClick: 'alert(1)',
              href: '#x',
              dangerouslySetInnerHTML: '<b>x</b>',
              transform: 'translate(1 1) skewX(3)',
              opacity: 0.5,
            },
          },
          { tag: 'path', attrs: { d: 'javascript:alert(1)' } },
          { tag: 'rect', attrs: { x: '1px', width: 4, height: '4' } },
        ])}
      </svg>,
    );
    expect(html).toBe(
      '<svg><path d="M1 1h4" opacity="0.5"></path><path></path><rect width="4" height="4"></rect></svg>',
    );
  });

  it('stop at 60 shapes', () => {
    const many = Array.from({ length: 80 }, () => ({ tag: 'circle', attrs: { r: 1 } }));
    expect(drawShapes(many)).toHaveLength(60);
  });
});
