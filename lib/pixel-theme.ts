/**
 * Theme state for the canvas islands.
 *
 * gaurijha.com's original kept its own listener Set and required every theme
 * change to route through its own setDark(). That does not hold here: this site
 * already has two writers of html[data-mode] — public/init-theme.js before first
 * paint, and components/pixel/ThemeSwitch.tsx on click — and neither knows about
 * the canvases.
 *
 * So the subscription watches the attribute instead of the call site. Any writer
 * works, including a future one, and the canvases re-theme without a reload.
 */

export function isDark(): boolean {
  return document.documentElement.getAttribute('data-mode') === 'dark';
}

/** Returns an unsubscribe. Canvas islands call this in place of polling. */
export function onThemeChange(fn: (dark: boolean) => void): () => void {
  let last = isDark();
  const observer = new MutationObserver(() => {
    const next = isDark();
    if (next === last) return;
    last = next;
    fn(next);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-mode'],
  });
  return () => observer.disconnect();
}
