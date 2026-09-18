import { useState } from 'react';
import { Link } from 'react-router-dom';

export type PieceCardProps = {
  href: string;
  title: string;
  thumbnailUrl?: string | null;
  kind?: string;
  engine?: string;
  owner?: string;
  testId?: string;
};

/** Shared public/profile piece card. The caller owns only the destination. */
export default function PieceCard({
  href,
  title,
  thumbnailUrl,
  kind,
  engine,
  owner,
  testId,
}: PieceCardProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const titleId = `piece-card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`;
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

  return (
    <article
      aria-labelledby={titleId}
      className="piece-card public-project-card"
      data-kind={kind}
      data-testid={testId}
    >
      <Link to={href} className="piece-card-link public-project-card-link">
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
            alt={`Preview of ${title}`}
            className="piece-card-thumbnail public-project-thumbnail"
            onError={() => setThumbnailFailed(true)}
          />
        )}
        <h3 id={titleId} data-testid={testId ? `${testId}-title` : undefined}>
          {title}
        </h3>
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
