import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Fixed, decorative page backdrop: painted sky, sun glow, drifting clouds,
 * soft mountains and a tiny far-away train. Sits behind all content.
 * Purely presentational.
 */
export default function Scenery() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <div className={`scenery ${isHome ? 'scenery--home' : 'scenery--soft'}`} aria-hidden="true">
      <div className="scenery-sun" />

      <svg className="scenery-cloud c1" viewBox="0 0 220 70">
        <path d="M20 55 Q4 55 6 42 Q8 30 24 32 Q28 12 52 14 Q70 4 88 20 Q112 12 126 30 Q150 24 160 40 Q180 40 180 52 Q180 58 168 58 L28 58 Q20 58 20 55Z" />
      </svg>
      <svg className="scenery-cloud c2" viewBox="0 0 220 70">
        <path d="M20 55 Q4 55 6 42 Q8 30 24 32 Q28 12 52 14 Q70 4 88 20 Q112 12 126 30 Q150 24 160 40 Q180 40 180 52 Q180 58 168 58 L28 58 Q20 58 20 55Z" />
      </svg>
      <svg className="scenery-cloud c3" viewBox="0 0 220 70">
        <path d="M20 55 Q4 55 6 42 Q8 30 24 32 Q28 12 52 14 Q70 4 88 20 Q112 12 126 30 Q150 24 160 40 Q180 40 180 52 Q180 58 168 58 L28 58 Q20 58 20 55Z" />
      </svg>

      <svg className="scenery-ridge" viewBox="0 0 1200 220" preserveAspectRatio="none">
        <path d="M0 140 L110 70 L210 120 L340 40 L470 125 L590 80 L720 135 L850 55 L990 130 L1090 90 L1200 125 L1200 220 L0 220Z" fill="#b5d6cf" opacity=".55" />
        <path d="M0 170 Q200 110 420 160 T820 150 T1200 150 L1200 220 L0 220Z" fill="#9ccaa5" opacity=".6" />
      </svg>

      <svg className="scenery-train" viewBox="0 0 240 24">
        {/* Carriages trailing on left */}
        <rect x="0" y="4" width="34" height="16" rx="2" fill="#c9502b" />
        <rect x="38" y="4" width="34" height="16" rx="2" fill="#d9703a" />
        <rect x="76" y="4" width="34" height="16" rx="2" fill="#c9502b" />
        <rect x="114" y="4" width="34" height="16" rx="2" fill="#d9703a" />
        <rect x="152" y="4" width="34" height="16" rx="2" fill="#c9502b" />
        {/* Locomotive engine leading in front on the right */}
        <rect x="190" y="6" width="32" height="14" rx="2" fill="#6b5a4a" />
        <rect x="190" y="2" width="12" height="18" rx="2" fill="#4a3e33" />
        <rect x="214" y="1" width="4" height="6" rx="1" fill="#2b2623" />
        <polygon points="222,14 226,19 222,20" fill="#2b2623" />
      </svg>
    </div>
  );
}
