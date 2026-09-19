/**
 * Compiles apps/learn/course/ into a single JSON bundle the Worker imports.
 *
 * Why precompile: the app runs on Cloudflare Workers via OpenNext, where there
 * is no filesystem at request time. Rendering markdown at build time also keeps
 * unified/remark out of the Worker bundle entirely — the runtime only ever
 * touches strings that were already sanitized here.
 *
 * Run: node scripts/build-course.mjs   (wired into `pnpm build` via prebuild)
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString as mdastToString } from 'mdast-util-to-string';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const COURSE = join(APP, 'course');
const OUT = join(APP, 'lib', 'generated', 'course.json');

const read = (p) => readFileSync(join(COURSE, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

/* ------------------------------------------------------------------ *
 * Markdown → HTML
 * ------------------------------------------------------------------ */

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/** course-relative path (`lessons/03-foo.md`, `labs/README.md`) → site route */
function routeForCoursePath(target) {
  const clean = target.replace(/^\.\//, '').split('#')[0];
  const hash = target.includes('#') ? '#' + slugify(decodeURIComponent(target.split('#')[1])) : '';

  const lesson = clean.match(/^lessons\/(\d{2})-([a-z0-9-]+)\.md$/);
  if (lesson) return `/lesson/${lesson[1]}-${lesson[2]}${hash}`;

  if (clean === 'CURRICULUM.md') return `/curriculum${hash}`;
  if (clean === 'START-HERE.md') return `/start${hash}`;
  if (clean === 'QUICK-REFERENCE.md') return `/reference${hash}`;
  if (clean === 'RESEARCH.md') return `/research${hash}`;
  if (clean === 'labs/README.md' || clean === 'labs') return `/labs${hash}`;
  if (clean.startsWith('visuals/')) return `/atlas/${clean === 'visuals/advanced-atlas.html' ? 'advanced' : 'foundations'}`;

  // Everything else is a file the reader can download through the gated route.
  return `/api/course-file/${clean}`;
}

const schema = (() => {
  const s = structuredClone(defaultSchema);
  s.tagNames = [...new Set([...(s.tagNames || []), 'span', 'figure', 'figcaption'])];
  s.attributes = {
    ...s.attributes,
    '*': [...(s.attributes['*'] || []), 'id', 'className'],
    a: [...(s.attributes.a || []), 'rel', 'target', 'dataExternal'],
    code: [...(s.attributes.code || []), 'className'],
    th: [...(s.attributes.th || []), 'align'],
    td: [...(s.attributes.td || []), 'align'],
  };
  s.protocols = { ...(s.protocols || {}), href: ['http', 'https', 'mailto'] };
  // Heading ids are generated here, not author-supplied; no clobber prefix so
  // the fragment in the ToC matches the id on the heading exactly.
  s.clobberPrefix = '';
  return s;
})();

function remarkCourseLinks(headings) {
  return (tree) => {
    const seen = new Map();

    visit(tree, 'heading', (node) => {
      const text = mdastToString(node).trim();
      if (!text) return;
      const base = slugify(text);
      const n = seen.get(base) || 0;
      seen.set(base, n + 1);
      const id = n === 0 ? base : `${base}-${n}`;
      node.data = node.data || {};
      node.data.hProperties = { ...(node.data.hProperties || {}), id };
      headings.push({ id, text, level: node.depth });
    });

    visit(tree, 'link', (node) => {
      const url = String(node.url || '');
      node.data = node.data || {};
      const props = (node.data.hProperties = node.data.hProperties || {});

      if (/^https?:\/\//.test(url)) {
        // Citations open away from the reader; rel is mandatory with target.
        props.rel = 'noopener noreferrer';
        props.target = '_blank';
        // Styled via `a[data-external]`, not a class: rehype-sanitize's default
        // schema filters className values and silently empties an unknown one.
        props.dataExternal = 'true';
        return;
      }
      if (url.startsWith('#')) {
        node.url = '#' + slugify(decodeURIComponent(url.slice(1)));
        return;
      }
      if (url.startsWith('mailto:')) return;
      node.url = routeForCoursePath(url);
    });
  };
}

async function renderMarkdown(markdown) {
  const headings = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(() => remarkCourseLinks(headings))
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(rehypeStringify)
    .process(markdown);

  const plain = mdastToString(unified().use(remarkParse).use(remarkGfm).parse(markdown))
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = plain ? plain.split(/\s+/).length : 0;

  return {
    html: String(file),
    headings,
    wordCount,
    readingMinutes: Math.max(1, Math.round(wordCount / 220)),
  };
}

/** Renders a document but drops its leading `# Title` (the page renders it). */
async function renderBody(markdown) {
  const stripped = markdown.replace(/^#\s+.*\n+/, '');
  return renderMarkdown(stripped);
}

function titleOf(markdown, fallback) {
  const m = markdown.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

/* ------------------------------------------------------------------ *
 * Curriculum parsing
 * ------------------------------------------------------------------ */

/** Splits CURRICULUM.md into the preamble and one section per `## Module N:`. */
function splitCurriculum(markdown) {
  const lines = markdown.split('\n');
  const starts = [];
  lines.forEach((line, i) => {
    const m = line.match(/^##\s+Module\s+(\d+):\s*(.+)$/);
    if (m) starts.push({ index: i, number: Number(m[1]), title: m[2].trim() });
  });

  const preamble = lines.slice(0, starts.length ? starts[0].index : lines.length).join('\n');
  const sections = starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : lines.length;
    return { number: s.number, title: s.title, body: lines.slice(s.index + 1, end).join('\n').trim() };
  });

  // The "Curriculum at a glance" table carries weeks + principal artifact.
  const glance = new Map();
  for (const line of lines) {
    const row = line.match(/^\|\s*([\d–\-]+)\s*\|\s*(\d+)\.\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (row) glance.set(Number(row[2]), { weeks: row[1].trim(), artifact: row[4].trim() });
  }

  return { preamble, sections, glance };
}

/* ------------------------------------------------------------------ *
 * Downloadable assets
 * ------------------------------------------------------------------ */

const ASSET_DIRS = ['labs', 'starter-labs', 'langgraph-example', 'notebooks', 'templates', 'capstones', 'tools', 'visuals', 'output'];
const ROOT_ASSETS = [
  'Harness-Engineering-Course.pdf',
  'Harness-Engineering-Workbook.pdf',
  'Harness-Engineering-Solutions.pdf',
  'Harness-Engineering-Reader.html',
  'MANIFEST.json',
];

function walk(dir, acc = []) {
  for (const entry of readdirSync(join(COURSE, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.name === '.DS_Store' || entry.name === '__pycache__') continue;
    if (entry.isDirectory()) walk(rel, acc);
    else acc.push(rel);
  }
  return acc;
}

function collectAssets() {
  const files = [];
  for (const dir of ASSET_DIRS) if (existsSync(join(COURSE, dir))) walk(dir, files);
  for (const f of ROOT_ASSETS) if (existsSync(join(COURSE, f))) files.push(f);
  return files
    .map((path) => ({ path: path.split('\\').join('/'), bytes: statSync(join(COURSE, path)).size }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

async function main() {
  const manifest = readJson('MANIFEST.json');
  const assignments = readJson('assessments/assignments.json');
  const moduleAssessments = readJson('assessments/module-assessments.json');

  const assignmentByLesson = new Map(assignments.map((a) => [a.lesson, a]));
  const assessmentByModule = new Map(moduleAssessments.map((a) => [a.module, a]));

  // Lessons -------------------------------------------------------------
  const lessons = [];
  for (const entry of manifest.lesson_map) {
    const markdown = read(entry.path);
    const rendered = await renderBody(markdown);
    const full = titleOf(markdown, entry.title);
    const slug = entry.path.replace(/^lessons\//, '').replace(/\.md$/, '');
    const assignment = assignmentByLesson.get(entry.lesson) || null;

    lessons.push({
      number: entry.lesson,
      slug,
      title: full,
      // "Lesson 4: Tool Contracts…" → "Tool Contracts…" for nav and cards.
      shortTitle: full.replace(/^Lesson\s+\d+:\s*/, ''),
      module: entry.module,
      labCommand: entry.lab_command || null,
      html: rendered.html,
      headings: rendered.headings.filter((h) => h.level === 2),
      wordCount: rendered.wordCount,
      readingMinutes: rendered.readingMinutes,
      assignment: assignment
        ? { title: assignment.title, prompt: assignment.prompt, solution: assignment.solution }
        : null,
    });
  }
  lessons.sort((a, b) => a.number - b.number);

  // Modules -------------------------------------------------------------
  const curriculumMd = read('CURRICULUM.md');
  const { preamble, sections, glance } = splitCurriculum(curriculumMd);

  const modules = [];
  for (const section of sections) {
    const body = await renderMarkdown(section.body);
    const meta = glance.get(section.number) || {};
    const assessment = assessmentByModule.get(section.number) || null;
    modules.push({
      number: section.number,
      title: section.title,
      weeks: meta.weeks || null,
      artifact: meta.artifact || null,
      html: body.html,
      lessons: lessons.filter((l) => l.module === section.number).map((l) => l.number),
      labCommand: lessons.find((l) => l.module === section.number)?.labCommand || null,
      assessment: assessment
        ? { title: assessment.title, prompt: assessment.prompt, answer: assessment.answer }
        : null,
    });
  }
  modules.sort((a, b) => a.number - b.number);

  // Standalone documents ------------------------------------------------
  const docs = {};
  for (const [key, path] of Object.entries({
    curriculum: 'CURRICULUM.md',
    start: 'START-HERE.md',
    reference: 'QUICK-REFERENCE.md',
    research: 'RESEARCH.md',
    labs: 'labs/README.md',
    workbook: 'assessments/WORKBOOK.md',
    traceCases: 'assessments/TRACE-CASES.md',
    solutions: 'solutions/SOLUTIONS.md',
    traceKey: 'solutions/TRACE-KEY.md',
    verification: 'VERIFICATION.md',
    capstones: 'capstones/README.md',
  })) {
    if (!existsSync(join(COURSE, path))) continue;
    const markdown = read(path);
    const rendered = await renderBody(markdown);
    docs[key] = {
      path,
      title: titleOf(markdown, key),
      html: rendered.html,
      headings: rendered.headings.filter((h) => h.level <= 2),
      readingMinutes: rendered.readingMinutes,
    };
  }

  const curriculumIntro = await renderBody(preamble);

  const bundle = {
    builtAt: new Date().toISOString(),
    edition: manifest.edition,
    researchAsOf: manifest.research_as_of,
    counts: manifest.counts,
    curriculumIntroHtml: curriculumIntro.html,
    modules,
    lessons,
    docs,
    assets: collectAssets(),
  };

  writeFileSync(OUT, JSON.stringify(bundle));
  const kb = (statSync(OUT).size / 1024).toFixed(0);
  console.log(
    `course bundle → ${relative(APP, OUT)} (${kb} KB): ` +
      `${lessons.length} lessons, ${modules.length} modules, ` +
      `${Object.keys(docs).length} docs, ${bundle.assets.length} assets`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
