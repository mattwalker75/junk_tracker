/**
 * Craving Crusher's small drawings, from the approved mockups (thick #2b1d3a outlines, flat fills).
 * Each takes the usual SVG props (className for the size). The monsters themselves are files:
 * web/public/monsters/<slug>.svg, shown with <img> (see Monster in parts.tsx).
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

export const Gamepad = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10a5 5 0 0 1 4.8 6.3l-1 3.6a2.6 2.6 0 0 1-4.4 1.1L14 15.5h-4L7.6 18a2.6 2.6 0 0 1-4.4-1.1l-1-3.6A5 5 0 0 1 7 7z"/><path d="M7.5 10.5v3M6 12h3"/><circle cx="15.5" cy="11" r="0.9" fill="currentColor"/><circle cx="17.5" cy="13" r="0.9" fill="currentColor"/></svg>
);
export const Home = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>
);
export const HeartFull = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 22"><path d="M12 21C5 15 1.5 11.5 1.5 7.2 1.5 4 4 1.5 7 1.5c2 0 4 1.1 5 2.9 1-1.8 3-2.9 5-2.9 3 0 5.5 2.5 5.5 5.7 0 4.3-3.5 7.8-10.5 13.8z" fill="#ff4d6d" stroke="#2b1d3a" strokeWidth="2.4" strokeLinejoin="round"/><path d="M5.5 5.5c1-1 2.4-1.2 3.4-.6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8"/></svg>
);
export const HeartEmpty = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 22"><path d="M12 21C5 15 1.5 11.5 1.5 7.2 1.5 4 4 1.5 7 1.5c2 0 4 1.1 5 2.9 1-1.8 3-2.9 5-2.9 3 0 5.5 2.5 5.5 5.7 0 4.3-3.5 7.8-10.5 13.8z" fill="#ecdcc0" stroke="#2b1d3a" strokeWidth="2.4" strokeLinejoin="round" strokeDasharray="3 2.4"/></svg>
);
export const Star = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24"><path d="M12 2l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.1 6 20.4l1.3-6.7-5-4.7 6.8-.8z" fill="#ffffff" stroke="#2b1d3a" strokeWidth="2.2" strokeLinejoin="round"/></svg>
);
export const Ability = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="#7bd36b" stroke="#ffc93c" strokeWidth="1.6"/><rect x="9" y="7" width="4.4" height="10" rx="1" fill="#ffcf4a" stroke="#2b1d3a" strokeWidth="1.4"/><path d="M11 7 C11 4 13 3 15.5 3.5 C15 6 13 7 11 7Z" fill="#2f7a2a"/><path d="M11 7 C11 5 9.5 4 7.5 4.3 C8 6 9.5 7 11 7Z" fill="#2f7a2a"/></svg>
);
export const Target = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 44 44"> <circle cx="22" cy="22" r="20" fill="#ffffff" stroke="#2b1d3a" strokeWidth="3"/> <circle cx="22" cy="22" r="13" fill="none" stroke="#ff4d6d" strokeWidth="4"/> <circle cx="22" cy="22" r="6" fill="#ff4d6d" stroke="#2b1d3a" strokeWidth="2.4"/> <path d="M22 2 V10 M22 34 V42 M2 22 H10 M34 22 H42" stroke="#2b1d3a" strokeWidth="3" strokeLinecap="round"/> </svg>
);
export const Shield = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 26 28"><path d="M13 2 L23 6 V13 C23 20 18 24 13 26 C8 24 3 20 3 13 V6 Z" fill="#7bd36b" stroke="#2b1d3a" strokeWidth="2.6" strokeLinejoin="round"/><circle cx="10.5" cy="11" r="3.2" fill="#2f7a2a"/><circle cx="15.5" cy="11" r="3.2" fill="#2f7a2a"/><circle cx="13" cy="8.5" r="3.2" fill="#3f9a36"/><path d="M13 12 V19" stroke="#2f7a2a" strokeWidth="3" strokeLinecap="round"/></svg>
);
export const Potion = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 28"><path d="M9 2 H15 V9 L21 21 C22 24 20 26 17 26 H7 C4 26 2 24 3 21 L9 9 Z" fill="#6ec6ff" stroke="#2b1d3a" strokeWidth="2.6" strokeLinejoin="round"/><path d="M6 18 H18" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round"/></svg>
);
export const Wind = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="2.6"/><path d="M7 11 C10 7 16 7 19 11 M7 15 C10 19 16 19 19 15" stroke="#2b1d3a" strokeWidth="2.4" strokeLinecap="round" fill="none"/></svg>
);
export const IconHit = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="#7bd36b" stroke="#2b1d3a" strokeWidth="2"/><path d="M6 16 L14 8 M12 6 L16 10 M7 13 L9 15" stroke="#2b1d3a" strokeWidth="2.4" strokeLinecap="round"/></svg>
);
export const IconCrit = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="#5a3f86" stroke="#2b1d3a" strokeWidth="2"/><path d="M12.5 3.5 L6 12 H10.5 L9 18.5 L16 10 H11.5 Z" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="1.6" strokeLinejoin="round"/></svg>
);
export const IconHeal = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="#ff4d6d" stroke="#2b1d3a" strokeWidth="2"/><path d="M11 6 V16 M6 11 H16" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round"/></svg>
);
export const IconBlock = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 22 22"><path d="M11 1.5 L19.5 5 V11 C19.5 16 15.5 19 11 20.5 C6.5 19 2.5 16 2.5 11 V5 Z" fill="#7bd36b" stroke="#2b1d3a" strokeWidth="2" strokeLinejoin="round"/><path d="M7 11 L10 14 L15 8" stroke="#2b1d3a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
);
export const Sword = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 40 40"><g transform="rotate(45 20 20)" stroke="#2b1d3a" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"><path d="M20 1 L24 6 V25 H16 V6 Z" fill="#e9f1fb"/><path d="M20 6 V22" stroke="#ffffff" strokeWidth="2"/><rect x="10" y="25" width="20" height="5" rx="2.5" fill="#ffc93c"/><rect x="17.5" y="30" width="5" height="6" fill="#a0603a"/><circle cx="20" cy="37.5" r="2.6" fill="#ffc93c"/></g></svg>
);
export const Close = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 20 20"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round"/></svg>
);
export const Cookie = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 48 48"><circle cx="24" cy="24" r="17" fill="#e0a458" stroke="#2b1d3a" strokeWidth="3"/><path d="M13.5 17 A13 13 0 0 1 21.5 10.4" stroke="#f6d59c" strokeWidth="3" fill="none" strokeLinecap="round"/><g fill="#6b3a1e"><ellipse cx="18" cy="21" rx="2.6" ry="2.2"/><ellipse cx="29" cy="17" rx="2.4" ry="2"/><ellipse cx="28" cy="29" rx="2.8" ry="2.3"/><ellipse cx="17" cy="31" rx="2.2" ry="1.9"/><ellipse cx="34" cy="25" rx="2" ry="1.8"/></g></svg>
);
export const Burger = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 48 48"><path d="M8 35 H40 V37 C40 40 37 42 34 42 H14 C11 42 8 40 8 37 Z" fill="#f2a93b" stroke="#2b1d3a" strokeWidth="2.8" strokeLinejoin="round"/><rect x="7" y="27" width="34" height="8" rx="4" fill="#7a3b1d" stroke="#2b1d3a" strokeWidth="2.8"/><path d="M9 27 H39 L35.5 31.5 L31 28.6 L26 32.5 L21 28.6 L15 31.5 Z" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="2" strokeLinejoin="round"/><path d="M6.5 25 Q9.5 21.5 12.5 25 T18.5 25 T24.5 25 T30.5 25 T36.5 25 T41.5 25" stroke="#2b1d3a" strokeWidth="6" fill="none" strokeLinecap="round"/><path d="M6.5 25 Q9.5 21.5 12.5 25 T18.5 25 T24.5 25 T30.5 25 T36.5 25 T41.5 25" stroke="#7bd36b" strokeWidth="2.6" fill="none" strokeLinecap="round"/><path d="M8 22 C8 12 16 7 24 7 C32 7 40 12 40 22 Z" fill="#f2a93b" stroke="#2b1d3a" strokeWidth="2.8" strokeLinejoin="round"/><g fill="#fff3c4"><ellipse cx="18" cy="13.5" rx="1.8" ry="1.1"/><ellipse cx="25" cy="11" rx="1.8" ry="1.1"/><ellipse cx="31" cy="15" rx="1.8" ry="1.1"/><ellipse cx="23" cy="17.5" rx="1.8" ry="1.1"/></g></svg>
);
export const Pizza = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="#e9a24c" stroke="#2b1d3a" strokeWidth="3"/><circle cx="24" cy="24" r="14.2" fill="#e8453c"/><circle cx="24" cy="24" r="12.8" fill="#ffcf4a"/><path d="M24 11 V37 M11 24 H37 M14.8 14.8 L33.2 33.2 M33.2 14.8 L14.8 33.2" stroke="#e9a24c" strokeWidth="1.6"/><g fill="#c0392b" stroke="#2b1d3a" strokeWidth="1.6"><circle cx="18.5" cy="17" r="3"/><circle cx="30" cy="18.5" r="3"/><circle cx="17" cy="29.5" r="3"/><circle cx="29.5" cy="30.5" r="3"/><circle cx="24" cy="24" r="2.5"/></g></svg>
);
export const ClockSmall = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#ffc93c" stroke="#fff7e6" strokeWidth="2"/><path d="M10 5.5 V10 L13 12" stroke="#2b1d3a" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
export const Points = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="2.5"/><path d="M12 6.5 l1.7 3.5 3.8 .5 -2.8 2.6 .7 3.8 -3.4 -1.9 -3.4 1.9 .7 -3.8 -2.8 -2.6 3.8 -.5 z" fill="#fff3c4" stroke="#2b1d3a" strokeWidth="1.3" strokeLinejoin="round"/></svg>
);
export const Flame = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 30 36"><path d="M15 2 C24 11 28 17 26 25 C24 31 20 34 15 34 C9 34 4 30 4 24 C4 19 7 16 10 13 C10 18 12 20 15 20 C13 14 12 8 15 2Z" fill="#ff7a2f" stroke="#2b1d3a" strokeWidth="2.8" strokeLinejoin="round"/><path d="M15 16 C19 21 20 24 19 27 C18 30 16 31 15 31 C12 31 10 29 10 26 C10 23 12 22 13 20 C13 23 14 24 15 24 C15 21 14 19 15 16Z" fill="#ffc93c"/></svg>
);
export const Back = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
);
export const Book = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 40 34"><path d="M20 6 C14 2 7 2 3 4 V30 C7 28 14 28 20 32 C26 28 33 28 37 30 V4 C33 2 26 2 20 6Z" fill="#7bd36b" stroke="#2b1d3a" strokeWidth="3" strokeLinejoin="round"/><path d="M20 6 V32" stroke="#2b1d3a" strokeWidth="3"/><circle cx="11" cy="15" r="2.4" fill="#2b1d3a"/><circle cx="16" cy="15" r="2.4" fill="#2b1d3a"/><path d="M10 21 l2 3 2 -3 2 3" fill="none" stroke="#2b1d3a" strokeWidth="2" strokeLinejoin="round"/><path d="M24 12 H33 M24 17 H33 M24 22 H30" stroke="#2b1d3a" strokeWidth="2.2" strokeLinecap="round"/></svg>
);
export const Trophy = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 38 34"><path d="M10 3 H28 V12 a9 9 0 0 1 -18 0Z" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="3" strokeLinejoin="round"/><path d="M10 6 H4 a6 6 0 0 0 7 9 M28 6 H34 a6 6 0 0 1 -7 9" fill="none" stroke="#2b1d3a" strokeWidth="3"/><path d="M19 21 V26" stroke="#2b1d3a" strokeWidth="4"/><rect x="11" y="26" width="16" height="6" rx="2" fill="#ff7a2f" stroke="#2b1d3a" strokeWidth="3"/><path d="M14 7 V12" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.7"/></svg>
);
export const Fist = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 38 34"><path d="M6 20 C4 14 8 8 14 9 L16 5 C18 2 22 3 22 6 V9 C28 8 33 12 32 19 C31 26 26 30 19 30 C12 30 8 27 6 20Z" fill="#ffd2a8" stroke="#2b1d3a" strokeWidth="3" strokeLinejoin="round"/><path d="M14 9 C13 13 15 15 18 15" fill="none" stroke="#2b1d3a" strokeWidth="2.4" strokeLinecap="round"/><path d="M3 4 L7 8 M34 3 L30 8 M36 14 H32" stroke="#ff4d6d" strokeWidth="3" strokeLinecap="round"/></svg>
);
export const Play = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 16 18"><path d="M3 2 L14 9 L3 16Z" fill="#ffffff" stroke="#2b1d3a" strokeWidth="2.4" strokeLinejoin="round"/></svg>
);
export const PadSmall = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 26 18"><path d="M7 1 H19 a6 6 0 0 1 6 6 V11 a6 6 0 0 1 -11 3 H12 a6 6 0 0 1 -11 -3 V7 a6 6 0 0 1 6 -6Z" fill="#ffc93c" stroke="#fff7e6" strokeWidth="1.6"/><path d="M7 5 V11 M4 8 H10" stroke="#2b1d3a" strokeWidth="2" strokeLinecap="round"/><circle cx="18" cy="7" r="1.5" fill="#2b1d3a"/><circle cx="21" cy="10" r="1.5" fill="#2b1d3a"/></svg>
);
export const ShieldBlue = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24"><path d="M12 2.2 L20.2 5.2 V11 C20.2 16.2 16.6 19.8 12 22 C7.4 19.8 3.8 16.2 3.8 11 V5.2 Z" fill="#6ec6ff" stroke="#2b1d3a" strokeWidth="2.2" strokeLinejoin="round"/><path d="M12 4.6 V19.4" stroke="#2b1d3a" strokeWidth="1.4" opacity="0.35"/><path d="M8.2 11.6 l2.8 2.8 5-5.4" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
export const Skull = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24"><path d="M12 2.4 C6.8 2.4 3.3 5.9 3.3 10.6 C3.3 13.4 4.6 15.4 6.4 16.4 V19 A1.6 1.6 0 0 0 8 20.6 H16 A1.6 1.6 0 0 0 17.6 19 V16.4 C19.4 15.4 20.7 13.4 20.7 10.6 C20.7 5.9 17.2 2.4 12 2.4 Z" fill="#f4efe6" stroke="#2b1d3a" strokeWidth="2.1" strokeLinejoin="round"/><ellipse cx="8.7" cy="11.2" rx="2.4" ry="2.6" fill="#2b1d3a"/><ellipse cx="15.3" cy="11.2" rx="2.4" ry="2.6" fill="#2b1d3a"/><path d="M12 13.6 L10.7 15.9 H13.3 Z" fill="#2b1d3a"/><path d="M10 17.4 V20.4 M12 17.4 V20.4 M14 17.4 V20.4" stroke="#2b1d3a" strokeWidth="1.4" strokeLinecap="round"/><path d="M6.6 7.4 C7.4 6 8.6 5.2 10 4.9" stroke="#ffffff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9"/></svg>
);
export const Check = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5 9.5-10" fill="none" stroke="#2b1d3a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
export const Info = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff7e6" stroke="#1a1024" strokeWidth="2.4"/><path d="M12 11 V17" stroke="#2b1d3a" strokeWidth="3" strokeLinecap="round"/><circle cx="12" cy="7.4" r="1.7" fill="#2b1d3a"/></svg>
);
export const PlayDark = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24"><path d="M7 4 L20 12 L7 20 Z" fill="#2b1d3a" stroke="#2b1d3a" strokeWidth="2" strokeLinejoin="round"/></svg>
);
export const HeartPlus = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 40 40"><path d="M20 35 C9 27 4 21 4 14.5 A8 8 0 0 1 20 10 A8 8 0 0 1 36 14.5 C36 21 31 27 20 35 Z" fill="#ff7a95" stroke="#2b1d3a" strokeWidth="3" strokeLinejoin="round"/><path d="M10 14 A4.5 4.5 0 0 1 14.5 10" stroke="#ffd1dc" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M20 16 V27 M14.5 21.5 H25.5" stroke="#ffffff" strokeWidth="7" strokeLinecap="round"/><path d="M20 16 V27 M14.5 21.5 H25.5" stroke="#2b1d3a" strokeWidth="2.6" strokeLinecap="round"/></svg>
);
export const InfoBlue = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#6ec6ff" stroke="#2b1d3a" strokeWidth="2.6"/><path d="M13 11.5 V18.5" stroke="#2b1d3a" strokeWidth="3" strokeLinecap="round"/><circle cx="13" cy="7.6" r="1.9" fill="#2b1d3a"/></svg>
);
export const Padlock = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 26"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#2b1d3a" strokeWidth="3.2"/><rect x="3" y="10.5" width="18" height="13" rx="3.5" fill="#b9b0c2" stroke="#2b1d3a" strokeWidth="3"/><circle cx="12" cy="16" r="2" fill="#2b1d3a"/><path d="M12 17v3" stroke="#2b1d3a" strokeWidth="2.4" strokeLinecap="round"/></svg>
);
export const CheckBadge = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#7bd36b" stroke="#2b1d3a" strokeWidth="3"/><path d="M7 12.5l3.2 3 6-6.5" fill="none" stroke="#2b1d3a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
/** The player's little hero (mockup MonMap60); `ko` gives it dizzy X eyes. */
export const Hero = ({ ko, ...p }: P & { ko?: boolean }) => (
  <svg {...p} aria-hidden viewBox="0 0 40 46">
    <ellipse cx="20" cy="43" rx="12" ry="3" fill="#2b1d3a" opacity="0.3"/>
    <path d="M9 26 L4 38 L18 36Z" fill="#ff4d6d" stroke="#2b1d3a" strokeWidth="2.4" strokeLinejoin="round"/>
    <rect x="11" y="24" width="18" height="16" rx="6" fill="#6ec6ff" stroke="#2b1d3a" strokeWidth="2.6"/>
    <circle cx="20" cy="15" r="11" fill="#ffd2a8" stroke="#2b1d3a" strokeWidth="2.6"/>
    <path d="M9 14 a11 11 0 0 1 22 0 Z" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="2.6" strokeLinejoin="round"/>
    <path d="M20 4 C22 0 27 0 28 2" fill="none" stroke="#ff4d6d" strokeWidth="3" strokeLinecap="round"/>
    {ko
      ? <path d="M14 16.5 l4 3.5 M18 16.5 l-4 3.5 M22 16.5 l4 3.5 M26 16.5 l-4 3.5" stroke="#2b1d3a" strokeWidth="1.8" strokeLinecap="round"/>
      : <><circle cx="16" cy="18" r="1.8" fill="#2b1d3a"/><circle cx="24" cy="18" r="1.8" fill="#2b1d3a"/><path d="M16.5 22 q3.5 2.5 7 0" fill="none" stroke="#2b1d3a" strokeWidth="1.8" strokeLinecap="round"/></>}
    <path d="M31 30 L37 18" stroke="#2b1d3a" strokeWidth="5" strokeLinecap="round"/><path d="M31 30 L37 18" stroke="#e8f6ff" strokeWidth="2.4" strokeLinecap="round"/>
    <path d="M28 30 h6" stroke="#2b1d3a" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);
/** A boss's castle (mockup MonMap60): green once beaten, grey while locked, gold while you fight it. */
export const Castle = ({ tone, ...p }: P & { tone: "beaten" | "current" | "locked" }) => {
  const wall = tone === "beaten" ? "#8fd27c" : tone === "current" ? "#ffd765" : "#a79fb0";
  const flag = tone === "locked" ? "#d8d2de" : "#ff4d6d";
  return (
    <svg {...p} aria-hidden viewBox="0 0 88 84">
      <path d="M8 82 V30 H6 V18 H14 V24 H20 V18 H28 V30 H26 V40 H62 V30 H60 V18 H68 V24 H74 V18 H82 V30 H80 V82 Z" fill={wall} stroke="#2b1d3a" strokeWidth="3.5" strokeLinejoin="round"/>
      <path d="M30 40 V22 H28 V12 H36 V17 H41 V12 H47 V17 H52 V12 H60 V22 H58 V40 Z" fill={wall} stroke="#2b1d3a" strokeWidth="3.5" strokeLinejoin="round"/>
      <path d="M44 12 V2 M44 2 l10 3.5 -10 3.5" fill={flag} stroke="#2b1d3a" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M12 34 H22 M66 34 H76" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
};
export const MapIcon = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>
);
export const Crown = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 40 30"><path d="M4 26 L2 8 L12 16 L20 3 L28 16 L38 8 L36 26 Z" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="3" strokeLinejoin="round"/><circle cx="20" cy="18" r="3" fill="#ff4d6d" stroke="#2b1d3a" strokeWidth="2"/></svg>
);
export const Replay = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>
);
export const HeartBroken = (p: P) => (
  <svg {...p} aria-hidden viewBox="0 0 24 22"><path d="M12 21C5 15 1.5 11.5 1.5 7.2 1.5 4 4 1.5 7 1.5c2 0 4 1.1 5 2.9 1-1.8 3-2.9 5-2.9 3 0 5.5 2.5 5.5 5.7 0 4.3-3.5 7.8-10.5 13.8z" fill="#ecdcc0" stroke="#2b1d3a" strokeWidth="2.4" strokeLinejoin="round"/><path d="M12 4.4 L10 9 L13.5 11.5 L11 16" fill="none" stroke="#2b1d3a" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/></svg>
);
/** The five Hall of Heroes badges (mockup MonHall). */
export const BadgeArt = ({ id, earned, ...p }: P & { id: string; earned: boolean }) => {
  const g = earned ? undefined : "grayscale(1)";
  const ring = (fill: string) => <circle cx="22" cy="22" r="19" fill={fill} stroke="#2b1d3a" strokeWidth="3"/>;
  return (
    <svg {...p} aria-hidden viewBox="0 0 44 44" style={{ filter: g, opacity: earned ? 1 : 0.55 }}>
      {id === "first-blood" ? <>{ring("#ff4d6d")}<circle cx="22" cy="22" r="13" fill="none" stroke="#ffd0d8" strokeWidth="2" strokeDasharray="3 3"/><g transform="rotate(45 22 22)"><path d="M22 8 L25 12 V27 H19 V12 Z" fill="#e9f1fb" stroke="#2b1d3a" strokeWidth="2.2" strokeLinejoin="round"/><rect x="15" y="27" width="14" height="4" rx="2" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="2"/><rect x="20.5" y="31" width="3" height="5" fill="#a0603a" stroke="#2b1d3a" strokeWidth="1.6"/></g></> : null}
      {id === "flawless" ? <>{ring("#6ec6ff")}<path d="M14 17 L18 12 H26 L30 17 L22 32 Z" fill="#ffffff" stroke="#2b1d3a" strokeWidth="2.4" strokeLinejoin="round"/><path d="M14 17 H30 M18 12 L22 32 L26 12" fill="none" stroke="#2b1d3a" strokeWidth="1.8" strokeLinejoin="round"/></> : null}
      {id === "daredevil" ? <>{ring("#ff7a2f")}<path d="M22 9 C29 16 31 21 29 27 C27.5 31 25 33 22 33 C18 33 14.5 30 14.5 26 C14.5 22 17 20 19 17 C19 21 20.5 22.5 22 22.5 C21 18 20.5 13 22 9Z" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="2.2" strokeLinejoin="round"/><text x="22" y="30" textAnchor="middle" fontSize="8" fontWeight="900" fill="#2b1d3a">×2</text></> : null}
      {id === "world-1" ? <>{ring("#7bd36b")}<path d="M17 33 V11" stroke="#2b1d3a" strokeWidth="2.6" strokeLinecap="round"/><path d="M17 11 L30 15 L17 20 Z" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="2.2" strokeLinejoin="round"/><rect x="12" y="25" width="20" height="8" rx="4" fill="#2f7a2a" stroke="#2b1d3a" strokeWidth="2"/><text x="22" y="31.6" textAnchor="middle" fontSize="7" fontWeight="900" fill="#ffffff">W1</text></> : null}
      {id === "comeback" ? <>{ring("#ffc93c")}<path d="M22 33 C13 26 10 22 10 17.5 A5.5 5.5 0 0 1 22 15 A5.5 5.5 0 0 1 34 17.5 C34 22 31 26 22 33Z" fill="#ff4d6d" stroke="#2b1d3a" strokeWidth="2.4" strokeLinejoin="round"/><path d="M16.5 22 l4 4 7-8" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></> : null}
    </svg>
  );
};
