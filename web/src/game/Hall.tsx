/**
 * The Hall of Heroes (mockup MonHall), from GET /api/game/hall: your best run up top, then the tabs
 * All time · This month · My runs · Hardcore (skull), and the five badges (badges.ts, worked out
 * from your stored fights). Several users means separation, not privacy, so everyone's runs are
 * listed.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LEVEL_COUNT, levelInfo, type Badge, type HallRun, type HallView } from "../../../shared/game";
import { cx } from "../components/ui";
import { api } from "../lib/api";
import { BadgeArt, Crown, ShieldBlue, Skull } from "./icons";
import { shortDate } from "./logic";
import { GameBg, GameMenu, GameNote } from "./parts";
import { useGame } from "./state";

const fmt = (n: number) => n.toLocaleString("en-US");
const portrait = (slug: string) => `/monsters/${slug}.svg`;
type Tab = "allTime" | "thisMonth" | "mine" | "hardcore";
const TABS: { id: Tab; label: string }[] = [{ id: "allTime", label: "All time" }, { id: "thisMonth", label: "This month" }, { id: "mine", label: "My runs" }, { id: "hardcore", label: "Hardcore" }];

/** "Reached Baron Fryer", or "Crushed all 60" for a finished run. */
export const reachedText = (h: Pick<HallRun, "level" | "endReason">): string =>
  h.endReason === "finished" ? `Crushed all ${LEVEL_COUNT}` : `Reached ${levelInfo(Math.max(1, Math.min(LEVEL_COUNT, h.level))).name}`;

export function Hall() {
  const { today } = useGame();
  const hall = useQuery({ queryKey: ["game-hall", today], queryFn: () => api.gameHall(today) });
  const [tab, setTab] = useState<Tab>("allTime");
  const h = hall.data;
  return (
    <main className="relative min-h-dvh pb-8">
      <GameBg background="radial-gradient(130% 50% at 50% 0%, #4a3480 0%, #2b1d3a 65%)" />
      <header className="relative z-30 flex items-center gap-2.5 px-4 pt-3">
        <a href="#/game" aria-label="Back to the title screen" className="g-btn grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff7e6] text-[#2b1d3a]">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
        </a>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-game text-[12px] tracking-[0.08em] text-[#c8b6e6]">CRAVING CRUSHER</span>
          <h1 className="truncate font-game text-[30px] leading-none font-normal text-[#ffc93c]" style={{ WebkitTextStroke: "2.5px #1a1024", paintOrder: "stroke fill", textShadow: "0 3px 0 #1a1024" }}>Hall of Heroes</h1>
        </div>
        <GameMenu />
      </header>
      {hall.error ? <GameNote title="Hmm, that didn't load">{hall.error.message}</GameNote> : null}
      {h ? <Body h={h} tab={tab} setTab={setTab} today={today} /> : <div className="h-40" />}
    </main>
  );
}

function Body({ h, tab, setTab, today }: { h: HallView; tab: Tab; setTab: (t: Tab) => void; today: string }) {
  const best = h.mine[0];
  const bestRank = best ? h.allTime.findIndex((r) => r.isYou && r.number === best.number) + 1 : 0;
  const list = h[tab];
  return (
    <>
      {best ? (
        <section aria-label="Your best" className="mx-4 mt-3 flex items-center gap-3 rounded-[22px] border-[3px] border-[#1a1024] px-3.5 py-3 text-[#2b1d3a] shadow-[0_5px_0_#1a1024]" style={{ background: "linear-gradient(180deg, #ffd765 0%, #ffc93c 60%, #f0a91f 100%)" }}>
          <span className="grid size-[68px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-[#2b1d3a] bg-[#ffd2b0]"><img src={portrait(levelInfo(Math.min(LEVEL_COUNT, best.level)).slug)} alt="" className="mt-1.5 size-[66px]" /></span>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[12px] font-black tracking-[0.1em] text-[#6b4a00]">YOUR BEST</span>
            <span className="font-game text-[38px] leading-none text-white" style={{ WebkitTextStroke: "2.5px #2b1d3a", paintOrder: "stroke fill" }}>{fmt(best.score)}</span>
            <span className="truncate text-[14px] font-black text-[#4a2f00]">{reachedText(best)}</span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {bestRank ? <span className="rounded-full bg-[#2b1d3a] px-2 py-0.5 font-game text-[13px] text-[#ffc93c]">#{bestRank} all time</span> : null}
            <span className="text-[13px] font-black text-[#4a2f00]">Run #{best.number}</span>
          </div>
        </section>
      ) : (
        <GameNote title="No runs yet" action={<a href="#/game/start" className="g-btn flex h-12 items-center justify-center rounded-2xl bg-g-yellow font-game text-xl">Start a run</a>}>
          Every run lands here with its score, even one going right now.
        </GameNote>
      )}

      <div role="tablist" aria-label="Which runs" className="mx-4 mt-3.5 grid grid-cols-4 gap-1 rounded-[18px] bg-[#1a1024] p-1.5">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cx("flex h-10 items-center justify-center gap-1 rounded-xl px-1 font-game text-[14px] leading-none whitespace-nowrap", tab === t.id ? "bg-g-yellow text-[#2b1d3a] shadow-[0_3px_0_#0e0817]" : "text-[#d9c9f0]")}>
            {t.id === "hardcore" ? <Skull className="size-4 shrink-0" /> : null}{t.label}
          </button>
        ))}
      </div>

      <ol role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="mt-3 flex flex-col gap-2.5">
        {list.length ? list.map((r, i) => <Row key={`${r.userId}-${r.number}`} r={r} rank={i + 1} mine={tab === "mine"} />) : (
          <li className="g-panel mx-4 px-4 py-3 text-[15px] font-bold">
            {tab === "hardcore" ? "No Hardcore runs yet. Brave enough? Start one and pick Hardcore." : tab === "thisMonth" ? `No runs this month (${shortDate(today).slice(4, 7)}) yet.` : tab === "mine" ? "You haven't started a run yet." : "No runs yet."}
          </li>
        )}
      </ol>

      <Badges badges={h.badges} />
    </>
  );
}

function Row({ r, rank, mine }: { r: HallRun; rank: number; mine: boolean }) {
  const lv = levelInfo(Math.max(1, Math.min(LEVEL_COUNT, r.level)));
  const when = r.endedOn ?? r.startedOn;
  const state = !r.endReason ? "going" : r.endReason === "defeated" ? "defeated" : r.endReason === "finished" ? "finished" : "ended early";
  const medal = rank === 1 ? "#ffc93c" : rank === 2 ? "#e0e6f0" : rank === 3 ? "#e0a868" : "#ffffff";
  return (
    <li className="relative mx-4">
      {rank === 1 && !mine ? <Crown className="absolute -top-3 left-[70px] z-[1] h-7 w-9 -rotate-12" /> : null}
      <div className={cx("flex items-center gap-2.5 rounded-[20px] border-[3px] px-3 py-2.5 text-[#2b1d3a] shadow-[0_5px_0_#1a1024]", r.isYou && !mine ? "border-[#ffc93c] bg-[#fff1c2]" : "border-[#1a1024] bg-[#fff7e6]")}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full border-[3px] border-[#2b1d3a] font-game text-[17px]" style={{ background: medal }}>{rank}</span>
        <span className="grid size-[54px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-[#2b1d3a] bg-[#ffd2b0]"><img src={portrait(lv.slug)} alt="" loading="lazy" className="mt-1 size-[54px]" /></span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-game text-[19px]">{mine ? `Run #${r.number}` : r.name}</span>
            {r.isYou && !mine ? <span className="shrink-0 rounded-full bg-[#2b1d3a] px-1.5 text-[11px] leading-[18px] font-black text-[#ffc93c]">YOU</span> : null}
            {!mine && r.hardcore ? <Skull className="size-4 shrink-0" aria-label="Hardcore" /> : null}
          </span>
          <span className="truncate text-[13px] font-extrabold text-[#8a4a1f]">{reachedText(r)}{!mine && r.number > 1 ? ` · Run #${r.number}` : ""}</span>
          {mine ? (
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] font-extrabold text-[#9a86ac]">
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border-2 border-[#2b1d3a] px-1.5 text-[11px] leading-[16px] font-black" style={{ background: r.hardcore ? "#ff4d6d" : "#6ec6ff", color: "#1a1024" }}>
                {r.hardcore ? <Skull className="size-3" /> : <ShieldBlue className="size-3" />}{r.hardcore ? "HARDCORE" : "NORMAL"}
              </span>
              <span>{state} · {shortDate(when).slice(4)}</span>
            </span>
          ) : <span className="truncate text-[12px] font-extrabold text-[#9a86ac]">World {lv.world} · {shortDate(when).slice(4)}</span>}
        </span>
        <span className="shrink-0 font-game text-[24px] text-[#ffc93c]" style={{ WebkitTextStroke: "2px #2b1d3a", paintOrder: "stroke fill" }}>{fmt(r.score)}</span>
      </div>
    </li>
  );
}

function Badges({ badges }: { badges: Badge[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const got = badges.filter((b) => b.earned).length;
  const b = badges.find((x) => x.id === sel) ?? null;
  return (
    <section aria-label="Badges" className="mx-4 mt-4 rounded-[22px] border-[3px] border-[#1a1024] bg-[#fff7e6] px-3 pt-3 pb-3.5 text-[#2b1d3a] shadow-[0_5px_0_#1a1024]">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-game text-[24px] font-normal">Badges</h2>
        <span className="text-[13px] font-black text-[#6b5a7a]">{got} of {badges.length} · tap one</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {badges.map((x) => (
          <button key={x.id} onClick={() => setSel(sel === x.id ? null : x.id)} aria-pressed={sel === x.id} aria-label={`${x.name}${x.earned ? ", earned" : ", not yet"}`}
            className={cx("flex flex-col items-center gap-1 rounded-2xl border-[3px] px-0.5 pt-1.5 pb-1", sel === x.id ? "border-[#2b1d3a] bg-[#ffe9a8]" : "border-transparent")}>
            <BadgeArt id={x.id} earned={x.earned} className="size-[46px]" />
            <span className={cx("text-center text-[12px] leading-tight font-black", !x.earned && "text-[#9a8aa8]")}>{x.name}</span>
          </button>
        ))}
      </div>
      {b ? (
        <div className="mt-2.5 rounded-2xl border-[3px] border-[#2b1d3a] bg-white px-3 py-2 text-[14px] leading-snug font-bold">
          <b className="font-black">{b.name}</b> · {b.earned ? <span className="font-black text-[#2f9a2a]">earned{b.earnedOn ? ` ${shortDate(b.earnedOn).slice(4)}` : ""}</span> : <span className="font-black text-[#8a7a99]">not yet</span>}
          <span className="block">{b.how}{b.detail ? ` ${b.detail}` : ""}</span>
        </div>
      ) : null}
    </section>
  );
}
