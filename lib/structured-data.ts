// Schema.org JSON-LD generators. Trellis web-seo.md is wary of JSON-LD
// unless it earns a rich result we actually want — the five shapes here all
// do: Person (knowledge panel), Organization (brand panel + sitelinks),
// WebSite (sitelinks search box / site name), Article (article rich result
// in Search + Discover), BreadcrumbList (detail-page hierarchy). Stable @id URIs let the graphs cross-reference
// across pages so Google can unify Person ↔ Author ↔ Publisher.
//
// Single source of truth — every JSON-LD island on the site flows through
// here so the Person profile (sameAs, image, jobTitle) cannot drift between
// the home page and the writing index.

import type { CaseStudyFrontmatter, WritingFrontmatter } from './content';
import { canonical, CANONICAL_ORIGIN } from './canonical';

export const SITE_URL = CANONICAL_ORIGIN;
export const PERSON_ID = `${SITE_URL}/#person`;
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const LOGO_ID = `${SITE_URL}/#logo`;

const PERSON_NAME = 'Abhishek Kaushik';
const PERSON_IMAGE = `${SITE_URL}/images/about/abhishek.webp`;
const ORG_LOGO = `${SITE_URL}/opengraph-image`;
const SAME_AS = [
  'https://github.com/Zireael26',
  'https://www.linkedin.com/in/abhishek26k',
  'https://x.com/abhi2601k',
];

type JsonLdNode = Record<string, unknown>;

export function personNode(): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: PERSON_NAME,
    alternateName: 'abhi',
    url: SITE_URL,
    image: PERSON_IMAGE,
    jobTitle: 'AI Engineer',
    description:
      'Independent engineer building agent-native software. Modular monoliths, retrieval systems, and operational AI.',
    email: 'mailto:hello@akaushik.org',
    knowsAbout: [
      'AI engineering',
      'agent systems',
      'retrieval-augmented generation',
      'modular monolith architecture',
      'TypeScript',
      'Python',
      'Next.js',
    ],
    sameAs: SAME_AS,
    worksFor: { '@id': ORG_ID },
  };
}

export function organizationNode(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'akaushik.org',
    alternateName: 'Abhishek Kaushik — Independent AI Engineering',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      '@id': LOGO_ID,
      url: ORG_LOGO,
      contentUrl: ORG_LOGO,
      width: 1200,
      height: 630,
      caption: 'akaushik.org',
    },
    image: { '@id': LOGO_ID },
    founder: { '@id': PERSON_ID },
    sameAs: SAME_AS,
  };
}

export function websiteNode(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: 'akaushik.org',
    description:
      'Portfolio of Abhishek Kaushik — independent engineer building agent-native software.',
    publisher: { '@id': ORG_ID },
    inLanguage: 'en',
  };
}

// Root layout islands. Three graphs flattened into a single @graph so the
// page emits one <script> tag and Google's parser sees one document.
export function siteGraph(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@graph': [personNode(), organizationNode(), websiteNode()],
  };
}

export function breadcrumbGraph(
  section: 'work' | 'writing',
  slug: string,
  title: string,
): JsonLdNode {
  const sectionName = section === 'work' ? 'Work' : 'Writing';
  const sectionUrl = canonical(`/${section}`);
  const pageUrl = canonical(`/${section}/${slug}`);

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: canonical('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: sectionName,
        item: sectionUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: pageUrl,
      },
    ],
  };
}

// Article — writing detail page.
export function articleGraph(slug: string, fm: WritingFrontmatter): JsonLdNode {
  const url = `${SITE_URL}/writing/${slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: fm.title,
    description: fm.dek,
    datePublished: fm.date,
    dateModified: fm.date,
    author: { '@id': PERSON_ID },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    inLanguage: 'en',
    image: ORG_LOGO,
  };
}

// Case study — modelled as Article with `articleSection: 'Case study'`
// rather than CreativeWork, because Article is what earns rich results in
// Search. The semantic loss is small and the SEO win is real.
export function caseStudyGraph(slug: string, fm: CaseStudyFrontmatter): JsonLdNode {
  const url = `${SITE_URL}/work/${slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#case-study`,
    headline: fm.title,
    description: fm.dek,
    articleSection: 'Case study',
    keywords: fm.stack,
    author: { '@id': PERSON_ID },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    inLanguage: 'en',
    image: ORG_LOGO,
    about: {
      '@type': 'Thing',
      name: fm.evidenceOf,
    },
  };
}

// JSON.stringify, then neutralise the `</script>` sequence and HTML escapes
// that would let user-controlled strings break out of the <script> tag.
// Inputs here are all author-controlled, but this is a one-liner and the
// default is "be paranoid in HTML contexts".
export function jsonLdString(node: JsonLdNode): string {
  return JSON.stringify(node)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
