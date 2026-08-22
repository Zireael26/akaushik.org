/**
 * The section pattern: a factual statement heading with a mono label UNDER it.
 * Never a rule under the heading.
 *
 * Two shapes:
 *   block  — heading over full-width content (The method., Selected work.)
 *   column — the left column of a split-editorial section (Experience, Education)
 *
 * `headingTarget` is the cursor-engine hook. Only the long statement headings
 * carry it; the short ones don't, because the lime arrow pointing at a two-word
 * heading reads as noise rather than emphasis.
 */
export function SectionHead({
  heading,
  label,
  variant = 'block',
  headingTarget = false,
  headingMax,
  id,
}: {
  heading: string;
  label: string;
  variant?: 'block' | 'column';
  headingTarget?: boolean;
  /** max-width in ch, column variant only. */
  headingMax?: number;
  id?: string;
}) {
  return (
    <div className={`px-head px-head--${variant}`}>
      <h2
        className="px-head-title"
        id={id}
        style={headingMax ? { maxWidth: `${headingMax}ch` } : undefined}
        data-cursor-target={headingTarget ? '1' : undefined}
      >
        {heading}
      </h2>
      <div className="px-head-label" data-cursor-target="1">
        {label}
      </div>
    </div>
  );
}
