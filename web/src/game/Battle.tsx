/**
 * The battle (mockup MonBattle), from GET /api/game: hearts, run and score; the deadline ticking
 * down to midnight at the end of its last day on the phone's clock; the monster with its HP bar and ability; the
 * "So close!" nudge; power-ups; what a sync just settled; the battle log; and the game's two bottom
 * buttons, + Activity (attack) and + Splurge (no Weigh in in game mode).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { POWER_UP_LABEL, type FightView, type NextFightView, type PowerUp, type RunView } from "../../../shared/game/types";
import { cx } from "../components/ui";
import { api } from "../lib/api";
import { useActions } from "../lib/actions";
import { nowTime } from "../lib/dates";
import { Arena, Clock, worldLook } from "./art";
import { Ability, HeartBroken, HeartFull, HeartPlus, IconBlock, IconCrit, IconHeal, IconHit, Potion, Shield, Skull, Star, Sword, Target, Wind } from "./icons";
import { countdown, hpLeft, lineRow, soClose, type LineIcon } from "./logic";
import { levelInfo } from "../../../shared/game";
import { Burst, Confetti } from "./art";
import { MapIcon } from "./icons";
import { GameBg, GameHeader, GameNote, Hearts, HpBar, HpNumbers, Monster } from "./parts";
import { applyResult, markShown, useGame, useResults, type QueuedResult } from "./state";

const fmt = (n: number) => n.toLocaleString("en-US");

/** The time now, once a second (the deadline clock). Only the Deadline panel ticks, not the whole battle. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(t); }, []);
  return now;
}

/** The deadline, counting down to midnight at the end of its last day. */
function Deadline({ deadlineOn }: { deadlineOn: string }) {
  const cd = countdown(deadlineOn, useNow());
  return (
    <section aria-label="Deadline" className={cx("g-panel mx-3 mt-2.5 flex items-center gap-2.5 py-1.5 pr-2.5 pl-1.5", cd.passed && "bg-g-soft-red")}>
      <Clock passed={cd.passed} className="size-[54px] shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[10px] font-black tracking-[0.02em] whitespace-nowrap text-g-warn">{cd.kicker}</span>
        <span className="font-game text-[23px] leading-[1.05]">{cd.passed ? "Time’s up!" : cd.big}</span>
        <span className="text-xs font-extrabold text-g-mute">{cd.passed ? "It strikes once the day is over: −1 heart." : "Miss it: it strikes, −1 heart"}</span>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <span aria-hidden className={cx("tabular rounded-[10px] bg-g-night px-[7px] py-[5px] text-[15px] font-black whitespace-nowrap", cd.passed ? "text-[#ff7a95]" : "text-g-yellow")}>{cd.digits}</span>
        <span className="text-[10px] font-black tracking-[0.06em] text-g-mute">D · H · M · S</span>
      </div>
    </section>
  );
}

/** Hearts in the battle's top row: up to 3 drawn one by one; more as one heart × N, so the score keeps its room. */
function BattleHearts({ hearts, crack }: { hearts: number; crack: boolean }) {
  if (hearts + (crack ? 1 : 0) <= 3) {
    return crack ? (
      <span className="relative">
        <Hearts hearts={hearts + 1} />
        <span aria-hidden className="g-anim-crack absolute top-0" style={{ left: hearts * 27 }}><HeartBroken className="h-[22px] w-6" /></span>
      </span>
    ) : <Hearts hearts={hearts} />;
  }
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`${hearts} hearts`}>
      <HeartFull className="h-[22px] w-6" />
      <span className="g-stroke-thin font-game text-lg leading-none">×{hearts}</span>
      {crack ? <HeartBroken aria-hidden className="g-anim-crack h-[22px] w-6" /> : null}
    </span>
  );
}

export function Battle() {
  const { today, view, error, loading } = useGame();
  const { head } = useResults();
  if (error) return <Shell><GameNote title="Hmm, that didn't load">{error.message}</GameNote></Shell>;
  if (loading || !view) return <Shell><div className="h-40" /></Shell>;
  const run = view.run, fight = view.fight;
  if (run?.active && !fight && view.next) return <Between run={run} next={view.next} autoStart={view.autoStart} head={head} />;
  if (!run || !run.active || !fight) {
    return (
      <Shell>
        <GameNote title={run ? `Run #${run.number} is over` : "No run going yet"}
          action={<a href="#/game/start" className="g-btn flex h-12 items-center justify-center rounded-2xl bg-g-yellow font-game text-xl">Start a run</a>}>
          {run ? `It ended with ${fmt(run.score)} points. A new run starts again with Crumbs.` : "Start a run and Crumbs is your first monster. Every workout you log is a hit."}
        </GameNote>
      </Shell>
    );
  }
  return <BattleBody run={run} fight={fight} today={today} head={head} />;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-dvh pb-6">
      <GameBg background={worldLook(2).page} />
      <GameHeader kicker="CRAVING CRUSHER" title="Battle" back={{ href: "#/game", label: "Back to the title screen" }}><MapLink /></GameHeader>
      {children}
    </main>
  );
}

type Fx = { kind: "hit" | "heal"; amount: number; n: number } | null;

/** Hearts · run · score, the battle's top row. */
function RunRow({ run, crack }: { run: RunView; crack: boolean }) {
  return (
    <div className="mx-3 mt-2 flex items-stretch gap-2">
      <div className="g-panel flex h-10 shrink-0 items-center gap-1 rounded-[14px] px-2.5">
        <BattleHearts hearts={run.hearts} crack={crack} />
      </div>
      <div className={cx("g-panel flex h-10 shrink-0 flex-col items-center justify-center rounded-[14px] px-2.5 leading-none", run.hardcore ? "bg-g-night text-g-night-ink" : "bg-g-blue text-g-on")}>
        <span className="flex items-center gap-0.5 text-[10px] font-black tracking-[0.06em]">{run.hardcore ? <Skull className="size-3" /> : null}RUN</span>
        <span className="font-game text-lg/none">#{run.number}</span>
      </div>
      <div className="g-panel flex h-10 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-[14px] bg-g-yellow pr-3 pl-2 text-g-on" aria-label={`Score ${fmt(run.liveScore)}`}>
        <Star className="size-6 shrink-0" />
        <span aria-hidden className="text-[11px] font-black tracking-[0.06em] max-[370px]:hidden">SCORE</span>
        <span aria-hidden className="g-stroke-thin min-w-0 truncate font-game text-[22px] leading-none tabular max-[370px]:text-[19px]">{fmt(run.liveScore)}</span>
      </div>
    </div>
  );
}

/**
 * Between fights (Matt, Nov 14 2026): a monster went down (or struck) and the next one waits to be
 * started. The KO or strike that just came in plays here first, as on the battle screen; then the
 * monster that is up next, what starting it now means, and Choose your fight → Start the fight.
 * Logging still works (and still earns points), it just hits or heals nothing.
 */
function Between({ run, next, autoStart, head }: { run: RunView; next: NextFightView; autoStart: boolean; head: QueuedResult | null }) {
  const act = useActions();
  const scene = useScene(head);
  const shown = scene ? levelInfo(scene.level) : null;
  return (
    <main className="relative min-h-dvh pb-2">
      <GameBg background={worldLook(next.world).page} />
      <GameHeader kicker={`WORLD ${next.world} · LEVEL ${next.level} OF 60`} title={next.worldName}><MapLink /></GameHeader>
      <RunRow run={run} crack={!!scene?.crack} />

      <section aria-label="Between fights" className={cx("relative mx-3 mt-2.5 h-[230px] overflow-hidden rounded-[22px] border-[3px] border-g-line shadow-[0_4px_0_var(--g-line)]", scene && "g-anim-shake")}>
        <Arena world={next.world} className="g-art absolute inset-0 size-full" />
        <div className="absolute inset-x-2.5 top-2 flex items-start justify-between gap-2">
          <span className="g-stroke truncate font-game text-2xl leading-none" style={{ textShadow: "0 2px 0 #2b1d3a" }}>{shown?.name ?? next.name}</span>
          {!scene ? <span className="shrink-0 -rotate-2 rounded-full border-2 border-[#2b1d3a] bg-g-yellow px-2.5 py-0.5 font-game text-[15px] text-[#2b1d3a]">{next.rematch ? "REMATCH" : "UP NEXT"}</span> : null}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
          {scene?.kind === "ko" && shown ? <img src={`/monsters/${shown.slug}.svg`} alt={`${shown.name}, knocked out`} className="g-anim-ko h-[160px] w-[160px] origin-[50%_85%]" />
            : <Monster slug={shown?.slug ?? next.slug} name={shown?.name ?? next.name} pose={scene ? "strike" : "normal"} motion={scene ? "strike" : "idle"} className="h-[160px] w-[160px]" />}
        </div>
        {scene?.kind === "ko" ? <>
          <Confetti className="pointer-events-none absolute inset-0 z-10" />
          <Burst text="K.O.!" className="g-anim-burst absolute top-[90px] right-2 z-10 w-[112px]" />
        </> : null}
        {scene?.kind === "strike" ? <Burst text="WHAM!" fill="#ffc93c" className="g-anim-burst absolute top-[90px] left-2 z-10 w-[112px]" /> : null}
      </section>

      <section aria-label="Up next" className="g-panel mx-3 mt-2.5 px-3 py-2.5">
        <span className="text-[11px] font-black tracking-[0.06em] text-g-warn">{next.rematch ? `REMATCH · ATTEMPT ${next.attempt}` : "NO MONSTER RIGHT NOW"}</span>
        <h2 className="font-game text-[22px] leading-tight font-normal">{next.rematch ? `${next.name} is waiting for a rematch` : `Next up: ${next.name}`}</h2>
        <p className="text-[14px] font-black">{next.hp} HP · {next.days}-day deadline{next.boss ? " · BOSS" : ""}</p>
        <p className="mt-0.5 text-[13px] leading-snug font-extrabold text-g-mute"><b className="text-g-text">{next.ability.name}:</b> {next.ability.text}</p>
        <p className="mt-1.5 text-[13px] leading-snug font-bold">
          {next.partDay ? "Start it now and it gets the rest of today as a head start: its deadline counts from tomorrow." : "Start it now and today is day 1: everything you log today counts."}
          {" "}Until it starts, what you log hits and heals nothing (it still earns +5 points).
        </p>
        <p className="mt-1 text-[13px] leading-snug font-bold text-g-mute">
          {autoStart ? "Keep the monsters coming is on: if you don't start it today, it starts by itself the first time you open game mode on a new day."
            : "Or turn on Keep the monsters coming (Settings → You) and the next monster starts by itself the first time you open game mode each day."}
        </p>
        <a href="#/game/choose" className="g-btn g-anim-glow mt-2.5 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-g-green font-game text-[21px] text-[#2b1d3a] shadow-[0_5px_0_var(--g-line)]">
          <Sword className="size-7 shrink-0" />Start the next fight ›
        </a>
      </section>

      <div className="pb-safe sticky bottom-0 z-20 grid grid-cols-2 gap-2.5 px-3 pt-4">
        <button onClick={() => act.activity()} aria-label="+ Activity" className="g-btn flex h-[64px] items-center justify-center gap-2 rounded-[20px] bg-g-green px-1.5 shadow-[0_5px_0_var(--g-line)]">
          <Sword className="size-[30px] shrink-0" /><span className="g-stroke-thin font-game text-[21px] whitespace-nowrap">+ Activity</span>
        </button>
        <button onClick={() => act.log()} aria-label="+ Splurge" className="g-btn flex h-[64px] items-center justify-center gap-2 rounded-[20px] bg-g-blue px-1.5 shadow-[0_5px_0_var(--g-line)]">
          <HeartPlus className="size-[30px] shrink-0" /><span className="g-stroke-thin font-game text-[21px] whitespace-nowrap">+ Splurge</span>
        </button>
      </div>
    </main>
  );
}

/** The adventure map, from the battle screen's header. */
function MapLink() {
  return (
    <a href="#/game/map" aria-label="Adventure map" className="g-btn grid size-11 shrink-0 place-items-center rounded-full bg-g-panel text-g-text">
      <MapIcon className="size-6" />
    </a>
  );
}

/**
 * A KO or a strike that just came in plays here first: the monster that went down spins with a
 * K.O.! burst and confetti, or the one that struck lunges with WHAM! while a heart cracks. Then its
 * result screen comes up (Results.tsx). Reduced motion skips straight to the screen.
 */
const SCENE_MS = 1700;
function useScene(head: QueuedResult | null): { kind: "ko" | "strike"; level: number; crack: boolean } | null {
  const pending = head && !head.shown ? head.result : null;
  const id = pending?.id;
  useEffect(() => {
    if (!id) return;
    const t = window.setTimeout(() => markShown(id), SCENE_MS);
    return () => window.clearTimeout(t);
  }, [id]);
  if (!pending) return null;
  if (pending.kind === "victory" || pending.kind === "finish") return { kind: "ko", level: Number(pending.ko.data.level ?? 60), crack: false };
  return { kind: "strike", level: Number(pending.strike.data.level), crack: pending.kind === "strike" };
}

function BattleBody({ run, fight, today, head }: { run: RunView; fight: FightView; today: string; head: QueuedResult | null }) {
  const act = useActions();
  const left = hpLeft(fight);
  const so = soClose(left);
  const look = worldLook(fight.world);

  // the monster reacts when its HP (bonus HP included) changes while you watch (a save, a sync)
  const last = useRef<{ id: string; hp: number } | null>(null);
  const [fx, setFx] = useState<Fx>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { id: fight.id, hp: left };
    if (!prev || prev.id !== fight.id || prev.hp === left) return;
    const n = Date.now();
    setFx({ kind: left < prev.hp ? "hit" : "heal", amount: Math.abs(left - prev.hp), n });
    const t = window.setTimeout(() => setFx((f) => (f?.n === n ? null : f)), 1200);
    return () => window.clearTimeout(t);
  }, [fight.id, left]);
  const scene = useScene(head);
  const struck = scene?.kind === "strike";
  const ko = scene?.kind === "ko" ? levelInfo(scene.level) : null;
  const strikeBy = struck ? levelInfo(scene.level) : null;

  return (
    <main className="relative min-h-dvh pb-2">
      <GameBg background={look.page} />
      <GameHeader kicker={`WORLD ${fight.world} · LEVEL ${fight.level} OF 60`} title={fight.worldName}><MapLink /></GameHeader>

      {/* hearts · run · score */}
      <RunRow run={run} crack={!!scene?.crack} />

      <Deadline deadlineOn={fight.deadlineOn} />

      {/* the arena */}
      <section aria-label="Battle arena" className={cx("relative mx-3 mt-2.5 h-[260px] overflow-hidden rounded-[22px] border-[3px] border-g-line shadow-[0_4px_0_var(--g-line)]", (fx?.kind === "hit" || scene) && "g-anim-shake")}>
        <Arena world={fight.world} className="g-art absolute inset-0 size-full" />
        <div className="absolute inset-x-2.5 top-2 flex flex-col gap-1">
          <div className="flex items-end justify-between gap-2">
            <span className="g-stroke truncate font-game text-2xl leading-none" style={{ textShadow: "0 2px 0 #2b1d3a" }}>{ko?.name ?? strikeBy?.name ?? fight.name}</span>
            <span className="g-stroke-thin shrink-0 text-base font-black">{ko ? `HP 0 / ${ko.hp}` : strikeBy ? `HP ${strikeBy.hp} / ${strikeBy.hp}` : <>HP <HpNumbers hp={fight.hp} max={fight.max} bonus={fight.bonus} /></>}</span>
          </div>
          <HpBar label={`${fight.name} hit points`} max={fight.max} value={ko ? 0 : left}
            fill={fx?.kind === "heal" ? "#ff4d6d" : "#ff7a2f"} fillClass="rounded-full shadow-[inset_0_-4px_0_rgba(0,0,0,.18)]" />
          <div className="mt-0.5 flex items-center justify-between gap-2">
{scene ? <span /> : <span className="inline-flex max-w-[80%] -rotate-2 items-center gap-1.5 rounded-full bg-[#2b1d3a] py-[3px] pr-2.5 pl-1 text-xs font-black text-g-yellow shadow-[0_3px_0_rgba(43,29,58,.35)]">
              <Ability className="size-[22px] shrink-0" />
              <span className="min-w-0"><span className="text-white">{fight.ability.name}:</span> {fight.ability.text}</span>
            </span>}
            {run.shieldArmed && fight.powerUpsAllowed ? <span className="g-anim-pulse shrink-0 rounded-full border-2 border-[#2b1d3a] bg-g-green px-2 py-[3px] text-xs font-black text-[#2b1d3a]">Shield up</span> : null}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
          {ko ? <img src={`/monsters/${ko.slug}.svg`} alt={`${ko.name}, knocked out`} className="g-anim-ko h-[170px] w-[170px] origin-[50%_85%]" />
            : <Monster slug={strikeBy?.slug ?? fight.slug} name={strikeBy?.name ?? fight.name} pose={struck ? "strike" : fx?.kind === "hit" ? "hurt" : "normal"}
              motion={struck ? "strike" : fx ? (fx.kind === "hit" ? "hurt" : "heal") : "idle"} motionKey={fx?.n} className="h-[170px] w-[170px]" />}
        </div>
        {ko ? <>
          <Confetti className="pointer-events-none absolute inset-0 z-10" />
          <Burst text="K.O.!" className="g-anim-burst absolute top-[104px] right-2 z-10 w-[112px]" />
        </> : null}
        {struck ? <Burst text="WHAM!" fill="#ffc93c" className="g-anim-burst absolute top-[104px] left-2 z-10 w-[112px]" /> : null}
        {fx ? (
          <div key={fx.n} aria-hidden className="g-anim-float pointer-events-none absolute top-24 right-4 z-10 flex flex-col items-center">
            <span className="g-stroke-thick font-game text-[40px] leading-none" style={{ color: fx.kind === "hit" ? "#fff" : "#ff7a95", textShadow: "0 4px 0 #2b1d3a" }}>{fx.kind === "hit" ? `−${fx.amount}` : `+${fx.amount}`}</span>
            <span className="g-stroke-thin font-game text-[15px] whitespace-nowrap" style={{ color: "#ffc93c" }}>{fx.kind === "hit" ? "hit!" : "yum, it heals"}</span>
          </div>
        ) : null}
      </section>

      {/* so close */}
      <section aria-label="So close" className="g-panel mx-3 mt-2.5 flex items-center gap-2.5 bg-g-yellow py-1.5 pr-3 pl-2 text-g-on">
        <Target className="size-10 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="flex items-baseline justify-between gap-1.5"><span className="font-game text-xl leading-[1.05]">{so.title}</span><span className="text-[11px] font-black whitespace-nowrap text-[#6b4a00]">10 min = 100 cal = 10 dmg</span></span>
          <span className="text-sm leading-[1.28] font-extrabold">
            <b className="font-black">{so.hp} HP left.</b> Finish it: <b className="font-black text-[#7a2a00]">{so.minutes} more minutes</b>, or <b className="font-black text-[#7a2a00]">{so.calories} calories</b>, or mix, e.g. {so.mix}.
          </span>
        </div>
      </section>

      {fight.betOptions.length ? (
        <a href="#/game/choose" className="g-btn mx-3 mt-2.5 flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-g-panel px-3 text-g-text">
          <span className="text-sm leading-tight font-extrabold"><span className="font-game text-base">Choose your fight</span> · bet on a shorter deadline for up to ×2 points</span>
          <span aria-hidden className="font-game text-lg">→</span>
        </a>
      ) : null}

      <PowerUps run={run} fight={fight} today={today} />

      {/* the battle log */}
      <section aria-label="Battle log" className="g-panel mx-3 mt-2.5 mb-2 px-2.5 pt-1 pb-1">
        <div className="flex items-baseline justify-between">
          <h2 className="font-game text-[17px] font-normal">Battle log</h2>
          <span className="text-xs font-black text-g-mute"><HpNumbers hp={fight.hp} max={fight.max} bonus={fight.bonus} /> HP</span>
        </div>
        {fight.lines.length ? (
          <ul className="mt-0.5 flex flex-col">
            {fight.lines.map((l, i) => lineRow(l, today, i)).map((r) => (
              <li key={r.key} className="g-dashed flex min-h-[27px] items-center gap-2 py-1">
                <span className="w-10 shrink-0 text-xs font-black text-[#8a6a3a]">{r.day}</span>
                <span className="grid size-[22px] shrink-0 place-items-center"><LineIconView icon={r.icon} /></span>
                <span className="min-w-0 flex-1 text-[13px] leading-snug font-extrabold">{r.text}</span>
                <span className={cx("min-w-10 shrink-0 text-right font-game text-[17px] whitespace-nowrap",
                  r.tone === "heal" ? "text-g-pink" : r.tone === "crit" ? "text-[#9a6400]" : r.tone === "block" ? "text-[#2f7a2a]" : "text-g-text")}>{r.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="g-dashed py-2 text-[13px] leading-snug font-extrabold text-g-mute">Nothing yet. Log a workout to land the first hit, or go a day without a splurge for a clean-day crit at midnight.</p>
        )}
      </section>

      {/* the game's two bottom buttons */}
      <div className="pb-safe sticky bottom-0 z-20 grid grid-cols-2 gap-2.5 px-3 pt-4">
        <button onClick={() => act.activity()} aria-label="+ Activity, attack" className="g-btn flex h-[74px] items-center justify-center gap-2 rounded-[20px] bg-g-green px-1.5 shadow-[0_5px_0_var(--g-line)]">
          <Sword className="size-[34px] shrink-0" />
          <span className="flex flex-col items-start leading-[1.05]">
            <span className="g-stroke-thin font-game text-[22px] whitespace-nowrap">+ Activity</span>
            <span className="text-[13px] font-black text-[#1f4f1a]">(attack)</span>
          </span>
        </button>
        <button onClick={() => act.log()} aria-label="+ Splurge, heals it" className="g-btn flex h-[74px] items-center justify-center gap-2 rounded-[20px] bg-g-blue px-1.5 shadow-[0_5px_0_var(--g-line)]">
          <HeartPlus className="size-[34px] shrink-0" />
          <span className="flex flex-col items-start leading-[1.05]">
            <span className="g-stroke-thin font-game text-[22px] whitespace-nowrap">+ Splurge</span>
            <span className="text-[13px] font-black text-[#0f4a73]">(heals it)</span>
          </span>
        </button>
      </div>
    </main>
  );
}

function LineIconView({ icon }: { icon: LineIcon }) {
  if (icon === "hit") return <IconHit className="size-5" />;
  if (icon === "crit") return <IconCrit className="size-5" />;
  if (icon === "heal") return <IconHeal className="size-5" />;
  if (icon === "block") return <IconBlock className="size-5" />;
  if (icon === "ko") return <Star className="size-5" />;
  return <span className="size-2 rounded-full bg-g-mute" />;
}

/** Veggie Shield, Water Potion, Second Wind: a tap asks "sure?", a second tap uses it. */
function PowerUps({ run, fight, today }: { run: RunView; fight: FightView; today: string }) {
  const qc = useQueryClient();
  const [asking, setAsking] = useState<PowerUp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!asking) return; const t = window.setTimeout(() => setAsking(null), 4000); return () => window.clearTimeout(t); }, [asking]);

  const use = async (kind: PowerUp) => {
    if (asking !== kind) { setAsking(kind); setError(null); return; }
    setAsking(null); setBusy(true);
    try { applyResult(qc, today, await api.gamePowerUp(kind, today, nowTime())); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const off = !fight.powerUpsAllowed;
  const items: { kind: PowerUp; count: number; icon: ReactNode; sub: string; disabled: boolean }[] = [
    { kind: "shield", count: run.shields, icon: <Shield className="h-7 w-[26px] shrink-0" />, disabled: off || busy || run.shields < 1 || run.shieldArmed,
      sub: run.shieldArmed ? "up: blocks the next heal" : run.shields ? "tap to block one heal" : "3 clean days earn one" },
    { kind: "potion", count: run.potions, icon: <Potion className="h-6 w-5 shrink-0" />, disabled: off || busy || run.potions < 1, sub: run.potions ? "50 damage now" : "60+ min earns one" },
    { kind: "wind", count: run.winds, icon: <Wind className="size-[22px] shrink-0" />, disabled: off || busy || run.winds < 1, sub: run.winds ? "+1 day" : "a boss kill earns one" },
  ];
  return (
    <div className="mx-3 mt-2.5">
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        {items.map((it) => {
          const sure = asking === it.kind;
          return (
            <button key={it.kind} onClick={() => void use(it.kind)} disabled={it.disabled} aria-label={`${POWER_UP_LABEL[it.kind]}: ${it.count}. ${sure ? "Tap again to use it." : it.sub}`}
              title={`${POWER_UP_LABEL[it.kind]}: ${it.sub}`}
              className={cx("g-btn flex min-h-[46px] items-center gap-1.5 rounded-[14px] px-1.5 py-1 text-left", sure ? "bg-g-yellow" : it.kind === "shield" && run.shieldArmed ? "g-anim-pulse bg-g-green" : "bg-g-panel text-g-text")}>
              {it.icon}
              <span className="flex min-w-0 flex-col leading-[1.1]">
                <span className="text-xs leading-tight font-black">{it.kind === "shield" ? "Veggie Shield" : it.kind === "potion" ? "Potion" : "2nd Wind"} ×{it.count}</span>
                <span className="text-[11px] leading-tight font-extrabold opacity-80">{sure ? "tap again to use" : it.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
      {off ? <p className="mt-1.5 text-xs font-extrabold g-kicker">{fight.ability.name}: no power-ups work in this fight. You keep them for the next one.</p> : null}
      {error ? <p role="alert" className="g-panel mt-2 bg-g-soft-red px-3 py-1.5 text-sm font-extrabold">{error}</p> : null}
    </div>
  );
}
