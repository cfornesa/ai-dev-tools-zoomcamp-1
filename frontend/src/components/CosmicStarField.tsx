/**
 * Issue #807: decorative animated Celestial star field for the "cosmic" site
 * backdrop, after the external repo's Celestial theme (nebula drift, slow
 * star rotation, twinkle). First-party CSS + bounded generated nodes only —
 * no theme JS, no dependency.
 */
export const COSMIC_STAR_COUNT = 90;

// Deterministic (seeded) so renders are stable across re-renders and tests.
export function cosmicStars(count = COSMIC_STAR_COUNT) {
  let seed = 807;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: Math.min(count, 120) }, (_, index) => ({
    id: index,
    left: `${(next() * 100).toFixed(2)}%`,
    top: `${(next() * 100).toFixed(2)}%`,
    size: 1 + Math.floor(next() * 3),
    duration: `${(3 + next() * 5).toFixed(2)}s`,
    delay: `${(next() * 6).toFixed(2)}s`,
    amber: next() > 0.8,
  }));
}

const STARS = cosmicStars();

export default function CosmicStarField() {
  return (
    <div className="cosmic-starfield" data-testid="cosmic-starfield" aria-hidden="true">
      <div className="cosmic-nebula cosmic-nebula-1" />
      <div className="cosmic-nebula cosmic-nebula-2" />
      <div className="cosmic-nebula cosmic-nebula-3" />
      <div className="cosmic-astrolabe" />
      <div className="cosmic-stars">
        {STARS.map((star) => (
          <span
            key={star.id}
            className={`cosmic-star${star.amber ? ' cosmic-star-amber' : ''}`}
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDuration: star.duration,
              animationDelay: star.delay,
            }}
          />
        ))}
      </div>
    </div>
  );
}
