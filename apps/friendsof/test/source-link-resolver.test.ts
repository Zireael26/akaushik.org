import assert from 'node:assert/strict';
import { parseMarkdown } from '../lib/markdown';
import {
  createSourceAwareLinkResolver,
  type AuthorizedSourceLinkEntry,
} from '../lib/source-link-resolver';

const guestCatalog: AuthorizedSourceLinkEntry[] = [
  {
    kind: 'resource',
    id: 'doc-guide',
    slug: 'doc-guide',
    title: 'Meeting guide',
    sourceRef: 'research/meeting-2026-09-09/01-meeting-guide.md',
  },
  {
    kind: 'resource',
    id: 'doc-finance',
    slug: 'doc-finance',
    title: 'Finance options',
    sourceRef: 'research/04-finance-airgap-options.md',
  },
  {
    kind: 'asset',
    id: 'asset-presentation',
    slug: 'asset-presentation',
    title: 'presentation.pdf',
    sourceRef: 'research/meeting-2026-09-09/output/presentation.pdf',
  },
  {
    kind: 'asset',
    id: 'asset-native-presentation',
    slug: 'asset-native-presentation',
    title: 'presentation.html',
    sourceRef: 'research/meeting-2026-09-09/artifacts/presentation.html',
  },
];

const resolve = createSourceAwareLinkResolver(
  guestCatalog,
  'research/meeting-2026-09-09/README.md',
);

assert.deepEqual(resolve('01-meeting-guide.md'), {
  id: 'doc-guide', slug: 'doc-guide', href: '/reader/doc-guide', title: 'Meeting guide', isAuthorized: true,
});
assert.equal(resolve('../04-finance-airgap-options.md')?.href, '/reader/doc-finance');
assert.equal(resolve('output/presentation.pdf')?.href, '/api/media/asset-presentation');
assert.equal(resolve('output/presentation.html')?.href, '/api/media/asset-native-presentation', 'same-tree asset provenance supports a reviewed relocation');
assert.equal(resolve('private/01-meeting-guide.md'), null, 'path-qualified resource targets are never guessed by basename');
assert.equal(resolve('doc-guide#Opening Questions')?.href, '/reader/doc-guide#h-opening-questions');
assert.equal(resolve('../../../../outside.md'), null, 'logical-root traversal fails closed');
assert.equal(resolve('https://example.test/file.md'), null, 'external URLs are not internalized');
assert.equal(resolve('private-owner-note.md'), null, 'a target absent from the authorized catalog is indistinguishable from missing');

const outsideTree = createSourceAwareLinkResolver([
  ...guestCatalog.filter((entry) => entry.id !== 'asset-native-presentation'),
  { kind: 'asset', id: 'outside-presentation', slug: 'outside-presentation', title: 'presentation.html', sourceRef: 'other-client/artifacts/presentation.html' },
], 'research/meeting-2026-09-09/README.md');
assert.equal(outsideTree('output/presentation.html'), null, 'asset relocation fallback cannot cross the current source tree');

const ambiguous = createSourceAwareLinkResolver([
  ...guestCatalog,
  { kind: 'asset', id: 'other-presentation', slug: 'other-presentation', title: 'presentation.html', sourceRef: 'research/meeting-2026-09-09/archive/presentation.html' },
], 'research/meeting-2026-09-09/README.md');
assert.equal(ambiguous('output/presentation.html'), null, 'ambiguous authorized asset basename fails closed');

const source = '[Guide](01-meeting-guide.md) · [Deck](output/presentation.pdf) · [Private](private-owner-note.md)';
const parsed = await parseMarkdown(source, { resolveLink: resolve });
assert.equal(source, '[Guide](01-meeting-guide.md) · [Deck](output/presentation.pdf) · [Private](private-owner-note.md)', 'rendering never mutates source Markdown');
assert.match(parsed.html, /href="\/reader\/doc-guide"/u);
assert.match(parsed.html, /href="\/api\/media\/asset-presentation"/u);
assert.doesNotMatch(parsed.html, /private-owner-note\.md/u);
assert.equal(parsed.links.filter((link) => link.isAuthorized).length, 2);
assert.equal(parsed.links.filter((link) => !link.isAuthorized).length, 1);

const assetSource = '[Flow](asset:asset-presentation) · [Hidden](asset:asset-hidden) · [Unsafe](javascript:alert(1))';
const parsedAssets = await parseMarkdown(assetSource, {
  resolveLink: resolve,
  resolveAsset: (assetId) => assetId === 'asset-presentation'
    ? { id: assetId, href: `/api/media/${assetId}`, isAuthorized: true }
    : null,
});
assert.equal(assetSource, '[Flow](asset:asset-presentation) · [Hidden](asset:asset-hidden) · [Unsafe](javascript:alert(1))');
assert.match(parsedAssets.html, /href="\/api\/media\/asset-presentation"/u);
assert.doesNotMatch(parsedAssets.html, /asset-hidden/u);
assert.doesNotMatch(parsedAssets.html, /javascript:/u);
assert.equal(parsedAssets.links.some((link) => link.type === 'asset' && link.isAuthorized), true);
assert.equal(parsedAssets.links.some((link) => link.type === 'asset' && !link.isAuthorized), true);

console.log('source-link-resolver: 23 focused assertions passed');
