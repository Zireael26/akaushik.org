import Link from 'next/link';

import { StatusField } from '@/components/pixel/StatusField';
import { SectionHead } from '@/components/pixel/SectionHead';

/**
 * 404 — page not found.
 *
 * Server component. Renders a hero-scale decorative field (the agent graph
 * with one severed edge and one unreachable node) followed by a plain,
 * short statement and a way back. Copy is deliberately spare and in the
 * register of docs/voice.md with no invented detail. The field is
 * decorative — the surrounding copy already says what happened — so it stays
 * aria-hidden and never takes focus.
 */
export default function NotFound() {
  return (
    <main id="top" className="px-status">
      <StatusField variant="not-found" />
      <div className="px-status-body">
        <SectionHead heading="Page not found." label="404" variant="block" as="h1" level={1} />
        <p className="px-status-copy">This page does not exist.</p>
        <div className="px-status-actions">
          <Link href="/" className="px-status-link px-notch">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
