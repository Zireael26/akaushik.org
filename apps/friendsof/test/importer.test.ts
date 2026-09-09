import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  adaptCatalogToSolManifest,
  verifyStagedItem,
  mapToResourceKind,
  type CatalogDocumentEntry,
  type CatalogAssetEntry,
  type RootApprovalManifest,
  type GenericAdaptationOptions
} from '../lib/importer.js';

describe('P1 Generic Private Importer & Sol Manifest Adapter Suite', () => {

  it('maps valid kind strings to canonical Sol ResourceKinds and rejects unknown kinds', () => {
    assert.equal(mapToResourceKind('meeting'), 'meeting');
    assert.equal(mapToResourceKind('research'), 'research');
    assert.equal(mapToResourceKind('presentation'), 'presentation');
    assert.equal(mapToResourceKind('progress_update'), 'progress_update');
    assert.equal(mapToResourceKind('discussion'), 'discussion');
    assert.equal(mapToResourceKind('question'), 'question');
    assert.equal(mapToResourceKind('document'), 'document');

    // Rejects unknown kinds with a fatal Error
    assert.throws(() => {
      mapToResourceKind('invalid-unknown-kind');
    }, /Invalid or unknown resource kind/);
  });

  it('adapts generic staging catalog and root approval to Sol ImportManifest (schemaVersion: 1) without hardcoded values', () => {
    // Synthetic documents
    const syntheticDocs: CatalogDocumentEntry[] = [
      {
        item_id: 'doc_synth_guest_1',
        slug: 'synth-guest-1',
        title: 'Synthetic Guest Document',
        kind: 'document',
        source_reference: 'synthetic/doc1.md',
        source_hash: 'aaaa1111',
        source_bytes: 100,
        attachments: ['asset_synth_1']
      },
      {
        item_id: 'doc_synth_owner_1',
        slug: 'synth-owner-1',
        title: 'Synthetic Owner Document',
        kind: 'research',
        source_reference: 'synthetic/owner1.md',
        source_hash: 'bbbb2222',
        source_bytes: 200
      }
    ];

    // Synthetic assets (including 2 audio assets)
    const syntheticAssets: CatalogAssetEntry[] = [
      {
        item_id: 'asset_synth_1',
        slug: 'asset-synth-1',
        title: 'Synthetic Diagram (SVG)',
        original_filename: 'diagram.svg',
        source_reference: 'synthetic/diagram.svg',
        source_hash: 'cccc3333',
        source_bytes: 300,
        media_type: 'image/svg+xml',
        parent_id: 'doc_synth_guest_1'
      },
      {
        item_id: 'asset_gb_initial_audio_original',
        slug: 'asset-audio-original-qta',
        title: 'Initial Meeting Audio (Master Spatial QTA Archive)',
        original_filename: 'original.qta',
        source_reference: 'audio/original.qta',
        source_hash: '1e2dd4c45756e0e1bd7722e75474c3e48ddcaa2be10d85a02f429bf09f5d1927',
        source_bytes: 88246998,
        media_type: 'audio/quicktime',
        role: 'original',
        parent_id: 'mtg_gb_initial'
      },
      {
        item_id: 'asset_gb_initial_audio_playback',
        slug: 'asset-audio-playback-m4a',
        title: 'Initial Meeting Recording Playback (Lossless AAC M4A)',
        original_filename: 'playback.m4a',
        source_reference: 'audio/playback.m4a',
        source_hash: 'a894cf638ae04d8f0303ef502136bd8584cb1c6e2567ebd0af198211d424844d',
        source_bytes: 29903105,
        media_type: 'audio/mp4',
        role: 'playback',
        parent_id: 'mtg_gb_initial'
      }
    ];

    // Synthetic root approval manifest
    const syntheticApproval: RootApprovalManifest = {
      approved_at: '2026-09-09T04:21:23Z',
      authority: 'Root Curator Selection',
      source_manifest_sha256: 'dddd4444',
      guest_document_ids: ['doc_synth_guest_1'],
      guest_asset_ids: [
        'asset_synth_1',
        'asset_gb_initial_audio_original',
        'asset_gb_initial_audio_playback'
      ],
      owner_only_document_ids: ['doc_synth_owner_1']
    };

    const options: GenericAdaptationOptions = {
      workspaceId: 'ws_custom_tenant',
      manifestId: 'imp_manifest_999',
      sourceLabel: 'Custom Intake',
      createdAt: '2026-09-09T05:00:00Z',
      meetingCorrections: {
        'mtg_gb_initial': {
          occurredAt: '2026-08-27T09:03:45Z',
          occurrenceStatus: 'occurred'
        }
      }
    };

    const { manifest, meetingCorrections } = adaptCatalogToSolManifest(
      syntheticDocs,
      syntheticAssets,
      syntheticApproval,
      options
    );

    // Verify Sol ImportManifest schema
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.manifestId, 'imp_manifest_999');
    assert.equal(manifest.workspaceId, 'ws_custom_tenant');
    assert.equal(manifest.sourceLabel, 'Custom Intake');

    // Total items: 1 guest doc + 3 guest assets + 1 owner doc = 5 items
    assert.equal(manifest.items.length, 5);

    // Verify guest document
    const guestDoc = manifest.items.find(i => i.itemId === 'doc_synth_guest_1')!;
    assert.equal(guestDoc.kind, 'document');
    assert.equal(guestDoc.visibility, 'workspace');
    assert.deepEqual(guestDoc.dependsOn, ['asset_synth_1']);

    // Verify both audio assets are catalog-driven and approved guest downloadable
    const audioOrig = manifest.items.find(i => i.itemId === 'asset_gb_initial_audio_original')!;
    assert.equal(audioOrig.kind, 'asset');
    assert.equal(audioOrig.visibility, 'workspace');
    assert.equal(audioOrig.sourceSha256, '1e2dd4c45756e0e1bd7722e75474c3e48ddcaa2be10d85a02f429bf09f5d1927');
    assert.equal(audioOrig.byteLength, 88246998);

    const audioPlay = manifest.items.find(i => i.itemId === 'asset_gb_initial_audio_playback')!;
    assert.equal(audioPlay.kind, 'asset');
    assert.equal(audioPlay.visibility, 'workspace');
    assert.equal(audioPlay.sourceSha256, 'a894cf638ae04d8f0303ef502136bd8584cb1c6e2567ebd0af198211d424844d');
    assert.equal(audioPlay.byteLength, 29903105);

    // Verify owner document
    const ownerDoc = manifest.items.find(i => i.itemId === 'doc_synth_owner_1')!;
    assert.equal(ownerDoc.kind, 'research');
    assert.equal(ownerDoc.visibility, 'owner_only');

    // Verify meeting corrections passed through cleanly
    assert.equal(meetingCorrections['mtg_gb_initial']?.occurredAt, '2026-08-27T09:03:45Z');
    assert.equal(meetingCorrections['mtg_gb_initial']?.occurrenceStatus, 'occurred');
  });

  it('rejects guest and owner document overlap', () => {
    const docs: CatalogDocumentEntry[] = [
      { item_id: 'doc_overlap', slug: 'overlap', title: 'Overlap', kind: 'document', source_reference: 'doc.md', source_hash: '11', source_bytes: 10 }
    ];
    const approval: RootApprovalManifest = {
      approved_at: '2026-09-09T00:00:00Z',
      authority: 'Test',
      source_manifest_sha256: '22',
      guest_document_ids: ['doc_overlap'],
      guest_asset_ids: [],
      owner_only_document_ids: ['doc_overlap'] // overlap!
    };

    assert.throws(() => {
      adaptCatalogToSolManifest(docs, [], approval, { workspaceId: 'ws_test', manifestId: 'm1', sourceLabel: 'Test' });
    }, /Guest and owner document overlap detected/);
  });

  it('rejects duplicate document or asset IDs in catalog', () => {
    const duplicateDocs: CatalogDocumentEntry[] = [
      { item_id: 'doc_dup', slug: 'dup1', title: 'Dup 1', kind: 'document', source_reference: 'doc1.md', source_hash: '11', source_bytes: 10 },
      { item_id: 'doc_dup', slug: 'dup2', title: 'Dup 2', kind: 'document', source_reference: 'doc2.md', source_hash: '22', source_bytes: 20 }
    ];
    const approval: RootApprovalManifest = {
      approved_at: '2026-09-09T00:00:00Z',
      authority: 'Test',
      source_manifest_sha256: '22',
      guest_document_ids: ['doc_dup'],
      guest_asset_ids: [],
      owner_only_document_ids: []
    };

    assert.throws(() => {
      adaptCatalogToSolManifest(duplicateDocs, [], approval, { workspaceId: 'ws_test', manifestId: 'm1', sourceLabel: 'Test' });
    }, /Duplicate document ID in catalog/);
  });

  it('rejects broken dependency and parent references', () => {
    const brokenDocs: CatalogDocumentEntry[] = [
      { item_id: 'doc_good', slug: 'good', title: 'Good', kind: 'document', source_reference: 'doc.md', source_hash: '11', source_bytes: 10, attachments: ['nonexistent_asset'] }
    ];
    const approval: RootApprovalManifest = {
      approved_at: '2026-09-09T00:00:00Z',
      authority: 'Test',
      source_manifest_sha256: '22',
      guest_document_ids: ['doc_good'],
      guest_asset_ids: [],
      owner_only_document_ids: []
    };

    assert.throws(() => {
      adaptCatalogToSolManifest(brokenDocs, [], approval, { workspaceId: 'ws_test', manifestId: 'm1', sourceLabel: 'Test' });
    }, /Invalid dependency reference "nonexistent_asset"/);
  });

  it('cryptographically verifies staged items and parses markdown AST/plainText/links', async () => {
    const rawMarkdown = '# Test Heading\n\nRefer to [[other-doc|Other]].\n\nText here.';
    const fileBytes = Buffer.from(rawMarkdown, 'utf-8');
    const hash = createHash('sha256').update(fileBytes).digest('hex');

    const item = {
      itemId: 'doc_synth_test',
      sourceRef: 'test/doc.md',
      sourceSha256: hash,
      kind: 'document' as const,
      title: 'Test Doc',
      visibility: 'workspace' as const,
      byteLength: fileBytes.byteLength
    };

    const verified = await verifyStagedItem(item, fileBytes, {
      resolveLink: (t) => t === 'other-doc' ? { id: 'doc_2', slug: 'other-doc', href: '/reader/other-doc', isAuthorized: true } : null
    });

    assert.equal(verified.isValid, true);
    assert.equal(verified.errors.length, 0);
    assert.equal(verified.verifiedBytes, fileBytes.byteLength);
    assert.equal(verified.verifiedHash, hash);
    assert.ok(verified.parsedMarkdown);
    assert.equal(verified.parsedMarkdown.headings.length, 1);
    assert.equal(verified.parsedMarkdown.headings[0].id, 'h-test-heading');
    assert.equal(verified.parsedMarkdown.headings[0].href, '#h-test-heading');
    assert.equal(verified.parsedMarkdown.links.length, 1);
    assert.equal(verified.parsedMarkdown.links[0].href, '/reader/other-doc');
  });

  it('detects byte length and SHA-256 tampering/corruption', async () => {
    const legitBytes = Buffer.from('Original content', 'utf-8');
    const legitHash = createHash('sha256').update(legitBytes).digest('hex');

    const tamperedBytes = Buffer.from('Tampered content!!', 'utf-8');

    const item = {
      itemId: 'doc_tamper_test',
      sourceRef: 'test/tamper.md',
      sourceSha256: legitHash,
      kind: 'document' as const,
      title: 'Tampered Doc',
      visibility: 'workspace' as const,
      byteLength: legitBytes.byteLength
    };

    const verified = await verifyStagedItem(item, tamperedBytes);
    assert.equal(verified.isValid, false);
    assert.ok(verified.errors.some(e => e.includes('Byte length mismatch')));
    assert.ok(verified.errors.some(e => e.includes('SHA-256 mismatch')));
  });

  it('fails with fatal error on non-UTF-8 bytes during Markdown verification', async () => {
    // Non-UTF8 byte sequence: [0xFF, 0xFE, 0xFD]
    const invalidUtf8Bytes = Buffer.from([0xff, 0xfe, 0xfd]);
    const hash = createHash('sha256').update(invalidUtf8Bytes).digest('hex');

    const item = {
      itemId: 'doc_invalid_utf8',
      sourceRef: 'test/bad-utf8.md',
      sourceSha256: hash,
      kind: 'document' as const,
      title: 'Bad UTF-8 Doc',
      visibility: 'workspace' as const,
      byteLength: invalidUtf8Bytes.byteLength
    };

    const verified = await verifyStagedItem(item, invalidUtf8Bytes);
    assert.equal(verified.isValid, false);
    assert.ok(verified.errors.some(e => e.includes('Markdown processing failed')));
  });

});
