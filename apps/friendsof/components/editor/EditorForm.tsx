'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createResourceAction, saveRevisionAction } from '@/app/actions';
import type { ResourceDetail, ResourceKind } from '@/lib/contracts';

export type EditorFormProps = {
  resource?: ResourceDetail | null;
  workspaceId: string;
};

export function EditorForm({ resource, workspaceId: _workspaceId }: EditorFormProps) {
  const router = useRouter();
  const isEditing = Boolean(resource);

  const [title, setTitle] = useState(resource?.title ?? '');
  const [slug, setSlug] = useState(resource?.slug ?? '');
  const [kind, setKind] = useState<ResourceKind>(resource?.kind ?? 'document');
  const [markdown, setMarkdown] = useState(resource?.revision?.markdown ?? '');
  const [excerpt, setExcerpt] = useState(resource?.excerpt ?? '');
  const [shareWithWorkspace, setShareWithWorkspace] = useState(resource?.lifecycle === 'shared');

  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !markdown.trim() || isSaving) return;

    setIsSaving(true);
    setStatusMessage(null);
    setConflictError(null);

    try {
      if (isEditing && resource) {
        // Edit existing resource: enforces optimistic concurrency with baseRevisionId
        const res = await saveRevisionAction({
          resourceId: resource.id,
          baseRevisionId: resource.headRevisionId,
          title: title.trim(),
          markdown: markdown.trim(),
          excerpt: excerpt.trim() || null,
          visibility: shareWithWorkspace ? 'workspace' : 'owner_only',
          evidenceState: resource.revision.evidenceState,
        });

        if (res.ok) {
          setStatusMessage('✓ Document revision saved successfully.');
          router.refresh();
        } else if (res.conflict) {
          setConflictError(res.error || 'The document was modified in another session.');
        } else {
          setStatusMessage(`Error: ${res.error}`);
        }
      } else {
        // Create new resource
        const res = await createResourceAction(
          {
            kind,
            title: title.trim(),
            markdown: markdown.trim(),
            excerpt: excerpt.trim() || null,
            slug: slug.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            visibility: shareWithWorkspace ? 'workspace' : 'owner_only',
            evidenceState: 'proposal',
          },
          { shareWithWorkspace },
        );

        if (res.ok && res.resource) {
          setStatusMessage('✓ Document created successfully.');
          router.push(`/reader/${res.resource.slug}`);
        } else {
          setStatusMessage(`Error: ${res.error}`);
        }
      }
    } catch {
      setStatusMessage('Error: Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="px-article" style={{ maxWidth: '900px', margin: '0 auto', padding: '40px var(--wrap-pad)' }}>
      <div className="px-article-crumb">
        <Link href="/overview">&larr; Workspace Overview</Link>
      </div>

      <h1 className="px-article-title">
        {isEditing ? 'Edit Document' : 'Write a Note or Document'}
      </h1>
      <div className="px-article-dek">
        {isEditing
          ? `Editing revision ${resource?.headRevisionNumber} · Changes are saved to a new revision.`
          : 'Create a new document, note, or meeting pack for this workspace.'}
      </div>

      {conflictError && (
        <div
          role="alert"
          style={{
            margin: '20px 0',
            padding: '16px',
            border: '1px solid var(--px-red)',
            background: 'color-mix(in srgb, var(--px-red) 8%, var(--bg))',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--px-red-ink)', fontWeight: 600 }}>
            Revision Conflict
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink)' }}>
            {conflictError}
          </p>
          <div>
            <button
              type="button"
              onClick={() => router.refresh()}
              style={{
                background: 'var(--panel)',
                color: 'var(--panelInk)',
                border: '1px solid var(--line)',
                padding: '6px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Reload Latest Revision
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label
            htmlFor="editor-title"
            style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink40)', marginBottom: '6px' }}
          >
            Title
          </label>
          <input
            id="editor-title"
            type="text"
            placeholder="e.g. Site supply verification report"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!isEditing && !slug) {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
              }
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 500,
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              outline: 'none',
            }}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label
              htmlFor="editor-slug"
              style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink40)', marginBottom: '6px' }}
            >
              URL Slug
            </label>
            <input
              id="editor-slug"
              type="text"
              placeholder="site-supply-verification"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isEditing}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                background: 'transparent',
                border: '1px solid var(--line)',
                color: isEditing ? 'var(--ink60)' : 'var(--ink)',
                cursor: isEditing ? 'not-allowed' : 'text',
                outline: 'none',
              }}
              required
            />
          </div>

          <div>
            <label
              htmlFor="editor-kind"
              style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink40)', marginBottom: '6px' }}
            >
              Content Family
            </label>
            <select
              id="editor-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ResourceKind)}
              disabled={isEditing}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            >
              <option value="document">Document / Note</option>
              <option value="meeting">Meeting Pack</option>
              <option value="research">Research Study</option>
              <option value="presentation">Presentation Deck</option>
              <option value="progress_update">Progress Update</option>
              <option value="question">Focus Question</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="editor-excerpt"
            style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink40)', marginBottom: '6px' }}
          >
            Summary / Dek
          </label>
          <input
            id="editor-excerpt"
            type="text"
            placeholder="Brief overview of this document..."
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="editor-body"
            style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink40)', marginBottom: '6px' }}
          >
            Markdown Content
          </label>
          <textarea
            id="editor-body"
            rows={14}
            placeholder="Write plain Markdown with safe [[wikilinks]]..."
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              lineHeight: 1.6,
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              outline: 'none',
              resize: 'vertical',
            }}
            required
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={shareWithWorkspace}
              onChange={(e) => setShareWithWorkspace(e.target.checked)}
            />
            <span>Share with workspace members</span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {statusMessage && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: statusMessage.startsWith('✓') ? 'var(--px-lime-ink)' : 'var(--px-red-ink)',
                }}
              >
                {statusMessage}
              </span>
            )}

            <button
              type="submit"
              disabled={isSaving}
              style={{
                background: 'var(--panel)',
                color: 'var(--panelInk)',
                border: '1px solid var(--line)',
                padding: '8px 18px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11.5px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save Revision' : 'Save Document'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
