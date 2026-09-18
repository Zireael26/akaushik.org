'use client';

/**
 * Demo chat surface (U2).
 *
 * Transport contract with POST /api/chat:
 *   request  JSON { message: string, sessionId: string }
 *   response SSE stream of filtered VeriCite events:
 *     - data {"type":"chunk","data":"..."}          → appended to the live answer
 *     - data {"type":"revised_answer","data":"..."} → replaces the live answer
 *     - data {"type":"sources","sources":[...]}     → rendered as source cards
 *     - data {"type":"answer_verification",
 *              "answer_verification":{"verdict":"..."}} → verdict chip
 *     - data {"type":"answer_gated"}                → abstain state (deliberate
 *       "not found in the documents", never an error)
 *     - data {"type":"error","data":"..."}        → generic failure message
 *     - data: [DONE]                                   → end of stream
 *   Source shape: { id, title, page?, excerpt?, url }.
 *   Verdict values accept an optional `ship_` prefix: ship_verified/verified,
 *   ship_degraded/degraded, abstain. Unknown verdicts render no chip.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import './chat.css';

export interface ChatSource {
  title: string;
  url?: string | null;
  page?: number | string | null;
  excerpt?: string;
}

export interface ChatProps {
  title: string;
  subtitle: string;
  suggestions: string[] | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: ChatSource[];
  verdict?: string;
}

type DonePayload = {
  sources?: ChatSource[];
  /** Direct verdict (set by the answer_gated abstain signal). */
  verdict?: string;
  answer_verification?: { verdict?: string };
  verification?: { verdict?: string };
};

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function normaliseVerdict(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.startsWith('ship_') ? raw.slice('ship_'.length) : raw;
}

function verdictChipLabel(verdict: string): string | null {
  const v = normaliseVerdict(verdict);
  if (v === 'verified') return 'Verified against sources';
  if (v === 'degraded') return 'Partially verified';
  return null;
}

/**
 * Inline pass: **bold** and [n] citation markers, each marker linking to its
 * source card. Everything else is plain text (React escapes it).
 */
function renderInline(text: string, messageId: string, keyBase: string, sources?: ChatSource[]) {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\[\d+\])/g);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    const cite = /^\[(\d+)\]$/.exec(part);
    if (cite) {
      const n = cite[1] ?? '';
      // A marker opens its source document at the cited page; without a
      // source URL it falls back to scrolling to the source card.
      const source = sources?.[Number(n) - 1];
      if (source?.url) {
        return (
          <a
            key={key}
            className="dm-cite"
            href={sourceHref(source)}
            target="_blank"
            rel="noopener noreferrer"
            title={source.title}
          >
            [{n}]
          </a>
        );
      }
      return (
        <a key={key} className="dm-cite" href={`#${sourceAnchor(messageId, n)}`}>
          [{n}]
        </a>
      );
    }
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    return <span key={key}>{part}</span>;
  });
}

const LIST_ITEM = /^\s*(?:[-*\u2022]|(\d+)[.)])\s+(.*)$/;

/**
 * Block pass over the answer's light markdown: paragraphs split on blank
 * lines, consecutive `-`/`*`/`1.` lines become a list, `#` headings render as
 * a bold line. Anything richer stays as text; the answer is never parsed as
 * HTML.
 */
function renderAnswer(text: string, messageId: string, sources?: ChatSource[]) {
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length === 0) return;
    const key = `p${out.length}`;
    out.push(
      <p key={key}>
        {para.map((line, i) => (
          <span key={i}>
            {i > 0 ? <br /> : null}
            {renderInline(line, messageId, `${key}-${i}`, sources)}
          </span>
        ))}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const key = `l${out.length}`;
    const items = list.items.map((item, i) => <li key={i}>{renderInline(item, messageId, `${key}-${i}`, sources)}</li>);
    out.push(list.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flushPara();
      flushList();
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flushPara();
      const ordered = item[1] !== undefined;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item[2] ?? '');
      continue;
    }
    flushList();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    para.push(heading ? `**${(heading[1] ?? '').replace(/\*\*/g, '')}**` : line);
  }
  flushPara();
  flushList();
  return out;
}

function sourceAnchor(messageId: string, n: string | number): string {
  return `dm-source-${messageId}-${n}`;
}

function sourceHref(source: ChatSource): string {
  const url = source.url ?? '';
  if (typeof source.page === 'number') return `${url}#page=${source.page}`;
  return url;
}

function excerptOf(source: ChatSource): string {
  const text = typeof source.excerpt === 'string' ? source.excerpt : '';
  return text.length > 300 ? text.slice(0, 300) : text;
}

export function Chat({ title, subtitle, suggestions }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One conversation per page load: every follow-up carries the same id until
  // the reader starts over with New chat.
  const [sessionId, setSessionId] = useState<string>(() => newId());
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Nothing to follow on an empty thread; scrolling would hide the title.
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streaming]);

  function startNewChat() {
    if (streaming) return;
    setSessionId(newId());
    setMessages([]);
    setInput('');
    setError(null);
  }

  async function send(raw: string) {
    const question = raw.trim();
    if (!question || streaming) return;
    setError(null);
    setInput('');
    const userMsg: ChatMessage = { id: newId(), role: 'user', text: question };
    const answerId = newId();
    setMessages((prev) => [...prev, userMsg, { id: answerId, role: 'assistant', text: '' }]);
    setStreaming(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, sessionId }),
      });
      if (!res.ok || !res.body) {
        throw new Error(
          res.status === 429
            ? 'That is a lot of questions in a few minutes. Please wait a moment and ask again.'
            : res.status === 401
              ? 'Your session has ended. Reload the page to sign in again.'
              : 'The demo did not answer. Please try again.',
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const final: { current: DonePayload | null } = { current: null };

      const appendText = (delta: string) => {
        if (!delta) return;
        buffer += delta;
        const snapshot = buffer;
        setMessages((prev) => prev.map((m) => (m.id === answerId ? { ...m, text: snapshot } : m)));
      };

      const replaceText = (text: string) => {
        buffer = text;
        const snapshot = buffer;
        setMessages((prev) => prev.map((m) => (m.id === answerId ? { ...m, text: snapshot } : m)));
      };

      // Final metadata arrives across several events (sources, then the
      // verification verdict, possibly a gate signal), so merge — never
      // replace — or the last event would discard the earlier ones.
      const applyDone = (payload: DonePayload) => {
        const prev = final.current ?? {};
        final.current = {
          ...prev,
          ...payload,
          answer_verification: payload.answer_verification ?? prev.answer_verification,
          verification: payload.verification ?? prev.verification,
        };
      };

      const handleDataLine = (line: string) => {
        const payload = line.slice('data:'.length).trim();
        if (!payload || payload === '[DONE]') return;
        let evt: {
          type?: string;
          data?: unknown;
          sources?: ChatSource[];
        } & DonePayload;
        try {
          evt = JSON.parse(payload);
        } catch {
          return;
        }
        if (!evt || typeof evt !== 'object') return;
        // Upstream failure: the server sends exactly one generic error
        // event. Surface its message and drop the empty answer bubble so
        // the failure reads as a message, never a blank assistant row.
        if (evt.type === 'error') {
          const message =
            typeof evt.data === 'string' && evt.data.length > 0
              ? evt.data
              : 'The assistant could not complete this response.';
          setError(message);
          setMessages((prev) => prev.filter((m) => m.id !== answerId || m.text.length > 0));
          return;
        }
        // Live answer deltas (the server's filter normalises them to `data`).
        if (evt.type === 'chunk' && typeof evt.data === 'string') {
          appendText(evt.data);
          return;
        }
        // The trust gate replaced the whole answer: swap the live text.
        if (evt.type === 'revised_answer' && typeof evt.data === 'string') {
          replaceText(evt.data);
          return;
        }
        // Gated abstain: a deliberate "not found in the documents" state.
        if (evt.type === 'answer_gated') {
          applyDone({ verdict: 'abstain' });
          return;
        }
        if (evt.type === 'done' || evt.type === 'complete' || evt.type === 'meta' || evt.sources || evt.answer_verification || evt.verification) {
          applyDone(evt);
          return;
        }
        // Recognised JSON but nothing to render — ignore rather than leak it.
      };

      // Line-buffered SSE: a network chunk can end anywhere, including in
      // the middle of a JSON payload, so only complete lines are parsed.
      // Anything that is not a `data:` line (comments, blank separators)
      // is ignored, never rendered.
      let remainder = '';
      const drain = (text: string) => {
        remainder += text;
        let idx = remainder.indexOf('\n');
        while (idx >= 0) {
          const line = remainder.slice(0, idx).replace(/\r$/, '');
          remainder = remainder.slice(idx + 1);
          if (line.startsWith('data:')) handleDataLine(line);
          idx = remainder.indexOf('\n');
        }
      };
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (value) drain(decoder.decode(value, { stream: true }));
        if (streamDone) break;
      }
      drain(decoder.decode() + '\n');

      const verdict =
        final.current?.verdict ??
        final.current?.answer_verification?.verdict ?? final.current?.verification?.verdict ?? undefined;
      if (final.current && (final.current.sources || verdict !== undefined)) {
        const sources = Array.isArray(final.current.sources) ? final.current.sources : undefined;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === answerId ? { ...m, sources, verdict: typeof verdict === 'string' ? verdict : undefined } : m,
          ),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      setError(message);
      // Drop the empty placeholder answer so the thread stays readable.
      setMessages((prev) => prev.filter((m) => m.id !== answerId || m.text.length > 0));
    } finally {
      setStreaming(false);
    }
  }

  const canSend = input.trim().length > 0 && !streaming;
  // After the first question, unasked suggestions stay one tap away above the
  // composer, so a presenter can walk through them in order.
  const asked = new Set(messages.filter((m) => m.role === 'user').map((m) => m.text));
  const remaining = (suggestions ?? []).filter((q) => !asked.has(q));

  return (
    <main className="dm-wrap">
      <div className="dm-head">
        <div>
          <h1 className="dm-title">{title}</h1>
          {subtitle ? <p className="dm-subtitle">{subtitle}</p> : null}
        </div>
        <button type="button" className="dm-new" onClick={startNewChat} disabled={streaming}>
          New chat
        </button>
      </div>

      {suggestions && messages.length === 0 ? (
        <div className="dm-suggest" aria-label="Suggested questions">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              className="dm-chip"
              disabled={streaming}
              onClick={() => void send(q)}
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <div className="dm-list" role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && !streaming && !suggestions ? (
          <p className="dm-empty">Ask a question about the documents to begin.</p>
        ) : null}

        {messages.map((m, index) =>
          m.role === 'user' ? (
            <div key={m.id} className="dm-row dm-row-user">
              <div className="dm-bubble dm-bubble-user">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="dm-row dm-row-assistant">
              <div
                className="dm-bubble dm-bubble-assistant"
                data-verdict={normaliseVerdict(m.verdict ?? '') || undefined}
              >
                {m.text ? (
                  <div className="dm-text">{renderAnswer(m.text, m.id, m.sources)}</div>
                ) : streaming && index === messages.length - 1 ? (
                  <p className="dm-text dm-streaming">Answering&hellip;</p>
                ) : null}

                {normaliseVerdict(m.verdict ?? '') === 'abstain' ? (
                  <span className="dm-verdict" data-tone="abstain">
                    Not found in the documents
                  </span>
                ) : null}

                {verdictChipLabel(m.verdict ?? '') ? (
                  <span className="dm-verdict" data-tone={normaliseVerdict(m.verdict ?? '')}>
                    {verdictChipLabel(m.verdict ?? '')}
                  </span>
                ) : null}

                {m.sources && m.sources.length > 0 ? (
                  <ul className="dm-sources" aria-label="Sources">
                    {m.sources.map((s, i) => {
                      const n = String(i + 1);
                      return (
                        <li key={`${m.id}-${i}`} id={sourceAnchor(m.id, n)} className="dm-source">
                          <span className="dm-source-num" aria-hidden="true">
                            [{n}]
                          </span>
                          <div className="dm-source-body">
                            {s.url ? (
                              <a
                                className="dm-source-title"
                                href={sourceHref(s)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {s.title}
                              </a>
                            ) : (
                              <span className="dm-source-title dm-source-title-plain">{s.title}</span>
                            )}
                            {typeof s.page === 'number' || (typeof s.page === 'string' && s.page !== '') ? (
                              <span className="dm-source-page">p. {String(s.page)}</span>
                            ) : null}
                            {excerptOf(s) ? <p className="dm-source-excerpt">{excerptOf(s)}</p> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </div>
          ),
        )}
      </div>

      {error ? (
        <p className="dm-error" role="alert">
          {error}
        </p>
      ) : null}
      {/* Scroll anchor below the thread and any error, clear of the sticky composer. */}
      <div ref={bottomRef} className="dm-anchor" aria-hidden="true" />

      <div className="dm-dock">
      {suggestions && messages.length > 0 && remaining.length > 0 ? (
        <div className="dm-suggest dm-suggest-row" aria-label="More suggested questions">
          {remaining.map((q) => (
            <button
              key={q}
              type="button"
              className="dm-chip"
              disabled={streaming}
              onClick={() => void send(q)}
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}
      <form
        className="dm-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label className="dm-sr" htmlFor="dm-input">
          Ask a question
        </label>
        <input
          id="dm-input"
          className="dm-input"
          type="text"
          placeholder="Ask a question about the documents"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          autoComplete="off"
        />
        <button type="submit" className="dm-send" disabled={!canSend}>
          {streaming ? 'Answering…' : 'Send →'}
        </button>
      </form>
      </div>
    </main>
  );
}
