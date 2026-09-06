import type { ReactNode } from 'react';

/**
 * The ruled row: mono tag column, then body. Rows carry a top border; the last
 * row in a stack adds the bottom one.
 */
export function RuledRow({
  tag,
  last = false,
  children,
}: {
  /** Mono tag, e.g. "'19–'21" or "IN". */
  tag: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`px-row${last ? ' is-last' : ''}`}>
      <span className="px-row-tag">{tag}</span>
      <span className="px-row-body">{children}</span>
    </div>
  );
}

/**
 * A "Selected work" row — the large-title, hover-indent variant.
 *
 * `href` is optional: rows that link somewhere real render as anchors, and rows
 * that don't render as plain divs. The prototype used placeholder anchors,
 * which take keyboard focus and go nowhere; that's a real a11y defect
 * and isn't reproduced.
 */
export function MatterRow({
  title,
  tag,
  tagTone,
  href,
  titleAs,
  level,
}: {
  title: string;
  tag: string;
  /** Tag colour rotates cobalt -> amber -> red -> ink. */
  tagTone: 'cobalt' | 'amber' | 'red' | 'ink';
  href?: string;
  /** Heading level for the title. Defaults to span for section context; use h2 for page-level index items. */
  titleAs?: 'span' | 'h2' | 'h3';
  level?: 2 | 3;
}) {
  const TitleTag = (titleAs ?? (level === 2 ? 'h2' : level === 3 ? 'h3' : 'span')) as 'span' | 'h2' | 'h3';
  const inner = (
    <>
      <TitleTag className="px-matter-title" style={TitleTag !== 'span' ? { margin: 0 } : undefined}>
        {title}
      </TitleTag>
      <span className={`px-matter-tag is-${tagTone}`}>{tag}</span>
    </>
  );

  if (href) {
    return (
      <a className="px-matter" href={href}>
        {inner}
      </a>
    );
  }
  return <div className="px-matter">{inner}</div>;
}
