import { Header } from '@/components/layout/Header';
import { ReaderHeader } from '@/components/reader/ReaderHeader';
import { SourceTabs, type FacetItem } from '@/components/reader/SourceTabs';
import { ConnectionMap } from '@/components/reader/ConnectionMap';
import { DiscussionThread } from '@/components/reader/DiscussionThread';
import { AudioPlayer } from '@/components/reader/AudioPlayer';
import { QuestionRegister, type QuestionRegisterViewSection } from '@/components/reader/QuestionRegister';
import { notFound, redirect } from 'next/navigation';
import {
  getPortalDal,
  getResourceBySlug,
  getResourceComments,
  getBacklinks,
  getUserDisplayName,
  buildMarkdownResolvers,
} from '@/lib/portal-dal';
import { parseMarkdown } from '@/lib/markdown';
import { parseQuestionRegister } from '@/lib/question-register';
import { createCommentAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function ReaderSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dal = await getPortalDal();
  if (!dal) {
    redirect('/');
  }

  let principal;
  try {
    principal = await dal.principal('resource.read');
  } catch {
    redirect('/');
  }

  const resourceResult = await getResourceBySlug(dal, slug);
  if (!resourceResult.ok) {
    if (resourceResult.code === 'UNAUTHENTICATED') redirect('/');
    notFound();
  }

  const resource = resourceResult.value;
  const registerDocument = parseQuestionRegister(resource.revision.markdown);
  const displayName = await getUserDisplayName(principal, principal.context.accountId);

  // Load authorized resources for link resolution, backlinks, and comments
  const [linkCatalogResult, backlinksResult, comments] = await Promise.all([
    dal.authorizedLinkCatalog(),
    getBacklinks(dal, resource.id),
    getResourceComments(dal, resource.id, resource.headRevisionId),
  ]);

  const linkCatalog = linkCatalogResult.ok ? linkCatalogResult.value : [];
  const backlinks = backlinksResult.ok ? backlinksResult.value : [];

  // Strictly precompute authorized link & asset resolvers
  const resolvers = buildMarkdownResolvers(
    linkCatalog,
    resource.assets,
    resource.revision.provenance?.sourceRef,
  );

  const parseFragment = async (markdown: string) => markdown
    ? (await parseMarkdown(markdown, {
        resolveLink: resolvers.resolveLink,
        resolveAsset: resolvers.resolveAsset,
      })).html
    : '';

  // Question registers are presented as meeting-friendly cards while the stored
  // Markdown remains byte-for-byte unchanged. Ordinary documents use the reader.
  let registerView: {
    prefixHtml: string;
    suffixHtml: string;
    sections: QuestionRegisterViewSection[];
    questionCount: number;
  } | null = null;
  if (registerDocument) {
    const [prefixHtml, suffixHtml, ...sectionFragments] = await Promise.all([
      parseFragment(registerDocument.prefixMarkdown),
      parseFragment(registerDocument.suffixMarkdown),
      ...registerDocument.sections.flatMap((section) => [
        parseFragment(section.leadMarkdown),
        parseFragment(section.trailingMarkdown),
      ]),
    ]);
    registerView = {
      prefixHtml,
      suffixHtml,
      questionCount: registerDocument.questionCount,
      sections: registerDocument.sections.map((section, index) => ({
        ...section,
        leadHtml: sectionFragments[index * 2] ?? '',
        trailingHtml: sectionFragments[index * 2 + 1] ?? '',
      })),
    };
  }

  const parsed = registerView ? null : await parseMarkdown(resource.revision.markdown, {
    resolveLink: resolvers.resolveLink,
    resolveAsset: resolvers.resolveAsset,
  });

  const meeting = resource.meeting;
  const hasAudio = Boolean(meeting?.playbackAudioAssetId || meeting?.originalAudioAssetId);

  // Find original asset vs playback derivative asset
  const audioOriginalAsset = resource.assets.find(
    (a) => a.id === meeting?.originalAudioAssetId || a.purpose === 'original',
  );
  const audioPlaybackAsset = resource.assets.find(
    (a) => a.id === meeting?.playbackAudioAssetId || a.purpose === 'playback',
  );

  const rawExt = audioOriginalAsset?.filename?.split('.').pop()?.toUpperCase();
  const originalFormat = rawExt || (audioOriginalAsset?.mediaType?.includes('quicktime') ? 'QTA' : 'M4A');
  const originalSize = audioOriginalAsset?.byteLength
    ? `${(audioOriginalAsset.byteLength / (1024 * 1024)).toFixed(1)} MB`
    : undefined;

  // Filter downloadable non-playback assets (PDFs, decks, attachments)
  const downloadableAssets = resource.assets.filter(
    (a) => a.purpose !== 'playback' && a.purpose !== 'waveform',
  );

  // If this resource is a meeting and has an attached transcript, load real transcript
  let transcriptHtml: string | null = null;
  if (meeting?.transcriptResourceId) {
    const transcriptRes = await dal.getResource(meeting.transcriptResourceId);
    if (transcriptRes.ok) {
      const transcriptResolvers = buildMarkdownResolvers(
        linkCatalog,
        transcriptRes.value.assets,
        transcriptRes.value.revision.provenance?.sourceRef,
      );
      const parsedTranscript = await parseMarkdown(transcriptRes.value.revision.markdown, {
        resolveLink: transcriptResolvers.resolveLink,
        resolveAsset: transcriptResolvers.resolveAsset,
      });
      transcriptHtml = parsedTranscript.html;
    }
  }

  // Build dynamic available facets (no empty/useless tabs on regular docs)
  const facets: FacetItem[] = parsed ? [
    {
      key: 'summary',
      label: 'Summary & Analysis',
      content: (
        <div className="px-article-body">
          <div dangerouslySetInnerHTML={{ __html: parsed.html }} />
        </div>
      ),
    },
  ] : [];

  if (transcriptHtml) {
    facets.push({
      key: 'transcript',
      label: 'Transcript',
      content: (
        <div className="px-transcript-block">
          <div dangerouslySetInnerHTML={{ __html: transcriptHtml }} />
        </div>
      ),
    });
  }

  if (hasAudio) {
    facets.push({
      key: 'recording',
      label: 'Audio Recording',
      content: (
        <AudioPlayer
          isAvailable={hasAudio}
          src={audioPlaybackAsset ? `/api/media/${audioPlaybackAsset.id}` : meeting?.playbackAudioAssetId ? `/api/media/${meeting.playbackAudioAssetId}` : undefined}
          downloadUrl={
            audioOriginalAsset
              ? `/api/media/${audioOriginalAsset.id}?download=true`
              : meeting?.originalAudioAssetId
                ? `/api/media/${meeting.originalAudioAssetId}?download=true`
                : undefined
          }
          originalFormat={originalFormat}
          originalSize={originalSize}
          meetingDate={meeting?.occurredAt ?? undefined}
          provenanceNotice="Verified original recording"
        />
      ),
    });
  }

  // Build connection map using verified target slugs
  const connectionItems = [
    ...resource.resolvedLinks.map((link) => ({
      id: link.targetResourceId,
      slug: link.targetSlug,
      title: link.targetTitle || link.label || 'Linked Resource',
      relation: 'Citation',
      context: link.label ?? '',
    })),
    ...backlinks.map((b) => ({
      id: b.sourceResourceId,
      slug: b.sourceSlug,
      title: b.sourceTitle,
      relation: 'Backlink',
      context: b.label ?? '',
    })),
  ];

  const user = {
    name: displayName,
    role: principal.role,
  };

  const commentItems = comments.map((c) => ({
    id: c.id,
    author: c.authorAccountId,
    text: c.bodyMarkdown,
    version: c.version,
    date: c.createdAt,
  }));

  async function handleAddComment(text: string) {
    'use server';
    const res = await createCommentAction(resource.id, resource.headRevisionId, text);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    return { ok: true };
  }

  return (
    <div>
      <Header activeNav="overview" user={user} />

      <article className="px-article">
        <ReaderHeader
          title={resource.title}
          dek={registerView ? undefined : resource.excerpt ?? undefined}
          provenanceState={resource.revision.evidenceState}
          metaDate={resource.updatedAt}
          compact={Boolean(registerView)}
        />

        {registerView && (
          <QuestionRegister
            prefixHtml={registerView.prefixHtml}
            suffixHtml={registerView.suffixHtml}
            sections={registerView.sections}
            questionCount={registerView.questionCount}
          />
        )}
        <SourceTabs facets={facets} />

        {/* Downloadable Authorized Attachments & Decks */}
        {downloadableAssets.length > 0 && (
          <div
            style={{
              margin: '36px 0',
              padding: '20px',
              border: '1px solid var(--line)',
              background: 'color-mix(in srgb, var(--line) 4%, transparent)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--px-cobalt-ink)',
                marginBottom: '14px',
              }}
            >
              Attached Materials &amp; Downloads ({downloadableAssets.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {downloadableAssets.map((asset) => {
                const sizeFormatted =
                  asset.byteLength > 1024 * 1024
                    ? `${(asset.byteLength / (1024 * 1024)).toFixed(1)} MB`
                    : `${Math.round(asset.byteLength / 1024)} KB`;
                const formatLabel = asset.mediaType.split('/')[1]?.toUpperCase() || 'FILE';

                return (
                  <div
                    key={asset.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      padding: '10px 14px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>
                        {asset.filename}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--ink45)',
                          marginTop: '2px',
                        }}
                      >
                        {formatLabel} &middot; {sizeFormatted}
                      </div>
                    </div>

                    <a
                      href={`/api/media/${asset.id}?download=true`}
                      download={asset.filename}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--panel)',
                        color: 'var(--panelInk)',
                        border: '1px solid var(--line)',
                        padding: '6px 12px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10.5px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        textDecoration: 'none',
                      }}
                    >
                      Download {formatLabel} &darr;
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {connectionItems.length > 0 && (
          <ConnectionMap activeTitle={resource.title} connections={connectionItems} />
        )}

        <DiscussionThread
          comments={commentItems}
          onAddComment={handleAddComment}
        />
      </article>
    </div>
  );
}
