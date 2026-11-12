/**
 * Craving Crusher's pages under #/game, inside the `.game` root that carries the game's look.
 * Stage 2: the title, Start a run, the battle and Choose your fight. The map, a world up close, the
 * Monster Book, the Hall of Heroes and How to crush come in the next update; their links land on a
 * short note until then.
 */
import type { GameScreen } from "../lib/route";
import { Battle } from "./Battle";
import { Choose } from "./Choose";
import { GameBg, GameHeader, GameNote, PlayerContext } from "./parts";
import { StartRun } from "./StartRun";
import { TitleScreen } from "./TitleScreen";

const SOON: Record<string, string> = { map: "The world map", world: "A world up close", book: "The Monster Book", hall: "The Hall of Heroes", how: "How to crush" };

export function GamePage({ screen, soon, who, loginEnabled }: { screen: GameScreen; soon?: string; who: string; loginEnabled: boolean }) {
  return (
    <PlayerContext.Provider value={{ who, loginEnabled }}>
      <div className="game min-h-dvh">
        {screen === "title" ? <TitleScreen /> : null}
        {screen === "start" ? <StartRun /> : null}
        {screen === "battle" ? <Battle /> : null}
        {screen === "choose" ? <Choose /> : null}
        {screen === "soon" ? <Soon what={soon} /> : null}
      </div>
    </PlayerContext.Provider>
  );
}

function Soon({ what }: { what?: string }) {
  const name = (what && SOON[what]) || "This screen";
  return (
    <main className="relative min-h-dvh">
      <GameBg background="linear-gradient(180deg, #4fb4f5 0%, #6ec6ff 35%, #bfe8ff 70%, #e6f7ff 100%)" />
      <GameHeader kicker="CRAVING CRUSHER" title={name} back={{ href: "#/game", label: "Back to the title screen" }} />
      <GameNote title="Coming in the next update"
        action={<div className="grid grid-cols-2 gap-2">
          <a href="#/game" className="g-btn flex h-12 items-center justify-center rounded-2xl bg-g-panel-2 font-game text-lg">Title screen</a>
          <a href="#/game/battle" className="g-btn flex h-12 items-center justify-center rounded-2xl bg-g-yellow font-game text-lg">To the battle</a>
        </div>}>
        {name} is being built. Your run keeps going in the meantime: every workout you log still hits.
      </GameNote>
    </main>
  );
}
