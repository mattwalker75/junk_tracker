/**
 * Start a run (mockup MonStartRun): Crumbs says hi, pick Normal or Hardcore, start. A run still
 * going would end (as "abandoned", it stays in the Hall of Heroes), so the screen says so first.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { levelInfo, type FightView, type Mode } from "../../../shared/game";
import { cx } from "../components/ui";
import { api } from "../lib/api";
import { nowTime } from "../lib/dates";
import { go } from "../lib/route";
import { Check, HeartFull, Info, PlayDark, ShieldBlue, Skull } from "./icons";
import { dueText, hpLeft, hpText } from "./logic";
import { GameBg, GameHeader } from "./parts";
import { applyResult, startedRun, useGame } from "./state";

const fmt = (n: number) => n.toLocaleString("en-US");

const MODES: { mode: Mode; name: string; tag: string; points: string[]; tint: string; icon: string }[] = [
  { mode: "normal", name: "Normal", tag: "CHECKPOINTS", points: ["Knocked back to the start of your world at 0 hearts", "−250 points per knock-back", "Your run and score carry on"], tint: "#e8f6ff", icon: "#c9ecff" },
  { mode: "hardcore", name: "Hardcore", tag: "NO CHECKPOINTS", points: ["0 hearts = the run is over, back to level 1", "×1.25 on all points", "Skull badge in the Hall of Heroes"], tint: "#ffe3e8", icon: "#5b4a6b" },
];

export function StartRun() {
  const qc = useQueryClient();
  const { today, view } = useGame();
  const hall = useQuery({ queryKey: ["game-hall", today], queryFn: () => api.gameHall(today) });
  const [mode, setMode] = useState<Mode>("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [begun, setBegun] = useState<{ number: number; mode: Mode; fight: FightView | null } | null>(null);
  // a run still going ends when a new one starts: that takes a second tap
  const [sure, setSure] = useState(false);
  const run = view?.run ?? null;
  const next = (run?.number ?? 0) + 1;
  const going = !!run?.active;
  const best = hall.data?.mine[0];
  const crumbs = levelInfo(1);

  const start = async () => {
    if (going && !sure) { setSure(true); return; }
    setBusy(true); setError(null); setSure(false);
    try {
      const r = await api.gameStart(mode, today, nowTime());
      // what settled in the old run is moot now; what came after the new run's start is told (a
      // workout logged earlier today can KO Crumbs at once: its Victory comes up)
      applyResult(qc, today, { ...r, happened: startedRun(r) });
      void qc.invalidateQueries({ queryKey: ["game-hall"] });
      setBegun({ number: r.view.run?.number ?? next, mode, fight: r.view.fight });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <main className="relative flex min-h-dvh flex-col gap-3 pb-5">
      <GameBg background="radial-gradient(120% 50% at 50% 12%, #9be37f 0%, #4fae4a 42%, #2b6a3a 75%, #2b1d3a 100%)" />
      <GameHeader kicker="CALORIE CRUSHER · NEW RUN" title={<span className="text-g-yellow">Start Run #{next}</span>} back={{ href: "#/game", label: "Back to the title screen" }} />

      <section aria-label="Crumbs says hi" className="relative z-[2] flex h-32 items-end gap-1 px-4">
        <div className="relative h-[124px] w-[124px] shrink-0"><div className="g-anim-sway"><img src={`/monsters/${crumbs.slug}.svg`} alt="Crumbs" className="w-[124px]" /></div></div>
        <div className="g-anim-rise relative mb-11 flex-1 rounded-[18px] border-[3px] border-g-line bg-white px-3 py-2 text-[15px] leading-snug font-black text-[#2b1d3a] shadow-[0_4px_0_var(--g-line)]">
          {next > 1 ? "Hi again! I've been practising. How brave are we feeling this time?" : "Hi, I'm Crumbs, your first monster! How brave are we feeling?"}
        </div>
      </section>

      <h2 className="g-stroke-thin relative z-[2] mx-4 font-game text-xl font-normal">Pick your run mode</h2>
      <div role="radiogroup" aria-label="Run mode" className="relative z-[2] mx-4 flex flex-col gap-3.5">
        {MODES.map((m) => {
          const on = mode === m.mode;
          return (
            <button key={m.mode} role="radio" aria-checked={on} onClick={() => setMode(m.mode)}
              className={cx("relative flex w-full items-center gap-3 rounded-[22px] border-4 border-g-line py-3.5 pr-3.5 pl-3 text-left text-[#2b1d3a] transition", on ? "-translate-y-0.5" : "saturate-75")}
              style={{ background: on ? m.tint : "#f3ead8", boxShadow: on ? "0 5px 0 #1a1024, 0 0 0 4px #ffc93c" : "0 5px 0 #1a1024" }}>
              <span className="grid size-[66px] shrink-0 place-items-center rounded-[20px] border-[3px] border-g-line shadow-[inset_0_-5px_0_rgba(0,0,0,.14)]" style={{ background: m.icon }}>
                {m.mode === "normal" ? <ShieldBlue className="size-12" /> : <Skull className="size-12" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-1.5"><span className="font-game text-[26px] leading-none">{m.name}</span><span className="rounded-full bg-[#2b1d3a] px-1.5 py-px text-[10px] font-black tracking-[0.06em] text-white">{m.tag}</span></span>
                {m.points.map((p) => (
                  <span key={p} className="flex items-start gap-1.5 text-sm leading-snug font-extrabold">
                    <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 border-g-line" style={{ background: m.mode === "normal" ? "#3f9fe0" : "#ff4d6d" }}>
                      <svg viewBox="0 0 24 24" className="size-3"><path d="M5 12.5l4.5 4.5 9.5-10" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <span>{p}</span>
                  </span>
                ))}
              </span>
              {on ? <span aria-hidden className="g-anim-pop absolute -top-2.5 -right-2 grid size-8 place-items-center rounded-full border-[3px] border-g-line bg-g-yellow shadow-[0_3px_0_#1a1024]"><Check className="size-4" /></span> : null}
            </button>
          );
        })}
      </div>

      <p className="relative z-[2] mx-5 flex items-start gap-2 text-[13px] leading-snug font-extrabold text-[#f2ffe9]">
        <Info className="size-[18px] shrink-0" />
        <span>You can drop a Hardcore run to Normal any time; a Normal run can't switch to Hardcore.</span>
      </p>

      {best ? (
        <div className="relative z-[2] mx-4 flex items-center gap-2 rounded-[14px] border-2 border-[#1a1024] bg-[#1a1024]/55 px-3 py-2 text-[13px] font-extrabold text-[#f0e4ff]">
          <Skull className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">Your best: <span className="font-black text-g-yellow">{fmt(best.score)}</span> · Run #{best.number}{best.hardcore ? " · Hardcore" : ""}</span>
          <a href="#/game/hall" className="shrink-0 font-black text-g-yellow">Hall of Heroes</a>
        </div>
      ) : null}

      {going && run ? (
        <p role="note" className="g-panel relative z-[2] mx-4 bg-g-soft-yellow px-3 py-2 text-sm leading-snug font-extrabold">
          Run #{run.number} is still going ({fmt(run.liveScore)} points). Starting Run #{next} ends it; it stays in the Hall of Heroes.
        </p>
      ) : null}

      <div className="flex-1" />
      <div className="relative z-[2] mx-4 flex flex-col gap-2">
        {error ? <p role="alert" className="g-panel bg-g-soft-red px-3 py-2 text-sm font-extrabold">{error}</p> : null}
        {sure && run ? (
          <div role="alertdialog" aria-label={`End Run #${run.number}?`} className="g-panel flex flex-col gap-2 bg-g-soft-red px-3 py-2.5">
            <p className="text-[15px] leading-snug font-black">End Run #{run.number}? It can't be brought back.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSure(false)} className="g-btn h-11 rounded-xl bg-g-panel font-game text-[16px] text-g-text">Keep going</button>
              <button onClick={() => void start()} disabled={busy} className="g-btn h-11 rounded-xl bg-g-yellow font-game text-[16px]">End it, start #{next}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => void start()} disabled={busy} className="g-btn flex min-h-[60px] items-center justify-center gap-2 rounded-[18px] bg-g-yellow font-game text-[22px] shadow-[0_5px_0_var(--g-line)]">
            <PlayDark className="size-[22px]" />Start Run #{next} · {mode === "hardcore" ? "Hardcore" : "Normal"}
          </button>
        )}
        <span className="text-center text-xs font-extrabold text-[#e3f7da]">Level 1 · Crumbs · {crumbs.hp} HP · 3 hearts · score 0</span>
      </div>

      {begun ? <Begins begun={begun} /> : null}
    </main>
  );
}

/** "Run #N begins!": the monster you fight first (Crumbs, or the next one if Crumbs went down at once). Tap, Enter or Esc to go. */
function Begins({ begun }: { begun: { number: number; mode: Mode; fight: FightView | null } }) {
  const ref = useRef<HTMLButtonElement>(null);
  const f = begun.fight;
  const lv = levelInfo(f?.level ?? 1);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") go("/game/battle"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Run #${begun.number} begins`} className="fixed inset-0 z-50 text-[#2b1d3a]" style={{ background: "radial-gradient(80% 50% at 50% 45%, #9be37f 0%, #4fae4a 55%, #2d6e3a 100%)" }}>
      <button ref={ref} onClick={() => go("/game/battle")} className="flex size-full cursor-pointer flex-col items-center justify-center gap-3.5 outline-none">
        <span className="font-game text-[15px] tracking-[0.14em] text-[#1a3d1f]">WORLD {lv.world} · {lv.worldName.toUpperCase()} · LEVEL {lv.level} / 60</span>
        <span className="g-anim-pop font-game text-[46px] leading-none text-g-yellow" style={{ WebkitTextStroke: "3px #1a1024", paintOrder: "stroke fill", textShadow: "0 5px 0 #1a1024" }}>Run #{begun.number} begins!</span>
        <span className={cx("inline-flex items-center gap-1.5 rounded-full border-[3px] border-[#1a1024] py-1 pr-3 pl-2 font-game text-base tracking-[0.04em] shadow-[0_3px_0_#1a1024]", begun.mode === "hardcore" ? "bg-[#2b1d3a] text-white" : "bg-g-blue text-[#1a1024]")}>
          {begun.mode === "hardcore" ? <Skull className="size-5" /> : <ShieldBlue className="size-5" />}{begun.mode === "hardcore" ? "HARDCORE RUN" : "NORMAL RUN"}
        </span>
        <span className="flex gap-1.5">{[0, 1, 2].map((i) => <HeartFull key={i} className="h-8 w-9" />)}</span>
        <img src={`/monsters/${lv.slug}.svg`} alt="" className="g-anim-bob w-[140px]" />
        <span className="rounded-full border-[3px] border-g-line bg-[#fff7e6] px-3.5 py-1.5 text-sm font-black">{lv.name} · {f ? `${hpText(hpLeft(f), f.max)} HP · due ${dueText(f.deadlineOn)}` : `${lv.hp} HP · ${lv.days}-day deadline`}</span>
        <span className="text-[13px] font-extrabold text-[#1a3d1f]">{begun.mode === "hardcore" ? "All points ×1.25 · no checkpoints · tap to go" : "A checkpoint at every world · tap to go"}</span>
      </button>
    </div>
  );
}
