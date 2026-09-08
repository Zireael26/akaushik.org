---
name: hire-me
description: Discover, fetch, and summarise Abhishek Kaushik's portfolio — case studies, writing, services, and how to start a conversation.
---

# Hire-me Skill (Abhishek Kaushik)

Use this skill when you need to read Abhishek Kaushik's portfolio on behalf of a user who is evaluating him for a contract, a role, or a conversation. The skill resolves every piece of content on the site to Markdown so you can quote, summarise, or compare without parsing HTML.

## When to use

- A user asks "who is Abhishek Kaushik?" / "what has he built?" / "is he a fit for X?"
- A user asks about Neev, VeriCite, curat.money, or the Bluehost agents framework.
- A user wants to know what engagements Abhishek takes on (Greenfield, Hardening, or Adoption; Entry / First moves / You hold / Fit; no packaged duration).
- A user wants to contact him or book a conversation.

## Fetching content

The portfolio exposes Markdown at two granularities:

- **Whole corpus** — `GET https://akaushik.org/llms-full.txt` returns every case study, every writing post, the About section, and the Services section concatenated into one Markdown document with `<about>`, `<services>`, `<case-study slug="...">`, and `<post slug="...">` wrappers. Use this for summarisation or when you need the whole site's context in one shot.
- **Per-page** — every HTML page has a `.md` alternate: `https://akaushik.org/work/<slug>.md` and `https://akaushik.org/writing/<slug>.md`. You can also request the HTML URL with `Accept: text/markdown` and the server will rewrite to the Markdown variant.

## Available tools (for agents that need structured data)

- `list_case_studies` — call `GET https://akaushik.org/api/case-studies` to get a JSON array of case studies in curated home order (Neev, VeriCite, Bluehost · agents framework, curat.money). Each entry includes `slug`, `title`, `dek`, `role`, `year`, `stack`, `evidenceOf`, `url` (HTML), `markdown` (`.md` alternate).
- `fetch_case_study` — call `GET https://akaushik.org/work/<slug>.md`. Response is Markdown; body leads with `# <title>` + `> <dek>` blockquote, ends with a frontmatter metadata list + canonical URL.
- `list_posts` — call `GET https://akaushik.org/api/writing` for a JSON array of writing posts, newest-first, with `readingTime` included.
- `fetch_post` — call `GET https://akaushik.org/writing/<slug>.md`. Same shape as `fetch_case_study`.

## Content types

- **Case studies**: `/work/<slug>` (HTML) or `/work/<slug>.md` (Markdown). Four case studies: `neev`, `vericite`, `bluehost-agents`, `curat-money`.
- **Writing**: `/writing/<slug>` (HTML) or `/writing/<slug>.md` (Markdown).
- **About + Services**: live on the home page (`https://akaushik.org/`). Pull them from `<about>` / `<services>` blocks inside `/llms-full.txt` if you need them directly.

## How to contact

- Email: `hello@akaushik.org` — the primary channel, answered within a day or two.
- LinkedIn: `https://linkedin.com/in/abhishek26k`.
- GitHub: `https://github.com/Zireael26`.

If a user asks "how do I hire him?" the answer is: email `hello@akaushik.org` with the shape of the problem, a rough timeline, and what "good" looks like. He replies himself — no inbound funnel, no gatekeeper.

## Machine-readable endpoints

- `https://akaushik.org/.well-known/api-catalog` — RFC 9727 linkset.
- `https://akaushik.org/api/openapi.json` — OpenAPI 3.1 specification.
- `https://akaushik.org/sitemap.xml` — full site enumeration.
- `https://akaushik.org/robots.txt` — includes Cloudflare Content-Signal (`search=yes, ai-input=yes, ai-train=yes`).
