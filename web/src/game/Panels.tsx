/**
 * The live panels at the top of the game-skinned sheets (mockups MonLogActivity, MonLogSplurge):
 * the monster, its HP bar with what this entry would do, the sum, and one plain sentence. The
 * numbers come from logic.ts, which runs the shared engine's preview().
 */
import { cx } from "../components/ui";
import { hpShort, hpText, type AttackPanel, type HealPanel } from "./logic";
import { HpBar, Monster } from "./parts";

function Thumb({ slug, name, pose, motion }: { slug: string; name: string; pose: "normal" | "hurt"; motion: "idle" | "still" | "heal" }) {
  return (
    <div className="relative size-[88px] shrink-0 overflow-hidden rounded-[22px] border-[3px] border-[#2b1d3a] shadow-[0_3px_0_#2b1d3a]"
      style={{ background: "linear-gradient(180deg, #ff7b45 0%, #ffb35e 60%, #f2b46a 60%, #e08f4c 100%)" }}>
      <div className="absolute inset-x-0 top-1"><Monster slug={slug} name={name} pose={pose} motion={motion} className="w-[82px]" /></div>
    </div>
  );
}

const panelBox = "flex flex-col gap-2 rounded-[20px] border-[3px] border-[#2b1d3a] p-2.5 text-[#2b1d3a] shadow-[0_4px_0_var(--g-line)]";
const panelBg = { background: "linear-gradient(180deg, #ffb877 0%, #ffd9a0 100%)" };
const lineBox = "rounded-[13px] border-[2.5px] border-[#2b1d3a] px-2.5 py-2 text-sm leading-snug font-extrabold text-[#2b1d3a]";

export function AttackPreview({ p, slug }: { p: AttackPanel; slug: string }) {
  const hit = p.state === "short" || p.state === "finish";
  const hpLabel = hit ? `${hpShort(p.hpBefore, p.max)} → ${hpShort(p.hpAfter, p.max)}` : hpText(p.hpBefore, p.max);
  return (
    <section aria-label="Damage preview" className={panelBox} style={panelBg}>
      <div className="flex items-center gap-2.5">
        <Thumb slug={slug} name={p.name} pose={p.state === "finish" ? "hurt" : "normal"} motion={p.state === "finish" ? "still" : "idle"} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-1.5">
            <span className="g-stroke truncate font-game text-[22px] leading-none">{p.name}</span>
            <span className="shrink-0 text-sm font-black">{hpLabel}</span>
          </div>
          <HpBar label={`${p.name} hit points after this workout`} max={p.max} value={Math.max(0, p.hpAfter)} change={hit ? Math.min(p.hpBefore, p.dmg) : 0} kind="hit" fill="var(--g-orange)" />
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
            <span className="shrink-0 text-sm font-black">{healing ? `${hpShort(p.hpBefore, p.max)} → ${hpShort(p.hpAfter, p.max)}` : hpText(p.hpBefore, p.max)}</span>
          </div>
          <HpBar label={`${p.name} hit points after this splurge`} max={p.max} value={p.hpBefore} change={healing ? p.heal : 0} kind="heal" fill="var(--g-orange)" />
          <span className="text-xs leading-tight font-extrabold text-[#5b2a10]">{p.formula}</span>
        </div>
      </div>
      <div aria-live="polite" className={cx(lineBox, p.state === "blocked" ? "bg-[#e6f8d8]" : healing ? "bg-[#ffe0e8]" : "bg-white")}>
        {healing ? <span>{p.name} heals <b className="font-black text-[#d6336c]">+{p.heal}</b>{p.line.slice(`${p.name} heals +${p.heal}`.length)}</span> : <span>{p.line}</span>}
      </div>
    </section>
  );
}

/**
 * Between fights (Matt, Nov 14 2026), in place of the live panel: nothing is going, so this entry
 * hits or heals nothing, and the next monster only counts what is logged once it starts.
 */
export function NoFightNote({ name, kind }: { name: string; kind: "hit" | "heal" }) {
  return (
    <section aria-label="No monster right now" className={cx(panelBox, "gap-1")} style={panelBg}>
      <span className="font-game text-[19px] leading-tight">No monster right now</span>
      <span className="text-sm leading-snug font-extrabold">
        This {kind === "hit" ? "workout won't hit" : "splurge won't heal"} anything; it still earns +5 points. {name} is up next: start it from the battle screen.
      </span>
    </section>
  );
}
