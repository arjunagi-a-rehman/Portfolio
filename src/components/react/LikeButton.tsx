import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useClientId } from './useClientId';

type Props = { postSlug: string };

export function LikeButton({ postSlug }: Props) {
  const clientId = useClientId();

  const state = useQuery(
    api.likes.getLikeState,
    clientId ? { postSlug, clientId } : 'skip'
  );

  const toggle = useMutation(api.likes.toggle).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.likes.getLikeState, {
        postSlug: args.postSlug,
        clientId: args.clientId,
      });
      if (!current) return;
      localStore.setQuery(
        api.likes.getLikeState,
        { postSlug: args.postSlug, clientId: args.clientId },
        {
          liked: !current.liked,
          count: current.liked
            ? Math.max(0, current.count - 1)
            : current.count + 1,
        }
      );
    }
  );

  const liked = state?.liked ?? false;
  const count = state?.count ?? 0;
  const ready = clientId !== null && state !== undefined;

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
      <span className="like-button__count">{count}</span>
      <span className="like-button__label">{liked ? 'Liked' : 'Like'}</span>
    </button>
  );
}
