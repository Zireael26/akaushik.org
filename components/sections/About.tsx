import { PixelPortrait } from '@/components/pixel/PixelPortrait';
import { Fragment, type ReactNode } from 'react';

import { ABOUT_COPY } from '@/lib/about-copy';

// Inline-markdown renderer supporting **bold**, *italic*, and [text](url)
// links only. Returns React nodes — never raw HTML strings — so there is no
// XSS surface even if ABOUT_COPY drifts to operator-edited content.
// Tokens matched in order via matchAll: link, bold, italic. No nested
// formatting (`**[a](b)**` renders as bold containing plain text).
function renderInline(text: string): ReactNode[] {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }
    if (match[1] !== undefined && match[2] !== undefined) {
      nodes.push(
        <a key={key++} href={match[2]}>
          {match[1]}
        </a>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={key++}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key++}>{match[4]}</em>);
    }
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes.map((node, i) =>
    typeof node === 'string' ? <Fragment key={`t${i}`}>{node}</Fragment> : node,
  );
}

/**
 * Profile — the About section in the pixel design.
 *
 * Ported from gaurijha.com's `gj-profile`: statement + chips on the left, a
 * notched 3:4 portrait with a mono caption on the right.
 *
 * The head is written out with the shared `.px-head*` classes rather than via
 * <SectionHead> because SectionHead takes `heading` as a plain string, and the
 * lede carries inline markdown (`*actually*`) that has to go through
 * renderInline. Same classes, so no CSS is duplicated.
 *
 * All copy comes from lib/about-copy.ts, which app/llms-full.txt also reads.
 */
export function About() {
  return (
    <section
      className="px-section px-profile"
      id="profile"
      data-screen-label="02 About"
      data-companion-pose="about"
      aria-labelledby="profile-statement"
    >
      <div className="px-profile-main">
        <div className="px-head px-head--block">
          <h2 className="px-head-title px-profile-statement" id="profile-statement">
            {renderInline(ABOUT_COPY.lede)}
          </h2>
          <div className="px-head-label" data-cursor-target="1">
            {ABOUT_COPY.kicker}
          </div>
        </div>

        <div className="px-profile-body">
          {ABOUT_COPY.paragraphs.map((paragraph, i) => (
            <p className="px-split-intro" key={i}>
              {renderInline(paragraph)}
            </p>
          ))}
        </div>

        <div className="px-chips">
          {ABOUT_COPY.meta.map((row, i) => (
            <span
              className={`px-chip${i === ABOUT_COPY.meta.length - 1 ? ' is-cobalt' : ''}`}
              key={row.label}
            >
              <span className="px-chip-key">{row.label}</span>
              {row.value}
            </span>
          ))}
        </div>
      </div>

      <div className="px-portrait">
        <div className="px-portrait-frame px-notch">
          {/* Rendered as a pixel field rather than an <img>, so the portrait
              speaks the same language as the rest of the page — same palette
              ramp, same ambient drift, and it takes pointer heat. next/image
              cannot do that, which is why the optimisation it offers is not
              worth having here. */}
          <PixelPortrait
            src="/images/about/abhishek.webp"
            alt="Portrait of Abhishek Kaushik"
            className="px-portrait-canvas"
            // Head and shoulders, at the canvas's own 3:4. The full frame
            // does not work here: it is a face lit at a restaurant window,
            // with a lamp on the left, a lit street on the right, and a black
            // polo occupying the bottom third. Ramped whole, the shirt is the
            // largest single-tone region in the picture and takes the loudest
            // end of the palette while the face lands mid-ramp — a lime slab
            // with a hole where the person is. Cropped to the head, the
            // stretch is computed over skin and hair and the features read.
            crop={{ x: 0.27, y: 0.1, w: 0.4, h: 0.45 }}
            gamma={1}
            floor={0.2}
            cellSize={2.1}
          />
        </div>
        <div className="px-portrait-cap">Abhishek Kaushik · AI engineer</div>
      </div>
    </section>
  );
}
