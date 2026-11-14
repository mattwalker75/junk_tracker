/**
 * The Monster Book (mockups MonBestiary1-2, MonNewA-E): all 60 monsters by world, from levels.ts
 * and abilities.ts, each with its one-line bio (bios.ts). Beaten ones carry a "Beaten" stamp, the
 * one you are fighting shows its fight, and the ones up ahead show their art with "Up ahead ·
 * Level N" (Matt wants to see the art). Tapping a card opens its page: big art, the bio, HP, days
 * and the ability.
 */
import { useState } from "react";
import { abilityFor, bioFor, LEVELS, LEVELS_PER_WORLD, WORLDS, type FightView, type GameView, type Level, type MapStatus } from "../../../shared/game";
import { Sheet } from "../components/ui";
import { worldMap } from "./art";
import { Crown } from "./icons";
import { countdown, hpLeft, hpText, shortDate } from "./logic";
import { GameBg, GameHeader, GameNote, HpBar } from "./parts";
import { useGame } from "./state";

const portrait = (slug: string) => `/monsters/${slug}.svg`;
const CARD_BG: Record<MapStatus, string> = { beaten: "#e6f8d8", current: "#ffd2b0", locked: "#f1e8f6" };

export function Book() {
  const { view, error } = useGame();
  const [open, setOpen] = useState<Level | null>(null);
  const beaten = view?.map.filter((m) => m.status === "beaten").length ?? 0;
  return (
    <main className="relative min-h-dvh pb-8">
      <GameBg background="linear-gradient(180deg, #6ec6ff 0%, #bfe8ff 18%, #fff3dc 40%, #ffe7bd 100%)" />
      <GameHeader kicker="CALORIE CRUSHER" title="Monster Book" back={{ href: "#/game", label: "Back to the title screen" }} />
      {error ? <GameNote title="Hmm, that didn't load">{error.message}</GameNote> : null}
      <div className="g-panel mx-4 mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-2xl px-3.5 py-2 text-[14px] font-extrabold">
        <span><b className="font-black">{beaten} of 60</b> beaten{view?.run ? <> · <b className="font-black">Run #{view.run.number}</b></> : null}</span>
        <span className="text-g-mute">Tap a monster</span>
      </div>
      {WORLDS.map((name, i) => <WorldSection key={name} w={i + 1} view={view} onOpen={setOpen} />)}
      <MonsterSheet lv={open} view={view} onClose={() => setOpen(null)} />
    </main>
  );
}

const statusOf = (view: GameView | undefined, level: number): MapStatus => view?.map[level - 1]?.status ?? "locked";
const fightAt = (view: GameView | undefined, level: number): FightView | null => (view?.fight && view.fight.level === level && statusOf(view, level) === "current" ? view.fight : null);

function WorldSection({ w, view, onOpen }: { w: number; view: GameView | undefined; onOpen: (l: Level) => void }) {
  const levels = LEVELS.slice((w - 1) * LEVELS_PER_WORLD, w * LEVELS_PER_WORLD);
  const st = levels.map((l) => statusOf(view, l.level));
  const beaten = st.filter((s) => s === "beaten").length;
  const here = st.includes("current");
  const look = worldMap(w);
  const dark = w >= 5;
  const pill = beaten === LEVELS_PER_WORLD ? `Cleared ${beaten}/10` : here ? "You are here" : beaten ? `${beaten}/10 beaten` : `Levels ${levels[0].level}–${levels[9].level}`;
  return (
    <section aria-label={`World ${w}, ${WORLDS[w - 1]}`} className="mt-4">
      <div className="relative mx-4 overflow-hidden rounded-[20px] border-[3px] border-[#2b1d3a] px-3.5 pt-2 pb-2.5 shadow-[0_4px_0_#2b1d3a]" style={{ background: look.banner }}>
        <span className="block font-game text-[13px] tracking-[0.12em]" style={{ color: dark ? "#fff7e6" : look.ink }}>WORLD {w}</span>
        <h2 className="g-stroke font-game text-[28px] leading-none font-normal">{WORLDS[w - 1]}</h2>
        <span className="absolute top-2.5 right-3 rounded-full border-[3px] border-[#2b1d3a] px-2.5 py-px text-[13px] font-black"
          style={{ background: beaten === LEVELS_PER_WORLD ? "#2f9a52" : here ? "#ffc93c" : "#fff7e6", color: beaten === LEVELS_PER_WORLD ? "#fff" : "#2b1d3a" }}>{pill}</span>
      </div>
      <ul className="mt-2 flex flex-col gap-2.5">
        {levels.map((l) => <Card key={l.level} lv={l} status={statusOf(view, l.level)} fight={fightAt(view, l.level)} onOpen={() => onOpen(l)} />)}
      </ul>
    </section>
  );
}

function Stamp({ big }: { big?: boolean }) {
  return (
    <span aria-hidden className="absolute -bottom-1 -left-1 -rotate-[8deg] rounded-md border-[3px] border-[#e0264b] bg-white/90 px-1.5 font-game tracking-[0.04em] text-[#e0264b]"
      style={{ fontSize: big ? 15 : 12, lineHeight: big ? "20px" : "16px" }}>BEATEN</span>
  );
}

function Card({ lv, status, fight, onOpen }: { lv: Level; status: MapStatus; fight: FightView | null; onOpen: () => void }) {
  const ab = abilityFor(lv.level);
  const boss = lv.boss;
  const art = boss ? 96 : 66;
  const tag = status === "beaten" ? { t: "Beaten", bg: "#2f9a52", fg: "#fff" } : status === "current" ? { t: fight ? "Fighting now" : "Up next", bg: "#ff7a2f", fg: "#fff" } : { t: "Up ahead", bg: "#5b4a6b", fg: "#fff" };
  return (
    <li className="mx-4">
      <button onClick={onOpen} aria-label={`Level ${lv.level}, ${lv.name}${boss ? ", boss" : ""}: ${tag.t.toLowerCase()}. Open its page.`}
        className="g-btn flex w-full items-start gap-3 rounded-[20px] px-3 py-3 text-left text-g-text"
        style={{ background: status === "current" || boss ? "var(--g-soft-yellow)" : "var(--g-panel)", borderColor: status === "current" ? "#ffc93c" : undefined, outline: status === "current" ? "3px solid #2b1d3a" : undefined }}>
        <span className="relative shrink-0">
          {boss ? <Crown className="absolute -top-4 left-1/2 z-[1] h-6 w-8 -translate-x-1/2" /> : null}
          <span className="grid place-items-center overflow-hidden rounded-2xl border-[3px] border-[#2b1d3a]" style={{ width: art + 8, height: art + 8, background: CARD_BG[status] }}>
            <img src={portrait(lv.slug)} alt="" loading="lazy" decoding="async" style={{ width: art, height: art }} />
          </span>
          {status === "beaten" ? <Stamp big={boss} /> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span className="text-[13px] font-black text-g-mute">Lv {lv.level}</span>
            <span className="font-game text-[21px] leading-tight">{lv.name}</span>
            {boss ? <span className="rounded-md border-2 border-[#2b1d3a] bg-g-yellow px-1.5 font-game text-[12px] leading-[18px] text-[#2b1d3a]">{lv.level === 60 ? "FINAL BOSS" : "BOSS"}</span> : null}
            <span className="ml-auto rounded-full border-2 border-[#2b1d3a] px-2 text-[12px] leading-[20px] font-black" style={{ background: tag.bg, color: tag.fg }}>{status === "locked" ? `Up ahead · Level ${lv.level}` : tag.t}</span>
          </span>
          <span className="text-[13px] font-extrabold text-g-mute">HP <b className="text-g-text">{lv.hp}</b> · Deadline <b className="text-g-text">{lv.days} days</b></span>
          <span className="text-[13px] leading-snug font-extrabold"><b className="font-black">{ab.name}:</b> {ab.text}</span>
          {fight ? (
            <>
              <span className="text-[13px] font-black text-[#c2410c]">Fighting now: {hpText(hpLeft(fight), fight.max, "/")} · {countdown(fight.deadlineOn, new Date()).big}</span>
              <HpBar label={`${fight.name} hit points`} max={fight.max} value={hpLeft(fight)} fill="var(--g-orange)" className="mt-0.5 h-2 !border-2" gloss={false} />
            </>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function MonsterSheet({ lv, view, onClose }: { lv: Level | null; view: GameView | undefined; onClose: () => void }) {
  const status = lv ? statusOf(view, lv.level) : "locked";
  const fight = lv ? fightAt(view, lv.level) : null;
  const ab = lv ? abilityFor(lv.level) : null;
  const m = lv ? view?.map[lv.level - 1] : undefined;
  return (
    <Sheet skin="game" open={!!lv} onOpenChange={(o) => { if (!o) onClose(); }} title={lv?.name ?? ""}
      lead={lv ? <span className="rounded-lg border-2 border-g-line bg-g-yellow px-1.5 font-game text-[13px] text-[#2b1d3a]">Lv {lv.level}</span> : undefined}>
      {lv && ab ? (
        <div className="pb-5">
          <div className="relative mx-auto grid h-[220px] place-items-center overflow-hidden rounded-[22px] border-[3px] border-g-line" style={{ background: worldMap(lv.world).banner }}>
            <img src={portrait(lv.slug)} alt={lv.name} className="g-anim-bob h-[200px] w-[200px]" />
            {status === "beaten" ? <span className="absolute bottom-3 left-3"><span className="relative block"><Stamp big /></span></span> : null}
          </div>
          <p className="mt-1.5 text-[12px] font-black tracking-[0.06em]" style={{ color: worldMap(lv.world).ink }}>WORLD {lv.world} · {lv.worldName.toUpperCase()}{lv.boss ? " · BOSS" : ""}</p>
          <p className="mt-1 text-[17px] leading-snug font-extrabold italic">"{bioFor(lv.level)}"</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border-[3px] border-g-line bg-g-panel-2 px-3 py-2"><span className="block text-[11px] font-black tracking-[0.06em] text-g-mute">HP</span><span className="font-game text-[24px]">{fight ? hpText(hpLeft(fight), fight.max) : lv.hp}</span></div>
            <div className="rounded-2xl border-[3px] border-g-line bg-g-panel-2 px-3 py-2"><span className="block text-[11px] font-black tracking-[0.06em] text-g-mute">DEADLINE</span><span className="font-game text-[24px]">{lv.days} days</span></div>
          </div>
          <div className="mt-2 rounded-2xl border-[3px] border-g-line bg-g-soft-yellow px-3 py-2">
            <span className="block font-game text-[18px]">{ab.name}</span>
            <span className="text-[15px] leading-snug font-bold">{ab.text}</span>
          </div>
          <p className="mt-2 rounded-xl border-2 border-g-line px-3 py-1.5 text-[14px] font-extrabold" style={{ background: status === "beaten" ? "var(--g-soft-green)" : status === "current" ? "var(--g-soft-yellow)" : "var(--g-panel-2)" }}>
            {fight ? `Fighting now: ${hpLeft(fight)} HP to go${fight.bonus ? ` (${fight.bonus} of it bonus HP)` : ""}, due ${shortDate(fight.deadlineOn)}.`
              : status === "current" ? "Up next: it waits until you start it (battle screen → Start the next fight)."
              : status === "beaten" ? `Beaten in Run #${view?.run?.number}${m?.bestPoints ? ` for ${m.bestPoints.toLocaleString("en-US")} points` : ""}.`
              : `Up ahead · Level ${lv.level}. You'll meet it after ${lv.level > 1 ? LEVELS[lv.level - 2].name : "starting a run"}.`}
          </p>
          {fight ? <a href="#/game/battle" className="g-btn mt-3 flex h-12 items-center justify-center rounded-2xl bg-g-yellow font-game text-xl">Fight {lv.name}</a>
            : status === "current" ? <a href="#/game/choose" className="g-btn mt-3 flex h-12 items-center justify-center rounded-2xl bg-g-green font-game text-xl">Start {lv.name}</a> : null}
        </div>
      ) : null}
    </Sheet>
  );
}
