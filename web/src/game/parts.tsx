/** Pieces the game screens share: the page colour, the header with the menu, hearts, the monster, a note panel. */
import { createContext, useContext, type ReactNode } from "react";
import { START_HEARTS } from "../../../shared/game/types";
import { cx } from "../components/ui";
import { UserMenu } from "../components/UserMenu";
import { HeartEmpty, HeartFull } from "./icons";

/** Who is playing, for the menu. */
export const PlayerContext = createContext<{ who: string; loginEnabled: boolean }>({ who: "", loginEnabled: false });

/** The full-screen colour behind a game screen (dimmed at night by index.css). */
export function GameBg({ background }: { background: string }) {
  return <div className="g-bg" style={{ background }} aria-hidden />;
}

export function GameMenu() {
  const p = useContext(PlayerContext);
  return <UserMenu who={p.who} loginEnabled={p.loginEnabled} goals={undefined} place="game" />;
}

/** "CALORIE CRUSHER · WORLD 2 · LEVEL 11 OF 60" over a big outlined title, the menu on the right. */
export function GameHeader({ kicker, title, back, children }: { kicker: string; title: ReactNode; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="relative z-30 flex items-center gap-2.5 px-4 pt-3">
      {back ? (
        <a href={back.href} aria-label={back.label} className="g-btn grid size-10 shrink-0 place-items-center rounded-xl bg-g-panel text-g-text">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
        </a>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-game text-[12px] tracking-[0.08em] g-kicker opacity-80">{kicker}</span>
        <h1 className="g-stroke g-shadow-text truncate font-game text-[30px] leading-none font-normal">{title}</h1>
      </div>
      {children}
      <GameMenu />
    </header>
  );
}

/** Hearts as the mockups draw them: full ones, then dashed empty ones up to 3. */
export function Hearts({ hearts, className }: { hearts: number; className?: string }) {
  const slots = Math.max(START_HEARTS, hearts);
  return (
    <span className={cx("flex items-center gap-[3px]", className)} role="img" aria-label={`${hearts} ${hearts === 1 ? "heart" : "hearts"}`}>
      {Array.from({ length: slots }, (_, i) => i < hearts ? <HeartFull key={i} className="h-[22px] w-6" /> : <HeartEmpty key={i} className="h-[22px] w-6" />)}
    </span>
  );
}

/** A monster drawing. Fry Hydra has its own hurt and strike drawings; every monster gets the CSS motion. */
export function Monster({ slug, name, pose = "normal", motion = "idle", className, motionKey }: {
  slug: string; name: string; pose?: "normal" | "hurt" | "strike"; motion?: "idle" | "hurt" | "heal" | "strike" | "still"; className?: string; motionKey?: number;
}) {
  const own = slug === "05-fry-hydra" && pose !== "normal";
  const src = `/monsters/${slug}${own ? `-${pose}` : ""}.svg`;
  const inner = motion === "hurt" ? "g-anim-hurt" : motion === "heal" ? "g-anim-heal" : motion === "strike" ? "g-anim-lunge" : "";
  return (
    <div className={cx(motion === "idle" && "g-anim-bob")}>
      <img key={motionKey} src={src} alt={name} draggable={false} className={cx("block origin-[50%_85%] select-none", inner, className)} />
    </div>
  );
}

/** A plain game panel with a message (no run yet, an error, a screen still to come). */
export function GameNote({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="g-panel mx-4 mt-6 px-4 py-4">
      <h2 className="font-game text-[22px] leading-tight">{title}</h2>
      <div className="mt-1.5 text-[15px] leading-snug font-bold">{children}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  );
}

/** Bonus HP's colour: violet, so it never reads as the orange HP or the pink of a heal. */
export const BONUS_FILL = "#a35cff";

/**
 * An HP bar. Orange fills up to max HP; bonus HP (a splurge past full, up to 20% of max HP — Matt,
 * Nov 14 2026) is a violet bar laid over it from the left, so 20 bonus on a 100 HP monster covers a
 * fifth of the bar. `value` is HP + bonus HP; `change` stripes the part between `value` and
 * `value + change` (what a workout takes off, or what a splurge would add).
 */
export function HpBar({ label, max, value, change = 0, kind = "hit", fill = "#ff7a2f", className, fillClass, gloss = true }: {
  label: string; max: number; value: number; change?: number; kind?: "hit" | "heal"; fill?: string; className?: string; fillClass?: string; gloss?: boolean;
}) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const v = Math.max(0, value), end = Math.max(0, value + change);
  const main = Math.min(v, max), mainEnd = Math.min(end, max);
  const bonus = Math.max(0, v - max), bonusEnd = Math.max(0, end - max);
  const shown = kind === "hit" ? v : end;
  const stripe = kind === "hit" ? "repeating-linear-gradient(135deg, #ffffff 0 4px, #ffc93c 4px 8px)" : "repeating-linear-gradient(135deg, #ff7a95 0 4px, #ff4d6d 4px 8px)";
  const bonusStripe = kind === "hit" ? "repeating-linear-gradient(135deg, #ffffff 0 4px, #d9b8ff 4px 8px)" : "repeating-linear-gradient(135deg, #e7d2ff 0 4px, #a35cff 4px 8px)";
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(shown, max)}
      aria-valuetext={shown > max ? `${max} of ${max} HP, plus ${shown - max} bonus HP` : `${shown} of ${max} HP`}
      className={cx("relative box-content overflow-hidden rounded-full border-[3px] border-[#2b1d3a] bg-[#3a2238]", className ?? "h-[18px]")}>
      <div className={cx("absolute inset-y-0 left-0 transition-[width,background] duration-500", fillClass)} style={{ width: pct(main), background: fill }} />
      {mainEnd > main ? <div className="g-anim-blink absolute inset-y-0 transition-[left,width] duration-200" style={{ left: pct(main), width: pct(mainEnd - main), background: stripe }} /> : null}
      {bonus > 0 ? <div className="absolute inset-y-0 left-0 border-r-2 border-[#2b1d3a] transition-[width] duration-500" style={{ width: pct(bonus), background: BONUS_FILL }} /> : null}
      {bonusEnd > bonus ? <div className="g-anim-blink absolute inset-y-0 transition-[left,width] duration-200" style={{ left: pct(bonus), width: pct(bonusEnd - bonus), background: bonusStripe }} /> : null}
      {gloss ? <div className="absolute inset-x-1.5 top-[3px] h-1 rounded bg-white opacity-30" /> : null}
    </div>
  );
}

/** "HP 250 / 250" with bonus HP as a violet "+20 bonus" after it. */
export function HpNumbers({ hp, max, bonus, className }: { hp: number; max: number; bonus: number; className?: string }) {
  return (
    <span className={className}>
      {hp} / {max}{bonus > 0 ? <> <span className="whitespace-nowrap rounded-md px-1 text-white" style={{ background: BONUS_FILL }}>+{bonus} bonus</span></> : null}
    </span>
  );
}
