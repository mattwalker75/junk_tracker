/**
 * The bigger drawings: the battle arena behind the monster (the mockup's Burger Badlands desert,
 * recoloured for each world) and the title screen's sky, sunburst, clouds, logo burst and hill.
 */
import { useId } from "react";

/** Each world's colours: the page behind the screen, and the arena's sky, hills, ground and the band across it. */
export const WORLD_LOOK: Record<number, { page: string; sky: [string, string, string]; far: string; mesa: string; mesaLine: string; ground: [string, string]; band: string; bandLine: string; prop: string }> = {
  1: { page: "linear-gradient(180deg, #7fd38a 0%, #a8e6a0 30%, #d4f3c4 70%, #ecfbe2 100%)", sky: ["#5fc6a8", "#9be3c0", "#e6f7d0"], far: "#6fbf86", mesa: "#3f8f4a", mesaLine: "#2f7a3a", ground: ["#8fd67a", "#5fb35a"], band: "#4fa0c8", bandLine: "#9fd8f0", prop: "#2f7a2a" },
  2: { page: "linear-gradient(180deg, #ff9a5c 0%, #ffb877 30%, #ffd9a0 70%, #ffe7bd 100%)", sky: ["#ff7b45", "#ffb35e", "#ffe0a0"], far: "#e88a5a", mesa: "#c4502f", mesaLine: "#a83f26", ground: ["#f2b46a", "#e08f4c"], band: "#e2382b", bandLine: "#ff8a7e", prop: "#7bd36b" },
  3: { page: "linear-gradient(180deg, #f59ac8 0%, #ffc4e1 30%, #ffe3f1 70%, #fff3f9 100%)", sky: ["#e07ab8", "#ffb3d9", "#fff0f7"], far: "#f2a7cf", mesa: "#ffffff", mesaLine: "#e7c7da", ground: ["#fff7fb", "#f3d6e6"], band: "#8fd0ff", bandLine: "#d9f0ff", prop: "#ff7a95" },
  4: { page: "linear-gradient(180deg, #4fb4f5 0%, #6ec6ff 30%, #bfe8ff 70%, #e6f7ff 100%)", sky: ["#3a9be0", "#7ccbff", "#d6f1ff"], far: "#5ab0e8", mesa: "#2f7fbf", mesaLine: "#24689f", ground: ["#9fe0c8", "#5fbf9f"], band: "#3fa0d8", bandLine: "#bfe8ff", prop: "#7bd36b" },
  5: { page: "linear-gradient(180deg, #2b1d5a 0%, #4a3480 30%, #7a5aa8 70%, #a888c8 100%)", sky: ["#1c1240", "#3a2a6a", "#6b4a9b"], far: "#4a3478", mesa: "#2b1d4a", mesaLine: "#20153a", ground: ["#4a3a5e", "#352848"], band: "#ffc93c", bandLine: "#fff1a8", prop: "#ff4d6d" },
  6: { page: "linear-gradient(180deg, #c94a3a 0%, #e0703f 30%, #ffb877 70%, #ffe0b0 100%)", sky: ["#a8352a", "#e0703f", "#ffcf8a"], far: "#b8553a", mesa: "#7a4a2a", mesaLine: "#5e3820", ground: ["#c98a4c", "#a06a3a"], band: "#ffc93c", bandLine: "#fff1a8", prop: "#c0392b" },
};
export const worldLook = (w: number) => WORLD_LOOK[w] ?? WORLD_LOOK[2];

/** The arena behind the monster (mockup MonBattle), in the world's colours. */
export function Arena({ world, className }: { world: number; className?: string }) {
  const L = worldLook(world);
  const id = useId().replace(/:/g, "");
  const night = world === 5;
  return (
    <svg viewBox="0 0 360 294" preserveAspectRatio="xMidYMax slice" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={L.sky[0]} /><stop offset="0.55" stopColor={L.sky[1]} /><stop offset="1" stopColor={L.sky[2]} /></linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={L.ground[0]} /><stop offset="1" stopColor={L.ground[1]} /></linearGradient>
      </defs>
      <rect width="360" height="294" fill={`url(#${id}s)`} />
      <circle cx="292" cy="112" r="30" fill={night ? "#fff7e6" : "#fff1a8"} opacity="0.9" />
      <circle cx="292" cy="112" r="40" fill={night ? "#fff7e6" : "#fff1a8"} opacity="0.25" />
      {night
        ? <g fill="#fff7e6"><circle cx="40" cy="60" r="2" /><circle cx="120" cy="40" r="1.6" /><circle cx="200" cy="70" r="2" /><circle cx="250" cy="30" r="1.4" /><circle cx="90" cy="100" r="1.4" /></g>
        : <g fill="#ffffff" opacity="0.7"><ellipse cx="62" cy="104" rx="30" ry="8" /><ellipse cx="80" cy="97" rx="16" ry="9" /><ellipse cx="220" cy="92" rx="24" ry="6" /></g>}
      <path d="M0 190 L0 150 L22 150 L30 136 L70 136 L78 150 L120 150 L126 160 L170 160 L180 142 L236 142 L244 158 L300 158 L306 146 L360 146 L360 190 Z" fill={L.far} opacity="0.75" />
      <path d="M-4 200 L-4 120 L12 120 L18 108 L62 108 L70 122 L82 122 L90 200 Z" fill={L.mesa} stroke="#2b1d3a" strokeWidth="3" strokeLinejoin="round" />
      <path d="M8 136 H72 M4 152 H78 M2 170 H84" stroke={L.mesaLine} strokeWidth="3" />
      <path d="M268 200 L276 132 L292 132 L298 120 L336 120 L344 136 L364 136 L364 200 Z" fill={L.mesa} stroke="#2b1d3a" strokeWidth="3" strokeLinejoin="round" />
      <path d="M276 150 H362 M272 168 H362" stroke={L.mesaLine} strokeWidth="3" />
      <path d="M0 196 Q90 186 180 192 T360 190 L360 294 L0 294 Z" fill={`url(#${id}g)`} stroke="#2b1d3a" strokeWidth="3" />
      <path d="M-6 250 C40 236 80 262 130 252 C170 244 196 262 240 256 C290 250 320 266 366 256 L366 278 C320 290 290 272 240 280 C196 286 170 270 130 276 C80 286 40 262 -6 276 Z" fill={L.band} stroke="#2b1d3a" strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 256 C40 250 56 256 70 258 M150 254 C166 250 180 254 190 258 M270 258 C290 254 304 260 316 262" stroke={L.bandLine} strokeWidth="3" strokeLinecap="round" fill="none" />
      <g stroke="#2b1d3a" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M38 226 V194 a7 7 0 0 1 14 0 V226 Z" fill={L.prop} />
        <path d="M38 210 H30 V200 a5 5 0 0 1 10 0" fill="none" />
        <path d="M52 204 H58 V194 a5 5 0 0 0 -10 0" fill="none" />
        <path d="M318 232 V206 a6 6 0 0 1 12 0 V232 Z" fill={L.prop} />
        <path d="M330 216 H336 V208 a4 4 0 0 0 -8 0" fill="none" />
      </g>
    </svg>
  );
}

/** The title screen's slowly turning sunburst. */
export function Sunburst({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 900 900" aria-hidden className={className}>
      <g fill="#ffffff" opacity="0.16">
        <path d="M450 450 L450 0 L520 0Z" /><path d="M450 450 L740 105 L790 150Z" /><path d="M450 450 L900 400 L900 470Z" /><path d="M450 450 L795 745 L745 790Z" />
        <path d="M450 450 L450 900 L380 900Z" /><path d="M450 450 L160 795 L110 750Z" /><path d="M450 450 L0 500 L0 430Z" /><path d="M450 450 L105 155 L155 110Z" />
        <path d="M450 450 L620 30 L680 55Z" /><path d="M450 450 L870 620 L845 680Z" /><path d="M450 450 L280 870 L220 845Z" /><path d="M450 450 L30 280 L55 220Z" />
      </g>
    </svg>
  );
}

export function Clouds({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 390 300" aria-hidden className={className}>
      <g fill="#ffffff" stroke="#2b1d3a" strokeWidth="3">
        <path d="M262 92 a16 16 0 0 1 28 -10 a20 20 0 0 1 36 6 a14 14 0 0 1 4 26 H266 a13 13 0 0 1 -4 -22Z" />
        <path d="M18 286 a12 12 0 0 1 22 -8 a16 16 0 0 1 28 4 a11 11 0 0 1 2 20 H22 a10 10 0 0 1 -4 -16Z" />
      </g>
      <g fill="#ffc93c"><path d="M352 250 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" /><path d="M30 150 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" /></g>
    </svg>
  );
}

/** The orange star burst behind the logo. */
export function LogoBurst({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 330 190" aria-hidden className={className}>
      <path d="M165 4 L186 34 L222 18 L224 54 L262 50 L246 82 L284 98 L250 118 L272 150 L234 150 L232 186 L198 166 L165 190 L144 160 L104 176 L104 140 L66 146 L82 114 L44 98 L80 80 L62 48 L100 52 L104 16 L138 34Z" fill="#ff7a2f" stroke="#2b1d3a" strokeWidth="4" strokeLinejoin="round" />
      <path d="M165 22 L182 46 L212 34 L214 62 L244 60 L232 84" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

/** The green hill the monsters peek over. */
export function Hill({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 390 120" preserveAspectRatio="none" aria-hidden className={className}>
      <path d="M0 40 C60 18 120 30 195 26 C270 22 330 12 390 34 V120 H0Z" fill="#7bd36b" stroke="#2b1d3a" strokeWidth="4" />
      <path d="M20 44 C70 28 120 38 170 34" fill="none" stroke="#b8f0a0" strokeWidth="5" strokeLinecap="round" />
      <path d="M0 74 C80 62 150 70 220 66 C290 62 340 58 390 66 V120 H0Z" fill="#5fb35a" />
      <g fill="#3f8f4a"><circle cx="60" cy="58" r="3" /><circle cx="300" cy="50" r="3" /><circle cx="340" cy="90" r="3" /><circle cx="120" cy="96" r="3" /></g>
    </svg>
  );
}

/** The battle screen's alarm clock; the red hand ticks round once a minute. */
export function Clock({ passed, className }: { passed: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 54 54" aria-hidden className={className}>
      <path d="M11 9 L4 15 M43 9 L50 15" stroke="#2b1d3a" strokeWidth="5" strokeLinecap="round" />
      <circle cx="27" cy="29" r="23" fill="#ffffff" stroke="#2b1d3a" strokeWidth="3.5" />
      <circle cx="27" cy="29" r="19" fill={passed ? "#ffd0d8" : "#fff7e6"} />
      <g stroke="#2b1d3a" strokeWidth="2.4" strokeLinecap="round"><path d="M27 12v3.5M27 42.5V46M10 29h3.5M40.5 29H44" /></g>
      <path d="M27 29 L27 18" stroke="#2b1d3a" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M27 29 L35 33" stroke="#2b1d3a" strokeWidth="3.5" strokeLinecap="round" />
      <g style={passed ? undefined : { transformOrigin: "27px 29px", animation: "g-tick 60s steps(60) infinite" }}>
        <path d="M27 33 L27 13" stroke="#ff4d6d" strokeWidth="2.2" strokeLinecap="round" /><circle cx="27" cy="13" r="2" fill="#ff4d6d" />
      </g>
      <circle cx="27" cy="29" r="3" fill="#2b1d3a" />
    </svg>
  );
}
