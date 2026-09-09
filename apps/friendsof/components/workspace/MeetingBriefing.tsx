import Link from 'next/link';

export type MeetingBriefingProps = {
  meetingId?: string | null;
  topicTitle?: string;
  focusTitle?: string;
  focusDesc?: string;
  statusText?: string;
};

export function MeetingBriefing({
  meetingId,
  topicTitle,
  focusTitle,
  focusDesc,
  statusText,
}: MeetingBriefingProps) {
  if (!meetingId || !topicTitle) {
    return (
      <section className="px-section" id="section-briefing">
        <div className="px-split">
          <div className="px-head--column">
            <div className="px-head-label">Next conversation</div>
            <h2 className="px-head-title">Meeting briefing.</h2>
            <p className="px-split-intro">
              No upcoming meeting pack or briefing is currently active in this workspace.
            </p>
          </div>
          <div className="px-split-body">
            <div className="px-row is-last">
              <div className="px-row-tag">STATUS</div>
              <div className="px-row-body">
                <strong>No scheduled session</strong><br />
                Meeting materials and focus topics will appear here when scheduled.
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-section" id="section-briefing">
      <div className="px-split">
        <div className="px-head--column">
          <div className="px-head-label">Next meeting topic</div>
          <h2 className="px-head-title">For our next conversation.</h2>
          <p className="px-split-intro">
            Upcoming session materials, agenda focus areas, and preparatory notes.
          </p>
        </div>

        <div className="px-split-body">
          <div className="px-row is-interactive">
            <div className="px-row-tag is-cobalt">TOPIC</div>
            <div className="px-row-body">
              <strong>
                <Link href={`/meetings/${meetingId}`}>{topicTitle}</Link>
              </strong>
            </div>
          </div>

          {focusTitle && (
            <div className="px-row">
              <div className="px-row-tag is-amber">FOCUS</div>
              <div className="px-row-body">
                <strong>{focusTitle}</strong>
                {focusDesc && <><br />{focusDesc}</>}
              </div>
            </div>
          )}

          {statusText && (
            <div className="px-row is-last">
              <div className="px-row-tag">STATUS</div>
              <div className="px-row-body">
                <strong>Meeting status</strong>
                <br />
                {statusText}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
