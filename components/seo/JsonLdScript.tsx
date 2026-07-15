// Server component that emits a `<script type="application/ld+json">`
// element directly into the static server HTML, where parse-only crawlers
// (curl, isitagentready.com, Googlebot's first pass, ClaudeBot, GPTBot)
// can read it without executing JavaScript.
//
// `next/script` won't do — in the App Router, `<Script strategy="beforeInteractive">`
// inside the `<head>` of `app/layout.tsx` is *serialised into the React
// Server Components payload*, not rendered as a literal `<script>` tag in
// the static HTML head (verified by `curl localhost:4100/` returning the
// tag only inside an RSC `__next_f.push` chunk). For SEO islands the
// payload-only delivery defeats the point — we need the tag visible to
// parse-only fetchers.
//
// The escaping happens upstream in `lib/structured-data.ts:jsonLdString`,
// which neutralises `<`, `>`, and `&` so the JSON body can never break out
// of the `<script>` tag. All inputs come from author-controlled MDX
// frontmatter and the static profile in `structured-data.ts`; no
// user-submitted content ever flows through here.

import type { ReactElement } from 'react';

export function JsonLdScript({
  id,
  json,
  nonce,
}: {
  id: string;
  json: string;
  nonce?: string;
}): ReactElement {
  return (
    <script
      id={id}
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
