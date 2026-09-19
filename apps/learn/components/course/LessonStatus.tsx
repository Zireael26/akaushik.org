'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/app/actions';
import type { LessonStatus as Status } from '@/lib/progress';

export interface LessonStatusProps {
  slug: string;
  initial: Status | null;
  action: (slug: string, status: Status | null) => Promise<ActionResult>;
}

/** Single control: mark this lesson done, or undo it. */
export function LessonStatusToggle({ slug, initial, action }: LessonStatusProps) {
  const [status, setStatus] = useState<Status | null>(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next: Status | null = status === 'done' ? null : 'done';
    setStatus(next);
    startTransition(async () => {
      const result = await action(slug, next);
      // Put the button back where it was if the write did not land, rather
      // than leaving a tick the database does not agree with.
      if (!result.ok) setStatus(status);
    });
  }

  return (
    <button
      type="button"
      className={`px-button ${status === 'done' ? '' : 'px-button--ghost'}`}
      onClick={toggle}
      disabled={pending}
      aria-pressed={status === 'done'}
    >
      {status === 'done' ? 'Completed' : 'Mark complete'}
    </button>
  );
}
