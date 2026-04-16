import { useMutation } from 'convex/react';
import { useMemo, useState, type FormEvent } from 'react';
import { api } from '../../../convex/_generated/api';
import { Provider } from './ConvexProvider';
import { useClientId } from './useClientId';
import './subscribe.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; resubscribed: boolean }
  | { kind: 'error'; message: string };

type Props = { source: string };

/**
 * Inner component — assumes a Convex <Provider> above it. Used inside
 * ArticleEngagement where the Provider is already in scope, so we don't double-
 * wrap (which would create a second ConvexReactClient / WebSocket).
 */
export function SubscribeCard({ source }: Props) {
  const clientId = useClientId();
  const subscribe = useMutation(api.subscribers.subscribe);

  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const ready = clientId !== null && status.kind !== 'submitting';
  const canSubmit = ready && email.trim().length > 0;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clientId || !canSubmit) return;
    setStatus({ kind: 'submitting' });
    try {
      const res = await subscribe({
        email,
        clientId,
        honeypot: honeypot || undefined,
        source,
      });
      if (res.ok) {
        setStatus({
          kind: 'success',
          resubscribed: Boolean('resubscribed' in res && res.resubscribed),
        });
        return;
      }
      const msg =
        res.reason === 'rate_limited'
          ? "You're subscribing too often. Try again in a bit."
          : res.reason === 'bad_email'
            ? "That email doesn't look right."
            : res.reason === 'spam'
              ? 'Submission blocked.'
              : 'Could not subscribe.';
      setStatus({ kind: 'error', message: msg });
    } catch (err) {
      console.error('[portfolio] subscribe failed', err);
      setStatus({
        kind: 'error',
        message: 'Couldn\u2019t subscribe. Try again in a moment.',
      });
    }
  };

  const reset = () => {
    setEmail('');
    setHoneypot('');
    setStatus({ kind: 'idle' });
  };

  if (status.kind === 'success') {
    return (
      <SubscribeShell>
        <div className="subscribe-success">
          <div className="subscribe-success__icon" aria-hidden="true">✓</div>
          <div className="subscribe-success__body">
            <h3 className="subscribe-card__title">
              {status.resubscribed ? 'Welcome back' : "You're in"}
            </h3>
            <p className="subscribe-card__sub">
              You'll get an email whenever a new post goes live. No spam, one per post, unsubscribe anytime.
            </p>
            <button
              type="button"
              className="subscribe-card__link-btn"
              onClick={reset}
            >
              Subscribe a different address
            </button>
          </div>
        </div>
      </SubscribeShell>
    );
  }

  return (
    <SubscribeShell>
      <div className="subscribe-card__header">
        <h3 className="subscribe-card__title">
          Get new posts <span className="gradient-text">in your inbox</span>
        </h3>
        <p className="subscribe-card__sub">
          One email per new post. No spam, unsubscribe anytime.
        </p>
      </div>

      <form className="subscribe-card__form" onSubmit={onSubmit} noValidate>
        <label className="subscribe-card__field">
          <span className="subscribe-card__label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            disabled={status.kind === 'submitting'}
          />
        </label>

        {/* Honeypot — real users never see or fill this. */}
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

        <button
          type="submit"
          className="subscribe-card__submit"
          disabled={!canSubmit}
        >
          {status.kind === 'submitting' ? 'Subscribing\u2026' : 'Subscribe'}
        </button>

        {status.kind === 'error' ? (
          <span className="subscribe-card__error" role="alert">
            {status.message}
          </span>
        ) : null}
      </form>
    </SubscribeShell>
  );
}

function SubscribeShell({ children }: { children: React.ReactNode }) {
  return <div className="subscribe-card">{children}</div>;
}

/**
 * Standalone island — wraps its own Provider. Used on the /blogs listing
 * page where no other island exists to supply the Convex context.
 */
export default function SubscribeCardIsland({ source }: Props) {
  return (
    <Provider>
      <SubscribeCard source={source} />
    </Provider>
  );
}
