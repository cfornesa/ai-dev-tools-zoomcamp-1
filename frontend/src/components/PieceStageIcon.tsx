import type { ReactNode } from 'react';

export type PieceStageIconName =
  'screenshot' | 'download' | 'immersive' | 'sound' | 'controls' | 'steer' | 'guide' | 'fullscreen';

const PATHS: Record<PieceStageIconName, ReactNode> = {
  screenshot: (
    <>
      <path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v9.8H4z" />
      <circle cx="12" cy="13.2" r="3.1" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v11" />
      <path d="m7.5 10 4.5 4.5 4.5-4.5" />
      <path d="M4.5 20h15" />
    </>
  ),
  immersive: (
    <>
      <path d="m12 3 8 9-8 9-8-9z" />
      <path d="m12 7 4.5 5-4.5 5-4.5-5z" />
    </>
  ),
  sound: (
    <>
      <path d="M4 10h3l4-3.5v11L7 14H4z" />
      <path d="M15 9.2a4.2 4.2 0 0 1 0 5.6" />
      <path d="M17.8 6.7a7.7 7.7 0 0 1 0 10.6" />
    </>
  ),
  controls: (
    <>
      <path d="M5 6h14M5 12h14M5 18h14" />
      <path d="M9 4v4M15 10v4M11 16v4" />
    </>
  ),
  steer: (
    <>
      <path d="M8.2 11.5V6.2a1.4 1.4 0 0 1 2.8 0v4.1" />
      <path d="M11 10V4.8a1.4 1.4 0 0 1 2.8 0v5.4" />
      <path d="M13.8 10.4V6.2a1.4 1.4 0 0 1 2.8 0v6.1" />
      <path d="M16.6 11.3v-2a1.4 1.4 0 0 1 2.8 0v4.3c0 4-2.5 6.2-6.2 6.2h-1.5c-1.7 0-2.6-.8-3.7-2.2L5.5 14a1.5 1.5 0 0 1 2.4-1.8z" />
    </>
  ),
  guide: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16.5" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  fullscreen: (
    <>
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />
    </>
  ),
};

export default function PieceStageIcon({ name }: { name: PieceStageIconName }) {
  return (
    <svg
      aria-hidden="true"
      className="piece-stage-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
