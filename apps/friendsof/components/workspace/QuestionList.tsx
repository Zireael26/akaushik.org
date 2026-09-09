import Link from 'next/link';

export type QuestionItem = {
  qNumber: string;
  tagClass?: string;
  title: string;
  description: string;
  href?: string;
};

export type QuestionListProps = {
  title?: string;
  label?: string;
  intro?: string;
  questions?: QuestionItem[];
};

export function QuestionList({
  title = 'Where input is needed.',
  label = 'Inquiry & Focus Questions',
  intro = 'Questions and discussion topics awaiting your guidance.',
  questions = [],
}: QuestionListProps) {
  return (
    <section className="px-section" id="section-inquiry" style={{ paddingBottom: 'clamp(48px, 8vh, 96px)' }}>
      <div className="px-split">
        <div className="px-head--column">
          <div className="px-head-label">{label}</div>
          <h2 className="px-head-title">{title}</h2>
          <p className="px-split-intro">{intro}</p>
        </div>

        <div className="px-split-body">
          {questions.length > 0 ? (
            questions.map((q, i) => (
              <div key={i} className={`px-row ${i === questions.length - 1 ? 'is-last' : ''}`}>
                <div className={`px-row-tag ${q.tagClass || 'is-cobalt'}`}>{q.qNumber}</div>
                <div className="px-row-body">
                  <strong>
                    {q.href ? <Link href={q.href}>{q.title}</Link> : q.title}
                  </strong>
                  <br />
                  {q.description}
                </div>
              </div>
            ))
          ) : (
            <div className="px-row is-last">
              <div className="px-row-tag">EMPTY</div>
              <div className="px-row-body" style={{ color: 'var(--ink60)', fontStyle: 'italic' }}>
                No active questions are awaiting input.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
