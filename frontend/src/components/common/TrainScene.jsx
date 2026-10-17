import React from 'react';

/**
 * Decorative, purely visual hero illustration.
 * A painted-style railway landscape: layered hills, terraces, a steam train
 * rolling across, drifting smoke, swaying bushes and falling leaves.
 * No data, no logic — safe to drop anywhere.
 */

const CARRIAGES = 6;
const CAR_W = 118;
const GAP = 6;
const ENGINE_W = 168;

function Carriage({ x, tone }) {
  const windows = Array.from({ length: 6 }, (_, i) => 12 + i * 17);
  return (
    <g transform={`translate(${x},0)`}>
      <rect x="0" y="-62" width={CAR_W} height="60" rx="5" fill={tone} />
      <rect x="-2" y="-67" width={CAR_W + 4} height="9" rx="4" fill="#f3e3c3" />
      <rect x="0" y="-22" width={CAR_W} height="5" fill="rgba(0,0,0,.12)" />
      {windows.map((wx) => (
        <rect key={wx} x={wx} y="-50" width="11" height="15" rx="2" fill="#fff4d6" opacity="0.92" />
      ))}
      <rect x="0" y="-62" width="12" height="60" rx="4" fill="rgba(255,255,255,.08)" />
      <circle cx="22" cy="2" r="7" fill="#2b2623" />
      <circle cx={CAR_W - 22} cy="2" r="7" fill="#2b2623" />
    </g>
  );
}

export default function TrainScene() {
  const tones = ['#c9502b', '#d9703a', '#c9502b', '#d9703a', '#c9502b', '#d9703a'];

  return (
    <svg
      className="train-scene"
      viewBox="0 0 1200 430"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label="Illustration of a train travelling through green hills"
    >
      <defs>
        <linearGradient id="ts-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9dc7c4" />
          <stop offset="1" stopColor="#c4e0d6" />
        </linearGradient>
        <linearGradient id="ts-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fbf93" />
          <stop offset="1" stopColor="#a6d49c" />
        </linearGradient>
        <linearGradient id="ts-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6aaa5c" />
          <stop offset="1" stopColor="#4d8f4f" />
        </linearGradient>
        <radialGradient id="ts-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff6d4" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff6d4" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* sun glow */}
      <circle cx="930" cy="110" r="150" fill="url(#ts-sun)" />

      {/* far mountains */}
      <g className="ts-far">
        <path d="M0 250 L120 150 L205 215 L330 110 L470 235 L600 160 L730 245 L860 130 L1010 240 L1110 175 L1200 230 L1200 330 L0 330Z" fill="url(#ts-far)" />
        <path d="M330 110 L300 148 L330 138 L352 156 L370 138Z" fill="#f4fbf8" opacity=".8" />
        <path d="M860 130 L832 166 L858 156 L880 172 L896 154Z" fill="#f4fbf8" opacity=".8" />
      </g>

      {/* mid hills with terraces */}
      <g className="ts-mid">
        <path d="M0 290 Q180 215 360 262 T700 250 T1050 262 T1200 245 L1200 340 L0 340Z" fill="url(#ts-mid)" />
        <g stroke="#5f9f6e" strokeWidth="2" opacity=".35" fill="none">
          <path d="M0 292 Q180 238 350 280" />
          <path d="M0 306 Q180 254 340 292" />
          <path d="M0 320 Q180 270 330 304" />
        </g>
      </g>

      {/* track bed */}
      <rect x="0" y="322" width="1200" height="108" fill="url(#ts-ground)" />
      <rect x="0" y="322" width="1200" height="9" fill="#6b5a46" />
      <rect x="0" y="331" width="1200" height="3" fill="#3f352b" />
      <g className="ts-sleepers" stroke="#4a3b2d" strokeWidth="5" opacity=".7">
        {Array.from({ length: 64 }, (_, i) => (
          <line key={i} x1={i * 20} y1="334" x2={i * 20 - 8} y2="346" />
        ))}
      </g>
      <rect x="0" y="333" width="1200" height="3" fill="#b9a98e" />

      {/* the train: Locomotive Engine leads in FRONT, pulling 6 carriages */}
      <g className="ts-train" transform="translate(0,333)">
        <g className="ts-train-body">
          {/* Carriages trailing on the left */}
          {Array.from({ length: CARRIAGES }, (_, i) => (
            <React.Fragment key={i}>
              <Carriage x={i * (CAR_W + GAP)} tone={tones[i]} />
              <rect x={i * (CAR_W + GAP) + CAR_W} y="-18" width={GAP} height="4" fill="#222" />
            </React.Fragment>
          ))}

          {/* Locomotive Engine leading in FRONT (on the right) */}
          <g transform={`translate(${CARRIAGES * (CAR_W + GAP)},0)`}>
            {/* Chassis beam */}
            <rect x="0" y="-8" width={ENGINE_W - 8} height="6" fill="#2a2725" />

            {/* Driver cab on the rear (left of the engine) */}
            <rect x="10" y="-72" width="62" height="66" rx="6" fill="#c9502b" />
            <rect x="2" y="-78" width="74" height="9" rx="4" fill="#f3e3c3" />
            <rect x="38" y="-60" width="22" height="22" rx="3" fill="#fff4d6" opacity=".92" />

            {/* Boiler extending forward */}
            <rect x="60" y="-52" width="108" height="46" rx="6" fill="#33302d" />
            <line x1="88" y1="-52" x2="88" y2="-6" stroke="#d9c8a4" strokeWidth="2" opacity="0.6" />
            <line x1="116" y1="-52" x2="116" y2="-6" stroke="#d9c8a4" strokeWidth="2" opacity="0.6" />
            <line x1="144" y1="-52" x2="144" y2="-6" stroke="#d9c8a4" strokeWidth="2" opacity="0.6" />
            <rect x="80" y="-62" width="16" height="12" rx="5" fill="#d9703a" />

            {/* Smokestack / Chimney at front */}
            <rect x="132" y="-76" width="16" height="26" rx="3" fill="#2a2725" />
            <rect x="127" y="-82" width="26" height="9" rx="3" fill="#2a2725" />

            {/* Headlight lantern */}
            <rect x="166" y="-38" width="10" height="14" rx="2" fill="#2a2725" />
            <rect x="172" y="-36" width="5" height="10" rx="1" fill="#fff5aa" />

            {/* Cowcatcher pilot wedge */}
            <polygon points="160,-2 176,2 160,2" fill="#2a2725" />

            {/* Wheels */}
            <circle cx="36" cy="2" r="8" fill="#2b2623" />
            <circle cx="102" cy="2" r="11" fill="#2b2623" />
            <circle cx="102" cy="2" r="4" fill="#d9c8a4" />
            <circle cx="138" cy="2" r="11" fill="#2b2623" />
            <circle cx="138" cy="2" r="4" fill="#d9c8a4" />

            {/* Side connecting piston rod */}
            <line className="ts-piston" x1="102" y1="2" x2="138" y2="2" stroke="#d9c8a4" strokeWidth="3" strokeLinecap="round" />

            {/* Smoke billowing backward from the chimney */}
            <g className="ts-smoke">
              <circle cx="140" cy="-92" r="12" />
              <circle cx="140" cy="-92" r="14" />
              <circle cx="140" cy="-92" r="10" />
              <circle cx="140" cy="-92" r="16" />
            </g>
          </g>
        </g>
      </g>

      {/* foreground bushes, sway gently */}
      <g className="ts-bush ts-bush-a">
        <ellipse cx="90" cy="410" rx="170" ry="70" fill="#3f7d4a" />
        <ellipse cx="60" cy="385" rx="110" ry="52" fill="#68a857" />
        <ellipse cx="130" cy="372" rx="80" ry="38" fill="#a3c85c" />
        <ellipse cx="40" cy="360" rx="42" ry="22" fill="#d2dd62" opacity=".85" />
      </g>
      <g className="ts-bush ts-bush-b">
        <ellipse cx="1090" cy="415" rx="200" ry="74" fill="#3f7d4a" />
        <ellipse cx="1120" cy="388" rx="120" ry="52" fill="#68a857" />
        <ellipse cx="1050" cy="376" rx="80" ry="36" fill="#a3c85c" />
        <ellipse cx="1130" cy="362" rx="46" ry="22" fill="#d2dd62" opacity=".85" />
      </g>
      <ellipse cx="600" cy="440" rx="700" ry="40" fill="#3f7d4a" />

      {/* falling leaves */}
      <g className="ts-leaves">
        <ellipse className="ts-leaf l1" cx="200" cy="40" rx="6" ry="3" fill="#a3c85c" />
        <ellipse className="ts-leaf l2" cx="520" cy="20" rx="5" ry="2.6" fill="#d2dd62" />
        <ellipse className="ts-leaf l3" cx="760" cy="30" rx="6" ry="3" fill="#8bbf5a" />
        <ellipse className="ts-leaf l4" cx="1000" cy="10" rx="5" ry="2.6" fill="#e6a65c" />
        <ellipse className="ts-leaf l5" cx="360" cy="0" rx="5" ry="2.6" fill="#d2dd62" />
      </g>
    </svg>
  );
}
