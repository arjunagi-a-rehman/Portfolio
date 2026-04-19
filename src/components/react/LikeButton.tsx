import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useClientId } from './useClientId';

type Props = { postSlug: string };

export function LikeButton({ postSlug }: Props) {
  const clientId = useClientId();

  // Public count — runs on mount, independent of clientId, so it resolves
  // as soon as the WebSocket returns instead of waiting an extra render for
  // localStorage to hydrate.
  const countState = useQuery(api.likes.getCount, { postSlug });

  // Per-client liked state — must wait until clientId is available.
  const myState = useQuery(
    api.likes.getMyLikeState,
    clientId ? { postSlug, clientId } : 'skip',
  );

  const toggle = useMutation(api.likes.toggle).withOptimisticUpdate(
    (localStore, args) => {
      const cur = localStore.getQuery(api.likes.getCount, {
        postSlug: args.postSlug,
      });
      const mine = localStore.getQuery(api.likes.getMyLikeState, {
        postSlug: args.postSlug,
        clientId: args.clientId,
      });
      if (!cur || !mine) return;
      const nextLiked = !mine.liked;
      const nextCount = nextLiked ? cur.count + 1 : Math.max(0, cur.count - 1);
      localStore.setQuery(
        api.likes.getCount,
        { postSlug: args.postSlug },
        { count: nextCount },
      );
      localStore.setQuery(
        api.likes.getMyLikeState,
        { postSlug: args.postSlug, clientId: args.clientId },
        { liked: nextLiked },
      );
    },
  );

  const liked = myState?.liked ?? false;
  const countLoaded = countState !== undefined;
  // Button is usable only when we know both the count and whether the
  // current client has liked — otherwise a click could toggle the wrong way.
  const ready = clientId !== null && myState !== undefined && countLoaded;

  const onClick = () => {
    if (!clientId) return;
    toggle({ postSlug, clientId }).catch((err) => {
      console.error('[portfolio] like toggle failed', err);
    });
  };

  return (
    <button
      type="button"
      className={`like-button${liked ? ' is-liked' : ''}`}
      onClick={onClick}
      disabled={!ready}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike this article' : 'Like this article'}
    >
      <svg
        className="like-button__icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span
        className="like-button__count"
        aria-live="polite"
        aria-busy={!countLoaded}
      >
        {countLoaded ? countState.count : '—'}
      </span>
      <span className="like-button__label">{liked ? 'Liked' : 'Like'}</span>
    </button>
  );
}
