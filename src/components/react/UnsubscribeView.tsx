import { useMutation } from 'convex/react';
import { useEffect, useState } from 'react';
import { api } from '../../../convex/_generated/api';
import { Provider } from './ConvexProvider';
import './subscribe.css';

type State =
  | { kind: 'pending' }
  | { kind: 'success'; alreadyUnsubscribed: boolean }
  | { kind: 'invalid' }
  | { kind: 'no-token' };

function UnsubscribeInner() {
  const unsubscribe = useMutation(api.subscribers.unsubscribe);
  const [state, setState] = useState<State>({ kind: 'pending' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState({ kind: 'no-token' });
      return;
    }
    unsubscribe({ token })
      .then((res) => {
        if (res.ok) {
          setState({
            kind: 'success',
            alreadyUnsubscribed: Boolean(
              'alreadyUnsubscribed' in res && res.alreadyUnsubscribed,
            ),
          });
        } else {
          setState({ kind: 'invalid' });
        }
      })
      .catch(() => setState({ kind: 'invalid' }));
    // Run exactly once on mount. The mutation is idempotent, so even under
    // React 18 strict-mode double-invocation this doesn't cause issues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === 'pending') {
    return (
      <div className="subscribe-card">
        <h1 className="subscribe-card__title">Unsubscribing…</h1>
        <p className="subscribe-card__sub">One moment.</p>
      </div>
    );
  }

  if (state.kind === 'success') {
    return (
      <div className="subscribe-card">
        <div className="subscribe-success">
          <div className="subscribe-success__icon" aria-hidden="true">
            ✓
          </div>
          <div className="subscribe-success__body">
            <h1 className="subscribe-card__title">
              {state.alreadyUnsubscribed
                ? "You're already unsubscribed"
                : "You've been unsubscribed"}
            </h1>
            <p className="subscribe-card__sub">
              {state.alreadyUnsubscribed
                ? 'Nothing more to do — we have no record of sending you emails.'
                : "You won't receive further emails from this site."}
            </p>
            <p className="subscribe-card__sub" style={{ marginTop: 12 }}>
              <a href="/blogs" style={{ color: 'var(--cyan)' }}>
                ← Back to the blog
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'no-token') {
    return (
      <div className="subscribe-card">
        <h1 className="subscribe-card__title">Missing token</h1>
        <p className="subscribe-card__sub">
          This page needs a valid unsubscribe token. Use the link from your
          email.
        </p>
      </div>
    );
  }

  // invalid
  return (
    <div className="subscribe-card">
      <h1 className="subscribe-card__title">Invalid link</h1>
      <p className="subscribe-card__sub">
        This unsubscribe link is invalid or has already been used. If you're
        still receiving emails, contact me and I'll remove you manually.
      </p>
    </div>
  );
}

export default function UnsubscribeView() {
  return (
    <Provider>
      <UnsubscribeInner />
    </Provider>
  );
}
