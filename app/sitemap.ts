import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/content';

const SITE_URL = 'https://akaushik.org';

// Parses a "YYYY-MM-DD" writing frontmatter date. Falls back to `now` when
// the field is missing or unparseable rather than emitting an Invalid Date.
function writingLastModified(date: string | undefined, now: Date): Date {
  if (!date) return now;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
}

// Case studies don't carry a precise date field — `year` is editorial copy
// like "2026 — now", not an ISO date (a `date`/`updated` frontmatter field
// is deferred editorial work). Pull the leading four-digit year out of that
// string and anchor to Jan 1 of that year; fall back to `now` if the field
// is missing or the leading year can't be parsed.
function caseStudyLastModified(year: string | undefined, now: Date): Date {
  const match = year ? /\d{4}/.exec(year) : null;
  if (!match) return now;
  const parsed = new Date(`${match[0]}-01-01`);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
}

// Home is the highest-authority page (everything links to it). Indexes
// (`/work`, `/writing`) and detail pages get slightly lower priority so
// search engines prefer surfacing the landing page in SERPs for branded
// queries.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const casePosts = getAllPosts('case-studies');
  const writingPosts = getAllPosts('writing');

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/work`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/writing`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/api/docs`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const caseEntries: MetadataRoute.Sitemap = casePosts.map((post) => ({
    url: `${SITE_URL}/work/${post.slug}`,
    lastModified: caseStudyLastModified(post.frontmatter.year, now),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const writingEntries: MetadataRoute.Sitemap = writingPosts.map((post) => ({
    url: `${SITE_URL}/writing/${post.slug}`,
    lastModified: writingLastModified(post.frontmatter.date, now),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticEntries, ...caseEntries, ...writingEntries];
}
