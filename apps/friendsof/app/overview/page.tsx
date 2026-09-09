import { Header } from '@/components/layout/Header';
import { OverviewHero } from '@/components/workspace/OverviewHero';
import { MeetingBriefing } from '@/components/workspace/MeetingBriefing';
import { CollectionsSection } from '@/components/workspace/CollectionsSection';
import { QuestionList } from '@/components/workspace/QuestionList';
import { getPortalDal, getWorkspaceSummary, getUserDisplayName } from '@/lib/portal-dal';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const dal = await getPortalDal();
  if (!dal) {
    redirect('/');
  }

  let principal;
  try {
    principal = await dal.principal();
  } catch {
    redirect('/');
  }

  const [workspace, resourcesResult, displayName] = await Promise.all([
    getWorkspaceSummary(principal),
    dal.listResources(),
    getUserDisplayName(principal, principal.context.accountId),
  ]);

  if (!resourcesResult.ok) {
    if (resourcesResult.code === 'UNAUTHENTICATED') redirect('/');
  }

  const resources = resourcesResult.ok ? resourcesResult.value : [];
  const meetings = resources.filter((r) => r.kind === 'meeting');
  // Prioritize upcoming scheduled meeting for the briefing card, otherwise fallback to latest
  const scheduledMeeting = meetings.find((m) => (m as unknown as { occurrenceStatus?: string }).occurrenceStatus === 'scheduled');
  const latestMeeting = scheduledMeeting || meetings[0] || null;

  const collectionItems = resources
    .filter((r) => r.kind !== 'meeting' && r.kind !== 'question')
    .map((r) => ({
      title: r.title,
      tag: r.kind.replace('_', ' '),
      tagClass: r.kind === 'research' ? 'is-cobalt' : r.kind === 'presentation' ? 'is-amber' : '',
      href: `/reader/${r.slug}`,
    }));

  const questions = resources
    .filter((r) => r.kind === 'question')
    .map((r, idx) => ({
      qNumber: `Q · ${String(idx + 1).padStart(2, '0')}`,
      tagClass: 'is-cobalt',
      title: r.title,
      description: r.excerpt ?? 'Question awaiting guidance.',
      href: `/reader/${r.slug}`,
    }));

  const user = {
    name: displayName,
    role: principal.role,
  };

  return (
    <div>
      <Header activeNav="overview" user={user} />

      <OverviewHero
        titleLine1={workspace?.name ? `${workspace.name.split(' ')[0]},` : 'Workspace,'}
        titleLine2={workspace?.name ? `${workspace.name.split(' ').slice(1).join(' ')}.` : 'Overview.'}
        subtitle="Shared records · Working notes · Active focus"
        welcomeNote="A place for our work together. Meetings, notes, and questions, kept in one place."
      />

      <MeetingBriefing
        meetingId={latestMeeting?.slug ?? latestMeeting?.id ?? null}
        topicTitle={latestMeeting?.title}
      />

      <CollectionsSection
        title="Records & Inquiries."
        label="Archive & Working Papers"
        intro="Shared working topics, field studies, and meeting records."
        items={collectionItems}
      />

      <QuestionList
        title="Where input is needed."
        label="Inquiry & Focus Questions"
        intro="Questions and discussion topics awaiting your guidance."
        questions={questions}
      />
    </div>
  );
}
