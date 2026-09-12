'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/app/actions';
import type { SavedAnswer, SelfGrade } from '@/lib/progress';

const GRADES: ReadonlyArray<{ value: SelfGrade; label: string }> = [
  { value: 'confident', label: 'Got it' },
  { value: 'partial', label: 'Partly' },
  { value: 'missed', label: 'Missed it' },
];

export interface AnswerFormProps {
  /** 'assignment' keys on lesson number, 'assessment' on module number. */
  kind: 'assignment' | 'assessment';
  keyValue: number;
  prompt: string;
  /** The worked answer. Held until the reader asks for it. */
  answer: string;
  saved: SavedAnswer | null;
  action: (formData: FormData) => Promise<ActionResult>;
}

/**
 * Write-then-compare. The model answer is in the page from the start — this is
 * a study aid for someone who wants to learn, not an exam, and pretending the
 * text is secret would mean a round trip that adds nothing. What the reveal
 * does do is record that it happened, so the reader can see later which
 * answers they reached on their own.
 */
export function AnswerForm({ kind, keyValue, prompt, answer, saved, action }: AnswerFormProps) {
  const [response, setResponse] = useState(saved?.response ?? '');
  const [revealed, setRevealed] = useState(saved?.revealed ?? false);
  const [grade, setGrade] = useState<SelfGrade | null>(saved?.selfGrade ?? null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fieldId = `${kind}-${keyValue}`;
  const dirty =
    response !== (saved?.response ?? '') ||
    revealed !== (saved?.revealed ?? false) ||
    grade !== (saved?.selfGrade ?? null);

  function persist(next: { revealed?: boolean; grade?: SelfGrade | null }) {
    const form = new FormData();
    form.set(kind === 'assignment' ? 'lessonNumber' : 'moduleNumber', String(keyValue));
    form.set('response', response);
    form.set('revealed', String(next.revealed ?? revealed));
    const effectiveGrade = next.grade !== undefined ? next.grade : grade;
    if (effectiveGrade) form.set('selfGrade', effectiveGrade);

    setStatus(null);
    startTransition(async () => {
      const result = await action(form);
      setStatus(result.ok ? 'Saved' : (result.error ?? 'Could not save'));
    });
  }

  function handleReveal() {
    setRevealed(true);
    persist({ revealed: true });
  }

  function handleGrade(value: SelfGrade) {
    const next = grade === value ? null : value;
    setGrade(next);
    persist({ grade: next });
  }

  return (
    <section className="px-panel" aria-labelledby={`${fieldId}-heading`}>
      <div className="px-eyebrow">
        {kind === 'assignment' ? 'Assignment' : 'Module assessment'}
      </div>
      <p className="px-quiz-prompt" id={`${fieldId}-heading`}>
        {prompt}
      </p>

      <div className="px-field">
        <label className="px-label" htmlFor={`${fieldId}-response`}>
          Your answer
        </label>
        <textarea
          id={`${fieldId}-response`}
          className="px-textarea"
          value={response}
          onChange={(event) => {
            setResponse(event.target.value);
            setStatus(null);
          }}
          placeholder="Write your answer before revealing the worked one."
          spellCheck
        />
      </div>

      <div className="px-quiz-actions">
        <button
          type="button"
          className="px-button"
          onClick={() => persist({})}
          disabled={pending || !dirty}
        >
          {pending ? 'Saving' : 'Save answer'}
        </button>

        {!revealed && (
          <button type="button" className="px-button px-button--ghost" onClick={handleReveal}>
            Reveal worked answer
          </button>
        )}

        {revealed && (
          <div className="px-grades" role="group" aria-label="How did you do?">
            {GRADES.map((option) => (
              <button
                key={option.value}
                type="button"
                data-grade={option.value}
                className={`px-grade ${grade === option.value ? 'is-on' : ''}`}
                aria-pressed={grade === option.value}
                onClick={() => handleGrade(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {status && (
        <p className="px-saved-note" role="status" style={{ marginTop: '10px' }}>
          {status}
        </p>
      )}

      {revealed && (
        <div className="px-answer">
          <div className="px-answer-label">Worked answer</div>
          <p className="px-answer-text">{answer}</p>
        </div>
      )}
    </section>
  );
}
