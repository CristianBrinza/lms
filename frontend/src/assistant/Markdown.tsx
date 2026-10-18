import { Fragment, type ReactNode } from 'react';

/**
 * A small, safe markdown reader for the assistant's replies: paragraphs, headings, bullet and
 * numbered lists, code blocks, bold, italics, inline code, links and images. It builds React
 * elements (never HTML strings), and only http(s) and same-site addresses become links or images.
 */

const SAFE_URL = /^(https?:\/\/|\/api\/)/i;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern =
    /(!?\[([^\]]*)\]\(([^)\s]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*\s][^*]*)\*)/g;
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const key = `${keyBase}-${index++}`;
    if (match[1]) {
      const url = match[3]!;
      if (!SAFE_URL.test(url)) out.push(match[0]);
      else if (match[1].startsWith('!'))
        out.push(
          <img key={key} src={url} alt={match[2]} loading="lazy" className="my-2 max-h-72 rounded-2xl" />,
        );
      else
        out.push(
          <a key={key} href={url} target="_blank" rel="noreferrer noopener" className="font-semibold underline">
            {match[2] || url}
          </a>,
        );
    } else if (match[4]) {
      out.push(
        <code key={key} className="rounded-md bg-ink-100 px-1 py-0.5 text-[0.85em]">
          {match[5]}
        </code>,
      );
    } else if (match[6] || match[8]) {
      out.push(<strong key={key}>{match[7] ?? match[9]}</strong>);
    } else if (match[10]) {
      out.push(<em key={key}>{match[11]}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface Block {
  kind: 'p' | 'h' | 'ul' | 'ol' | 'code';
  lines: string[];
}

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let current: Block | null = null;
  let fenced = false;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const line of lines) {
    if (/^```/.test(line)) {
      if (fenced) {
        flush();
        fenced = false;
      } else {
        flush();
        current = { kind: 'code', lines: [] };
        fenced = true;
      }
      continue;
    }
    if (fenced) {
      current!.lines.push(line);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'h', lines: [heading[1]!] });
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      if (current?.kind !== kind) {
        flush();
        current = { kind, lines: [] };
      }
      current!.lines.push((bullet ?? numbered)![1]!);
      continue;
    }
    if (current?.kind !== 'p') {
      flush();
      current = { kind: 'p', lines: [] };
    }
    current!.lines.push(line);
  }
  flush();
  return blocks;
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 break-words [&_a]:text-lav-700">
      {parseBlocks(text).map((block, i) => {
        const key = `b${i}`;
        if (block.kind === 'code')
          return (
            <pre key={key} className="overflow-x-auto rounded-2xl bg-ink-100 p-3 text-[0.8125rem]">
              <code>{block.lines.join('\n')}</code>
            </pre>
          );
        if (block.kind === 'h')
          return (
            <p key={key} className="font-bold">
              {inline(block.lines[0]!, key)}
            </p>
          );
        if (block.kind === 'ul' || block.kind === 'ol') {
          const List = block.kind === 'ul' ? 'ul' : 'ol';
          return (
            <List
              key={key}
              className={block.kind === 'ul' ? 'list-disc space-y-1 pl-5' : 'list-decimal space-y-1 pl-5'}
            >
              {block.lines.map((line, j) => (
                <li key={`${key}-${j}`}>{inline(line, `${key}-${j}`)}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={key}>
            {block.lines.map((line, j) => (
              <Fragment key={`${key}-${j}`}>
                {j > 0 ? <br /> : null}
                {inline(line, `${key}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
