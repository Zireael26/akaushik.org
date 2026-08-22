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
 * that don't render as plain divs. The prototype used dead `<a href="#">`
 * anchors, which take keyboard focus and go nowhere; that's a real a11y defect
 * and isn't reproduced.
 */
export function MatterRow({
  title,
  tag,
  tagTone,
  href,
}: {
  title: string;
  tag: string;
  /** Tag colour rotates cobalt -> amber -> red -> ink. */
  tagTone: 'cobalt' | 'amber' | 'red' | 'ink';
  href?: string;
}) {
  const inner = (
    <>
      <span className="px-matter-title">{title}</span>
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
