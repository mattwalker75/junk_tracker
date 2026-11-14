/**
 * How to crush (mockup MonScoring): every rule and number on two tabs, The fight and Points &
 * power-ups. The numbers come from the shared engine's constants (engine.ts, score.ts, types.ts,
 * levels.ts), so this page can't drift from what the game does. The examples use the monster you
 * are fighting (or Crumbs before a run).
 */
import { useState, type ReactNode } from "react";
import {
  abilityFor, betDays, BONUS_SHARE, bonusMaxOf, CRIT, HEAL, LEVELS, levelInfo, MAX_HEARTS, MAX_POWER_UPS, POINTS, POTION_DAMAGE, POTION_MINUTES, rawDamage,
  SHIELD_STREAK, START_HEARTS, WEEK_ACTIVE_DAYS, wonPoints, type Bet,
} from "../../../shared/game";
import { cx } from "../components/ui";
import { Burger, Cookie, HeartEmpty, HeartFull, IconCrit, Pizza, Potion, Shield, Skull, Sword, Wind, ShieldBlue } from "./icons";
import { GameBg, GameHeader, HpBar } from "./parts";
import { useGame } from "./state";

const fmt = (n: number) => n.toLocaleString("en-US");
type Tab = "fight" | "points";

export function How() {
  const { view } = useGame();
  const [tab, setTab] = useState<Tab>("fight");
  const lv = levelInfo(view?.fight?.level ?? 1);
  const run = view?.run?.active ? view.run : null;
  return (
    <main className="relative min-h-dvh pb-8">
      <GameBg background="linear-gradient(180deg, #6ec6ff 0%, #8fd3ff 40%, #bfe8c8 100%)" />
      <GameHeader kicker="CRAVING CRUSHER · RULES" title="How to crush" back={{ href: "#/game", label: "Back to the title screen" }} />
      <div role="tablist" aria-label="Rules" className="mx-4 mt-3 grid grid-cols-2 gap-1 rounded-[18px] bg-[#2b1d3a] p-1.5">
        {([["fight", "The fight"], ["points", "Points & power-ups"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cx("h-11 rounded-xl font-game text-[16px]", tab === id ? "bg-g-yellow text-[#2b1d3a] shadow-[0_3px_0_#0e0817]" : "text-[#d9c9f0]")}>{label}</button>
        ))}
      </div>
      {tab === "fight" ? <Fight example={lv.level} /> : <PointsTab example={lv.level} shields={run?.shields} potions={run?.potions} winds={run?.winds} />}
    </main>
  );
}

const Card = ({ title, note, children, className }: { title: string; note?: string; children: ReactNode; className?: string }) => (
  <section className={cx("g-panel mx-4 mt-3 rounded-[22px] px-4 py-3", className)}>
    <div className="flex items-baseline justify-between gap-2"><h2 className="font-game text-[23px] font-normal">{title}</h2>{note ? <span className="text-right text-[12px] font-black text-g-mute">{note}</span> : null}</div>
    {children}
  </section>
);

function Rule({ icon, title, children, value, last }: { icon: ReactNode; title: string; children: ReactNode; value?: string; last?: boolean }) {
  return (
    <div className={cx("flex items-center gap-3 py-2", !last && "border-b-2 border-dashed border-g-dash")}>
      <span className="shrink-0">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col leading-snug"><b className="font-game text-[18px] font-normal">{title}</b><span className="text-[14px] font-bold text-g-mute">{children}</span></span>
      {value ? <span className="shrink-0 font-game text-[22px] text-g-text">{value}</span> : null}
    </div>
  );
}

const Disc = ({ bg, children }: { bg: string; children: ReactNode }) => <span className="grid size-11 place-items-center rounded-full border-[3px] border-[#2b1d3a]" style={{ background: bg }}>{children}</span>;

function Fight({ example }: { example: number }) {
  const lv = levelInfo(example);
  const ab = abilityFor(example);
  const walk = { minutes: 45, calories: 210 };
  const bets: Bet[] = [1, 1.5, 2];
  return (
    <>
      <Card title="Attacks" note="from your real log · no cap">
        <Rule icon={<Disc bg="#7bd36b"><Sword className="size-7" /></Disc>} title="Workout" value={`−${rawDamage(walk)}`}>
          <b className="text-g-text">minutes + calories ÷ 10</b>, rounded. More calories, more damage. No calories? Just minutes.
          <span className="block font-black text-[#2f9a2a]">A walk: {walk.minutes} min + {walk.calories} cal = {walk.minutes} + {Math.round(walk.calories / 10)} = {rawDamage(walk)}</span>
        </Rule>
        <Rule icon={<IconCrit className="size-11" />} title="Clean-day crit" value={`−${CRIT}`}>No splurge all day: {CRIT} damage at midnight.</Rule>
        <Rule icon={<Disc bg="#6ec6ff"><span className="font-game text-[15px]">×2</span></Disc>} title="Comeback ×2" value="×2" last>The first workout after a day with no activity does double.</Rule>
      </Card>
      <section className="mx-4 mt-3 flex items-center gap-3 rounded-[22px] border-[3px] border-g-line bg-g-yellow px-3.5 py-3 text-[#2b1d3a] shadow-[0_4px_0_var(--g-line)]">
        <span className="grid size-[60px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-[#2b1d3a] bg-[#ff9a5c]"><img src={`/monsters/${lv.slug}.svg`} alt="" className="mt-1 size-[58px]" /></span>
        <span className="flex flex-col leading-snug">
          <b className="font-game text-[21px] font-normal">So close!</b>
          <span className="text-[14px] font-extrabold">10 min = 100 cal = 10 damage. You always see what finishes it: <span className="text-[#7a2a00]">92 HP left means 92 more minutes, or 920 calories, or mix them.</span></span>
        </span>
      </section>
      <Card title="Heals" note="junk feeds the monster">
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {([["Snack", HEAL.snack, <Cookie key="c" className="size-10" />, "#ffe9d6"], ["Meal", HEAL.meal, <Burger key="b" className="size-10" />, "#ffe0c8"], ["Feast", HEAL.feast, <Pizza key="p" className="size-10" />, "#ffd6d0"]] as const).map(([name, n, icon, bg]) => (
            <div key={name} className="flex flex-col items-center rounded-2xl border-[3px] border-[#2b1d3a] py-2 text-[#2b1d3a]" style={{ background: bg }}>
              {icon}<b className="font-game text-[17px] font-normal">{name}</b><span className="text-[16px] font-black text-[#c2410c]">+{n} HP</span>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-2xl border-[3px] border-g-line bg-g-soft-green px-3 py-2">
          <b className="font-game text-[17px] font-normal">Planned treat heals half</b>
          <span className="block text-[14px] font-bold text-g-mute">A planned Feast heals +{Math.ceil(HEAL.feast / 2)}, not +{HEAL.feast}. Halves round up.</span>
        </div>
        <div className="mt-2 rounded-2xl border-[3px] border-g-line bg-g-panel-2 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <b className="font-game text-[17px] font-normal">Full? It gets bonus HP</b>
            <HpBar label="Example: full HP plus 20 bonus HP" max={100} value={120} className="h-2.5 w-20 shrink-0" gloss={false} />
          </div>
          <span className="block text-[14px] font-bold text-g-mute">A splurge when it's at full HP still counts: what doesn't fit goes on as violet <b className="text-g-text">bonus HP</b>, up to {Math.round(BONUS_SHARE * 100)}% of its max ({bonusMaxOf(lv.hp)} for {lv.name}). Workouts knock the bonus off first.</span>
        </div>
        <p className="mt-2 text-[13px] font-bold text-g-mute">Abilities change these. {lv.name}'s <b className="text-g-text">{ab.name}</b>: {ab.text}</p>
        <p className="mt-1 text-[13px] font-bold text-g-mute">A splurge with no time counts as the worst time for monsters that care about the clock.</p>
      </Card>
      <Card title="Deadlines" note="pick on “Choose your fight”">
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {bets.map((b) => {
            const days = lv.days + (ab.extraDays ?? 0) - betDays(b);
            return (
              <div key={b} className="flex flex-col items-center rounded-2xl border-[3px] border-[#2b1d3a] px-1 py-2 text-center"
                style={{ background: b === 2 ? "#ff4d6d" : b === 1.5 ? "#ffe9a8" : "#ffffff", color: b === 2 ? "#fff" : "#2b1d3a" }}>
                <span className="font-game text-[26px] leading-none">×{b}</span>
                <b className="text-[14px] font-black">{b === 1 ? "Steady" : b === 1.5 ? "Bold · −1 day" : "Daredevil · −2"}</b>
                <span className="text-[12px] font-extrabold opacity-80">{lv.name}: {days} d</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[13px] font-bold text-g-mute">The first day counts as day 1; a fight that starts after a knockout gets the rest of that day free. The deadline ends at midnight, at the end of its last day. The bet locks at your first hit or once the first day is over.</p>
      </Card>
      <Card title="Hearts">
        <div className="mt-1 flex items-center gap-1" aria-hidden>{Array.from({ length: MAX_HEARTS }, (_, i) => i < START_HEARTS ? <HeartFull key={i} className="h-6 w-7" /> : <HeartEmpty key={i} className="h-6 w-7" />)}</div>
        <dl className="mt-1.5 grid grid-cols-[64px_1fr] gap-x-2 gap-y-1.5 text-[14px] leading-snug font-bold">
          <dt className="font-black text-[#e0264b]">Lose 1</dt><dd>The deadline passes with HP left: it <b>strikes</b>. Rematch at full HP. Junk never costs hearts.</dd>
          <dt className="font-black text-[#2f9a2a]">Earn 1</dt><dd>Beat a world boss, or have a week with {WEEK_ACTIVE_DAYS}+ active days. Start with {START_HEARTS}, hold up to {MAX_HEARTS}.</dd>
          <dt className="font-black">At 0</dt><dd>Depends on the run's mode, below.</dd>
        </dl>
      </Card>
      <Card title="Normal or Hardcore" note="picked when a run starts">
        <div className="mt-1.5 grid grid-cols-2 gap-2 text-[13px] leading-snug font-bold">
          <div className="rounded-2xl border-[3px] border-[#2b1d3a] bg-[#e8f6ff] px-2.5 py-2 text-[#2b1d3a]">
            <span className="flex items-center gap-1 font-game text-[17px]"><ShieldBlue className="size-4" />Normal</span>
            At 0 hearts you're knocked back to the first level of your world with {START_HEARTS} hearts, −{POINTS.knockback} points. The run goes on.
          </div>
          <div className="rounded-2xl border-[3px] border-[#2b1d3a] bg-[#ffe3e8] px-2.5 py-2 text-[#2b1d3a]">
            <span className="flex items-center gap-1 font-game text-[17px]"><Skull className="size-4" />Hardcore</span>
            At 0 hearts the run is over and the next starts at level 1. ×{POINTS.hardcore} on all points and a skull in the Hall.
          </div>
        </div>
        <p className="mt-2 text-[13px] font-bold text-g-mute">A Hardcore run can switch to Normal at any time from the map (tap its badge). That is one way: Normal can't become Hardcore.</p>
      </Card>
      <Card title="The road" note={`${LEVELS.length} levels · 6 worlds`}>
        <p className="mt-1 text-[14px] leading-snug font-bold">Every level is its own monster: nine, then a boss at level 10 of each world. HP grows from {LEVELS[0].hp} to {LEVELS[LEVELS.length - 1].hp}; deadlines from {LEVELS[0].days} to {LEVELS[LEVELS.length - 1].days} days. Beat level 60 and the run is complete.</p>
      </Card>
    </>
  );
}

function PointsTab({ example, shields, potions, winds }: { example: number; shields?: number; potions?: number; winds?: number }) {
  const [open, setOpen] = useState<string | null>("damage");
  const [pu, setPu] = useState<"shield" | "potion" | "wind">("shield");
  const lv = levelInfo(example);
  // the worked example: beating it with all its HP as damage and 2 days left, on Steady
  const ex = wonPoints({ damage: lv.hp, max: lv.hp, koDay: "2026-01-01", deadlineOn: "2026-01-03", flawless: false, boss: lv.boss, bet: 1, hardcore: false });
  const rows: { id: string; label: string; value: string; more: string }[] = [
    { id: "damage", label: "Damage dealt", value: "1 pt per damage", more: "Every point of damage is a point: workouts, clean-day crits and potions all count, the whole fight." },
    { id: "kill", label: "Kill", value: "monster's max HP", more: `Knock it out and you get its max HP on top: ${lv.name} is worth ${lv.hp}.` },
    { id: "speed", label: "Speed bonus", value: `+${POINTS.speedPerDay} / full day left`, more: `Every full day left on the deadline when it goes down is +${POINTS.speedPerDay}.` },
    { id: "bet", label: "Deadline bet", value: "×1.5 or ×2", more: "Bet on a shorter deadline on Choose your fight: Bold (one day less) ×1.5, Daredevil (two days less) ×2, on that monster's whole total." },
    { id: "flawless", label: "Flawless", value: `+${POINTS.flawless}`, more: "No heal landed in the whole fight. A heal your Veggie Shield blocked doesn't count against you." },
    { id: "boss", label: "Boss kill", value: `+${POINTS.boss}`, more: "Each world's level 10 is a boss: +500, a heart back and a Second Wind." },
    { id: "log", label: "Honest log", value: `+${POINTS.perLogEntry} each`, more: `Every activity, splurge or weigh-in you log during the run is +${POINTS.perLogEntry}, even a Feast. Logging is always worth it.` },
    { id: "hard", label: "Hardcore", value: `×${POINTS.hardcore}`, more: `While a run is Hardcore, every fight's points are ×${POINTS.hardcore}.` },
    { id: "struck", label: "When it strikes", value: "damage kept", more: "A fight you lose still keeps its damage as points (no bet)." },
    { id: "kb", label: "Knock-back", value: `−${POINTS.knockback}`, more: `On Normal, every knock-back takes off ${POINTS.knockback}.` },
  ];
  const PU = {
    shield: { name: "Veggie Shield", icon: <Shield className="h-12 w-11" />, have: shields, does: "Blocks the next heal. Put it up on Choose your fight or the battle screen; save it for burger night.", earn: `${SHIELD_STREAK} clean days in a row` },
    potion: { name: "Water Potion", icon: <Potion className="h-12 w-10" />, have: potions, does: `+${POTION_DAMAGE} damage in one splash. Save it for the last push before a deadline.`, earn: `one ${POTION_MINUTES}+ min workout` },
    wind: { name: "Second Wind", icon: <Wind className="size-12" />, have: winds, does: "One more day on the deadline, when you need it.", earn: "beating a boss" },
  } as const;
  const p = PU[pu];
  return (
    <>
      <Card title="Points" note="tap a row for more">
        <ul className="mt-1">
          {rows.map((r) => (
            <li key={r.id} className="border-b-2 border-dashed border-g-dash last:border-0">
              <button onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="flex min-h-11 w-full items-center gap-2 py-1.5 text-left">
                <span className="flex-1 text-[16px] font-extrabold">{r.label}</span>
                <span className="text-right text-[14px] font-black text-g-warn">{r.value}</span>
                <svg viewBox="0 0 24 24" className={cx("size-4 shrink-0", open === r.id && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {open === r.id ? <p className="mb-2 rounded-2xl border-[3px] border-g-line bg-g-soft-yellow px-3 py-2 text-[14px] leading-snug font-bold">{r.more}</p> : null}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[#2b1d3a] px-3 py-2.5 text-[#fff7e6]">
          <span className="grid size-[60px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-[#ffc93c] bg-[#ff9a5c]"><img src={`/monsters/${lv.slug}.svg`} alt="" className="mt-1 size-[58px]" /></span>
          <span className="flex flex-col leading-snug">
            <span className="text-[12px] font-black tracking-[0.08em] text-[#ffc93c]">WORKED EXAMPLE</span>
            <span className="text-[14px] font-extrabold">Beat {lv.name} with 2 full days left, on Steady:</span>
            <span className="text-[15px] font-black">{lv.hp} dmg + <span className="whitespace-nowrap text-[#ff9a5c]">{lv.hp} kill</span> + <span className="whitespace-nowrap text-[#6ec6ff]">{2 * POINTS.speedPerDay} speed</span>{lv.boss ? <> + <span className="text-[#7bd36b]">{POINTS.boss} boss</span></> : null} = <span className="font-game text-[24px] text-[#ffc93c]">{fmt(ex)}</span></span>
          </span>
        </div>
      </Card>
      <Card title="Power-ups" note={`hold up to ${MAX_POWER_UPS} each · tap one`}>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {(Object.keys(PU) as (keyof typeof PU)[]).map((k) => (
            <button key={k} onClick={() => setPu(k)} aria-pressed={pu === k}
              className={cx("flex flex-col items-center gap-1 rounded-2xl border-[3px] border-[#2b1d3a] px-1 py-2 text-[#2b1d3a]", pu === k ? "bg-[#ffe9a8] outline-[3px] outline-[#ffc93c] outline-solid" : "bg-white")}>
              {PU[k].icon}<b className="text-center font-game text-[15px] leading-tight font-normal">{PU[k].name}</b>
              {PU[k].have !== undefined ? <span className="rounded-full bg-[#2b1d3a] px-2 text-[12px] font-black text-[#7bd36b]">×{PU[k].have}</span> : null}
            </button>
          ))}
        </div>
        <div className="mt-2 rounded-2xl border-[3px] border-g-line bg-g-panel-2 px-3 py-2">
          <div className="flex items-baseline justify-between"><b className="font-game text-[19px] font-normal">{p.name}</b>{p.have !== undefined ? <span className="text-[13px] font-black text-g-pink">You have {p.have}</span> : null}</div>
          <p className="text-[14px] leading-snug font-bold">{p.does}</p>
          <p className="mt-1 text-[12px] font-black tracking-[0.06em] text-g-mute">HOW TO EARN · {p.earn.toUpperCase()}</p>
        </div>
        <p className="mt-2 text-[13px] font-bold text-g-mute">One use each. Some monsters (Bacon Bandit) block them for a fight; you keep them for the next.</p>
      </Card>
    </>
  );
}
