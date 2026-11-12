/** Pieces the game screens share: the page colour, the header with the menu, hearts, the monster, the "what happened" panel. */
import { createContext, useContext, type ReactNode } from "react";
import { START_HEARTS, type EventView } from "../../../shared/game/types";
import { cx } from "../components/ui";
import { UserMenu } from "../components/UserMenu";
import { HeartEmpty, HeartFull } from "./icons";
import { clearNews } from "./state";

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

/** "CRAVING CRUSHER · WORLD 2 · LEVEL 11 OF 60" over a big outlined title, the menu on the right. */
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

/** What a sync just settled (a KO, a strike, a heart…), until it is dismissed. Stage 3 makes the big ones full-screen. */
export function NewsPanel({ news, choose }: { news: EventView[]; choose: boolean }) {
  if (!news.length) return null;
  const ko = news.some((e) => e.kind === "ko");
  return (
    <section aria-label="What just happened" role="status" className="g-panel g-anim-rise mx-3 mt-2.5 bg-g-soft-green px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-game text-[19px] leading-tight">{ko ? "K.O.!" : "What just happened"}</h2>
        <button onClick={clearNews} className="g-btn h-8 rounded-[10px] bg-g-panel-2 px-2.5 text-[13px] font-black text-g-text">Got it</button>
      </div>
      <ul className="mt-1 space-y-0.5 text-sm leading-snug font-extrabold">
        {[...news].sort((a, b) => Number(b.kind === "ko") - Number(a.kind === "ko")).map((e) => <li key={e.id}>{e.text}</li>)}
      </ul>
      {ko && choose ? (
        <a href="#/game/choose" onClick={clearNews} className="g-btn mt-2 flex h-11 items-center justify-center rounded-xl bg-g-yellow font-game text-[17px]">Choose your next fight →</a>
      ) : null}
    </section>
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
