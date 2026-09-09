'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import styles from './QuestionRegister.module.css';

export interface QuestionRegisterViewSection {
  id: string;
  title: string;
  leadHtml: string;
  trailingHtml: string;
  questions: readonly {
    id: string;
    question: string;
    metadata: readonly { label: string; value: string }[];
  }[];
}

export interface QuestionRegisterProps {
  prefixHtml: string;
  suffixHtml: string;
  sections: readonly QuestionRegisterViewSection[];
  questionCount: number;
}

export function QuestionRegister({ prefixHtml, suffixHtml, sections, questionCount }: QuestionRegisterProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const visibleSections = useMemo(() => sections.map((section) => ({
    ...section,
    questions: deferredQuery
      ? section.questions.filter((question) => [
          section.title,
          question.id,
          question.question,
          ...question.metadata.flatMap((item) => [item.label, item.value]),
        ].join(' ').toLocaleLowerCase().includes(deferredQuery))
      : section.questions,
  })).filter((section) => !deferredQuery || section.questions.length > 0), [deferredQuery, sections]);
  const visibleCount = visibleSections.reduce((sum, section) => sum + section.questions.length, 0);

  return (
    <div className={styles.register}>
      {prefixHtml && <div className={styles.prose} dangerouslySetInnerHTML={{ __html: prefixHtml }} />}

      <div className={styles.tools} aria-label="Question register tools">
        <div>
          <p className={styles.eyebrow}>Meeting question register</p>
          <p className={styles.count} aria-live="polite">
            {deferredQuery ? `${visibleCount} of ${questionCount} questions` : `${questionCount} questions`}
          </p>
        </div>
        <label className={styles.searchLabel}>
          <span>Find a question</span>
          <input
            className={styles.search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by number or phrase"
            autoComplete="off"
          />
        </label>
      </div>

      <nav className={styles.sectionNav} aria-label="Question sections">
        {visibleSections.map((section) => (
          <a key={section.id} href={`#question-section-${section.id.toLowerCase()}`}>
            <strong>{section.id}</strong>
            <span>{section.title}</span>
          </a>
        ))}
      </nav>

      {visibleCount === 0 && (
        <div className={styles.empty} role="status">
          No questions match “{query}”. Clear the search to show all {questionCount} questions.
        </div>
      )}

      <div className={styles.sections}>
        {visibleSections.map((section) => (
          <section
            className={styles.section}
            id={`question-section-${section.id.toLowerCase()}`}
            key={section.id}
            aria-labelledby={`question-section-title-${section.id.toLowerCase()}`}
          >
            <header className={styles.sectionHeader}>
              <span aria-hidden="true">{section.id}</span>
              <h2 id={`question-section-title-${section.id.toLowerCase()}`}>{section.title}</h2>
              <small>{section.questions.length} shown</small>
            </header>
            {section.leadHtml && <div className={styles.prose} dangerouslySetInnerHTML={{ __html: section.leadHtml }} />}
            <div className={styles.cards}>
              {section.questions.map((question) => (
                <article className={styles.card} id={`question-${question.id.toLowerCase()}`} key={question.id}>
                  <div className={styles.questionHeading}>
                    <span className={styles.number}>{question.id}</span>
                    <p>{question.question}</p>
                  </div>
                  {question.metadata.length > 0 && (
                    <dl className={styles.metadata}>
                      {question.metadata.map((item) => (
                        <div key={item.label}>
                          <dt>{item.label}</dt>
                          <dd>{item.value || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </article>
              ))}
            </div>
            {section.trailingHtml && <div className={styles.prose} dangerouslySetInnerHTML={{ __html: section.trailingHtml }} />}
          </section>
        ))}
      </div>

      {suffixHtml && <div className={`${styles.prose} ${styles.templates}`} dangerouslySetInnerHTML={{ __html: suffixHtml }} />}
    </div>
  );
}
