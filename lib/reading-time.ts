/**
 * Estimate reading time for plain-text / MDX body copy.
 * 200 wpm is the standard for body copy; tight technical prose trends slower
 * but the default reads honestly on our case-study + writing pages.
 */
const WPM = 200;

export function getReadingTime(content: string): string {
  const words = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/^[ \t]*[-*]\s+/gm, ' ')
    .replace(/[#*_>`]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const minutes = Math.max(1, Math.round(words / WPM));
  return `${minutes} min read`;
}
