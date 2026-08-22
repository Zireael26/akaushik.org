/**
 * Drop the leading H1 + blockquote dek from an authored writing body.
 *
 * The files under `content/writing/` open with an H1 and a blockquote that
 * mirror the frontmatter title and dek. The article template renders both from
 * frontmatter — breadcrumb, H1, dek, byline, short answer — so that leading
 * pair would appear twice. Everything from the first H2 on renders verbatim.
 * Presentation only; the MDX files are untouched.
 *
 * It lives here rather than in the page because the MDX bodies are compiled at
 * build time now (`scripts/build-mdx-modules.ts`), so the strip has to happen
 * in the generator. One copy, one behaviour.
 */
export function stripTitleChrome(body: string): string {
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === '') i += 1;
  if (i < lines.length && lines[i]!.startsWith('# ')) {
    i += 1;
    while (i < lines.length && lines[i]!.trim() === '') i += 1;
  }
  if (i < lines.length && /^>\s?/.test(lines[i]!)) {
    while (i < lines.length && /^>\s?/.test(lines[i]!)) i += 1;
  }
  return lines.slice(i).join('\n').trim();
}
