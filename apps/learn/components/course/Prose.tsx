/**
 * Renders a block of course HTML.
 *
 * The HTML was sanitized at build time by scripts/build-course.mjs against a
 * strict allowlist, which is what makes `dangerouslySetInnerHTML` acceptable
 * here: nothing user-authored ever reaches this component, and the string
 * cannot change between build and render.
 */
export function Prose({ html, className = '' }: { html: string; className?: string }) {
  return (
    <div
      className={`px-article-body ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
