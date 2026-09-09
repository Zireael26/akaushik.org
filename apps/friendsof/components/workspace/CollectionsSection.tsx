import Link from 'next/link';

export type CollectionItem = {
  title: string;
  tag: string;
  tagClass?: string;
  href: string;
};

export type CollectionsSectionProps = {
  title?: string;
  label?: string;
  intro?: string;
  items?: CollectionItem[];
};

export function CollectionsSection({
  title = 'Records & Inquiries.',
  label = 'Archive & Working Papers',
  intro = 'Working topics, field models, and shared records.',
  items = [],
}: CollectionsSectionProps) {
  return (
    <section className="px-section" id="section-records">
      <div className="px-split">
        <div className="px-head--column">
          <div className="px-head-label">{label}</div>
          <h2 className="px-head-title">{title}</h2>
          <p className="px-split-intro">{intro}</p>
        </div>

        <div className="px-split-body">
          {items.length > 0 ? (
            items.map((item, i) => (
              <Link key={i} href={item.href} className="px-matter">
                <span className="px-matter-title">{item.title}</span>
                <span className={`px-matter-tag ${item.tagClass || ''}`}>{item.tag}</span>
              </Link>
            ))
          ) : (
            <div className="px-row is-last">
              <div className="px-row-tag">EMPTY</div>
              <div className="px-row-body" style={{ color: 'var(--ink60)', fontStyle: 'italic' }}>
                No records have been shared in this collection yet.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
