import { useMutation } from 'convex/react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../../../convex/_generated/api';
import { Provider } from './ConvexProvider';
import { useClientId } from './useClientId';
import './contact.css';

const MAX_NAME = 80;
const MAX_MESSAGE = 5000;

// Selector for Contact entry points anywhere on the site. Kept broad on purpose
// — we want to catch every existing mailto link to `contact@arjunagiarehman.com`
// plus any future element opted in via `data-contact-trigger`.
const CONTACT_SELECTOR =
  '[data-contact-trigger], a[href^="mailto:contact@arjunagiarehman.com"]';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

function ContactModalInner() {
  const clientId = useClientId();
  const submit = useMutation(api.contact.submit);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // Global click interceptor — catches clicks on any Contact link/button
  // across the site and opens the modal instead of following the mailto.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Respect modifier clicks (open in new tab, copy link, etc.)
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const trigger = target?.closest?.(CONTACT_SELECTOR) as HTMLElement | null;
      if (!trigger) return;
      e.preventDefault();
      lastTriggerRef.current = trigger;
      setOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Defer focus to next tick so the input exists.
    requestAnimationFrame(() => firstFieldRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    // Restore focus to whatever triggered the modal.
    setTimeout(() => lastTriggerRef.current?.focus(), 0);
    // Reset error state on close, keep form values so user can reopen.
    setStatus((s) => (s.kind === 'error' ? { kind: 'idle' } : s));
  };

  const handleDismissAfterSend = () => {
    setOpen(false);
    setName('');
    setEmail('');
    setMessage('');
    setStatus({ kind: 'idle' });
  };

  // Auto-close 3s after successful send.
  useEffect(() => {
    if (status.kind !== 'sent') return;
    const t = setTimeout(handleDismissAfterSend, 3000);
    return () => clearTimeout(t);
  }, [status.kind]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clientId || status.kind === 'submitting') return;
    setStatus({ kind: 'submitting' });
    try {
      const res = await submit({
        name,
        email,
        message,
        clientId,
        honeypot: honeypot || undefined,
      });
      if (res.ok) {
        setStatus({ kind: 'sent' });
        return;
      }
      const msg =
        res.reason === 'rate_limited'
          ? "You've just sent a message. Please wait a few minutes before sending another."
          : res.reason === 'bad_email'
            ? 'That email address does not look right.'
            : res.reason === 'empty'
              ? 'Name and message are required.'
              : res.reason === 'spam'
                ? 'Your submission looks like spam.'
                : 'Could not send message.';
      setStatus({ kind: 'error', message: msg });
    } catch (err) {
      console.error('[portfolio] contact submit failed', err);
      setStatus({
        kind: 'error',
        message: 'Network error. Try again in a moment.',
      });
    }
  };

  if (!open) return null;

  const busy = status.kind === 'submitting';
  const sent = status.kind === 'sent';

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-close is a mouse-only convenience; keyboard users already have Escape wired up in the effect at L65. role=presentation + onClick is semantically correct (decorative layer) but the rule flags any interactive handler on a non-interactive role. Adding role=button would misrepresent this as a primary control to screen readers.
    <div
      className="contact-backdrop"
      role="presentation"
      onClick={(e) => {
        // onClick (not onMouseDown) so a text-selection drag that starts
        // inside the dialog and releases outside it doesn't accidentally
        // close the modal. Click fires only when mousedown + mouseup land
        // on the same element.
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="contact-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-dialog-title"
        ref={dialogRef}
      >
        <button
          type="button"
          className="contact-close"
          onClick={handleClose}
          aria-label="Close contact form"
        >
          ×
        </button>

        {sent ? (
          <div className="contact-success">
            <div className="contact-success__icon" aria-hidden="true">
              ✓
            </div>
            <h2 className="contact-dialog__title">Message sent</h2>
            <p className="contact-success__body">
              Thanks for reaching out — I'll get back to you as soon as I can. A
              confirmation is on its way to your inbox.
            </p>
          </div>
        ) : (
          <>
            <header className="contact-dialog__header">
              <h2 className="contact-dialog__title" id="contact-dialog-title">
                Get in touch
              </h2>
              <p className="contact-dialog__subtitle">
                Drop a note and I'll reply by email.
              </p>
            </header>

            <form className="contact-form" onSubmit={onSubmit} noValidate>
              <label className="contact-field">
                <span className="contact-label">Name *</span>
                <input
                  ref={firstFieldRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_NAME}
                  required
                  autoComplete="name"
                  disabled={busy}
                />
              </label>

              <label className="contact-field">
                <span className="contact-label">Email *</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={busy}
                  placeholder="you@example.com"
                />
              </label>

              <label className="contact-field">
                <span className="contact-label">Message *</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MAX_MESSAGE}
                  rows={5}
                  required
                  disabled={busy}
                  placeholder="What's on your mind?"
                />
                <span className="contact-hint">
                  {message.length}/{MAX_MESSAGE}
                </span>
              </label>

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

              <div className="contact-actions">
                <button
                  type="submit"
                  className="contact-submit"
                  disabled={busy || !clientId}
                >
                  {busy ? 'Sending…' : 'Send message'}
                </button>
                {status.kind === 'error' ? (
                  <span className="contact-error" role="alert">
                    {status.message}
                  </span>
                ) : null}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ContactModal() {
  return (
    <Provider>
      <ContactModalInner />
    </Provider>
  );
}
