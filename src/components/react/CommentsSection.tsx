import { useMutation, useQuery } from 'convex/react';
import { type FormEvent, useMemo, useState } from 'react';
import SparkMD5 from 'spark-md5';
import { api } from '../../../convex/_generated/api';
import { useClientId } from './useClientId';

const MAX_NAME = 40;
const MAX_BODY = 2000;

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

type Props = { postSlug: string };

function hashEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  return SparkMD5.hash(normalized);
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CommentsSection({ postSlug }: Props) {
  const clientId = useClientId();
  const comments = useQuery(api.comments.list, { postSlug });
  const addComment = useMutation(api.comments.add);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const canSubmit = useMemo(() => {
    return (
      clientId !== null &&
      status.kind !== 'submitting' &&
      name.trim().length > 0 &&
      body.trim().length > 0
    );
  }, [clientId, status, name, body]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clientId || !canSubmit) return;

    setStatus({ kind: 'submitting' });
    try {
      const result = await addComment({
        postSlug,
        authorName: name,
        emailHash: hashEmail(email),
        body,
        clientId,
        honeypot: honeypot || undefined,
      });

      if (result.ok) {
        setName('');
        setEmail('');
        setBody('');
        setHoneypot('');
        setStatus({ kind: 'idle' });
        return;
      }

      const message =
        result.reason === 'rate_limited'
          ? "You're posting too quickly. Give it a minute."
          : result.reason === 'empty'
            ? 'Name and comment are required.'
            : result.reason === 'spam'
              ? 'Your comment looks like spam.'
              : 'Could not post comment.';
      setStatus({ kind: 'error', message });
    } catch (err) {
      console.error('[portfolio] addComment failed', err);
      setStatus({
        kind: 'error',
        message: 'Network error. Try again in a moment.',
      });
    }
  };

  const loading = comments === undefined;

  return (
    <div className="comments">
      <h3 className="comments__title">
        Comments{' '}
        {comments ? (
          <span className="comments__count">({comments.length})</span>
        ) : null}
      </h3>

      <form className="comments__form" onSubmit={onSubmit} noValidate>
        <div className="comments__row">
          <label className="comments__field">
            <span className="comments__label">Name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME}
              required
              autoComplete="name"
              disabled={status.kind === 'submitting'}
            />
          </label>
          <label className="comments__field">
            <span className="comments__label">Email (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={status.kind === 'submitting'}
              placeholder="for your Gravatar"
            />
          </label>
        </div>

        <label className="comments__field">
          <span className="comments__label">Comment *</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_BODY}
            rows={4}
            required
            disabled={status.kind === 'submitting'}
            placeholder="Share your thoughts…"
          />
          <span className="comments__hint">
            {body.length}/{MAX_BODY}
          </span>
        </label>

        {/* Honeypot — real users never see or fill this */}
        <input
          type="text"
          name="company"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            opacity: 0,
          }}
        />

        <div className="comments__actions">
          <button
            type="submit"
            className="comments__submit"
            disabled={!canSubmit}
          >
            {status.kind === 'submitting' ? 'Posting…' : 'Post comment'}
          </button>
          {status.kind === 'error' ? (
            <span className="comments__error" role="alert">
              {status.message}
            </span>
          ) : null}
        </div>

        <p className="comments__privacy">
          Your email is never stored — only an anonymous MD5 hash is used to
          fetch your Gravatar.
        </p>
      </form>

      <div className="comments__list">
        {loading ? (
          <p className="comments__empty">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="comments__empty">Be the first to comment.</p>
        ) : (
          comments.map((c) => (
            <article className="comment" key={c._id}>
              <div className="comment__avatar">
                {c.emailHash ? (
                  <img
                    src={`https://www.gravatar.com/avatar/${c.emailHash}?d=identicon&s=64`}
                    alt=""
                    width={40}
                    height={40}
                    loading="lazy"
                  />
                ) : (
                  <span className="comment__avatar-fallback">
                    {c.authorName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="comment__body">
                <header className="comment__header">
                  <span className="comment__author">{c.authorName}</span>
                  <time
                    className="comment__time"
                    dateTime={new Date(c.createdAt).toISOString()}
                  >
                    {relativeTime(c.createdAt)}
                  </time>
                </header>
                <p className="comment__text">{c.body}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
