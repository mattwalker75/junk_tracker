/**
 * The live panels at the top of the game-skinned sheets (mockups MonLogActivity, MonLogSplurge):
 * the monster, its HP bar with what this entry would do, the sum, and one plain sentence. The
 * numbers come from logic.ts, which runs the shared engine's preview().
 */
import { cx } from "../components/ui";
import type { AttackPanel, HealPanel } from "./logic";
import { Monster } from "./parts";

function Thumb({ slug, name, pose, motion }: { slug: string; name: string; pose: "normal" | "hurt"; motion: "idle" | "still" | "heal" }) {
  return (
    <div className="relative size-[88px] shrink-0 overflow-hidden rounded-[22px] border-[3px] border-[#2b1d3a] shadow-[0_3px_0_#2b1d3a]"
      style={{ background: "linear-gradient(180deg, #ff7b45 0%, #ffb35e 60%, #f2b46a 60%, #e08f4c 100%)" }}>
      <div className="absolute inset-x-0 top-1"><Monster slug={slug} name={name} pose={pose} motion={motion} className="w-[82px]" /></div>
    </div>
  );
}

function Bar({ label, max, rest, change, kind }: { label: string; max: number; rest: number; change: number; kind: "hit" | "heal" }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={kind === "hit" ? rest : rest + change}
      className="relative box-content h-[18px] overflow-hidden rounded-full border-[3px] border-[#2b1d3a] bg-[#3a2238]">
      <div className="absolute inset-y-0 left-0 bg-g-orange transition-[width] duration-500" style={{ width: pct(rest) }} />
      {change > 0 ? (
        <div className="g-anim-blink absolute inset-y-0 transition-[left,width] duration-200"
          style={{ left: pct(rest), width: pct(change), background: kind === "hit" ? "repeating-linear-gradient(135deg, #ffffff 0 4px, #ffc93c 4px 8px)" : "repeating-linear-gradient(135deg, #ff7a95 0 4px, #ff4d6d 4px 8px)" }} />
      ) : null}
      <div className="absolute inset-x-1.5 top-[3px] h-1 rounded bg-white opacity-30" />
    </div>
  );
}

const panelBox = "flex flex-col gap-2 rounded-[20px] border-[3px] border-[#2b1d3a] p-2.5 text-[#2b1d3a] shadow-[0_4px_0_var(--g-line)]";
const panelBg = { background: "linear-gradient(180deg, #ffb877 0%, #ffd9a0 100%)" };
const lineBox = "rounded-[13px] border-[2.5px] border-[#2b1d3a] px-2.5 py-2 text-sm leading-snug font-extrabold text-[#2b1d3a]";

export function AttackPreview({ p, slug }: { p: AttackPanel; slug: string }) {
  const hpLabel = p.state === "short" || p.state === "finish" ? `${p.hpBefore} → ${Math.max(0, p.hpAfter)}` : `${p.hpBefore} / ${p.max}`;
  return (
    <section aria-label="Damage preview" className={panelBox} style={panelBg}>
      <div className="flex items-center gap-2.5">
        <Thumb slug={slug} name={p.name} pose={p.state === "finish" ? "hurt" : "normal"} motion={p.state === "finish" ? "still" : "idle"} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-1.5">
            <span className="g-stroke truncate font-game text-[22px] leading-none">{p.name}</span>
            <span className="shrink-0 text-sm font-black">{hpLabel}</span>
          </div>
          <Bar label={`${p.name} hit points after this workout`} max={p.max} rest={Math.max(0, p.hpAfter)} change={p.state === "short" || p.state === "finish" ? Math.min(p.hpBefore, p.dmg) : 0} kind="hit" />
          <span className="text-xs leading-tight font-extrabold text-[#5b2a10]">{p.formula}</span>
        </div>
      </div>
      <div aria-live="polite" className={cx(lineBox, p.state === "finish" ? "g-anim-pop bg-g-yellow" : p.state === "short" ? "bg-[#ffe9a8]" : "bg-white")}>
        {p.state === "finish" ? (
          <span><b className="mr-1 inline-block -rotate-2 rounded-[9px] border-[2.5px] border-[#2b1d3a] bg-g-red px-1.5 font-game text-[17px] font-normal tracking-[0.02em] text-white" style={{ WebkitTextStroke: "1px #2b1d3a", paintOrder: "stroke fill" }}>FINISHING BLOW!</b>{p.line}</span>
        ) : p.state === "short" ? (
          <span>This hits {p.name} for <b className="font-black">{p.dmg}</b> · {p.short} short. <b className="font-black text-[#b8322c]">{p.short} more min or {(p.short * 10).toLocaleString("en-US")} more cal</b> would finish it!</span>
        ) : <span>{p.line}</span>}
        {p.note ? <span className="mt-1 block text-xs font-bold text-[#5b4a6b]">{p.note}</span> : null}
      </div>
    </section>
  );
}

export function HealPreview({ p, slug }: { p: HealPanel; slug: string }) {
  const healing = p.state === "heal";
  return (
    <section aria-label="Heal preview" className={panelBox} style={panelBg}>
      <div className="flex items-center gap-2.5">
        <Thumb slug={slug} name={p.name} pose="normal" motion={healing ? "heal" : "idle"} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-1.5">
            <span className="g-stroke truncate font-game text-[22px] leading-none">{p.name}</span>
            <span className="shrink-0 text-sm font-black">{healing ? `${p.hpBefore} → ${p.hpAfter}` : `${p.hpBefore} / ${p.max}`}</span>
          </div>
          <Bar label={`${p.name} hit points after this splurge`} max={p.max} rest={p.hpBefore} change={healing ? p.heal : 0} kind="heal" />
          <span className="text-xs leading-tight font-extrabold text-[#5b2a10]">{p.formula}</span>
        </div>
      </div>
      <div aria-live="polite" className={cx(lineBox, p.state === "blocked" ? "bg-[#e6f8d8]" : healing ? "bg-[#ffe0e8]" : "bg-white")}>
        {healing ? <span>{p.name} heals <b className="font-black text-[#d6336c]">+{p.heal}</b>{p.line.slice(`${p.name} heals +${p.heal}`.length)}</span> : <span>{p.line}</span>}
      </div>
    </section>
  );
}
