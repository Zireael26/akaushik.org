// llms.txt — short-form site digest per llmstxt.org. Served as a Route
// Handler (not a static file) so the Content-Type is consistently
// `text/markdown; charset=utf-8` regardless of request path (the proxy
// rewrites `/` + `Accept: text/markdown` → `/llms.txt`; static file
// serving sets extension-based `text/plain` which defeats AGENT_READINESS
// §4.2's MIME contract).

export const dynamic = 'force-static';
export const revalidate = 3600;

const BODY = `# Abhishek Kaushik — akaushik.org

> Independent engineer building agent-native software. AI systems for businesses that haven't met AI yet.

This file follows the [llmstxt.org](https://llmstxt.org) format. It gives agents the shortest path to useful context without crawling the site.

## About

- Role: AI engineer, ~6 years experience
- Focus: Modular monoliths, retrieval systems, and operational AI for Indian MSMEs and mid-market teams
- Anchor project: Neev — a modular-monolith platform for MSME textile distribution

## Case studies

- [Neev](https://akaushik.org/work/neev): Modular monolith, multi-tenant, tenant_id as a first-class invariant
- [VeriCite](https://akaushik.org/work/vericite): Institutional RAG on top of Hugging Face TEI + Qdrant
- [Bluehost Agents Framework](https://akaushik.org/work/bluehost-agents): Agent runtime powering Bluehost AI features
- [curat.money](https://akaushik.org/work/curat-money): Product-engineering framing, financial data

## Contact

- Email: hello@akaushik.org
- LinkedIn: https://linkedin.com/in/abhishek26k
- GitHub: https://github.com/Zireael26

## Optional

- [Full site content](https://akaushik.org/llms-full.txt)
- [Agent skills index](https://akaushik.org/.well-known/agent-skills/index.json)
- [MCP server card](https://akaushik.org/.well-known/mcp.json)
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'index, follow',
    },
  });
}
