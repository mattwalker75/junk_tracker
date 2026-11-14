/**
 * Calorie Crusher's pages under #/game, inside the `.game` root that carries the game's look: the
 * title, Start a run, the battle, Choose your fight, the adventure map, a world up close, the
 * Monster Book, the Hall of Heroes and How to crush. What a sync settles (a KO, a strike…) comes up
 * over any of them (Results.tsx).
 */
import type { GameScreen } from "../lib/route";
import { Battle } from "./Battle";
import { Book } from "./Book";
import { Choose } from "./Choose";
import { Hall } from "./Hall";
import { How } from "./How";
import { MapPage, WorldPage } from "./Map";
import { PlayerContext } from "./parts";
import { ResultHost } from "./Results";
import { StartRun } from "./StartRun";
import { setGamePerson } from "./state";
import { TitleScreen } from "./TitleScreen";

export function GamePage({ screen, world, who, person, loginEnabled }: { screen: GameScreen; world?: number; who: string; person: string; loginEnabled: boolean }) {
  // the results queue and toasts are this person's (Switch to / signing in as someone else starts afresh)
  setGamePerson(person);
  return (
    <PlayerContext.Provider value={{ who, loginEnabled }}>
      <div className="game min-h-dvh">
        {screen === "title" ? <TitleScreen /> : null}
        {screen === "start" ? <StartRun /> : null}
        {screen === "battle" ? <Battle /> : null}
        {screen === "choose" ? <Choose /> : null}
        {screen === "map" ? <MapPage /> : null}
        {screen === "world" ? <WorldPage world={world} /> : null}
        {screen === "book" ? <Book /> : null}
        {screen === "hall" ? <Hall /> : null}
        {screen === "how" ? <How /> : null}
        <ResultHost screen={screen} />
      </div>
    </PlayerContext.Provider>
  );
}
