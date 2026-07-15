import { describe, expect, it } from 'vitest';
import {
  PERSON_ID,
  ORG_ID,
  WEBSITE_ID,
  SITE_URL,
  personNode,
  organizationNode,
  websiteNode,
  siteGraph,
  articleGraph,
  caseStudyGraph,
  breadcrumbGraph,
  jsonLdString,
} from './structured-data';
import type { CaseStudyFrontmatter, WritingFrontmatter } from './content';

describe('structured-data', () => {
  it('exposes stable @id URIs anchored to SITE_URL', () => {
    expect(SITE_URL).toBe('https://akaushik.org');
    expect(PERSON_ID).toBe('https://akaushik.org/#person');
    expect(ORG_ID).toBe('https://akaushik.org/#organization');
    expect(WEBSITE_ID).toBe('https://akaushik.org/#website');
  });

  it('personNode carries the @id, sameAs, and worksFor reference', () => {
    const p = personNode();
    expect(p['@type']).toBe('Person');
    expect(p['@id']).toBe(PERSON_ID);
    expect(p['name']).toBe('Abhishek Kaushik');
    expect(p['sameAs']).toEqual(
      expect.arrayContaining([
        'https://github.com/Zireael26',
        'https://www.linkedin.com/in/abhishek26k',
        'https://x.com/abhi2601k',
      ]),
    );
    expect(p['worksFor']).toEqual({ '@id': ORG_ID });
  });

  it('organizationNode references the founder by @id', () => {
    const o = organizationNode();
    expect(o['@type']).toBe('Organization');
    expect(o['@id']).toBe(ORG_ID);
    expect(o['founder']).toEqual({ '@id': PERSON_ID });
  });

  it('websiteNode references the publisher by @id', () => {
    const w = websiteNode();
    expect(w['@type']).toBe('WebSite');
    expect(w['@id']).toBe(WEBSITE_ID);
    expect(w['publisher']).toEqual({ '@id': ORG_ID });
    expect(w['url']).toBe(SITE_URL);
  });

  it('siteGraph emits a single @graph with Person + Organization + WebSite', () => {
    const g = siteGraph();
    expect(g['@context']).toBe('https://schema.org');
    const graph = g['@graph'] as Array<Record<string, unknown>>;
    expect(graph).toHaveLength(3);
    expect(graph.map((n) => n['@type'])).toEqual(['Person', 'Organization', 'WebSite']);
  });

  it('articleGraph cross-references PERSON_ID + ORG_ID by author and publisher', () => {
    const fm: WritingFrontmatter = {
      title: 'Notes on agents',
      dek: 'A short dek',
      date: '2026-05-01',
    };
    const a = articleGraph('notes-on-agents', fm);
    expect(a['@type']).toBe('Article');
    expect(a['@id']).toBe('https://akaushik.org/writing/notes-on-agents#article');
    expect(a['author']).toEqual({ '@id': PERSON_ID });
    expect(a['publisher']).toEqual({ '@id': ORG_ID });
    expect(a['headline']).toBe('Notes on agents');
    expect(a['url']).toBe('https://akaushik.org/writing/notes-on-agents');
  });

  it('caseStudyGraph marks articleSection as "Case study" and carries the stack as keywords', () => {
    const fm: CaseStudyFrontmatter = {
      title: 'Neev',
      dek: 'MSME platform',
      index: '01',
      tag: 'Modular monolith',
      year: '2026—now',
      role: 'CTO',
      stack: ['Next.js', 'Postgres'],
      evidenceOf: 'AI for MSMEs',
    };
    const c = caseStudyGraph('neev', fm);
    expect(c['@type']).toBe('Article');
    expect(c['articleSection']).toBe('Case study');
    expect(c['keywords']).toEqual(['Next.js', 'Postgres']);
    expect((c['about'] as { name: string }).name).toBe('AI for MSMEs');
    expect(c['@id']).toBe('https://akaushik.org/work/neev#case-study');
  });

  it.each([
    {
      section: 'work' as const,
      slug: 'neev',
      title: 'Neev',
      names: ['Home', 'Work', 'Neev'],
      urls: [
        'https://akaushik.org/',
        'https://akaushik.org/work',
        'https://akaushik.org/work/neev',
      ],
    },
    {
      section: 'writing' as const,
      slug: 'ai-for-msme',
      title: 'Notes on bringing AI to an MSME',
      names: ['Home', 'Writing', 'Notes on bringing AI to an MSME'],
      urls: [
        'https://akaushik.org/',
        'https://akaushik.org/writing',
        'https://akaushik.org/writing/ai-for-msme',
      ],
    },
  ])('breadcrumbGraph emits canonical $section detail-page crumbs', ({ section, slug, title, names, urls }) => {
    const breadcrumbs = breadcrumbGraph(section, slug, title);
    const items = breadcrumbs['itemListElement'] as Array<Record<string, unknown>>;

    expect(breadcrumbs['@context']).toBe('https://schema.org');
    expect(breadcrumbs['@type']).toBe('BreadcrumbList');
    expect(breadcrumbs['@id']).toBe(`${urls.at(-1)}#breadcrumb`);
    expect(items.map((item) => item['position'])).toEqual([1, 2, 3]);
    expect(items.map((item) => item['name'])).toEqual(names);
    expect(items.map((item) => item['item'])).toEqual(urls);
  });

  it('jsonLdString round-trips to JSON when the script-tag escapes are reversed', () => {
    const out = jsonLdString(personNode());
    const restored = out
      .replace(/\\u003c/g, '<')
      .replace(/\\u003e/g, '>')
      .replace(/\\u0026/g, '&');
    const parsed = JSON.parse(restored);
    expect(parsed['@type']).toBe('Person');
    expect(parsed['@id']).toBe(PERSON_ID);
  });

  it('jsonLdString escapes <, >, and & so the output cannot break out of a <script> tag', () => {
    const node: Record<string, unknown> = { '@type': 'X', html: '<script>alert("x")</script>&' };
    const out = jsonLdString(node);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c');
    expect(out).toContain('\\u003e');
    expect(out).toContain('\\u0026');
  });
});
