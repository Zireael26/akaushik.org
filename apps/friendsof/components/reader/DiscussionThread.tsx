'use client';

import { useState } from 'react';

export type CommentData = {
  id: string;
  author: string;
  text: string;
  isDecision?: boolean;
  isQuestionAnswer?: boolean;
  version?: number;
  date?: string;
};

export type DiscussionThreadProps = {
  threadTitle?: string;
  comments: CommentData[];
  onAddComment?: (text: string) => Promise<{ ok: boolean; error?: string }>;
  isReadOnly?: boolean;
};

export function DiscussionThread({
  threadTitle = 'Discussion & Inquiries',
  comments,
  onAddComment,
  isReadOnly = false,
}: DiscussionThreadProps) {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [commentList, setCommentList] = useState<CommentData[]>(comments);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (onAddComment) {
        const result = await onAddComment(trimmed);
        if (!result.ok) {
          setSubmitError(result.error || 'Failed to save comment');
          return;
        }
      }

      setCommentList((prev) => [
        ...prev,
        {
          id: `c-${Date.now()}`,
          author: 'You',
          text: trimmed,
          date: 'Just now',
        },
      ]);
      setCommentText('');
    } catch {
      setSubmitError('Connection error. Could not post note.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="px-discussion-section">
      <div className="px-article-kicker">
        {threadTitle} ({commentList.length})
      </div>

      {commentList.length > 0 ? (
        commentList.map((c) => (
          <div key={c.id} className="px-comment">
            <div className="px-comment-author">
              {c.author}
              {c.version && c.version > 1 && (
                <span style={{ fontSize: '10px', color: 'var(--ink45)', marginLeft: '6px' }}>
                  (v{c.version})
                </span>
              )}
              {c.isDecision && (
                <span className="is-lime" style={{ marginLeft: '8px' }}>
                  [Promoted Decision]
                </span>
              )}
              {c.isQuestionAnswer && (
                <span className="is-amber" style={{ marginLeft: '8px' }}>
                  [Question Answer]
                </span>
              )}
            </div>
            <p className="px-comment-text">{c.text}</p>
          </div>
        ))
      ) : (
        <p style={{ fontSize: '14px', color: 'var(--ink45)', margin: '14px 0 20px', fontStyle: 'italic' }}>
          No comments or notes have been posted on this revision yet.
        </p>
      )}

      {!isReadOnly && (
        <form onSubmit={handleSubmit} className="px-composer-box">
          <label htmlFor="comment-input" className="px-sr-only">
            Add an observation or response
          </label>
          <textarea
            id="comment-input"
            className="px-composer-textarea"
            placeholder="Add an observation, answer, or note for the next session..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={isSubmitting}
          />

          {submitError && (
            <div
              role="alert"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--px-red-ink)',
                marginTop: '4px',
              }}
            >
              {submitError}
            </div>
          )}

          <div className="px-composer-footer">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink45)' }}>
              Responses anchor to current shared revision
            </span>
            <button
              type="submit"
              disabled={isSubmitting || !commentText.trim()}
              style={{
                background: 'var(--panel)',
                color: 'var(--panelInk)',
                border: '1px solid var(--line)',
                padding: '6px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                opacity: commentText.trim() ? 1 : 0.6,
              }}
            >
              {isSubmitting ? 'Posting...' : 'Post Note'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
