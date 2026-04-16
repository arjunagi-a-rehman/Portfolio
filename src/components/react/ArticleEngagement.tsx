import { CommentsSection } from './CommentsSection';
import { LikeButton } from './LikeButton';
import { Provider } from './ConvexProvider';
import './engagement.css';

type Props = { postSlug: string };

export default function ArticleEngagement({ postSlug }: Props) {
  return (
    <Provider>
      <div className="engagement">
        <div className="engagement__likes">
          <p className="engagement__likes-prompt">
            Enjoyed this? Leave a reaction.
          </p>
          <LikeButton postSlug={postSlug} />
        </div>
        <CommentsSection postSlug={postSlug} />
      </div>
    </Provider>
  );
}
