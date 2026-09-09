import Link from 'next/link';

export type ConnectionItem = {
  id: string;
  slug: string;
  title: string;
  relation: string;
  context: string;
};

export type ConnectionMapProps = {
  activeTitle: string;
  connections: ConnectionItem[];
};

export function ConnectionMap({ activeTitle, connections }: ConnectionMapProps) {
  const numConns = connections.length;
  const outerPositions =
    numConns === 2
      ? [
          { x: 30, y: 60, lx: 230, ly: 78 },
          { x: 530, y: 60, lx: 530, ly: 78 },
        ]
      : [
          { x: 30, y: 25, lx: 230, ly: 43 },
          { x: 30, y: 95, lx: 230, ly: 113 },
          { x: 530, y: 60, lx: 530, ly: 78 },
        ];

  return (
    <details className="px-connections-disclosure" open>
      <summary className="px-connections-summary">
        Connections &amp; Obsidian Graph ({connections.length})
      </summary>

      <div className="px-connections-content">
        <svg
          className="px-link-map-svg"
          viewBox="0 0 760 160"
          role="group"
          aria-label="Connection map of linked workspace notes"
        >
          {connections.map((conn, i) => {
            const pos = outerPositions[i] || { x: 30, y: 25, lx: 230, ly: 43 };
            return (
              <line
                key={conn.id}
                x1={380}
                y1={80}
                x2={pos.lx}
                y2={pos.ly}
                stroke="var(--line)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Central node: current document anchor */}
          <g transform="translate(270, 60)">
            <rect width={220} height={40} fill="var(--bg)" stroke="var(--px-cobalt)" strokeWidth={1.5} rx={2} />
            <text
              x={110}
              y={24}
              textAnchor="middle"
              fontWeight={600}
              fontFamily="var(--font-mono)"
              fontSize={11}
              letterSpacing="0.08em"
              fill="var(--ink)"
            >
              {activeTitle.length > 22 ? `${activeTitle.slice(0, 20)}...` : activeTitle}
            </text>
          </g>

          {/* Outer connected nodes */}
          {connections.map((conn, i) => {
            const pos = outerPositions[i] || { x: 30, y: 25, lx: 230, ly: 43 };
            return (
              <Link key={conn.id} href={`/reader/${conn.slug}`}>
                <g className="px-node-g" transform={`translate(${pos.x}, ${pos.y})`}>
                  <rect width={200} height={36} fill="var(--bg)" stroke="var(--line)" strokeWidth={1} rx={2} />
                  <text x={100} y={22} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill="var(--ink)">
                    {conn.title.length > 20 ? `${conn.title.slice(0, 18)}...` : conn.title}
                  </text>
                </g>
              </Link>
            );
          })}
        </svg>

        <div className="px-connections-list">
          {connections.map((c) => (
            <div key={c.id} className="px-conn-item">
              <div className="px-conn-main">
                <Link href={`/reader/${c.slug}`} className="px-conn-title">
                  [[{c.title}]]
                </Link>
                <p className="px-conn-context">{c.context}</p>
              </div>
              <span className="px-conn-rel">[{c.relation}]</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
