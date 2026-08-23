import type { ReactNode } from 'react';

import { MotionVideo } from './MotionVideo';

export type WritingLoopSlug =
  | 'building-this-portfolio'
  | 'micrograd-makemore'
  | 'ai-for-msme'
  | 'fastembed-to-tei';
type LoopSlug = WritingLoopSlug;

function MicrogradFloor() {
  return (
    <svg viewBox="0 0 1200 676" className="media-loop-fallback" aria-hidden="true">
      <rect width="1200" height="676" fill="var(--bg)" />
      <g stroke="var(--ink-10)" strokeWidth="1">
        <path d="M0 168 H1200 M0 336 H1200 M0 504 H1200" />
        <path d="M240 0 V676 M480 0 V676 M720 0 V676 M960 0 V676" />
      </g>
      <g stroke="var(--accent-60)" strokeWidth="2" fill="none">
        <path d="M150 440 C 250 360, 280 270, 390 270" />
        <path d="M150 180 C 250 220, 280 260, 390 270" />
        <path d="M450 270 C 560 270, 610 236, 720 236" />
        <path d="M790 236 C 890 250, 930 332, 1040 360" strokeDasharray="5 7" />
      </g>
      <g fill="var(--bg)" stroke="var(--accent)" strokeWidth="2">
        <circle cx="150" cy="440" r="42" />
        <circle cx="150" cy="180" r="42" />
        <circle cx="420" cy="270" r="58" fill="var(--accent)" />
        <circle cx="750" cy="236" r="58" />
        <circle cx="1040" cy="360" r="50" />
      </g>
      <g fontFamily="var(--mono)" fontSize="18" textAnchor="middle" dominantBaseline="middle">
        <text x="150" y="440" fill="var(--ink)">
          x
        </text>
        <text x="150" y="180" fill="var(--ink)">
          w
        </text>
        <text x="420" y="270" fill="var(--accent-ink)">
          +
        </text>
        <text x="750" y="236" fill="var(--ink)">
          tanh
        </text>
        <text x="1040" y="360" fill="var(--ink)">
          loss
        </text>
      </g>
    </svg>
  );
}

function PortfolioFloor() {
  return (
    <svg viewBox="0 0 1200 676" className="media-loop-fallback" aria-hidden="true">
      <rect width="1200" height="676" fill="var(--bg)" />
      <g stroke="var(--ink-10)" strokeWidth="1">
        <path d="M0 168 H1200 M0 338 H1200 M0 508 H1200" />
        <path d="M240 0 V676 M480 0 V676 M720 0 V676 M960 0 V676" />
      </g>
      <g fill="var(--bg-2)" stroke="var(--hairline)" strokeWidth="1.5">
        <rect x="128" y="142" width="210" height="116" />
        <rect x="382" y="142" width="210" height="116" />
        <rect x="636" y="142" width="210" height="116" />
        <rect x="382" y="376" width="210" height="116" fill="rgba(19, 66, 61, 0.08)" stroke="var(--accent)" />
        <rect x="890" y="142" width="180" height="350" />
      </g>
      <g stroke="var(--accent-60)" strokeWidth="2" fill="none">
        <path d="M338 200 H382" />
        <path d="M592 200 H636" />
        <path d="M741 258 C725 338 612 376 488 376" strokeDasharray="6 8" />
        <path d="M592 434 H890" />
      </g>
      <g fill="var(--accent)">
        <circle cx="233" cy="200" r="8" />
        <circle cx="487" cy="200" r="8" />
        <circle cx="741" cy="200" r="8" />
        <circle cx="487" cy="434" r="8" />
        <circle cx="980" cy="318" r="8" />
      </g>
      <g fontFamily="var(--mono)" fontSize="19" fill="var(--ink)">
        <text x="170" y="204">PRD</text>
        <text x="424" y="204">ADR</text>
        <text x="678" y="204">ROADMAP</text>
        <text x="424" y="438">process gate</text>
        <text x="934" y="322">site</text>
      </g>
    </svg>
  );
}

function FastembedFloor() {
  return (
    <svg viewBox="0 0 1200 676" className="media-loop-fallback" aria-hidden="true">
      <rect width="1200" height="676" fill="var(--bg)" />
      <g stroke="var(--ink-10)" strokeWidth="1">
        <path d="M0 225 H1200 M0 450 H1200" />
      </g>
      <g stroke="var(--accent-60)" strokeWidth="2" fill="none">
        <path d="M160 300 H370 M500 300 H710 M840 300 H1030" />
        <path d="M1030 350 C 940 470, 780 500, 640 500" strokeDasharray="5 7" />
      </g>
      <g fill="var(--bg-2)" stroke="var(--hairline)" strokeWidth="1.5">
        <rect x="70" y="230" width="180" height="140" />
        <rect x="370" y="230" width="180" height="140" />
        <rect
          x="710"
          y="230"
          width="180"
          height="140"
          fill="rgba(19, 66, 61, 0.10)"
          stroke="var(--accent)"
        />
        <rect x="980" y="230" width="180" height="140" />
        <rect
          x="520"
          y="470"
          width="260"
          height="64"
          fill="rgba(19, 66, 61, 0.08)"
          stroke="var(--accent)"
        />
      </g>
      <g fontFamily="var(--mono)" fontSize="20" fill="var(--ink)">
        <text x="118" y="306">
          query
        </text>
        <text x="410" y="306">
          Fastembed
        </text>
        <text x="762" y="306">
          TEI
        </text>
        <text x="1024" y="306">
          rerank
        </text>
        <text x="552" y="510">
          cited passage
        </text>
      </g>
    </svg>
  );
}

function MsmEFloor() {
  return (
    <svg viewBox="0 0 1200 676" className="media-loop-fallback" aria-hidden="true">
      <rect width="1200" height="676" fill="var(--bg)" />
      <rect width="1200" height="676" fill="var(--accent-05)" />
      <g stroke="var(--ink-10)" strokeWidth="1">
        <path d="M0 225 H1200 M0 451 H1200" />
      </g>
      <g fill="var(--bg-2)" stroke="var(--hairline)" strokeWidth="1.5">
        <rect x="120" y="130" width="220" height="136" />
        <rect x="490" y="130" width="220" height="136" fill="rgba(19, 66, 61, 0.08)" stroke="var(--accent)" />
        <rect x="860" y="130" width="220" height="136" />
        <rect x="305" y="410" width="220" height="96" />
        <rect x="675" y="410" width="220" height="96" />
      </g>
      <g stroke="var(--accent-60)" strokeWidth="2" fill="none">
        <path d="M340 198 H490" />
        <path d="M710 198 H860" />
        <path d="M970 266 C920 360 820 410 785 410" strokeDasharray="6 8" />
        <path d="M675 458 H525" />
        <path d="M415 410 C335 340 262 310 230 266" />
      </g>
      <g fill="var(--accent)">
        <circle cx="230" cy="198" r="8" />
        <circle cx="600" cy="198" r="8" />
        <circle cx="970" cy="198" r="8" />
        <circle cx="785" cy="458" r="8" />
        <circle cx="415" cy="458" r="8" />
      </g>
      <g fontFamily="var(--mono)" fontSize="19" fill="var(--ink)">
        <text x="164" y="202">WhatsApp</text>
        <text x="538" y="202">operator</text>
        <text x="914" y="202">stock</text>
        <text x="720" y="463">invoice</text>
        <text x="350" y="463">ledger</text>
      </g>
    </svg>
  );
}

const FLOORS: Record<LoopSlug, () => ReactNode> = {
  'building-this-portfolio': PortfolioFloor,
  'micrograd-makemore': MicrogradFloor,
  'ai-for-msme': MsmEFloor,
  'fastembed-to-tei': FastembedFloor,
};

function assetPath(kind: 'writing', slug: LoopSlug) {
  const base = `/video/writing/${slug}`;
  return {
    mp4: `${base}.mp4`,
    poster: `${base}.webp`,
  };
}

export function HyperframesLoop({
  kind,
  slug,
  className,
}: {
  kind: 'writing';
  slug: LoopSlug;
  className?: string;
}) {
  const Floor = FLOORS[slug];
  const { mp4, poster } = assetPath(kind, slug);
  const classes = ['media-loop', className].filter(Boolean).join(' ');

  return (
    <figure className={classes} aria-hidden="true">
      <Floor />
      <MotionVideo
        className="media-loop-video"
        kind={kind}
        slug={slug}
        width={1200}
        height={676}
        mp4={mp4}
        poster={poster}
      />
    </figure>
  );
}
