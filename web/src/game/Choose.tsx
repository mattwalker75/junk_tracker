/**
 * Choose your fight (mockup MonChoose): the monster just beaten, the next one with its HP and
 * ability, the three deadline cards (Steady ×1, Bold ×1.5 one day less, Daredevil ×2 two days less)
 * with what a day takes, the plan for the pick, a Veggie Shield to bring, and Fight!. The bet can
 * change until the first attack lands or the fight's first day ends; after that the screen says so.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { abilityFor, levelInfo } from "../../../shared/game";
import type { Bet } from "../../../shared/game/types";
import { cx } from "../components/ui";
import { api } from "../lib/api";
import { nowTime } from "../lib/dates";
import { go } from "../lib/route";
import { Ability, Flame, Potion, Shield, Star, Wind } from "./icons";
import { betPlan, dueText, hpLeft, shortDate } from "./logic";
import { GameBg, GameMenu, GameNote, Hearts, HpBar, HpNumbers } from "./parts";
import { applyResult, useGame } from "./state";

const fmt = (n: number) => n.toLocaleString("en-US");
const CARD: Record<string, { fill: string; tint: string; ring: string; note: string }> = {
  "1": { fill: "#7bd36b", tint: "#e9f9e2", ring: "#3f8f4a", note: "Room for a rest day, and no extra risk." },
  "1.5": { fill: "#6ec6ff", tint: "#e3f4ff", ring: "#2a7fbf", note: "A little spicier: 1.5× points for one day less." },
  "2": { fill: "#ff4d6d", tint: "#ffe3e8", ring: "#e2324f", note: "Double points, no slack: miss it and lose a heart." },
};

export function Choose() {
  const qc = useQueryClient();
  const { today, view, error } = useGame();
  const [pick, setPick] = useState<Bet | null>(null);
  const [bring, setBring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = view?.run, fight = view?.fight;

  const header = (
    <header className="relative z-30 flex items-center gap-2 border-b-[3px] border-[#1a1024] bg-[#2b1d3a]/95 px-3 py-2.5">
      <a href="#/game/battle" aria-label="Back to the battle" className="g-btn grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff7e6] text-[#2b1d3a]">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
      </a>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-game text-[10px] tracking-[0.1em] whitespace-nowrap text-[#c8b6e6]">CALORIE CRUSHER</span>
        <h1 className="g-stroke truncate font-game text-xl leading-none font-normal">Choose your fight</h1>
      </div>
      {run ? (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <Hearts hearts={run.hearts} className="[&_svg]:h-4 [&_svg]:w-[18px]" />
          <span className="flex items-center gap-1 rounded-[10px] border-2 border-g-yellow bg-[#2b1d3a] px-1.5" aria-label={`Score ${fmt(run.liveScore)}`}>
            <Star className="size-3.5" /><span className="font-game text-sm leading-tight text-g-yellow">{fmt(run.liveScore)}</span>
          </span>
        </div>
      ) : null}
      <GameMenu />
    </header>
  );
  const bg = <GameBg background="linear-gradient(180deg, #f6a25c 0%, #ec7a3e 34%, #d9562f 62%, #a63a2a 100%)" />;

  if (error) return <main className="relative min-h-dvh">{bg}{header}<GameNote title="Hmm, that didn't load">{error.message}</GameNote></main>;
  if (!view) return <main className="relative min-h-dvh">{bg}{header}</main>;
  if (!run?.active || (!fight && !view.next)) {
    return (
      <main className="relative min-h-dvh">{bg}{header}
        <GameNote title="No fight going" action={<a href="#/game/start" className="g-btn flex h-12 items-center justify-center rounded-2xl bg-g-yellow font-game text-xl">Start a run</a>}>Start a run first: Crumbs is waiting.</GameNote>
      </main>
    );
  }

  // between fights (Matt, Nov 14 2026): the monster up next, started by Fight!
  const waiting = fight ? null : view.next;
  const subj = fight ?? (() => { const n = view.next!; return { ...n, max: n.hp, bonus: 0, bet: 1 as Bet, deadlineOn: n.betOptions[0].deadlineOn, powerUpsAllowed: !abilityFor(n.level).noPowerUps }; })();
  // the monster just beaten, when this fight opened (or opens) right after its KO
  const ko = subj.attempt === 1 ? view.events.find((e) => e.kind === "ko" && Number(e.data.level) === subj.level - 1) : undefined;
  const plans = subj.betOptions.map((o) => betPlan(o, subj, today, run.hardcore));
  const chosen = pick ?? subj.bet;
  const plan = plans.find((p) => p.bet === chosen) ?? plans[0];
  const canBring = subj.powerUpsAllowed && run.shields > 0 && !run.shieldArmed;

  const fightNow = async () => {
    setBusy(true); setProblem(null);
    try {
      let open = !!fight;
      if (waiting) open = !!applyResult(qc, today, await api.gameNext(chosen, today, nowTime())).view.fight; // today's entries may knock it out at once
      else if (chosen !== subj.bet) applyResult(qc, today, await api.gameBet(chosen, today, nowTime()));
      if (bring && canBring && open) applyResult(qc, today, await api.gamePowerUp("shield", today, nowTime()));
      go("/game/battle");
    } catch (e) { setProblem((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <main className="relative flex min-h-dvh flex-col gap-2.5 pb-5">
      {bg}{header}

      {ko ? (
        <div className="g-panel mx-4 flex items-center gap-2.5 bg-[#d7f5c8] py-1.5 pr-3 pl-1.5 text-[#2b1d3a]">
          <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-g-line bg-[#ffd2b0]">
            <img src={`/monsters/${levelInfo(subj.level - 1).slug}.svg`} alt="" className="mt-1.5 w-12" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="font-game text-[17px]">{String(ko.data.name)} beaten!</span>
            <span className="truncate text-xs font-extrabold text-[#2f5a2a]">{shortDate(ko.day)} · {fmt(Number(ko.data.damage))} damage{Number(ko.data.daysLeft) ? ` · ${ko.data.daysLeft} ${Number(ko.data.daysLeft) === 1 ? "day" : "days"} early` : ""}</span>
          </div>
          <span className="g-stroke-thin shrink-0 font-game text-xl" style={{ color: "#ffc93c" }}>+{fmt(Number(ko.data.points))}</span>
        </div>
      ) : null}

      {/* the monster */}
      <section aria-label={`Next monster: ${subj.name}`} className="relative mx-4 mt-2 flex items-center gap-1 rounded-[20px] border-[3px] border-g-line pt-4 pb-2.5 pr-3 pl-1 text-[#2b1d3a] shadow-[0_4px_0_#1a1024]"
        style={{ background: "radial-gradient(90% 90% at 25% 60%, #ffe3a1 0%, #fff7e6 60%)" }}>
        <span className="absolute -top-3 left-3 rounded-full bg-[#2b1d3a] px-2.5 py-0.5 font-game text-[13px] tracking-[0.04em] text-g-yellow">{waiting ? (waiting.rematch ? "REMATCH" : "UP NEXT") : ko ? "NEXT UP" : "THIS FIGHT"} · LEVEL {subj.level} OF 60{subj.boss ? " · BOSS" : ""}</span>
        <div className="g-anim-bob shrink-0"><img src={`/monsters/${subj.slug}.svg`} alt={subj.name} className="w-[120px]" /></div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-col">
            <span className="truncate text-[11px] font-black tracking-[0.04em] text-[#c2410c]">WORLD {subj.world} · {subj.worldName.toUpperCase()}</span>
            <h2 className="m-0 font-game text-[27px] leading-none font-normal">{subj.name}</h2>
          </div>
          <div className="flex flex-col gap-[3px]">
            <div className="flex justify-between gap-1 text-xs font-black"><span>HP</span><HpNumbers hp={subj.hp} max={subj.max} bonus={subj.bonus} /></div>
            <HpBar label={`${subj.name} hit points`} max={subj.max} value={hpLeft(subj)} fill="var(--g-orange)" className="h-2.5" gloss={false} />
          </div>
          <div className="flex flex-col gap-px rounded-xl border-2 border-[#2b1d3a] bg-white px-2 py-1.5">
            <span className="flex items-center gap-1 font-game text-sm text-[#c27a00]"><Ability className="size-4" />{subj.ability.name}</span>
            <span className="text-xs leading-tight">{subj.ability.text}</span>
          </div>
        </div>
      </section>

      {plans.length && plan ? (
        <>
          <section aria-labelledby="cf-dl" className="relative mx-4 mt-0.5 flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 id="cf-dl" className="g-stroke g-shadow-text m-0 font-game text-[22px] font-normal">Pick your deadline</h2>
              <span className="text-xs font-black text-[#fff7e6]">{waiting?.partDay ? "Counts from tomorrow" : "Today is day 1"}</span>
            </div>
            <div role="radiogroup" aria-label="Deadline" className="flex flex-col gap-2">
              {plans.map((p) => {
                const on = p.bet === chosen;
                const c = CARD[String(p.bet)];
                return (
                  <button key={p.bet} role="radio" aria-checked={on} onClick={() => setPick(p.bet)}
                    className={cx("flex w-full items-center gap-2.5 rounded-[18px] border-g-line py-[7px] pr-3 pl-2 text-left text-[#2b1d3a] transition", on ? "-translate-y-0.5 border-4" : "my-px border-[3px]")}
                    style={{ background: on ? c.tint : "#fff7e6", boxShadow: on ? `0 5px 0 #1a1024, 0 0 0 3px ${c.ring}` : "0 4px 0 #1a1024" }}>
                    <span className="relative flex size-[62px] shrink-0 flex-col items-center justify-center rounded-2xl border-[3px] border-g-line leading-[0.9]" style={{ background: c.fill }}>
                      {p.bet === 2 ? <Flame className="g-anim-pulse absolute -top-5 -right-3.5 h-9 w-[30px]" /> : null}
                      <span className="g-stroke font-game text-[30px]">{p.days}</span>
                      <span className={cx("text-[11px] font-black", p.bet === 2 && "text-white")}>{p.days === 1 ? "day" : "days"}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-1.5"><span className="font-game text-[19px]">{p.label}</span><span className={cx("rounded-full px-1.5 text-xs font-black", p.bet === 2 ? "border-2 border-[#2b1d3a] bg-g-red text-white" : p.bet === 1.5 ? "bg-[#2b1d3a] text-g-yellow" : "bg-[#2b1d3a] text-white")}>×{p.bet}</span></span>
                      <span className="text-xs font-black text-[#5b4a6b]">Due {dueText(p.deadlineOn)}</span>
                      <span className="text-xs leading-tight">≈ <b>{p.perDay} damage a day</b> ≈ {p.example}</span>
                    </span>
                    <span className="grid size-[26px] shrink-0 place-items-center rounded-full border-[3px] border-[#2b1d3a] bg-white">
                      <span className="size-3 rounded-full" style={{ background: on ? c.ring : "transparent" }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-live="polite" aria-label="Your plan" className="relative mx-4 mt-0.5 flex flex-col gap-1.5 rounded-[18px] border-[3px] border-[#1a1024] bg-[#2b1d3a] px-3 py-2.5 text-[#fff7e6] shadow-[0_4px_0_#1a1024]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-game text-[17px] text-g-yellow">Your plan · {plan.label} ×{plan.bet}</span>
              <span className="text-xs font-black whitespace-nowrap text-[#c8b6e6]">{plan.days} {plan.days === 1 ? "day" : "days"} · due {shortDate(plan.deadlineOn)}</span>
            </div>
            <div className="flex items-end gap-2.5">
              <span className="font-game text-[44px] leading-[0.9]" style={{ color: "#fff", WebkitTextStroke: "2px #1a1024", paintOrder: "stroke fill" }}>{plan.perDay}</span>
              <span className="pb-0.5 text-[13px] leading-tight font-extrabold">damage a day = {plan.perDay} min, or {fmt(plan.perDay * 10)} cal, or mix: {plan.example}.</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {([["WORTH", fmt(plan.worth), true], ["SPEED BONUS", `+${plan.speedPerDay}/day`, false], ["FLAWLESS", `+${plan.flawless}`, false]] as const).map(([k, v, gold]) => (
                <div key={k} className="flex flex-col items-center rounded-[10px] bg-[#3d2b52] px-1.5 py-1">
                  <span className="text-[10px] font-black tracking-[0.06em] text-[#c8b6e6]">{k}</span>
                  <span className={cx("font-game text-[19px]", gold ? "text-g-yellow" : "text-white")}>{v}</span>
                </div>
              ))}
            </div>
            <span className="text-xs leading-snug font-bold text-[#e3d6f2]">{CARD[String(plan.bet)].note}</span>
          </section>
        </>
      ) : (
        <GameNote title="The deadline is set">The bet can only change before your first attack lands, on the fight's first day. This fight runs to the {dueText(subj.deadlineOn)}, at ×{subj.bet}.</GameNote>
      )}

      {/* power-ups */}
      <section aria-labelledby="cf-pu" className="relative mx-4 flex flex-col gap-1.5 rounded-[18px] border-[3px] border-g-line bg-[#fff7e6] px-2.5 py-2 text-[#2b1d3a] shadow-[0_4px_0_#1a1024]">
        <div className="flex items-baseline justify-between">
          <h2 id="cf-pu" className="m-0 font-game text-[17px] font-normal">Bring a power-up</h2>
          <span className="text-[11px] font-extrabold text-[#5b4a6b]">one use each</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {canBring || run.shieldArmed ? (
            <button aria-pressed={bring || run.shieldArmed} disabled={run.shieldArmed} onClick={() => setBring(!bring)}
              className={cx("flex flex-col items-center gap-0.5 rounded-[14px] border-[3px] border-[#2b1d3a] px-1 py-1.5 text-center shadow-[0_3px_0_#1a1024]", bring || run.shieldArmed ? "bg-[#d7f5c8]" : "bg-white")}>
              <Shield className="h-7 w-[26px]" />
              <span className="text-xs leading-tight font-black">Veggie Shield ×{run.shields}</span>
              <span className={cx("text-[11px] font-black", bring || run.shieldArmed ? "text-[#2f7a2a]" : "text-[#5b4a6b]")}>{run.shieldArmed ? "ALREADY UP ✓" : bring ? "BRINGING ✓" : "Tap to bring"}</span>
            </button>
          ) : (
            <Locked icon={<Shield className="h-7 w-[26px]" />} name={`Veggie Shield ×${run.shields}`} how={subj.powerUpsAllowed ? "earn: 3 clean days" : "not in this fight"} />
          )}
          <Locked icon={<Potion className="h-6 w-5" />} name={`Water Potion ×${run.potions}`} how={run.potions ? "use it in the battle" : "earn: 60+ min workout"} />
          <Locked icon={<Wind className="size-[22px]" />} name={`Second Wind ×${run.winds}`} how={run.winds ? "use it in the battle" : "earn: a boss kill"} />
        </div>
      </section>

      {problem ? <p role="alert" className="g-panel mx-4 bg-g-soft-red px-3 py-2 text-sm font-extrabold">{problem}</p> : null}
      <button onClick={() => void fightNow()} disabled={busy}
        className="g-btn relative mx-4 mt-0.5 flex min-h-[68px] flex-col items-center justify-center rounded-[22px] border-4 p-1.5 text-white shadow-[0_6px_0_#1a1024]"
        style={{ background: "linear-gradient(180deg, #ff7088 0%, #ff4d6d 55%, #e2324f 100%)" }}>
        <span className="absolute inset-x-3.5 top-1 h-1.5 rounded-full bg-white opacity-35" />
        <span className="g-stroke font-game text-[32px] leading-none tracking-[0.02em]" style={{ WebkitTextStroke: "2.5px #2b1d3a" }}>{waiting ? "Start the fight!" : "Fight!"}</span>
        <span className="text-[13px] font-black text-[#fff0f3]">{plan ? `${plan.days} ${plan.days === 1 ? "day" : "days"} · due ${shortDate(plan.deadlineOn)} · ×${plan.bet}` : `due ${shortDate(subj.deadlineOn)} · ×${subj.bet}`}{bring && canBring ? " · Veggie Shield" : ""}</span>
      </button>
    </main>
  );
}

function Locked({ icon, name, how }: { icon: ReactNode; name: string; how: string }) {
  return (
    <div aria-disabled="true" className="flex flex-col items-center gap-0.5 rounded-[14px] border-2 border-dashed border-[#b9a991] px-1 py-1.5 text-center">
      {icon}
      <span className="text-xs leading-tight font-black text-[#8a7a99]">{name}</span>
      <span className="text-[10px] leading-tight font-extrabold text-[#8a7a99]">{how}</span>
    </div>
  );
}
