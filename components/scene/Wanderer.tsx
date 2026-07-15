import { WandererCraneClient } from './WandererCraneClient';
import styles from './Wanderer.module.css';

/**
 * The Wanderer — paper-crane companion.
 *
 * Server component: renders the `#companion` host + the SVG fallback
 * (byte-for-byte from `_reference/portfolio/companion.js:211–219`), then
 * mounts `<WandererCraneClient />`, which imports the Three.js scene only
 * after the desktop/motion policy passes. The CSS module hides this entire
 * host outside that policy; on allowed desktops the SVG stays visible until
 * WebGL is live and remains as the no-WebGL fallback.
 */
export function Wanderer() {
  return (
    <div id="companion" className={`companion ${styles.companion}`} aria-hidden="true">
      <svg className="companion-svg" viewBox="0 0 120 80" aria-hidden="true">
        <polygon
          points="10,50 60,15 55,45 100,30 70,55 80,70 55,60 30,72"
          fill="#f5ece0"
          stroke="#2a2a2a"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <polygon points="55,45 100,30 70,55" fill="#e8dcc8" />
        <polygon points="55,60 80,70 70,55" fill="#e8dcc8" />
        <circle cx="60" cy="20" r="2" fill="#2a2a2a" />
      </svg>
      <WandererCraneClient />
    </div>
  );
}
