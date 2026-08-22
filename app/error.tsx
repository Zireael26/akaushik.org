'use client';

import Link from 'next/link';

import { StatusField } from '@/components/pixel/StatusField';
import { SectionHead } from '@/components/pixel/SectionHead';

/**
 * Error boundary for the app segment.
 *
 * Client component as Next.js requires: it receives `{ error, reset }` from
 * the framework. Copy is plain and restrained — a statement of failure with
 * two actions and no invented detail, per docs/voice.md. The field uses the
 * same network as the hero graph with one node overdriven and its incident
 * edges recoiling, at hero scale. It is decorative — the heading and copy
 * already carry the meaning — so it stays aria-hidden and the field engine
 * respects prefers-reduced-motion on its own.
 */
export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="top" className="px-status">
      <StatusField variant="error" />
      <div className="px-status-body">
        <SectionHead heading="Something failed." label="Error" variant="block" as="h1" level={1} />
        <p className="px-status-copy">This page could not be rendered.</p>
        <div className="px-status-actions">
          <button type="button" onClick={() => reset()} className="px-status-button px-notch">
            Try again
          </button>
          <Link href="/" className="px-status-link px-notch">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
