/**
 * What just happened, full screen (mockups MonVictory, MonStrike, MonKnockback, MonDefeat, and the
 * finish after level 60), one after another when several came at once; and the small news (a
 * heart, a power-up earned, Hardcore → Normal) as toasts at the top. Driven by the events a sync or
 * any game change returned (state.ts). On the battle screen the KO burst or the strike plays first
 * (Battle.tsx), then the screen comes up. With reduced motion nothing moves and the score is shown
 * at once.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { abilityFor, LEVEL_COUNT, levelInfo, MAX_HEARTS, POTION_DAMAGE, POTION_MINUTES, START_HEARTS, WEEK_ACTIVE_DAYS, WORLDS, type EventView, type GameView, type HallRun } from "../../../shared/game";
import { cx } from "../components/ui";
import { api } from "../lib/api";
import type { GameScreen } from "../lib/route";
import { Arena, Burst, Confetti, worldLook } from "./art";
import { ClockSmall, HeartBroken, HeartEmpty, HeartFull, Hero, Home, Padlock, PlayDark, Potion, Replay, Shield, Skull, Star, Sword, Trophy, Wind } from "./icons";
import { worldOf } from "./layout";
import { dayExample, daysFrom, dueText, hpLeft, hpText, shortDate } from "./logic";
import { GameMenu, HpBar } from "./parts";
import { countUp, victoryBreakdown, type Result } from "./outcomes";
import { dropToast, markShown, nextResult, clearResults, useGame, useResults, useToasts } from "./state";

const fmt = (n: number) => n.toLocaleString("en-US");
const portrait = (slug: string) => `/monsters/${slug}.svg`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The overlay host, on every game screen. */
export function ResultHost({ screen }: { screen: GameScreen }) {
  const { head, waiting } = useResults();
  const { today, view } = useGame();
  // away from a fight on the battle screen (or with reduced motion) a result comes up at once
  const battling = screen === "battle" && !!(view?.fight || view?.next);
  useEffect(() => {
    if (head && !head.shown && (!battling || reducedMotion())) markShown(head.result.id);
  }, [head, battling]);
  return (
    <>
      <Toasts />
      {head?.shown && view ? <Overlay key={head.result.id} r={head.result} view={view} today={today} waiting={waiting} /> : null}
    </>
  );
}

function Toasts() {
  const toasts = useToasts();
  useEffect(() => {
    if (!toasts.length) return;
    const t = window.setTimeout(() => dropToast(toasts[0].id), 4500);
    return () => window.clearTimeout(t);
  }, [toasts]);
  if (!toasts.length) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-2 z-[70] mx-auto flex max-w-md flex-col gap-1.5 px-3">
      {toasts.map((e) => (
        <button key={e.id} onClick={() => dropToast(e.id)} className="g-anim-toast pointer-events-auto flex items-center gap-2 rounded-2xl border-[3px] border-[#2b1d3a] bg-[#fff7e6] px-3 py-2 text-left text-[14px] leading-snug font-extrabold text-[#2b1d3a] shadow-[0_4px_0_#1a1024]">
          <ToastIcon e={e} />
          <span className="min-w-0 flex-1">{e.text}</span>
        </button>
      ))}
    </div>
  );
}

function ToastIcon({ e }: { e: EventView }) {
  if (e.kind === "heart") return <HeartFull className="h-[22px] w-6 shrink-0" />;
  if (e.kind === "mode_drop") return <Skull className="size-6 shrink-0" />;
  if (e.kind === "run_start") return <Star className="size-6 shrink-0" />;
  if (e.kind === "fight_start") return <Sword className="size-6 shrink-0" />;
  if (e.data.kind === "shield") return <Shield className="h-7 w-[26px] shrink-0" />;
  if (e.data.kind === "potion") return <Potion className="h-6 w-5 shrink-0" />;
  return <Wind className="size-6 shrink-0" />;
}

// ================================================================ the overlay shell

function Overlay({ r, view, today, waiting }: { r: Result; view: GameView; today: string; waiting: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { nextResult(); return; }
      // keep Tab inside the result screen (it covers everything)
      if (e.key !== "Tab" || !ref.current || (document.activeElement as HTMLElement | null)?.closest("[role=menu]")) return;
      const all = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!all.length) { e.preventDefault(); return; }
      const first = all[0], last = all[all.length - 1], at = document.activeElement;
      if (e.shiftKey && (at === first || at === ref.current || !ref.current.contains(at))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (at === last || !ref.current.contains(at))) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement, was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); html.style.overflow = was; };
  }, []);
  const bg = r.kind === "victory" ? "linear-gradient(180deg, #3a2654 0%, #2b1d3a 100%)"
    : r.kind === "strike" ? "linear-gradient(180deg, #4a1f3a 0%, #2b1d3a 100%)"
    : r.kind === "knockback" ? "linear-gradient(180deg, #f08a48 0%, #e0703f 30%, #3a2240 62%, #2b1d3a 100%)"
    : r.kind === "defeat" ? "radial-gradient(120% 60% at 50% 10%, #5a3a8a 0%, #2b1d3a 70%)"
    : "radial-gradient(130% 45% at 50% 18%, #9a4aa8 0%, #3a2654 60%, #2b1d3a 100%)";
  const label = r.kind === "victory" ? "Victory" : r.kind === "strike" ? "The monster struck" : r.kind === "knockback" ? "Knocked back" : r.kind === "defeat" ? "Defeated" : "All 60 crushed";
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className="game fixed inset-0 z-[60] overflow-y-auto outline-none" style={{ background: bg }}>
      <div className="mx-auto w-full max-w-xl pb-8">
        {r.kind === "victory" ? <Victory r={r} view={view} /> : null}
        {r.kind === "finish" ? <Finish r={r} view={view} today={today} /> : null}
        {r.kind === "strike" ? <Strike r={r} view={view} /> : null}
        {r.kind === "knockback" ? <Knockback r={r} view={view} /> : null}
        {r.kind === "defeat" ? <Defeat r={r} view={view} today={today} /> : null}
        {waiting ? (
          <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-2xl bg-[#1a1024]/70 px-3 py-2 text-[13px] font-extrabold text-[#fff7e6]">
            <span>{waiting} more {waiting === 1 ? "thing" : "things"} happened while you were away.</span>
            <span className="flex shrink-0 gap-2">
              <button onClick={nextResult} className="g-btn h-9 rounded-xl bg-g-yellow px-3 font-game text-[15px]">Next</button>
              <button onClick={clearResults} className="h-9 rounded-xl px-2 font-black text-[#fff7e6] underline underline-offset-2">Skip all</button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Top({ kicker, sub, right }: { kicker: string; sub: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-center gap-2 px-4 pt-3.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-game text-[12px] tracking-[0.08em] text-[#c8b6e6]">{kicker}</span>
        <span className="flex items-center gap-1.5 text-[14px] leading-tight font-black text-[#ffd9a8]">{sub}</span>
      </div>
      {right}
      <GameMenu />
    </header>
  );
}

const Panel = ({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) =>
  <section className={cx("mx-4 mt-3.5 rounded-[22px] border-[3px] border-[#1a1024] bg-[#fff7e6] px-4 py-3.5 text-[#2b1d3a] shadow-[0_5px_0_#1a1024]", className)} style={style}>{children}</section>;

const BigBtn = ({ href, onClick, children, color = "#ffc93c", className }: { href?: string; onClick?: () => void; children: ReactNode; color?: string; className?: string }) => {
  const cls = cx("g-btn flex min-h-[58px] items-center justify-center gap-2.5 rounded-[20px] px-3 font-game text-[22px] text-[#2b1d3a]", className);
  const style = { background: color, borderColor: "#1a1024", boxShadow: "0 5px 0 #1a1024" };
  return href ? <a href={href} onClick={onClick} className={cls} style={style}>{children}</a> : <button onClick={onClick} className={cls} style={style}>{children}</button>;
};

/** Where the "fight on" buttons go: Choose your fight while the bet can still change, or to start the one up next; else the battle. */
const fightHref = (view: GameView) => (view.fight?.betOptions.length || (!view.fight && view.next) ? "#/game/choose" : "#/game/battle");

/** The animated score: counts up from 0 (once, or again on Replay). */
function useCount(total: number, key: number): number {
  const [v, setV] = useState(() => (reducedMotion() ? total : 0));
  useEffect(() => {
    if (reducedMotion()) { setV(total); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => { setV(countUp(total, t - t0)); if (t - t0 < 1200) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [total, key]);
  return v;
}

/** The monster in its world's arena, with the KO's burst, stars and confetti. */
function KoScene({ level, title, caption, replayKey }: { level: number; title: string; caption: string; replayKey: number }) {
  const lv = levelInfo(level);
  return (
    <section className="relative mx-4 mt-3 h-[300px] overflow-hidden rounded-[24px] border-[3px] border-[#1a1024] shadow-[0_5px_0_#1a1024]" key={replayKey}>
      <Arena world={lv.world} className="g-art absolute inset-0 size-full" />
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 45%, rgb(255 241 168 / .55), transparent 60%)" }} />
      <Confetti className="pointer-events-none absolute inset-0" />
      <h2 className="g-anim-pop absolute inset-x-2 top-2.5 text-center font-game text-[34px] leading-none font-normal text-[#ffc93c]" style={{ WebkitTextStroke: "5px #2b1d3a", paintOrder: "stroke fill", textShadow: "0 4px 0 #2b1d3a" }}>{title}</h2>
      <div className="absolute inset-x-0 top-[62px] flex justify-center">
        <img src={portrait(lv.slug)} alt={lv.name} className="g-anim-ko h-[170px] w-[170px] origin-[50%_85%]" />
      </div>
      <Burst text="K.O.!" className="g-anim-burst absolute top-[88px] right-3 w-[104px]" />
      <svg viewBox="0 0 80 30" aria-hidden className="absolute top-[64px] left-1/2 w-[86px] -translate-x-[70%] g-anim-spin-fast" style={{ transformOrigin: "50% 50%" }}>
        <ellipse cx="40" cy="15" rx="34" ry="10" fill="none" stroke="#fff" strokeWidth="2.4" strokeDasharray="5 4" />
        <path d="M14 6 l2 4 4 1 -4 1 -2 4 -2 -4 -4 -1 4 -1z M60 4 l2 4 4 1 -4 1 -2 4 -2 -4 -4 -1 4 -1z" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="1.2" />
      </svg>
      <p className="absolute inset-x-3 bottom-3 rounded-2xl border-[3px] border-[#2b1d3a] bg-white px-3 py-1.5 text-center text-[14px] leading-snug font-extrabold text-[#2b1d3a]">{caption}</p>
    </section>
  );
}

function Breakdown({ ko, score }: { ko: EventView; score: number }) {
  const b = victoryBreakdown(ko);
  const [k, setK] = useState(0);
  const shown = useCount(b.total, k);
  return (
    <Panel>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-game text-[22px] font-normal">Score breakdown</h3>
        <button onClick={() => setK(k + 1)} className="g-btn flex h-9 items-center gap-1.5 rounded-full bg-[#6ec6ff] px-3 text-[14px] font-black" style={{ borderColor: "#1a1024" }}><Replay className="size-4" />Replay</button>
      </div>
      <ul className="mt-1">
        {b.rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 border-b-2 border-dashed border-[#e8d7b4] py-1.5">
            <span className="flex min-w-0 flex-1 flex-col leading-tight"><b className="text-[15px] font-black">{row.label}</b><span className="text-[12px] font-bold text-[#6b5a7a]">{row.sub}</span></span>
            <span className="font-game text-[20px]">{row.value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="font-game text-[20px]">Monster total</span>
        <span className="font-game text-[30px] leading-none text-[#ff7a2f]" style={{ WebkitTextStroke: "1.5px #2b1d3a", paintOrder: "stroke fill" }} aria-label={`${fmt(b.total)} points`}>{fmt(shown)}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between rounded-2xl border-[3px] border-[#2b1d3a] px-3.5 py-2" style={{ background: "linear-gradient(180deg, #ffd765, #f0a91f)" }}>
        <span className="flex flex-col leading-tight"><span className="text-[12px] font-black tracking-[0.08em] text-[#6b4a00]">RUN SCORE NOW</span><span className="text-[13px] font-black text-[#4a2f00]">every log adds 5 more</span></span>
        <span className="font-game text-[34px] leading-none text-white" style={{ WebkitTextStroke: "2.5px #2b1d3a", paintOrder: "stroke fill" }}>{fmt(score)}</span>
      </div>
    </Panel>
  );
}

function Rewards({ rewards }: { rewards: EventView[] }) {
  if (!rewards.length) return null;
  return (
    <Panel className="bg-[#e6f8d8]">
      <h3 className="font-game text-[19px] font-normal">Boss loot</h3>
      <ul className="mt-1 space-y-1">
        {rewards.map((e) => (
          <li key={e.id} className="flex items-center gap-2 text-[14px] leading-snug font-extrabold">
            {e.kind === "heart" ? <HeartFull className="h-[22px] w-6 shrink-0" /> : <Wind className="size-6 shrink-0" />}
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ================================================================ Victory

function Victory({ r, view }: { r: Extract<Result, { kind: "victory" }>; view: GameView }) {
  const d = r.ko.data;
  const lv = levelInfo(Number(d.level));
  const next = lv.level < LEVEL_COUNT ? levelInfo(lv.level + 1) : null;
  const ab = next ? abilityFor(next.level) : null;
  const beaten = view.map.filter((m) => m.status === "beaten").length;
  const daysLeft = Number(d.daysLeft ?? 0);
  return (
    <>
      <Top kicker={`CRAVING CRUSHER · RUN #${view.run?.number ?? ""}`} sub={`World ${lv.world} · ${lv.worldName} · Level ${lv.level} of 60`} />
      <KoScene level={lv.level} title={`${lv.name} defeated!`} replayKey={0}
        caption={`${fmt(Number(d.damage ?? 0))} damage in all${daysLeft ? `, with ${daysLeft} ${daysLeft === 1 ? "day" : "days"} to spare` : ", right on the deadline"}. Down it goes!`} />
      <Breakdown ko={r.ko} score={view.run?.liveScore ?? 0} />
      <Rewards rewards={r.rewards} />
      <Panel className="flex items-center gap-3">
        <div className="flex w-[74px] shrink-0 flex-col items-center rounded-xl border-[3px] border-[#2b1d3a] px-1 pt-1 pb-0.5" style={{ background: "linear-gradient(180deg, #ffd765, #f0a91f)" }}>
          <span className="grid w-full place-items-center rounded-lg border-2 border-[#2b1d3a] bg-[#ffd2b0]"><img src={portrait(lv.slug)} alt="" className="size-14" /></span>
          <span className="mt-0.5 max-w-full truncate font-game text-[10px] leading-tight text-[#2b1d3a]">{lv.name.toUpperCase()}</span>
          <span className="text-[9px] font-black text-[#6b4a00]">Lv {lv.level} · {lv.hp}</span>
        </div>
        <div className="min-w-0 flex-1">
          <span className="rounded-full border-2 border-[#2b1d3a] bg-[#7bd36b] px-2 py-px text-[11px] font-black tracking-[0.04em]">LOOT · TROPHY CARD</span>
          <h3 className="mt-1 font-game text-[20px] leading-tight font-normal">{lv.name} trophy card</h3>
          <p className="text-[13px] leading-snug font-bold text-[#6b5a7a]">In your Monster Book now. {beaten} of 60 beaten this run.</p>
          <a href="#/game/book" onClick={nextResult} className="text-[13px] font-black text-[#5b3fd0] underline underline-offset-2">Open the Monster Book</a>
        </div>
      </Panel>
      {next && ab ? (
        <Panel>
          <div className="flex items-center gap-3">
            <span className="grid size-[84px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-[#2b1d3a] bg-[#ffd2b0]"><img src={portrait(next.slug)} alt="" className="mt-2 size-[84px]" /></span>
            <div className="min-w-0 flex-1">
              <span className="text-[12px] font-black tracking-[0.08em] text-[#c2410c]">NEXT · LEVEL {next.level}{next.world !== lv.world ? ` · NEW WORLD: ${WORLDS[next.world - 1].toUpperCase()}` : ""}</span>
              <h3 className="font-game text-[24px] leading-tight font-normal">{next.name}</h3>
              <p className="text-[14px] font-black">{next.hp} HP · {next.days}-day deadline{next.boss ? " · BOSS" : ""}</p>
              <p className="text-[13px] leading-snug font-extrabold text-[#6b5a7a]"><b className="text-[#2b1d3a]">{ab.name}:</b> {ab.text}</p>
            </div>
          </div>
          {!view.fight && view.next ? (
            <>
              <p className="mt-2 text-[13px] leading-snug font-bold text-[#6b5a7a]">{next.name} waits until you start it{view.autoStart ? ", or it starts by itself the first time you open game mode on a new day (Keep the monsters coming)" : ""}.</p>
              <BigBtn href={fightHref(view)} onClick={nextResult} color="#7bd36b" className="mt-2">Start the next fight ›</BigBtn>
            </>
          ) : (
            <BigBtn href={fightHref(view)} onClick={nextResult} color="#7bd36b" className="mt-3">{view.fight?.betOptions.length ? "Choose your deadline ›" : "To the battle ›"}</BigBtn>
          )}
        </Panel>
      ) : null}
      <div className="mx-4 mt-3"><button onClick={nextResult} className="w-full py-2 text-center text-[14px] font-black text-[#fff7e6] underline underline-offset-2">Close</button></div>
    </>
  );
}

// ================================================================ Strike

function Strike({ r, view }: { r: Extract<Result, { kind: "strike" }>; view: GameView }) {
  const d = r.strike.data;
  const lv = levelInfo(Number(d.level));
  const after = Number(d.hearts ?? 0), before = after + 1;
  const run = view.run;
  const fight = view.fight && view.fight.level === lv.level ? view.fight : null;
  const days = fight ? daysFrom(fight.startedOn, fight.deadlineOn) + 1 : lv.days;
  const perDay = Math.ceil(lv.hp / days);
  const ab = abilityFor(lv.level);
  const boss = levelInfo(worldOf(lv.level) * 10);
  const slots = Math.max(START_HEARTS, before);
  return (
    <>
      <Top kicker={`CRAVING CRUSHER · RUN #${run?.number ?? ""}`} sub={<><ClockSmall className="size-4" />Deadline passed · {dueText(r.strike.day)}</>} />
      <section className="relative mx-4 mt-3 h-[260px] overflow-hidden rounded-[24px] border-[3px] border-[#1a1024] shadow-[0_5px_0_#1a1024]">
        <Arena world={lv.world} className="g-art absolute inset-0 size-full" />
        <div aria-hidden className="absolute inset-0 bg-[#ff4d6d]/25" />
        <h2 className="g-anim-pop absolute inset-x-2 top-2.5 text-center font-game text-[34px] leading-none font-normal text-white" style={{ WebkitTextStroke: "5px #2b1d3a", paintOrder: "stroke fill", textShadow: "0 4px 0 #2b1d3a" }}>{lv.name} strikes!</h2>
        <div className="absolute inset-x-0 bottom-2 flex justify-center">
          <img src={`/monsters/${lv.slug}${lv.slug === "05-fry-hydra" ? "-strike" : ""}.svg`} alt={lv.name} className="g-anim-lunge h-[180px] w-[180px] origin-[50%_85%]" />
        </div>
        <Burst text="WHAM!" fill="#ffc93c" className="g-anim-burst absolute top-[70px] left-3 w-[110px]" />
      </section>
      <Panel className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5" role="img" aria-label={`${after} of ${slots} hearts left`}>
          {Array.from({ length: slots }, (_, i) => i < after ? <HeartFull key={i} className="h-[38px] w-[42px]" />
            : i === after ? <span key={i} className="g-anim-crack inline-block"><HeartBroken className="h-[38px] w-[42px]" /></span>
            : <HeartEmpty key={i} className="h-[38px] w-[42px]" />)}
        </div>
        <div className="flex flex-col items-end leading-none">
          <span className="text-[12px] font-black tracking-[0.08em] text-[#a83f4a]">HEARTS</span>
          <span className="font-game text-[34px]">{before} <span className="text-[#b9a991]">→</span> <span className="text-[#ff4d6d]">{after}</span></span>
          <span className="text-[12px] font-black text-[#6b5a7a]">of {MAX_HEARTS} at most · the run goes on</span>
        </div>
      </Panel>
      <Panel>
        <p className="text-[16px] leading-snug font-extrabold">{lv.name} is back to full ({lv.hp} HP){fight ? <> — new deadline {shortDate(fight.deadlineOn)}.</> : view.next ? <> and waits for its rematch: start it when you're ready{view.autoStart ? " (or it starts by itself the first time you open game mode on a new day)" : ""}.</> : "."} <span className="text-[#2f9a2a]">You've got this.</span></p>
        <div className="mt-2 flex justify-between text-[13px] font-black"><span>{lv.name}</span><span>{fight ? hpText(hpLeft(fight), fight.max) : `${lv.hp} / ${lv.hp}`} HP</span></div>
        <HpBar label={`${lv.name} hit points`} max={fight?.max ?? lv.hp} value={fight ? hpLeft(fight) : lv.hp} fillClass="rounded-full" gloss={false} className="mt-1 h-3" />
        {fight ? <span className="mt-2 inline-block rounded-full border-2 border-[#2b1d3a] bg-[#ffe3e8] px-2.5 py-0.5 text-[13px] font-black">Due {dueText(fight.deadlineOn)}</span> : null}
        <p className="mt-2 text-[13px] font-black text-[#6b5a7a]">{days} fresh days · about {perDay} damage a day</p>
        <p className="mt-1 text-[13px] leading-snug font-bold text-[#6b5a7a]">{Number(d.hpLeft) < lv.hp
          ? `You had it down to ${String(d.hpLeft)} HP. Every minute you put in still counts: ${fmt(Number(d.points ?? 0))} points kept.`
          : "It didn't get a scratch this time. One workout a day is all it takes to start."}</p>
      </Panel>
      <Panel>
        <h3 className="font-game text-[21px] font-normal">Rematch tips</h3>
        <ul className="mt-1.5 space-y-2.5">
          {!ab.noPowerUps ? (
            <Tip icon={<Shield className="h-8 w-[30px]" />} title={<>Take the Veggie Shield <span className="ml-1 rounded-full bg-[#2b1d3a] px-1.5 text-[11px] text-[#7bd36b]">×{run?.shields ?? 0}</span></>}>
              {run?.shields ? `It blocks one heal. Save it for a splurge day (${ab.name}: ${ab.text})` : "Three clean days in a row earn one. It blocks one heal."}
            </Tip>
          ) : (
            <Tip icon={<Shield className="h-8 w-[30px]" />} title="No power-ups this time">{ab.name}: {ab.text} You keep them for the next fight.</Tip>
          )}
          <Tip icon={<ClockSmall className="size-8" />} title="Hit early, a little each day">{cap(dayExample(perDay))} = {perDay} damage. {days} of those and it's toast.</Tip>
          <Tip icon={<Potion className="h-8 w-7" />} title="Go long once for a Water Potion">One {POTION_MINUTES}+ min workout earns it (+{POTION_DAMAGE} damage).</Tip>
        </ul>
      </Panel>
      <Panel className="bg-[#ffe3e8]">
        <h3 className="font-game text-[20px] font-normal">Earn a heart back</h3>
        <div className="mt-1 flex justify-between gap-2 text-[14px] font-extrabold"><span>Beat boss {boss.name} (World {boss.world})</span><span className="shrink-0 text-[#e0264b]">+1 heart</span></div>
        <div className="mt-1 flex justify-between gap-2 text-[14px] font-extrabold"><span>A week with {WEEK_ACTIVE_DAYS}+ active days</span><span className="shrink-0 text-[#e0264b]">+1 heart</span></div>
      </Panel>
      <div className="mx-4 mt-3.5 grid grid-cols-2 gap-2.5">
        <BigBtn href={fightHref(view)} onClick={nextResult} color="#ff7a2f"><Sword className="size-7" /><span className="text-white" style={{ WebkitTextStroke: "2px #2b1d3a", paintOrder: "stroke fill" }}>Rematch</span></BigBtn>
        {/* closes this one; anything still waiting behind it comes up next time in the game */}
        <BigBtn href="#/" onClick={nextResult} color="#fff7e6" className="gap-1.5 px-1.5 text-[15px] whitespace-nowrap"><Home className="size-[18px] shrink-0" />Back to tracker</BigBtn>
      </div>
    </>
  );
}

function Tip({ icon, title, children }: { icon: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex min-w-0 flex-col leading-snug"><b className="font-game text-[17px] font-normal">{title}</b><span className="text-[14px] font-bold text-[#6b5a7a]">{children}</span></span>
    </li>
  );
}

// ================================================================ Knocked back

function Knockback({ r, view }: { r: Extract<Result, { kind: "knockback" }>; view: GameView }) {
  const d = r.knockback.data;
  const by = levelInfo(Number(r.strike.data.level));
  const to = levelInfo(Number(d.to));
  const from = Number(d.from);
  const score = view.run?.liveScore ?? 0;
  const strip = Array.from({ length: 10 }, (_, i) => levelInfo(to.level + i));
  const again = strip.filter((l) => l.level < from);
  return (
    <>
      <header className="flex items-center gap-2 px-4 pt-3.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-game text-[12px] tracking-[0.08em] text-[#5a2a10]">CRAVING CRUSHER · RUN #{view.run?.number ?? ""}</span>
          <span className="flex items-center gap-1 text-[14px] font-black text-[#2b1d3a]"><HeartEmpty className="h-4 w-[18px]" /><HeartEmpty className="h-4 w-[18px]" /><HeartEmpty className="h-4 w-[18px]" /> 0 hearts left</span>
        </div>
        <span className="inline-flex h-[30px] items-center gap-1 rounded-full border-[3px] border-[#1a1024] bg-[#6ec6ff] px-2.5 font-game text-[13px] text-[#1a1024]">NORMAL</span>
        <GameMenu />
      </header>
      <h2 className="g-anim-pop mt-2 text-center font-game text-[46px] leading-none font-normal text-white" style={{ WebkitTextStroke: "6px #2b1d3a", paintOrder: "stroke fill", textShadow: "0 5px 0 #2b1d3a" }}>Knocked back<span className="text-[#ffc93c]">!</span></h2>
      <p className="mx-5 mt-2 text-center text-[15px] leading-snug font-extrabold text-[#2b1d3a]">{by.name} took your last heart. Good news: it's a Normal run, so you just bounce back to the start of {to.worldName}. Your run keeps going!</p>
      <section className="relative mx-4 mt-3 h-[200px] overflow-hidden rounded-[24px] border-[3px] border-[#1a1024] shadow-[0_5px_0_#1a1024]" style={{ background: "linear-gradient(180deg, #ffd0a0, #f6a25c 70%, #d9562f 70%)" }}>
        <span className="absolute top-3 left-3 max-w-[54%] rounded-2xl border-[3px] border-[#2b1d3a] bg-white px-2.5 py-1 text-[13px] leading-tight font-extrabold text-[#2b1d3a]">Boop! See you soon.</span>
        <span className="absolute top-3 right-4 -rotate-6 font-game text-[28px] text-[#ffc93c]" style={{ WebkitTextStroke: "3px #2b1d3a", paintOrder: "stroke fill" }}>BOING!</span>
        <img src={portrait(by.slug)} alt={by.name} className="absolute bottom-1 left-3 h-[140px] w-[140px]" />
        <Hero ko className="g-anim-boing absolute right-10 bottom-8 h-[70px] w-[60px]" />
      </section>
      <Panel>
        <h3 className="font-game text-[24px] font-normal">What just happened</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Fact tone="#ffe9c2" ink="#c2410c" k="RUN CONTINUES FROM">Level {to.level} · start of World {to.world}</Fact>
          <Fact tone="#ffe3e8" ink="#e0264b" k="HEARTS REFILLED"><span className="flex items-center gap-0.5">{Array.from({ length: START_HEARTS }, (_, i) => <HeartFull key={i} className="h-5 w-[22px]" />)} {START_HEARTS} / {START_HEARTS}</span></Fact>
          <Fact tone="#ece6f0" ink="#5b4a6b" k="KNOCK-BACK"><span className="font-game text-[26px] text-[#ff4d6d]">−250</span> <span className="text-[13px]">score now {fmt(score)}</span></Fact>
          <Fact tone="#e6f8d8" ink="#2f7a2a" k="YOU KEEP">Run #{view.run?.number}, your score, earlier worlds, power-ups</Fact>
        </div>
        <div className="mt-2.5 rounded-2xl border-[3px] border-[#2b1d3a] bg-white px-3 py-2">
          <p className="text-[14px] leading-snug font-extrabold"><span className="text-[#c2410c]">World {to.world} resets:</span> {again.length ? `${again.map((l) => l.name).join(again.length > 2 ? ", " : " and ")} ${again.length === 1 ? "is" : "are"} back at full HP. Beat ${again.length === 1 ? "it" : "them"} again to reach ${levelInfo(from).name}.` : `${levelInfo(from).name} is back at full HP.`}</p>
          <div className="mt-2 grid grid-cols-10 gap-0.5">
            {strip.map((l) => (
              <span key={l.level} className="flex flex-col items-center">
                <span className="relative grid size-[30px] place-items-center overflow-hidden rounded-full border-2 border-[#2b1d3a]" style={{ background: l.level === to.level ? "#ffd2b0" : "#efe4d2" }}>
                  <img src={portrait(l.slug)} alt="" className="size-7" style={l.level > from ? { filter: "grayscale(1)", opacity: 0.55 } : undefined} />
                </span>
                {l.level === from ? <HeartBroken className="-mt-1 h-3 w-3.5" /> : l.level > from ? <Padlock className="-mt-1 h-3 w-3" /> : <span className="h-2" />}
                <span className={cx("text-[11px] font-black", l.level === to.level ? "text-[#c2410c]" : "text-[#6b5a7a]")}>{l.level}</span>
              </span>
            ))}
          </div>
        </div>
      </Panel>
      <div className="mx-4 mt-3.5"><BigBtn href={fightHref(view)} onClick={nextResult}><PlayDark className="size-6" />Back to Level {to.level} · {to.name}</BigBtn></div>
      <p className="mx-4 mt-2 flex items-center justify-between gap-2 text-[13px] font-extrabold text-[#fff7e6]">
        <span className="flex items-center gap-1"><Skull className="size-4" /> On Hardcore this would be game over.</span>
        <a href="#/game/map" onClick={nextResult} className="font-black text-[#ffc93c] underline underline-offset-2">See the map</a>
      </p>
    </>
  );
}

function Fact({ tone, ink, k, children }: { tone: string; ink: string; k: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border-[3px] border-[#2b1d3a] px-2.5 py-2" style={{ background: tone }}>
      <span className="block text-[11px] leading-tight font-black tracking-[0.06em]" style={{ color: ink }}>{k}</span>
      <span className="mt-0.5 block text-[15px] leading-tight font-black">{children}</span>
    </div>
  );
}

// ================================================================ Defeated and the finish: the run is over

/** Where the run that just ended sits in the Hall of Heroes. */
function useHallSpot(today: string, runNumber: number | undefined) {
  const hall = useQuery({ queryKey: ["game-hall", today], queryFn: () => api.gameHall(today) });
  const all = hall.data?.allTime ?? [];
  const at = all.findIndex((h) => h.isYou && h.number === runNumber);
  return { all, at };
}

function HallSpot({ all, at }: { all: HallRun[]; at: number }) {
  if (at < 0) return null;
  const from = Math.max(0, Math.min(at - 3, all.length - 5));
  const rows = all.slice(from, from + 5);
  const ahead = at > 0 ? all[at - 1] : null;
  return (
    <Panel>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-game text-[22px] font-normal">Hall of Heroes</h3>
        <span className="rounded-full bg-[#2b1d3a] px-2.5 py-0.5 font-game text-[15px] text-[#ffc93c]">#{at + 1} all time</span>
      </div>
      <ol className="mt-1.5 space-y-1">
        {rows.map((h, i) => {
          const me = from + i === at;
          return (
            <li key={`${h.userId}-${h.number}`} className={cx("flex items-center gap-2.5 rounded-xl px-2 py-1.5", me && "border-[3px] border-[#ffc93c] bg-[#fff1c2]")}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full border-[3px] border-[#2b1d3a] text-[13px] font-black" style={{ background: from + i === 0 ? "#ffc93c" : from + i === 1 ? "#e0e6f0" : from + i === 2 ? "#e0a868" : "#fff" }}>{from + i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{h.name} · Run #{h.number}{h.hardcore ? " ☠" : ""}{me ? <span className="ml-1.5 rounded-full bg-[#ff4d6d] px-1.5 text-[11px] font-black text-white">NEW</span> : null}</span>
              <span className="font-black">{fmt(h.score)}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-1.5 flex items-center justify-between text-[13px] font-extrabold text-[#6b5a7a]">
        <span>{ahead ? `Just ${fmt(ahead.score - all[at].score)} behind ${ahead.name}${ahead.isYou ? ` (Run #${ahead.number})` : ""}. Ooh.` : "Top of the Hall!"}</span>
        <a href="#/game/hall" onClick={nextResult} className="font-black text-[#5b3fd0] underline underline-offset-2">See the Hall</a>
      </div>
    </Panel>
  );
}

function NewRunCard({ number }: { number: number }) {
  const crumbs = levelInfo(1);
  return (
    <section className="mx-4 mt-3.5 rounded-[22px] border-[3px] border-[#1a1024] px-4 py-3.5 text-[#2b1d3a] shadow-[0_5px_0_#1a1024]" style={{ background: "linear-gradient(180deg, #d4f3c4, #a8e6a0)" }}>
      <div className="flex items-center gap-3">
        <span className="grid size-[84px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-[#2b1d3a] bg-[#7bd36b]"><img src={portrait(crumbs.slug)} alt="" className="mt-2 size-[84px]" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-game text-[21px] leading-tight font-normal">New run: back to Crumbs in the Snack Swamp</h3>
          <p className="text-[13px] leading-snug font-bold text-[#2f5a2a]">"Hi again! I've been practising." · {crumbs.hp} HP · {START_HEARTS} fresh hearts</p>
        </div>
      </div>
      <BigBtn href="#/game/start" onClick={clearResults} className="mt-3"><PlayDark className="size-6" />Start Run #{number}</BigBtn>
      <p className="mt-2 text-center text-[13px] font-extrabold text-[#2f5a2a]">Your tracker log is untouched — only the game restarts.</p>
    </section>
  );
}

function RunFacts({ view, endedOn }: { view: GameView; endedOn: string }) {
  const run = view.run;
  if (!run) return null;
  const beaten = view.map.filter((m) => m.status === "beaten");
  const days = daysFrom(run.startedOn, endedOn) + 1;
  const top = beaten.slice(-4);
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <Fact tone="#ffe9c2" ink="#c2410c" k="DAYS OF FIGHTING">{days} {days === 1 ? "day" : "days"}</Fact>
      <Fact tone="#e6f8d8" ink="#2f7a2a" k="MONSTERS BEATEN">
        <span className="flex items-center gap-1">{beaten.length}{top.map((m) => <img key={m.level} src={portrait(levelInfo(m.level).slug)} alt="" className="size-6" />)}</span>
      </Fact>
    </div>
  );
}

function Defeat({ r, view, today }: { r: Extract<Result, { kind: "defeat" }>; view: GameView; today: string }) {
  const lv = levelInfo(Number(r.defeat.data.level));
  const run = view.run;
  const score = Number(r.defeat.data.score ?? run?.score ?? 0);
  const { all, at } = useHallSpot(today, run?.number);
  const party = [levelInfo(2), levelInfo(5)].filter((p) => p.level !== lv.level);
  return (
    <>
      <Top kicker="CRAVING CRUSHER · GAME OVER" sub={<><HeartEmpty className="h-4 w-[18px]" /><HeartEmpty className="h-4 w-[18px]" /><HeartEmpty className="h-4 w-[18px]" /> 0 hearts · {lv.name} took the last one</>} />
      <h2 className="g-anim-pop mt-3 text-center font-game text-[56px] leading-none font-normal text-[#ff4d6d]" style={{ WebkitTextStroke: "7px #2b1d3a", paintOrder: "stroke fill", textShadow: "0 6px 0 #1a1024" }}>DEFEATED<span className="text-[#ffc93c]">!</span></h2>
      <p className="mx-5 mt-2 text-center text-[15px] leading-snug font-extrabold text-[#fff7e6]">The snacks win this round. {lv.name} kept your helmet, and honestly? It looks great on it.</p>
      <section className="relative mx-4 mt-3 h-[210px] overflow-hidden rounded-[24px] border-[3px] border-[#1a1024] shadow-[0_5px_0_#1a1024]" style={{ background: "linear-gradient(180deg, #ffb877, #ff9a5c 70%, #e8a66a 70%)" }}>
        <svg viewBox="0 0 360 40" aria-hidden className="absolute inset-x-0 top-0 w-full"><path d="M0 6 Q180 34 360 6" fill="none" stroke="#2b1d3a" strokeWidth="2.4" />
          {[30, 80, 130, 180, 230, 280, 330].map((x, i) => <path key={x} d={`M${x - 10} ${10 + Math.sin(i) * 2 + (i === 3 ? 8 : i === 2 || i === 4 ? 6 : 2)} l10 16 l10 -16 z`} fill={["#ff4d6d", "#ffc93c", "#6ec6ff", "#7bd36b"][i % 4]} stroke="#2b1d3a" strokeWidth="2" />)}
        </svg>
        <img src={portrait(party[0].slug)} alt="" className="g-anim-bob absolute bottom-3 left-2 size-[96px]" />
        <img src={portrait(party[1]?.slug ?? levelInfo(3).slug)} alt="" className="g-anim-bob absolute right-2 bottom-3 size-[96px]" style={{ animationDelay: "-.6s" }} />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <img src={portrait(lv.slug)} alt={lv.name} className="size-[150px]" />
          {/* your helmet, on its head */}
          <svg viewBox="0 0 40 20" aria-hidden className="absolute top-[6px] left-1/2 w-[64px] -translate-x-1/2 -rotate-6"><path d="M4 18 a16 16 0 0 1 32 0 Z" fill="#ffc93c" stroke="#2b1d3a" strokeWidth="2.6" strokeLinejoin="round" /><path d="M20 3 C22 -1 27 -1 28 1" fill="none" stroke="#ff4d6d" strokeWidth="3" strokeLinecap="round" /></svg>
        </div>
        <span className="absolute top-7 right-3 max-w-[40%] rounded-2xl border-[3px] border-[#2b1d3a] bg-white px-2 py-1 text-[12px] leading-tight font-extrabold text-[#2b1d3a]">Fits great. Can I keep it?</span>
      </section>
      <Panel>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-game text-[24px] leading-tight font-normal">Run #{run?.number} summary</h3>
            {run ? <span className="text-[13px] font-extrabold text-[#6b5a7a]">{shortDate(run.startedOn)} – {shortDate(r.defeat.day)}</span> : null}
          </div>
          <span className="shrink-0 font-game text-[36px] leading-none text-[#ffc93c]" style={{ WebkitTextStroke: "2.5px #2b1d3a", paintOrder: "stroke fill" }}>{fmt(score)}<span className="ml-1 text-[15px] text-[#2b1d3a]" style={{ WebkitTextStroke: 0 }}>pts</span></span>
        </div>
        <div className="mt-2"><Fact tone="#ffe9c2" ink="#c2410c" k="REACHED">World {lv.world} · {lv.name} (level {lv.level})</Fact></div>
        <RunFacts view={view} endedOn={r.defeat.day} />
      </Panel>
      <HallSpot all={all} at={at} />
      <NewRunCard number={(run?.number ?? 0) + 1} />
      <div className="mx-4 mt-3"><button onClick={nextResult} className="w-full py-2 text-center text-[14px] font-black text-[#fff7e6] underline underline-offset-2">Close</button></div>
    </>
  );
}

function Finish({ r, view, today }: { r: Extract<Result, { kind: "finish" }>; view: GameView; today: string }) {
  const run = view.run;
  const { all, at } = useHallSpot(today, run?.number);
  const ko = r.ko.kind === "ko" ? r.ko : null;
  return (
    <>
      <Top kicker={`CRAVING CRUSHER · RUN #${run?.number ?? ""} · COMPLETE`} sub="All 60 levels, all 6 worlds" right={<Trophy className="h-8 w-9" />} />
      {ko ? <KoScene level={LEVEL_COUNT} title="ALL 60 CRUSHED!" replayKey={0} caption="The Midnight Snacker shuffles back to bed. The fridge is safe. You did it!" /> : (
        <h2 className="mt-4 text-center font-game text-[44px] leading-none text-[#ffc93c]" style={{ WebkitTextStroke: "6px #2b1d3a", paintOrder: "stroke fill" }}>ALL 60 CRUSHED!</h2>
      )}
      <Panel className="text-center">
        <span className="text-[12px] font-black tracking-[0.08em] text-[#c2410c]">FINAL SCORE</span>
        <div className="font-game text-[52px] leading-none text-[#ffc93c]" style={{ WebkitTextStroke: "3px #2b1d3a", paintOrder: "stroke fill" }}>{fmt(run?.score ?? 0)}</div>
        <p className="mt-1 text-[14px] leading-snug font-bold text-[#6b5a7a]">Every monster in the Monster Book, beaten. Take a bow — then maybe a walk.</p>
        {run ? <RunFacts view={view} endedOn={r.ko.day} /> : null}
      </Panel>
      {ko ? <Breakdown ko={ko} score={run?.score ?? 0} /> : null}
      <HallSpot all={all} at={at} />
      <NewRunCard number={(run?.number ?? 0) + 1} />
      <div className="mx-4 mt-3"><button onClick={nextResult} className="w-full py-2 text-center text-[14px] font-black text-[#fff7e6] underline underline-offset-2">Close</button></div>
    </>
  );
}

