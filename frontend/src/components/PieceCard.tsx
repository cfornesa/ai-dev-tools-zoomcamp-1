import { useState } from 'react';
import { Link } from 'react-router-dom';

import { formatPublishedDate, truncateExcerpt } from './pieceCardUtils';

export type PieceCardProps = {
  href: string;
  title: string;
  description?: string;
  publishedAt?: string | null;
  thumbnailUrl?: string | null;
  thumbnailIsFallback?: boolean;
  kind?: string;
  engine?: string;
  owner?: string;
  testId?: string;
};

/** Shared public/profile piece card. The caller owns only the destination. */
export default function PieceCard({
  href,
  title,
  description = '',
  publishedAt,
  thumbnailUrl,
  kind,
  engine,
  owner,
  testId,
}: PieceCardProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const titleId = `piece-card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`;
  // A stored fallback is still a valid thumbnail response. Render it so
  // profile/gallery cards remain image-bearing; only an absent or failed URL
  // should become the text fallback tile.
  const showFallback = !thumbnailUrl || thumbnailFailed;
  const kindLabel =
    kind === 'generated'
      ? 'Generated'
      : kind === 'collection'
        ? 'Collection'
        : kind === '3d'
          ? '3D'
          : kind === '2d'
            ? '2D'
            : undefined;
  const excerpt = truncateExcerpt(description);
  const publishedLabel = publishedAt ? formatPublishedDate(publishedAt) : null;

  return (
    <article
      aria-labelledby={titleId}
      className="piece-card public-project-card"
      data-kind={kind}
      data-testid={testId}
    >
      <Link to={href} className="piece-card-link public-project-card-link" aria-label={title}>
        {showFallback ? (
          <div
            className="piece-card-thumbnail-fallback public-project-thumbnail-fallback"
            role="img"
            aria-label={`No preview available for ${title}`}
          >
            No preview available
          </div>
        ) : (
          <img
            src={thumbnailUrl}
            alt=""
            className="piece-card-thumbnail public-project-thumbnail"
            onError={() => setThumbnailFailed(true)}
          />
        )}
        {publishedLabel && (
          <p className="piece-card-date">
            <time dateTime={publishedAt ?? undefined}>{publishedLabel}</time>
          </p>
        )}
        <h3 id={titleId} data-testid={testId ? `${testId}-title` : undefined}>
          {title}
        </h3>
        {excerpt && <p className="piece-card-excerpt">{excerpt}</p>}
        {(kindLabel || engine) && (
          <p className="piece-card-meta">
            {kindLabel && <span className="renderer-badge">{kindLabel}</span>}
            {engine && <span className="engine-label">{engine}</span>}
          </p>
        )}
      </Link>
      {owner && <p className="public-project-attribution">By {owner}</p>}
    </article>
  );
}
