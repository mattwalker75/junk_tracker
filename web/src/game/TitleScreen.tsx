/**
 * The title screen (mockup MonTitle, without the name picker: Matt named it Craving Crusher).
 * Continue Run #N while a run is going, or Start a run; Monster Book, Hall of Heroes and How to
 * crush; the adventure map; the monsters peeking over the hill.
 */
import { useQuery } from "@tanstack/react-query";
import { levelInfo } from "../../../shared/game";
import { api } from "../lib/api";
import { Clouds, Hill, LogoBurst, Sunburst } from "./art";
import { Book, Fist, HeartFull, MapIcon, PadSmall, Play, Trophy } from "./icons";
import { GameBg, GameMenu } from "./parts";
import { useGame } from "./state";

const fmt = (n: number) => n.toLocaleString("en-US");
const peek = (slug: string) => `/monsters/${slug}.svg`;

export function TitleScreen() {
  const { today, view, error } = useGame();
  const hall = useQuery({ queryKey: ["game-hall", today], queryFn: () => api.gameHall(today) });
  const run = view?.run ?? null;
  // the open fight, or between fights the monster up next (Matt, Nov 14 2026)
  const fight = view?.fight ?? view?.next ?? null;
  const waiting = !view?.fight && !!view?.next;
  const going = !!(run?.active && fight);
  const best = hall.data?.mine[0];
  const leader = hall.data?.allTime[0];

  return (
    <main className="relative min-h-dvh overflow-hidden pb-[230px]">
      <GameBg background="linear-gradient(180deg, #4fb4f5 0%, #6ec6ff 35%, #bfe8ff 70%, #e6f7ff 100%)" />
      <div aria-hidden className="pointer-events-none absolute -top-[280px] -left-[255px] size-[900px] g-anim-spin"><Sunburst className="size-full" /></div>
      <Clouds className="pointer-events-none absolute top-0 left-0 h-[300px] w-[390px]" />
      <div aria-hidden className="g-anim-peek-l pointer-events-none absolute top-[168px] -left-[54px] z-[1] origin-left"><img src={peek("10-glazewing")} alt="" className="w-[110px]" /></div>
      <div aria-hidden className="g-anim-peek-r pointer-events-none absolute top-[208px] -right-[50px] z-[1] origin-right"><img src={peek("09-brain-freeze")} alt="" className="w-[110px]" /></div>
      <div aria-hidden className="g-anim-fly pointer-events-none absolute top-[58px] left-[22px] z-[1]"><img src={peek("02-chiplet")} alt="" className="w-[74px]" /></div>

      <header className="relative z-20 flex items-center justify-between px-4 pt-3.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b1d3a]/85 px-2.5 py-1 text-xs font-black tracking-[0.04em] text-[#fff7e6]">
          <PadSmall className="h-3.5 w-[18px]" /> GAME MODE
        </span>
        <GameMenu />
      </header>

      {/* the logo */}
      <div className="relative z-[3] mt-3.5 flex h-[200px] flex-col items-center justify-center">
        <LogoBurst className="absolute top-1.5 left-1/2 h-[190px] w-[330px] -translate-x-1/2" />
        <h1 aria-label="Craving Crusher" className="relative m-0 flex -rotate-[4deg] flex-col items-center font-game leading-[0.92] font-normal">
          <span className="block text-[50px] whitespace-nowrap text-g-yellow" style={{ WebkitTextStroke: "7px #2b1d3a", paintOrder: "stroke fill", textShadow: "0 5px 0 #2b1d3a, 0 7px 0 rgb(43 29 58 / .25)" }}>CRAVING</span>
          <span className="block text-[60px] whitespace-nowrap text-g-red" style={{ WebkitTextStroke: "9px #2b1d3a", paintOrder: "stroke fill", textShadow: "0 5px 0 #2b1d3a, 0 7px 0 rgb(43 29 58 / .25)" }}>CRUSHER</span>
        </h1>
        <span className="relative mt-2.5 -rotate-2 rounded-lg border-[3px] border-g-line bg-g-red px-3.5 py-1 text-[13px] font-black tracking-[0.03em] text-white shadow-[0_4px_0_var(--g-line)]">Every workout is a hit!</span>
      </div>

      <nav aria-label="Game" className="relative z-[4] mx-4 mt-5 flex flex-col gap-2.5">
        {error ? <p className="g-panel px-3 py-2 text-sm font-extrabold">{error.message}</p> : null}
        {view ? (going && run && fight ? (
          <a href="#/game/battle" className="g-btn g-anim-glow flex items-center gap-2.5 rounded-[22px] border-4 py-2 pr-3 pl-2 shadow-[0_6px_0_var(--g-line)]" style={{ background: "linear-gradient(180deg, #ffd765 0%, #ffc93c 60%, #f0a91f 100%)" }}>
            <span className="grid size-[62px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-g-line bg-[#ffd2b0]">
              <img src={peek(fight.slug)} alt="" className="mt-2 w-[64px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="font-game text-[26px] leading-none" style={{ color: "#fff", WebkitTextStroke: "2.5px #2b1d3a", paintOrder: "stroke fill" }}>Continue Run #{run.number}</span>
              <span className="flex flex-wrap items-center gap-1 text-xs font-black text-[#4a2f00]">
                World {fight.world} · {waiting ? `Up next: ${fight.name}` : fight.name} · {Array.from({ length: run.hearts }, (_, i) => <HeartFull key={i} className="h-3 w-[13px]" />)}
              </span>
              <span className="text-xs font-black text-[#4a2f00]">{run.hearts} {run.hearts === 1 ? "heart" : "hearts"} · {fmt(run.liveScore)} pts{run.hardcore ? " · Hardcore" : ""}</span>
            </span>
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-g-line bg-g-red"><Play className="ml-0.5 h-[18px] w-4" /></span>
          </a>
        ) : (
          <a href="#/game/start" className="g-btn g-anim-glow flex items-center gap-2.5 rounded-[22px] border-4 py-2 pr-3 pl-2 shadow-[0_6px_0_var(--g-line)]" style={{ background: "linear-gradient(180deg, #ffd765 0%, #ffc93c 60%, #f0a91f 100%)" }}>
            <span className="grid size-[62px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-g-line bg-[#ffd2b0]">
              <img src={peek(levelInfo(1).slug)} alt="" className="mt-2 w-[64px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-game text-[26px] leading-none" style={{ color: "#fff", WebkitTextStroke: "2.5px #2b1d3a", paintOrder: "stroke fill" }}>Start a run</span>
              <span className="text-xs font-black text-[#4a2f00]">
                {run ? `Run #${run.number} is over with ${fmt(run.score)} points. Run #${run.number + 1} starts with Crumbs.` : "Level 1 · Crumbs · 100 HP · 3 hearts"}
              </span>
            </span>
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-g-line bg-g-red"><Play className="ml-0.5 h-[18px] w-4" /></span>
          </a>
        )) : <div className="h-[86px]" />}

        <div className="grid grid-cols-3 gap-2">
          {([["#/game/book", "Monster Book", <Book key="b" className="h-[34px] w-10" />], ["#/game/hall", "Hall of Heroes", <Trophy key="t" className="h-[34px] w-[38px]" />], ["#/game/how", "How to crush", <Fist key="f" className="h-[34px] w-[38px]" />]] as const).map(([href, label, icon]) => (
            <a key={href} href={href} className="g-btn flex flex-col items-center gap-1 rounded-[18px] bg-[#fff7e6] px-1 pt-2 pb-2.5 text-[#2b1d3a]">
              {icon}
              <span className="text-center font-game text-[15px] leading-[1.05]">{label}</span>
            </a>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4">
          <a href="#/game/map" className="g-btn flex h-10 items-center gap-1.5 rounded-full bg-[#fff7e6] px-3.5 font-game text-[16px] text-[#2b1d3a]"><MapIcon className="size-5" />Adventure map</a>
          {going && run ? <a href="#/game/start" className="text-[13px] font-black text-[#2b1d3a] underline decoration-2 underline-offset-2 g-kicker">Start a new run instead</a> : null}
        </div>
      </nav>

      {/* the crowd peeking over the hill */}
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 z-[2] h-[230px] w-[390px] -translate-x-1/2">
        <img src={peek("01-crumbs")} alt="" className="g-anim-bob absolute top-[54px] -left-[18px] w-[100px] -rotate-[10deg]" />
        <img src={peek("03-gummo")} alt="" className="g-anim-bob absolute top-[40px] left-[52px] w-[96px] -rotate-[4deg]" style={{ animationDelay: "-.6s" }} />
        <img src={peek("16-midnight-snacker")} alt="" className="g-anim-bob absolute top-[6px] left-[116px] w-[140px]" style={{ animationDelay: "-1.2s" }} />
        <img src={peek("06-queso-kraken")} alt="" className="g-anim-bob absolute top-[42px] left-[238px] w-[96px] rotate-[5deg]" style={{ animationDelay: "-.3s" }} />
        <img src={peek("04-sir-soda")} alt="" className="g-anim-bob absolute top-[50px] left-[306px] w-[90px] rotate-[10deg]" style={{ animationDelay: "-1s" }} />
        <Hill className="absolute bottom-0 left-0 h-[120px] w-[390px]" />
        {best || leader ? (
          <div className="absolute inset-x-0 bottom-3.5 flex justify-center">
            <span className="rounded-full bg-[#2b1d3a]/85 px-3 py-0.5 text-xs font-extrabold text-[#fff7e6]">
              {best ? <>Your best: <b className="text-g-yellow">{fmt(best.score)}</b></> : null}
              {best && leader && !leader.isYou ? " · " : ""}
              {leader && !leader.isYou ? `${leader.name} leads with ${fmt(leader.score)}` : ""}
            </span>
          </div>
        ) : null}
      </div>
      {/* the hill reaches the screen's edges on wider screens too */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[60px] bg-[#5fb35a]" />
    </main>
  );
}
