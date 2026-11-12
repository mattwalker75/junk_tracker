/**
 * The adventure map (mockup MonMap60): all 6 worlds as tinted bands with their scenery, a winding
 * path through the 60 levels, each a node with its monster's portrait — beaten (a check), the
 * current fight (a pulse, your hero and a flag with its HP and days left) or locked (dimmed, a
 * padlock); bosses are castles. A sticky HUD (hearts, score, Level N / 60, the run's mode), "Jump
 * to me", and a card for the node you tap. And one world up close (mockup MonWorld2): its ten
 * levels as big nodes, with chips for the six worlds.
 *
 * Kept light for a phone: one <img> per portrait (the browser caches the files), one scenery
 * picture, and the path as three SVG strokes.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LEVEL_COUNT, LEVELS_PER_WORLD, levelInfo, WORLDS, type FightView, type GameView, type MapLevel, type MapStatus, type RunView } from "../../../shared/game";
import { Sheet } from "../components/ui";
import { api } from "../lib/api";
import { nowTime } from "../lib/dates";
import { worldMap } from "./art";
import { Castle, CheckBadge, Hero, Padlock, Play, ShieldBlue, Skull } from "./icons";
import { ALL_LEVELS, BAND_H, bandTop, cardBox, MAP_H, MAP_START, MAP_W, mapNode, paths, trailEnd, WORLD_H, WORLD_START, worldLevels, worldNode, worldOf, type Pt } from "./layout";
import { shortDate, soClose } from "./logic";
import { GameMenu, GameNote } from "./parts";
import { applyResult, useGame } from "./state";

const fmt = (n: number) => n.toLocaleString("en-US");
const portrait = (slug: string) => `/monsters/${slug}.svg`;
const NODE_BG: Record<MapStatus, string> = { beaten: "#d7f5c8", current: "#ffd2b0", locked: "#d8d2de" };
const DIM = { filter: "grayscale(1) contrast(.85) brightness(1.08)", opacity: 0.55 };

// ================================================================ the HUD (map and world)

function ModeBadge({ run, today }: { run: RunView; today: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hard = run.hardcore;
  const drop = async () => {
    setBusy(true); setError(null);
    try { applyResult(qc, today, await api.gameToNormal(today, nowTime())); setConfirm(false); setOpen(false); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={hard ? "Hardcore run: what that means" : "Normal run: what that means"}
        className="g-btn inline-flex h-[30px] shrink-0 items-center gap-1 rounded-full pr-2.5 pl-1.5 font-game text-[13px] tracking-[0.04em]"
        style={{ background: hard ? "#ff4d6d" : "#6ec6ff", borderColor: "#1a1024", boxShadow: "0 3px 0 #1a1024", color: "#1a1024" }}>
        {hard ? <Skull className="size-4" /> : <ShieldBlue className="size-4" />}{hard ? "HARDCORE" : "NORMAL"}
      </button>
      {open ? (
        <>
          <button aria-label="Close" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div role="note" className="absolute top-[58px] right-3 z-40 w-[250px] rounded-[14px] border-[3px] border-[#2b1d3a] px-2.5 py-2 text-[13px] leading-snug font-extrabold text-[#2b1d3a] shadow-[0_4px_0_#1a1024]"
            style={{ background: hard ? "#ffe3e8" : "#e8f6ff" }}>
            <span className="flex items-center gap-1.5 font-game text-[16px] font-normal">{hard ? <Skull className="size-4" /> : <ShieldBlue className="size-4" />}{hard ? "Hardcore run" : "Normal run"}</span>
            {hard
              ? "At 0 hearts the run is over and the next one starts at level 1. You get ×1.25 on all points and a skull in the Hall of Heroes."
              : `At 0 hearts you're knocked back to the start of your world with 3 hearts. −250 points per knock-back.${run.hardcoreDroppedOn ? ` This run was Hardcore until ${shortDate(run.hardcoreDroppedOn)}.` : ""}`}
            {hard && run.active ? (
              <button onClick={() => setConfirm(true)} className="g-btn mt-2 flex h-10 w-full items-center justify-center rounded-xl bg-[#6ec6ff] font-game text-[15px] text-[#1a1024]">Switch to Normal…</button>
            ) : null}
          </div>
        </>
      ) : null}
      <Sheet skin="game" open={confirm} onOpenChange={setConfirm} title="Switch to Normal?">
        <p className="text-[15px] leading-snug font-bold">
          From now on, 0 hearts knocks you back to the start of your world (−250 points) instead of ending the run.
          You lose the ×1.25 on new points and the skull.
        </p>
        <p className="mt-2 rounded-xl border-2 border-g-line bg-g-soft-red px-3 py-2 text-[14px] leading-snug font-extrabold">This is one way: a Normal run can't go back to Hardcore.</p>
        {error ? <p role="alert" className="mt-2 text-sm font-extrabold text-g-pink">{error}</p> : null}
        <div className="mt-3 mb-4 grid grid-cols-2 gap-2">
          <button onClick={() => setConfirm(false)} className="g-btn h-12 rounded-2xl bg-g-panel-2 font-game text-lg text-g-text">Keep Hardcore</button>
          <button onClick={() => void drop()} disabled={busy} className="g-btn h-12 rounded-2xl bg-[#6ec6ff] font-game text-lg">Switch to Normal</button>
        </div>
      </Sheet>
    </>
  );
}

function SmallHearts({ hearts }: { hearts: number }) {
  const slots = Math.max(3, hearts);
  return (
    <div role="img" aria-label={`${hearts} ${hearts === 1 ? "heart" : "hearts"}`} className="flex shrink-0 gap-px rounded-xl bg-[#1a1024] px-1.5 py-[3px]">
      {Array.from({ length: slots }, (_, i) => (
        <svg key={i} viewBox="0 0 24 22" className="h-4 w-[18px]" aria-hidden><path d="M12 20 C4 14 2 10 2 7 a5 5 0 0 1 10 -1 a5 5 0 0 1 10 1 c0 3 -2 7 -10 13z" fill={i < hearts ? "#ff4d6d" : "#5b4a6b"} stroke={i < hearts ? "#2b1d3a" : "#1a1024"} strokeWidth="2.6" strokeLinejoin="round" /></svg>
      ))}
    </div>
  );
}

function Hud({ kicker, title, back, run, today, children }: { kicker: string; title: string; back: string; run: RunView | null; today: string; children: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex flex-col gap-[7px] border-b-[3px] border-[#1a1024] px-3 pt-[9px] pb-[9px]" style={{ background: "rgb(43 29 58 / .95)" }}>
      <div className="relative flex items-center gap-2">
        <a href={back} aria-label="Back" className="g-btn grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff7e6] text-[#2b1d3a]" style={{ borderColor: "#1a1024", boxShadow: "0 4px 0 #1a1024" }}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
        </a>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-game text-[10px] tracking-[0.1em] text-[#c8b6e6]">{kicker}</span>
          <h1 className="truncate font-game text-[21px] leading-none font-normal text-white" style={{ WebkitTextStroke: "2px #1a1024", paintOrder: "stroke fill" }}>{title}</h1>
        </div>
        {run ? <ModeBadge run={run} today={today} /> : null}
        <GameMenu />
      </div>
      <div className="flex items-center gap-2">
        {run ? <SmallHearts hearts={run.hearts} /> : null}
        {run ? (
          <div aria-label={`Score ${fmt(run.liveScore)}`} className="flex shrink-0 items-center gap-1 rounded-xl border-[3px] border-[#ffc93c] bg-[#2b1d3a] px-[7px] py-px">
            <svg viewBox="0 0 24 24" className="size-[15px]" aria-hidden><path d="M12 2l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 16.6 6.1 19.8l1.3-6.5L2.5 8.8 9.1 8z" fill="#ffc93c" stroke="#1a1024" strokeWidth="2" strokeLinejoin="round" /></svg>
            <span className="font-game text-[15px] text-[#ffc93c]">{fmt(run.liveScore)}</span>
          </div>
        ) : null}
        {children}
      </div>
    </header>
  );
}

function LevelBar({ map }: { map: MapLevel[] }) {
  const beaten = map.filter((m) => m.status === "beaten").length;
  const cur = map.find((m) => m.status === "current");
  return (
    <div aria-label={cur ? `Level ${cur.level} of 60` : `${beaten} of 60 beaten`} className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex justify-between text-[11px] font-black whitespace-nowrap text-white"><span>{cur ? `Level ${cur.level} / ${LEVEL_COUNT}` : `${beaten} / ${LEVEL_COUNT}`}</span><span className="text-[#c8b6e6]">{beaten} beaten</span></span>
      <span className="block h-[9px] overflow-hidden rounded-full border-2 border-[#1a1024] bg-[#1a1024]">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(3, (beaten / LEVEL_COUNT) * 100)}%`, background: "linear-gradient(90deg, #7bd36b, #ffc93c)" }} />
      </span>
    </div>
  );
}

// ================================================================ nodes and their card

/** A level on the map or a world page: its portrait in a circle, or a castle for a boss. */
function Node({ m, at, size, onTap, selected }: { m: MapLevel; at: Pt; size: "map" | "world"; onTap: () => void; selected: boolean }) {
  const lv = levelInfo(m.level);
  const big = size === "world";
  const d = big ? 68 : 46;
  const img = big ? 64 : 44;
  const label = `Level ${lv.level}, ${lv.name}${lv.boss ? ", boss" : ""}, ${m.status === "current" ? "fighting now" : m.status}`;
  const faceStyle = m.status === "locked" ? DIM : undefined;
  const badge = m.status === "beaten" ? <CheckBadge className={big ? "absolute -right-1 -bottom-1 size-6" : "absolute -right-1.5 -bottom-1 size-[18px]"} />
    : m.status === "locked" ? <Padlock className={big ? "absolute -right-1.5 -bottom-1.5 h-[22px] w-5" : "absolute -right-1.5 -bottom-[5px] h-[17px] w-4"} /> : null;
  if (lv.boss) {
    const w = big ? 132 : 76, h = big ? 126 : 73, face = big ? 70 : 40;
    return (
      <button id={m.status === "current" ? "g-now" : undefined} aria-label={label} onClick={onTap} aria-pressed={selected}
        className="g-node absolute z-[3] p-0" style={{ left: at.x - w / 2, top: at.y - h / 2 - 4, width: w, height: h, scrollMargin: 200 }}>
        <Castle tone={m.status} className="absolute inset-0 size-full" />
        <span className={m.status === "current" ? "g-anim-node" : undefined}
          style={{ position: "absolute", left: (w - face) / 2, top: h * 0.4, width: face, height: face, borderRadius: `${face / 2}px ${face / 2}px 5px 5px`, background: NODE_BG[m.status], border: `3px solid ${m.status === "current" ? "#ffc93c" : "#2b1d3a"}`, overflow: "hidden", display: "grid", placeItems: "center" }}>
          <img src={portrait(lv.slug)} alt="" loading="lazy" decoding="async" draggable={false} style={{ width: face - 2, height: face - 2, ...faceStyle }} />
        </span>
        {badge ? <span className="absolute" style={{ left: (w + face) / 2 - 8, top: h * 0.4 + face - 14 }}>{badge}</span> : null}
      </button>
    );
  }
  return (
    <button id={m.status === "current" ? "g-now" : undefined} aria-label={label} onClick={onTap} aria-pressed={selected}
      className={`g-node absolute z-[3] rounded-full p-0 ${m.status === "current" ? "g-anim-node" : ""}`}
      style={{ left: at.x - d / 2, top: at.y - d / 2, width: d, height: d, background: NODE_BG[m.status], border: `${big ? 4 : 3}px solid ${m.status === "current" ? "#ffc93c" : "#2b1d3a"}`, boxShadow: "0 3px 0 #1a1024", scrollMargin: 200 }}>
      <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-full">
        <img src={portrait(lv.slug)} alt="" loading="lazy" decoding="async" draggable={false} style={{ width: img, height: img, ...faceStyle }} />
      </span>
      {badge}
    </button>
  );
}

function NodeLabel({ m, at, size }: { m: MapLevel; at: Pt; size: "map" | "world" }) {
  const lv = levelInfo(m.level);
  const big = size === "world";
  const below = lv.boss ? (big ? 62 : 34) : big ? 38 : 25;
  const text = lv.boss ? `${lv.level} · ${lv.level === LEVEL_COUNT ? "FINAL BOSS" : "BOSS"} · ${lv.name}${big ? ` · ${lv.hp} HP` : ""}` : `${lv.level} · ${lv.name}`;
  const locked = m.status === "locked";
  return (
    <span aria-hidden className="pointer-events-none absolute z-[4] whitespace-nowrap" style={{ top: at.y + below, ...labelAnchor(at.x) }}>
      <span className="inline-block rounded-full px-1.5 font-black whitespace-nowrap"
        style={{ fontSize: big ? 12 : 10, lineHeight: big ? "17px" : "15px", background: locked ? "rgb(43 29 58 / .6)" : "#2b1d3a", color: lv.boss && !locked ? "#ffc93c" : locked ? "#e3dbe9" : "#ffffff" }}>{text}</span>
    </span>
  );
}

/** Labels near an edge line up with it instead of running off the screen. */
function labelAnchor(x: number): React.CSSProperties {
  if (x >= 300) return { right: Math.max(4, MAP_W - x - 56), textAlign: "right" };
  if (x <= 90) return { left: Math.max(4, x - 56), textAlign: "left" };
  return { left: x - 110, width: 220, textAlign: "center" };
}

/** The card for a tapped node: what it is, and what's going on with it. */
function NodeCard({ m, view, box, onClose }: { m: MapLevel; view: GameView; box: { left: number; top: number; width: number }; onClose: () => void }) {
  const lv = levelInfo(m.level);
  const fight = view.fight && view.fight.level === m.level ? view.fight : null;
  const ink = worldMap(lv.world).ink;
  const kicker = `LEVEL ${lv.level} · WORLD ${lv.world} · ${lv.worldName.toUpperCase()}${lv.boss ? (lv.level === LEVEL_COUNT ? " · FINAL BOSS" : " · BOSS") : ""}`;
  const prev = lv.level > 1 ? levelInfo(lv.level - 1) : null;
  const cur = view.map.find((x) => x.status === "current");
  let status: string;
  if (fight) {
    const so = soClose(fight.hp);
    status = `Fighting now · ${fight.hp} HP to go. ${so.minutes} more minutes, or ${so.calories} calories, or mix.`;
  } else if (m.status === "beaten") {
    status = m.wins ? `Beaten${m.wins > 1 ? ` ${m.wins} times` : ""} in Run #${view.run?.number}${m.attempts > m.wins ? ` · it struck ${m.attempts - m.wins} ${m.attempts - m.wins === 1 ? "time" : "times"}` : ""} · best ${fmt(m.bestPoints)} points` : `Beaten in Run #${view.run?.number}`;
  } else if (!view.run) {
    status = lv.level === 1 ? "Locked · start a run and Crumbs is first." : `Locked · start a run, then beat ${prev?.name} first.`;
  } else if (!view.run.active) {
    status = `Locked · Run #${view.run.number} is over. A new run starts with Crumbs.`;
  } else if (cur && lv.level === cur.level + 1) {
    status = `Locked · next up after ${levelInfo(cur.level).name}.`;
  } else {
    status = `Locked · ${cur ? `${lv.level - cur.level} fights away. ` : ""}Beat ${prev?.name ?? "the one before"} first.`;
  }
  return (
    <section role="dialog" aria-label={lv.name} className="g-anim-pop absolute z-20 flex flex-col gap-[7px] rounded-[18px] border-[3px] border-[#2b1d3a] bg-[#fff7e6] px-3 pt-2.5 pb-3 text-[#2b1d3a] shadow-[0_4px_0_#1a1024,0_10px_24px_rgba(26,16,36,.35)]"
      style={{ left: box.left, top: box.top, width: box.width }}>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-black tracking-[0.06em]" style={{ color: ink }}>{kicker}</span>
          <span className="font-game text-[22px] leading-[1.05]">{lv.name}</span>
        </div>
        <button aria-label="Close" onClick={onClose} className="g-btn grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-white text-[#2b1d3a]" style={{ borderColor: "#2b1d3a", boxShadow: "0 3px 0 #1a1024" }}>
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-[#2b1d3a] px-2 py-0.5 text-xs font-black text-white">{fight ? `${fight.hp} / ${fight.max} HP` : `${lv.hp} HP`}</span>
        <span className="rounded-full border-2 border-[#2b1d3a] bg-white px-2 py-0.5 text-xs font-black">{fight ? `Due ${shortDate(fight.deadlineOn)} · ${fight.daysLeft} ${fight.daysLeft === 1 ? "day" : "days"} left` : `${lv.days}-day deadline`}</span>
      </div>
      <div className="flex items-center gap-2 rounded-xl border-2 border-[#2b1d3a] px-2.5 py-[7px]" style={{ background: fight ? "#ffe3a1" : m.status === "beaten" ? "#d7f5c8" : "#ece6f0" }}>
        <span className="text-[13px] leading-[1.25] font-black">{status}</span>
      </div>
      {fight ? (
        <a href="#/game/battle" className="g-btn flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-[#ffc93c] font-game text-lg text-[#2b1d3a]" style={{ borderColor: "#2b1d3a", boxShadow: "0 4px 0 #1a1024" }}>
          <Play className="h-4 w-3.5" />Fight {lv.name}
        </a>
      ) : (
        <a href={`#/game/world/${lv.world}`} className="self-start text-[13px] font-black text-[#5b3fd0] underline decoration-2 underline-offset-2">See {lv.worldName} up close</a>
      )}
    </section>
  );
}

/** The flag over the current fight ("92/250 · 3 days left") and your hero beside it. */
function NowFlag({ fight, at, big }: { fight: FightView; at: Pt; big: boolean }) {
  const lv = levelInfo(fight.level);
  const r = lv.boss ? (big ? 64 : 40) : big ? 34 : 23;
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute z-[6] flex" style={{ left: Math.min(at.x + 10, MAP_W - 8) - 220, width: 220, top: at.y - r - (big ? 40 : 29), justifyContent: "flex-end" }}>
        <span className="g-anim-wave rounded-xl border-[3px] border-[#2b1d3a] bg-[#ff4d6d] font-black whitespace-nowrap text-white shadow-[0_3px_0_#1a1024]"
          style={{ padding: big ? "4px 12px" : "3px 9px", fontSize: big ? 14 : 12 }}>{fight.hp}/{fight.max} · {fight.daysLeft} {fight.daysLeft === 1 ? "day" : "days"} left</span>
      </div>
      <Hero aria-label="Your hero" className="g-anim-bob pointer-events-none absolute z-[6]"
        style={{ left: at.x < 120 ? at.x + r - 2 : at.x - r - (big ? 40 : 30), top: at.y - (big ? 8 : 18), width: big ? 44 : 34, height: big ? 52 : 40 }} />
    </>
  );
}

// ================================================================ the 60-level map

export function MapPage() {
  const { today, view, error } = useGame();
  const [sel, setSel] = useState<number | null>(null);
  const jumped = useRef(false);
  const jump = (smooth: boolean) => {
    const el = document.getElementById("g-now") ?? document.getElementById("g-reached");
    el?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center", inline: "nearest" });
  };
  // open on where you are
  useLayoutEffect(() => {
    if (!view || jumped.current) return;
    jumped.current = true;
    if (view.run) jump(false); else window.scrollTo(0, document.body.scrollHeight);
  }, [view]);

  if (error) return <main className="min-h-dvh bg-[#2b1d3a] pt-4"><GameNote title="Hmm, that didn't load">{error.message}</GameNote></main>;
  if (!view) return <main className="min-h-dvh bg-[#2b1d3a]" />;
  const { run, fight, map } = view;
  const reached = trailEnd(map);
  const { full, walked } = paths(ALL_LEVELS, mapNode, MAP_START, reached);
  const selM = sel ? map[sel - 1] : null;
  const selBox = selM ? cardBox(mapNode(selM.level), { boss: levelInfo(selM.level).boss, tall: selM.status === "current" }) : null;
  const curFight = fight && map[fight.level - 1]?.status === "current" ? fight : null;

  return (
    <main className="relative flex flex-col overflow-x-clip bg-[#2b1d3a]" style={{ height: MAP_H }}>
      {/* the six bands, full width; the map itself is 390 wide in the middle */}
      {[6, 5, 4, 3, 2, 1].map((w) => (
        <div key={w} aria-hidden className="absolute inset-x-0" style={{ top: w === 6 ? 0 : bandTop(w), height: w === 6 ? bandTop(6) + BAND_H : BAND_H, background: worldMap(w).band }} />
      ))}
      <div className="absolute top-0 left-1/2 -translate-x-1/2" style={{ width: MAP_W, height: MAP_H }} onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
        <img src="/game-map-scenery.svg" alt="" aria-hidden decoding="async" className="g-art pointer-events-none absolute inset-0" style={{ width: MAP_W, height: MAP_H }} />
        <span aria-hidden className="absolute top-[637px] left-[104px] w-16 text-center font-game text-[11px] leading-none text-[#ffd0f4]">OPEN 24/7</span>
        <span aria-hidden className="absolute top-[607px] left-[14px] w-11 text-center font-game text-[10px] leading-none text-[#cffaff]">DRIVE</span>
        <PathSvg w={MAP_W} h={MAP_H} full={full} walked={walked} width={{ out: 20, road: 12 }} />
        {/* the worlds' signs */}
        {[1, 2, 3, 4, 5, 6].map((w) => <WorldSign key={w} w={w} map={map} />)}
        {map.map((m) => {
          const at = mapNode(m.level);
          return (
            <span key={m.level} id={m.level === reached && m.status !== "current" ? "g-reached" : undefined}>
              <Node m={m} at={at} size="map" selected={sel === m.level} onTap={() => setSel(sel === m.level ? null : m.level)} />
              <NodeLabel m={m} at={at} size="map" />
            </span>
          );
        })}
        {sel ? <SelectRing at={mapNode(sel)} boss={levelInfo(sel).boss} d={levelInfo(sel).boss ? 92 : 62} /> : null}
        {curFight ? <NowFlag fight={curFight} at={mapNode(curFight.level)} big={false} /> : null}
        {selM && selBox ? <NodeCard m={selM} view={view} box={selBox} onClose={() => setSel(null)} /> : null}
      </div>

      <Hud kicker={`CRAVING CRUSHER${run ? ` · RUN #${run.number}` : ""}`} title="Adventure map" back="#/game" run={run} today={today}>
        <LevelBar map={map} />
      </Hud>
      <RunNote view={view} />

      <div className="flex-1" />
      {run ? (
        <div className="pointer-events-none sticky bottom-3.5 z-[25] flex justify-end px-3.5 pb-3.5">
          <button onClick={() => { jump(true); if (fight) setSel(fight.level); }} className="g-btn pointer-events-auto flex h-12 items-center gap-[7px] rounded-full bg-[#ffc93c] pr-4 pl-2 font-game text-[17px] text-[#2b1d3a]"
            style={{ borderColor: "#1a1024", boxShadow: "0 4px 0 #1a1024, 0 8px 18px rgba(26,16,36,.35)" }}>
            <span className="grid size-8 place-items-center overflow-hidden rounded-full border-2 border-[#2b1d3a] bg-[#ffd2b0]">
              <img src={portrait(levelInfo(Math.max(1, Math.min(LEVEL_COUNT, reached || 1))).slug)} alt="" className="size-7" />
            </span>
            Jump to me
          </button>
        </div>
      ) : null}
    </main>
  );
}

/** No run yet, or the run is over: say so under the HUD. */
function RunNote({ view }: { view: GameView }) {
  const run = view.run;
  if (run?.active) return null;
  return (
    <div className="sticky top-[106px] z-20 mx-3 mt-2">
      <div className="g-panel flex items-center gap-2.5 px-3 py-2">
        <span className="min-w-0 flex-1 text-[13px] leading-snug font-extrabold">
          {run ? `Run #${run.number} is over with ${fmt(run.score)} points. A new run starts with Crumbs.` : "No run going yet. Start one and Crumbs is your first monster."}
        </span>
        <a href="#/game/start" className="g-btn flex h-10 shrink-0 items-center rounded-xl bg-g-yellow px-3 font-game text-[15px]">{run ? `Start Run #${run.number + 1}` : "Start a run"}</a>
      </div>
    </div>
  );
}

function PathSvg({ w, h, full, walked, width }: { w: number; h: number; full: string; walked: string; width: { out: number; road: number } }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="pointer-events-none absolute top-0 left-0">
      <path d={full} fill="none" stroke="#2b1d3a" strokeWidth={width.out} strokeLinecap="round" strokeLinejoin="round" />
      <path d={full} fill="none" stroke="#efe4d2" strokeWidth={width.road} strokeLinecap="round" strokeLinejoin="round" />
      <path d={full} fill="none" stroke="#b9a991" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="2 11" />
      {walked ? <>
        <path d={walked} fill="none" stroke="#ffc93c" strokeWidth={width.road} strokeLinecap="round" strokeLinejoin="round" />
        <path d={walked} fill="none" stroke="#fff3c2" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="2 11" />
      </> : null}
    </svg>
  );
}

function SelectRing({ at, d, boss }: { at: Pt; d: number; boss: boolean }) {
  return <div aria-hidden className="g-anim-spin-fast pointer-events-none absolute z-[2] rounded-full border-4 border-dashed border-white" style={{ left: at.x - d / 2, top: at.y - d / 2 - (boss ? 4 : 0), width: d, height: d }} />;
}

/** "World 2 · Burger Badlands / LEVELS 11–20 · YOU ARE HERE · 0/10", a link to the world up close. */
function WorldSign({ w, map }: { w: number; map: MapLevel[] }) {
  const ms = map.slice((w - 1) * LEVELS_PER_WORLD, w * LEVELS_PER_WORLD);
  const beaten = ms.filter((m) => m.status === "beaten").length;
  const here = ms.some((m) => m.status === "current");
  const locked = !here && beaten === 0;
  const look = worldMap(w);
  const first = (w - 1) * LEVELS_PER_WORLD + 1;
  const state = beaten === LEVELS_PER_WORLD ? `CLEARED · ${beaten}/10` : here ? `YOU ARE HERE · ${beaten}/10` : locked ? "LOCKED" : `${beaten}/10`;
  return (
    <a href={`#/game/world/${w}`} aria-label={`World ${w}, ${WORLDS[w - 1]}: ${state.toLowerCase()}. See it up close.`}
      className="absolute z-[5] flex max-w-[272px] items-center gap-1.5 rounded-full border-[3px] border-[#2b1d3a] bg-[#fff7e6] py-[3px] pr-2.5 pl-1 text-[#2b1d3a] shadow-[0_3px_0_#1a1024]"
      style={{ top: bandTop(w) + 382, ...(w % 2 ? { right: 10 } : { left: 10 }) }}>
      <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-[#2b1d3a] font-game text-[13px] text-white" style={{ background: look.chip }}>{w}</span>
      <span className="flex min-w-0 flex-col leading-[1.08]">
        <span className="font-game text-[14px] whitespace-nowrap">World {w} · {WORLDS[w - 1]}</span>
        <span className="text-[10px] font-black whitespace-nowrap" style={{ color: locked ? "#8a7a99" : look.ink }}>LEVELS {first}–{first + 9} · {state}</span>
      </span>
      {locked ? <Padlock className="h-[15px] w-3.5 shrink-0" /> : null}
    </a>
  );
}

// ================================================================ one world up close

export function WorldPage({ world }: { world?: number }) {
  const { today, view, error } = useGame();
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [world]);
  if (error) return <main className="min-h-dvh bg-[#2b1d3a] pt-4"><GameNote title="Hmm, that didn't load">{error.message}</GameNote></main>;
  if (!view) return <main className="min-h-dvh bg-[#2b1d3a]" />;
  const { run, fight, map } = view;
  const reached = trailEnd(map);
  const w = world ?? (reached ? worldOf(reached) : 1);
  const levels = worldLevels(w);
  const ms = levels.map((l) => map[l - 1]);
  const look = worldMap(w);
  const { full, walked } = paths(levels, worldNode, WORLD_START, reached);
  const beaten = ms.filter((m) => m.status === "beaten").length;
  const selM = sel ? map[sel - 1] : null;
  const selBox = selM ? cardBox(worldNode(selM.level), { boss: levelInfo(selM.level).boss, tall: selM.status === "current", width: 300, below: 560, scale: 1.5 }) : null;
  const curFight = fight && worldOf(fight.level) === w && map[fight.level - 1]?.status === "current" ? fight : null;
  // the map's band of scenery, blown up behind the world
  const scale = WORLD_H / BAND_H;

  return (
    <main className="relative flex flex-col overflow-clip" style={{ height: WORLD_H, background: look.band }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2" style={{ width: MAP_W, height: WORLD_H }} onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden opacity-90">
          <img src="/game-map-scenery.svg" alt="" decoding="async" className="g-art absolute max-w-none"
            style={{ width: MAP_W * scale, height: MAP_H * scale, left: -(MAP_W * scale - MAP_W) / 2, top: -bandTop(w) * scale }} />
        </div>
        <PathSvg w={MAP_W} h={WORLD_H} full={full} walked={walked} width={{ out: 26, road: 17 }} />
        {ms.map((m) => {
          const at = worldNode(m.level);
          return (
            <span key={m.level}>
              <Node m={m} at={at} size="world" selected={sel === m.level} onTap={() => setSel(sel === m.level ? null : m.level)} />
              <NodeLabel m={m} at={at} size="world" />
            </span>
          );
        })}
        {sel ? <SelectRing at={worldNode(sel)} boss={levelInfo(sel).boss} d={levelInfo(sel).boss ? 150 : 90} /> : null}
        {curFight ? <NowFlag fight={curFight} at={worldNode(curFight.level)} big /> : null}
        {selM && selBox ? <NodeCard m={selM} view={view} box={selBox} onClose={() => setSel(null)} /> : null}
      </div>

      <Hud kicker={`WORLD ${w} · LEVELS ${levels[0]}–${levels[9]}${run ? ` · RUN #${run.number}` : ""}`} title={WORLDS[w - 1]} back="#/game/map" run={run} today={today}>
        <div aria-label={`World progress: ${beaten} of 10 beaten`} className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex justify-between text-[11px] font-black whitespace-nowrap text-white"><span>World progress</span><span className="text-[#ffc93c]">{beaten}/10</span></span>
          <span className="flex gap-[3px]">
            {ms.map((m) => <span key={m.level} className="h-[9px] flex-1 rounded-full border-2 border-[#1a1024]" style={{ background: m.status === "beaten" ? "#7bd36b" : m.status === "current" ? "#ffc93c" : levelInfo(m.level).boss ? "#ff7a95" : "#4a3a5e" }} />)}
          </span>
        </div>
      </Hud>
      <WorldChips w={w} map={map} />
    </main>
  );
}

function WorldChips({ w, map }: { w: number; map: MapLevel[] }) {
  const info = (n: number) => {
    const ms = map.slice((n - 1) * LEVELS_PER_WORLD, n * LEVELS_PER_WORLD);
    const beaten = ms.filter((m) => m.status === "beaten").length;
    const cur = ms.find((m) => m.status === "current");
    return { beaten, cur, cleared: beaten === LEVELS_PER_WORLD, locked: !cur && beaten === 0 };
  };
  const me = info(w);
  const boss = levelInfo(w * LEVELS_PER_WORLD);
  const note = me.cleared ? `cleared 10/10 · ${boss.name} beaten` : me.cur ? `you are here · level ${me.cur.level - (w - 1) * 10} of 10` : me.locked ? (w === 6 ? "locked · the final boss waits" : "locked") : `${me.beaten} of 10 beaten`;
  return (
    <nav aria-label="Worlds" className="relative z-20 mx-2.5 mt-2.5 rounded-[18px] border-[3px] border-[#2b1d3a] bg-[#fff7e6] px-2 pt-2 pb-2.5 text-[#2b1d3a] shadow-[0_4px_0_#1a1024]">
      <div className="grid grid-cols-6 gap-1">
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const i = info(n), on = n === w;
          return (
            <a key={n} href={`#/game/world/${n}`} aria-current={on ? "page" : undefined} aria-label={`World ${n}, ${WORLDS[n - 1]}${i.cleared ? ", cleared" : i.locked ? ", locked" : ""}`}
              className="flex min-h-[50px] flex-col items-center gap-[3px] rounded-xl border-2 pt-[5px] pb-1"
              style={{ borderColor: on ? "#2b1d3a" : "transparent", background: on ? (i.cur ? "#ffd2b0" : "#f1e8f6") : "transparent", boxShadow: on ? "0 3px 0 #1a1024" : "none", color: i.locked ? "#8a7a99" : "#2b1d3a" }}>
              <span className="relative grid size-[30px] place-items-center rounded-full border-[3px] border-[#2b1d3a] font-game text-[15px] text-white" style={{ background: i.locked ? "#8a7a99" : worldMap(n).chip }}>
                {n}
                {i.cleared ? <CheckBadge className="absolute -right-1.5 -bottom-1 size-3.5" /> : i.locked ? <Padlock className="absolute -right-1.5 -bottom-1 h-3.5 w-3" /> : null}
              </span>
              <span className="text-[11px] leading-none font-black">{worldMap(n).short}</span>
            </a>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2 px-1">
        <span className="text-[13px] leading-snug font-extrabold text-[#5b4a6b]">World {w} · {WORLDS[w - 1]} · {note}</span>
        <a href="#/game/map" className="shrink-0 text-[13px] font-black text-[#5b3fd0] underline decoration-2 underline-offset-2">All 60 levels</a>
      </div>
    </nav>
  );
}

