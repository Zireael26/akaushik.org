/**
 * Friends Portal (Spec 007) · Markdown & Link Pipeline
 *
 * Strict, server-safe Plain Markdown allowlist compiler:
 * - MD-001 / MD-002 / MD-003: Plain Markdown AST, strict rehype sanitization, no MDX/JSX/raw scripts.
 * - LNK-001 / LNK-002 / LNK-003: Safe wikilinks, repeated occurrence edges, verified DAL routing.
 * - CNT-004: External links are visibly marked (class="external-link" data-external="true") with rel="noopener noreferrer".
 * - Credentialed URLs (URL.username / URL.password) strictly rejected into inert text.
 * - Pre-normalizes linkReference / imageReference / definition nodes to enforce uniform fail-closed security.
 * - Fail-closed: Relative links and wikilinks fail closed to inert spans without disclosing private existence or titles.
 * - Media routes: Authorized assets use /api/media/:assetId. All other remote/relative images blocked into inert spans.
 * - Same-document fragment jumps ([jump](#intro)) mapped to consistent 'h-' heading anchors.
 * - Wikilink fragments ([[target#intro]]) mapped to verified DAL routes with 'h-' heading anchors.
 * - Heading IDs with consistent 'h-' clobber protection matching heading.href across English and Devanagari Hindi.
 * - Block IDs (COM-001) align with DAL revision pinning: ${revisionId}:b${ordinal} when revisionId supplied, else b${ordinal}.
 * - Bounded input bytes, node count, and depth, with RangeError stack overflows mapped to MarkdownLimitError.
 * - Strongly-typed HAST tree (HastRoot) captured directly from post-sanitization AST.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString as mdastToString } from 'mdast-util-to-string';

// --- Strongly-Typed HAST Tree (HastRoot) ---

export interface HastProperties {
  [key: string]: boolean | number | string | (string | number)[] | null | undefined;
}

export interface HastText {
  type: 'text';
  value: string;
}

export interface HastElement {
  type: 'element';
  tagName: string;
  properties?: HastProperties;
  children: (HastElement | HastText | HastComment)[];
}

export interface HastComment {
  type: 'comment';
  value: string;
}

export interface HastRoot {
  type: 'root';
  children: (HastElement | HastText | HastComment)[];
  data?: Record<string, unknown>;
}

// --- Error Definitions ---

export class MarkdownLimitError extends Error {
  code: 'INPUT_TOO_LARGE' | 'TOO_MANY_NODES' | 'EXCESSIVE_DEPTH';
  limit: number;
  actual: number;

  constructor(code: 'INPUT_TOO_LARGE' | 'TOO_MANY_NODES' | 'EXCESSIVE_DEPTH', message: string, limit: number, actual: number) {
    super(message);
    this.name = 'MarkdownLimitError';
    this.code = code;
    this.limit = limit;
    this.actual = actual;
  }
}

// --- Resolver Contracts ---

export interface LinkResolverResult {
  id: string;
  slug: string;
  href: string; // Verified route from application DAL (e.g. /reader/slug)
  title?: string;
  isAuthorized: boolean;
}

export interface AssetResolverResult {
  id: string;
  href?: string; // Verified media route from application DAL (e.g. /api/media/id)
  isAuthorized: boolean;
}

export interface MarkdownParseOptions {
  revisionId?: string;
  currentSlug?: string;
  resolveLink?: (target: string) => LinkResolverResult | null;
  resolveAsset?: (assetId: string) => AssetResolverResult | null;
  maxInputBytes?: number; // default: 512 KiB (524,288 bytes)
  maxNodeCount?: number;  // default: 10,000 nodes
  maxDepth?: number;      // default: 32 levels
}

export interface LinkOccurrence {
  type: 'wikilink' | 'relative' | 'external' | 'asset';
  raw: string;
  target: string;
  alias?: string;
  anchor?: string;
  href?: string;
  isAuthorized: boolean;
  isBroken: boolean;
  blockId?: string;
  line?: number;
  column?: number;
  occurrenceIndex: number; // 1-based index for repeated edges to same target
}

export interface HeadingItem {
  id: string;   // Element ID with h- prefix (e.g. "h-overview" or "h-साइट-टू-स्टोर")
  href: string; // Fragment URL (e.g. "#h-overview" or "#h-साइट-टू-स्टोर")
  text: string; // Heading text
  level: number;// 1 - 6
}

export interface MarkdownParseResult {
  html: string;
  plainText: string;
  ast: HastRoot;
  headings: HeadingItem[];
  links: LinkOccurrence[];
  stats: {
    byteCount: number;
    nodeCount: number;
    maxDepthReached: number;
    wordCount: number;
  };
}

/**
 * Deterministic Unicode-aware heading slugifier.
 * Preserves alphanumeric ASCII, international/Devanagari letters (\p{L}),
 * combining marks/vowels (\p{M}), and numbers (\p{N}).
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '') || 'heading';
}

/**
 * Normalizes heading anchors to match consistent 'h-' prefix.
 */
export function formatHeadingAnchor(raw: string): string {
  const clean = decodeURIComponent(raw).trim();
  if (clean.startsWith('h-')) return clean;
  return 'h-' + slugifyHeading(clean);
}

/**
 * Creates the strict sanitization schema.
 */
function createSanitizeSchema() {
  const schema = structuredClone(defaultSchema);

  schema.tagNames = schema.tagNames || [];
  if (!schema.tagNames.includes('span')) {
    schema.tagNames.push('span');
  }

  schema.attributes = schema.attributes || {};
  schema.attributes['*'] = [
    ...(schema.attributes['*'] || []),
    'id',
    'dataBlockId',
    'dataWikilink',
    'dataTarget',
    'dataStatus',
    'dataReason',
    'dataExternal',
    'className',
    'title'
  ];

  // Specific attributes for anchors per CNT-004
  schema.attributes.a = [
    ...(schema.attributes.a || []).filter((item: any) => !Array.isArray(item) || item[0] !== 'className'),
    'className',
    'rel',
    'dataExternal'
  ];

  // Restrict href protocols: no javascript:, data:, vbscript:
  schema.protocols = schema.protocols || {};
  schema.protocols.href = ['http', 'https', 'mailto'];

  // Images: only asset protocol allowed in sanitized HTML (all others neutralized in AST)
  schema.protocols.src = ['asset'];

  // Preserve DOM clobbering protection with consistent prefix
  schema.clobberPrefix = 'h-';

  return schema;
}

/**
 * Production Markdown parsing, sanitization, and AST compilation pipeline.
 * No bypass switches in production API.
 */
export async function parseMarkdown(
  markdown: string,
  options: MarkdownParseOptions = {}
): Promise<MarkdownParseResult> {
  const maxInputBytes = options.maxInputBytes ?? 512 * 1024; // 512 KiB
  const maxNodeCount = options.maxNodeCount ?? 10_000;
  const maxDepth = options.maxDepth ?? 32;
  const revisionId = options.revisionId;

  // 1. Upfront byte cap check
  const inputBytes = Buffer.byteLength(markdown, 'utf8');
  if (inputBytes > maxInputBytes) {
    throw new MarkdownLimitError(
      'INPUT_TOO_LARGE',
      `Markdown input (${inputBytes} bytes) exceeds maximum limit of ${maxInputBytes} bytes.`,
      maxInputBytes,
      inputBytes
    );
  }

  // 2. Tracking structures
  const headings: HeadingItem[] = [];
  const headingCounts = new Map<string, number>();
  const linkOccurrences: LinkOccurrence[] = [];
  const targetOccurrenceCounts = new Map<string, number>();

  let nodeCount = 0;
  let maxDepthReached = 0;

  // Remark plugin: AST limits & block IDs assignment (COM-001)
  function remarkLimitsAndBlocks() {
    return (tree: any) => {
      function inspectDepth(node: any, depth: number) {
        nodeCount++;
        if (depth > maxDepthReached) maxDepthReached = depth;

        if (nodeCount > maxNodeCount) {
          throw new MarkdownLimitError(
            'TOO_MANY_NODES',
            `AST node count (${nodeCount}) exceeded maximum allowed limit of ${maxNodeCount} nodes.`,
            maxNodeCount,
            nodeCount
          );
        }
        if (depth > maxDepth) {
          throw new MarkdownLimitError(
            'EXCESSIVE_DEPTH',
            `AST nesting depth (${depth}) exceeded maximum allowed depth of ${maxDepth} levels.`,
            maxDepth,
            depth
          );
        }

        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            inspectDepth(child, depth + 1);
          }
        }
      }

      inspectDepth(tree, 1);

      // Assign block IDs matching DAL revision pinning: ${revisionId}:b${idx} if revisionId supplied, else b${idx}
      if (Array.isArray(tree.children)) {
        tree.children.forEach((child: any, idx: number) => {
          const blockId = revisionId ? `${revisionId}:b${idx}` : `b${idx}`;

          child.data = child.data || {};
          child.data.blockId = blockId;
          child.data.hProperties = child.data.hProperties || {};
          child.data.hProperties.dataBlockId = blockId;
        });
      }
    };
  }

  // Remark plugin: Normalize linkReference, imageReference, and definition nodes
  function remarkNormalizeReferences() {
    return (tree: any) => {
      const defs = new Map<string, string>();
      visit(tree, 'definition', (node: any) => {
        if (node.identifier) {
          defs.set(String(node.identifier).toUpperCase(), node.url || '');
        }
      });

      visit(tree, (node: any) => {
        if (node.type === 'linkReference') {
          const id = String(node.identifier || '').toUpperCase();
          const targetUrl = defs.get(id);
          if (targetUrl !== undefined) {
            node.type = 'link';
            node.url = targetUrl;
            delete node.identifier;
            delete node.label;
            delete node.referenceType;
          }
        } else if (node.type === 'imageReference') {
          const id = String(node.identifier || '').toUpperCase();
          const targetUrl = defs.get(id);
          if (targetUrl !== undefined) {
            node.type = 'image';
            node.url = targetUrl;
            delete node.identifier;
            delete node.label;
            delete node.referenceType;
          }
        }
      });

      // Strip definition nodes from AST so they do not produce unverified HTML
      visit(tree, (node: any, index: number | undefined, parent: any) => {
        if (node.type === 'definition' && parent && index !== undefined) {
          parent.children.splice(index, 1);
          return index;
        }
      });
    };
  }

  // Remark plugin: Wikilinks syntax [[target#anchor|alias]] with fail-closed authorization
  function remarkWikilinks() {
    return (tree: any) => {
      function findBlockId(parent: any): string | undefined {
        let curr = parent;
        while (curr) {
          if (curr.data?.blockId) return curr.data.blockId;
          curr = curr._parent;
        }
        return undefined;
      }

      visit(tree, (node: any) => {
        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            child._parent = node;
          }
        }
      });

      visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
        if (!parent || index === undefined) return;
        const val: string = node.value;
        const wikilinkRegex = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
        let match: RegExpExecArray | null;
        let lastIndex = 0;
        const replacements: any[] = [];

        while ((match = wikilinkRegex.exec(val)) !== null) {
          const start = match.index;
          const end = wikilinkRegex.lastIndex;

          if (start > lastIndex) {
            replacements.push({ type: 'text', value: val.slice(lastIndex, start) });
          }

          const target = (match[1] || '').trim();
          const rawAnchor = match[2]?.trim();
          const alias = match[3] ? match[3].trim() : target;
          const blockId = findBlockId(parent);

          const occIndex = (targetOccurrenceCounts.get(target) || 0) + 1;
          targetOccurrenceCounts.set(target, occIndex);

          // Fail-closed wikilink resolution
          let isAuthorized = false;
          let isBroken = true;
          let resolvedHref: string | undefined = undefined;
          const anchorSlug = rawAnchor ? formatHeadingAnchor(rawAnchor) : undefined;

          if (options.resolveLink) {
            const resolved = options.resolveLink(target);
            if (resolved) {
              isAuthorized = resolved.isAuthorized;
              isBroken = false;
              if (isAuthorized) {
                const baseHref = resolved.href || `/reader/${resolved.slug}`;
                resolvedHref = anchorSlug ? `${baseHref}#${anchorSlug}` : baseHref;
              }
            }
          }

          linkOccurrences.push({
            type: 'wikilink',
            raw: match[0],
            target,
            alias,
            anchor: rawAnchor,
            href: resolvedHref,
            isAuthorized,
            isBroken,
            blockId,
            line: node.position?.start?.line,
            column: node.position?.start?.column !== undefined ? node.position.start.column + start : undefined,
            occurrenceIndex: occIndex
          });

          if (isAuthorized && !isBroken && resolvedHref) {
            replacements.push({
              type: 'link',
              url: resolvedHref,
              data: {
                hProperties: {
                  dataWikilink: 'true',
                  dataTarget: target
                }
              },
              children: [{ type: 'text', value: alias }]
            });
          } else {
            // Fail-closed inert span without leaking existence or private titles
            replacements.push({
              type: 'text',
              value: alias,
              data: {
                hName: 'span',
                hProperties: {
                  className: ['inert-link', 'inert-unauthorized'],
                  dataWikilink: 'true',
                  dataStatus: 'unauthorized'
                }
              }
            });
          }

          lastIndex = end;
        }

        if (replacements.length > 0) {
          if (lastIndex < val.length) {
            replacements.push({ type: 'text', value: val.slice(lastIndex) });
          }
          parent.children.splice(index, 1, ...replacements);
          return index + replacements.length;
        }
      });
    };
  }

  // Remark plugin: Headings, Links & Fail-Closed Images
  function remarkLinksAndImages() {
    return (tree: any) => {
      // 1. Process Headings: consistent 'h-' prefix matching rehype-sanitize clobberPrefix
      visit(tree, 'heading', (node: any) => {
        const headingText = mdastToString(node).trim();
        const baseSlug = slugifyHeading(headingText);
        const count = headingCounts.get(baseSlug) || 0;
        headingCounts.set(baseSlug, count + 1);
        const uniqueSlug = count === 0 ? baseSlug : `${baseSlug}-${count}`;

        // Set ID on AST node without h-, because rehype-sanitize with clobberPrefix='h-' prefixes it
        node.data = node.data || {};
        node.data.hProperties = node.data.hProperties || {};
        node.data.hProperties.id = uniqueSlug;

        const renderedId = `h-${uniqueSlug}`;
        headings.push({
          id: renderedId,
          href: `#${renderedId}`,
          text: headingText,
          level: node.depth
        });
      });

      // 2. Process Standard Links: fail-closed relative links; credential rejection; external markers (CNT-004)
      visit(tree, 'link', (node: any, index: number | undefined, parent: any) => {
        const url: string = node.url || '';
        if (node.data?.hProperties?.dataWikilink) return;

        const isFragment = url.startsWith('#');
        const isExternal = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:');
        const isAsset = url.startsWith('asset:');
        const isRelative = !isExternal && !isFragment && !isAsset;
        const linkText = mdastToString(node).trim() || url;
        const occIndex = (targetOccurrenceCounts.get(url) || 0) + 1;
        targetOccurrenceCounts.set(url, occIndex);

        let isAuthorized = false;
        let isBroken = false;
        let verifiedHref: string | undefined = undefined;

        if (isFragment) {
          // Same-document fragment jump: authorized, mapped to h- anchor
          const rawAnchor = url.slice(1);
          const mappedAnchor = formatHeadingAnchor(rawAnchor);
          verifiedHref = '#' + mappedAnchor;
          node.url = verifiedHref;
          isAuthorized = true;
          isBroken = false;
        } else if (isAsset) {
          const assetId = url.slice('asset:'.length);
          if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(assetId) && options.resolveAsset) {
            const resolved = options.resolveAsset(assetId);
            if (resolved?.isAuthorized) {
              isAuthorized = true;
              verifiedHref = resolved.href || `/api/media/${resolved.id}`;
              node.url = verifiedHref;
            } else {
              isBroken = true;
            }
          } else {
            isBroken = true;
          }
        } else if (isExternal) {
          // Reject credentialed URLs (URL.username / URL.password)
          try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
              const parsed = new URL(url);
              if (parsed.username || parsed.password) {
                isAuthorized = false;
                isBroken = true;
              } else {
                isAuthorized = true;
                isBroken = false;
                verifiedHref = url;
              }
            } else {
              isAuthorized = true;
              isBroken = false;
              verifiedHref = url;
            }
          } catch {
            isAuthorized = false;
            isBroken = true;
          }

          if (isAuthorized) {
            // Apply CNT-004 security: rel="noopener noreferrer" + visible external marker
            node.data = node.data || {};
            node.data.hProperties = node.data.hProperties || {};
            node.data.hProperties.rel = 'noopener noreferrer';
            node.data.hProperties.className = ['external-link'];
            node.data.hProperties.dataExternal = 'true';
          }
        } else if (isRelative) {
          if (options.resolveLink) {
            const resolved = options.resolveLink(url);
            if (!resolved) {
              isBroken = true;
              isAuthorized = false;
            } else {
              isAuthorized = resolved.isAuthorized;
              isBroken = false;
              if (isAuthorized) {
                verifiedHref = resolved.href || `/reader/${resolved.slug}`;
                node.url = verifiedHref;
              }
            }
          } else {
            // Resolver absent -> fail closed!
            isAuthorized = false;
            isBroken = true;
          }
        }

        linkOccurrences.push({
          type: isAsset ? 'asset' : isExternal ? 'external' : 'relative',
          raw: url,
          target: url,
          alias: linkText,
          href: isAuthorized ? verifiedHref : undefined,
          isAuthorized,
          isBroken,
          line: node.position?.start?.line,
          column: node.position?.start?.column,
          occurrenceIndex: occIndex
        });

        if (!isAuthorized && parent && index !== undefined) {
          // Neutralize unauthorized/credentialed/unresolved link into inert span without disclosing existence
          parent.children.splice(index, 1, {
            type: 'text',
            value: linkText,
            data: {
              hName: 'span',
              hProperties: {
                className: ['inert-link', 'inert-unauthorized'],
                dataStatus: 'unauthorized'
              }
            }
          });
        }
      });

      // 3. Process Images: Fail-closed. ONLY authorized assets allowed via /api/media/. All others blocked.
      visit(tree, 'image', (node: any, index: number | undefined, parent: any) => {
        if (!parent || index === undefined) return;
        const src: string = node.url || '';
        const alt: string = node.alt || 'attachment';

        const isAsset = src.startsWith('asset:') || src.startsWith('/api/media/') || src.startsWith('/api/assets/');

        if (isAsset && options.resolveAsset) {
          const assetId = src.replace(/^asset:\/?\/?/, '').replace(/^\/api\/(?:media|assets)\//, '');
          const resolved = options.resolveAsset(assetId);
          if (resolved && resolved.isAuthorized) {
            node.url = resolved.href || `/api/media/${resolved.id}`;
            return;
          }
        }

        // Fail-closed for all other images (remote, relative unknown, or unauthorized assets)
        const reason = isAsset ? 'asset-unavailable' : 'remote-image-blocked';
        const label = isAsset ? `[Attachment unavailable: ${alt}]` : `[Remote image blocked: ${alt}]`;

        parent.children.splice(index, 1, {
          type: 'text',
          value: label,
          data: {
            hName: 'span',
            hProperties: {
              className: ['blocked-image'],
              dataReason: reason
            }
          }
        });
        return index + 1;
      });
    };
  }

  // 3. Capture Actual Sanitized HAST Plugin
  let actualSanitizedHast: HastRoot = { type: 'root', children: [] };
  function captureSanitizedHast() {
    return (tree: any) => {
      actualSanitizedHast = structuredClone(tree) as HastRoot;
    };
  }

  // 4. Assemble Unified Pipeline
  const sanitizeSchema = createSanitizeSchema();

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkLimitsAndBlocks)
    .use(remarkNormalizeReferences)
    .use(remarkWikilinks)
    .use(remarkLinksAndImages)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSanitize, sanitizeSchema)
    .use(captureSanitizedHast)
    .use(rehypeStringify, { allowDangerousHtml: true });

  // 5. Execute Processing with RangeError recursion catch
  try {
    const file = await processor.process(markdown);
    const html = String(file);

    // 6. Plain Text Extraction for Search / FTS5
    const plainTextTree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
    const plainText = mdastToString(plainTextTree).replace(/\s+/g, ' ').trim();
    const wordCount = plainText.length > 0 ? plainText.split(/\s+/).length : 0;

    return {
      html,
      plainText,
      ast: actualSanitizedHast,
      headings,
      links: linkOccurrences,
      stats: {
        byteCount: inputBytes,
        nodeCount,
        maxDepthReached,
        wordCount
      }
    };
  } catch (err: any) {
    if (err instanceof RangeError || err.name === 'RangeError' || /stack size/i.test(String(err?.message))) {
      throw new MarkdownLimitError(
        'EXCESSIVE_DEPTH',
        'Markdown parser recursion limit exceeded.',
        maxDepth,
        maxDepth
      );
    }
    throw err;
  }
}
