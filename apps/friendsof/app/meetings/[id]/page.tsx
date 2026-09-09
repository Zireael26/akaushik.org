import { Header } from '@/components/layout/Header';
import { RouteField } from '@/components/pixel/RouteField';
import { SourceTabs, type FacetItem } from '@/components/reader/SourceTabs';
import { DiscussionThread } from '@/components/reader/DiscussionThread';
import { AudioPlayer } from '@/components/reader/AudioPlayer';
import { notFound, redirect } from 'next/navigation';
import {
  getPortalDal,
  getResourceBySlug,
  getResourceComments,
  getUserDisplayName,
  buildMarkdownResolvers,
} from '@/lib/portal-dal';
import { parseMarkdown } from '@/lib/markdown';
import { createCommentAction } from '@/app/actions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const [meetingResult, displayName, linkCatalogResult] = await Promise.all([
    getResourceBySlug(dal, id),
    getUserDisplayName(principal, principal.context.accountId),
    dal.authorizedLinkCatalog(),
  ]);

  if (!meetingResult.ok) {
    if (meetingResult.code === 'UNAUTHENTICATED') redirect('/');
    notFound();
  }

  const meetingDetail = meetingResult.value;
  const meeting = meetingDetail.meeting;
  const hasAudio = Boolean(meeting?.playbackAudioAssetId || meeting?.originalAudioAssetId);

  // Concurrently load comments for this meeting resource
  const comments = await getResourceComments(dal, meetingDetail.id, meetingDetail.headRevisionId);

  const linkCatalog = linkCatalogResult.ok ? linkCatalogResult.value : [];
  const resolvers = buildMarkdownResolvers(
    linkCatalog,
    meetingDetail.assets,
    meetingDetail.revision.provenance?.sourceRef,
  );

  const parsed = await parseMarkdown(meetingDetail.revision.markdown, {
    resolveLink: resolvers.resolveLink,
    resolveAsset: resolvers.resolveAsset,
  });

  // Find original asset vs playback derivative asset
  const audioOriginalAsset = meetingDetail.assets.find(
    (a) => a.id === meeting?.originalAudioAssetId || a.purpose === 'original',
  );
  const audioPlaybackAsset = meetingDetail.assets.find(
    (a) => a.id === meeting?.playbackAudioAssetId || a.purpose === 'playback',
  );

  const rawExt = audioOriginalAsset?.filename?.split('.').pop()?.toUpperCase();
  const originalFormat = rawExt || (audioOriginalAsset?.mediaType?.includes('quicktime') ? 'QTA' : 'M4A');
  const originalSize = audioOriginalAsset?.byteLength
    ? `${(audioOriginalAsset.byteLength / (1024 * 1024)).toFixed(1)} MB`
    : undefined;

  // If this meeting has an attached transcript resource, load it
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

  const facets: FacetItem[] = [
    {
      key: 'summary',
      label: 'Summary & Analysis',
      content: (
        <div className="px-article-body">
          <div dangerouslySetInnerHTML={{ __html: parsed.html }} />
        </div>
      ),
    },
  ];

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
    const res = await createCommentAction(meetingDetail.id, meetingDetail.headRevisionId, text);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    return { ok: true };
  }

  return (
    <div>
      <Header activeNav="meetings" user={user} />

      <article className="px-article">
        <div className="px-article-crumb">
          <Link href="/meetings">&larr; Meetings Timeline</Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: meeting?.occurrenceStatus === 'scheduled' ? 'var(--px-cobalt-ink)' : 'var(--px-lime-ink)',
            }}
          >
            [{meeting?.occurrenceStatus ?? 'Session'}]
          </span>
        </div>

        <h1 className="px-article-title">{meetingDetail.title}</h1>
        {meetingDetail.excerpt && <div className="px-article-dek">{meetingDetail.excerpt}</div>}

        <div className="px-article-byline">
          <span>{meeting?.occurredAt ?? meetingDetail.updatedAt}</span>
          <span>&middot;</span>
          <span>{user.name} ({user.role})</span>
        </div>

        <RouteField isHero />

        <SourceTabs facets={facets} />

        <DiscussionThread
          threadTitle="Meeting Discussion"
          comments={commentItems}
          onAddComment={handleAddComment}
        />
      </article>
    </div>
  );
}
