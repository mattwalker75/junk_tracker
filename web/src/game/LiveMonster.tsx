/**
 * A monster that moves (Matt, Nov 22 2026). Its drawing is put inline (an <img> can't be driven), its tagged
 * parts — arms, legs, tail, hat, head, orbit — animate with monster-moves.css, and moves.ts says which of its
 * own moves plays: idle during a fight, strike when it takes a heart, ko when it is defeated, win when it takes
 * your last heart. Until its drawing has loaded it is the plain <img>, so nothing jumps.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { cx } from "../components/ui";
import { inlineSvg } from "./inlineSvg";
import { movesFor, STRIKE_MS, type MonsterAct } from "./moves";
import "./monster-moves.css";

const loaded = new Map<string, string>();
const loading = new Map<string, Promise<string>>();

function load(slug: string): Promise<string> {
  let p = loading.get(slug);
  if (!p) {
    p = fetch(`/monsters/${slug}.svg`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => { loaded.set(slug, t); return t; });
    p.catch(() => loading.delete(slug)); // a failed load is tried again next time
    loading.set(slug, p);
  }
  return p;
}

export function LiveMonster({ slug, name, act = "idle", play = 0, className, extra }: {
  slug: string; name: string;
  /** what it is doing; "still" stands it still */
  act?: MonsterAct;
  /** change it to play the same act again from the top */
  play?: number;
  className?: string;
  /** SVG markup in the drawing's 200 x 200 units, drawn on top and moving with the body */
  extra?: string;
}) {
  const [svg, setSvg] = useState(() => loaded.get(slug) ?? null);
  const tag = useId().replace(/[^a-zA-Z0-9]/g, "");
  useEffect(() => {
    let live = true;
    const have = loaded.get(slug);
    if (have) setSvg(have);
    else { setSvg(null); load(slug).then((t) => { if (live) setSvg(t); }, () => {}); }
    return () => { live = false; };
  }, [slug]);
  // a heart taken plays once, then the monster goes back to idling
  const [struck, setStruck] = useState(false);
  useEffect(() => {
    setStruck(false);
    if (act !== "strike") return;
    const t = setTimeout(() => setStruck(true), STRIKE_MS);
    return () => clearTimeout(t);
  }, [act, play]);
  const now: MonsterAct = act === "strike" && struck ? "idle" : act;
  const m = movesFor(slug);
  const html = useMemo(() => (svg ? inlineSvg(svg, tag, extra) : ""), [svg, tag, extra]);
  if (!svg) return <img src={`/monsters/${slug}.svg`} alt={name} draggable={false} className={cx("block select-none", className)} />;
  return (
    <div key={`${now}-${play}`} role="img" aria-label={name}
      className={cx("ccm block select-none", now !== "still" && `cc-${now}`, className)}
      data-idle={m.idle} data-move={now === "idle" || now === "still" ? undefined : m[now]}
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}
