"use client";

import { useState } from "react";

import { useGameState } from "~/components/game-state-provider";
import GameScene from "~/components/scenes/game-scene";
import StartScene from "~/components/scenes/start-scene";
import { cn } from "~/lib/cn";

/**
 * What the laptop's display is currently showing. The scenes are exclusive —
 * only the mounted one runs, which is what keeps the trading hooks out of the
 * menu.
 */
type Scene = "start" | "game";

/**
 * The display itself: a lit surface that holds exactly one scene. Everything
 * about where the display sits in the photo — its outline, its tilt — belongs
 * to the page, so this component only ever fills the space it is given.
 */
export default function Screen({ className }: { className: string }) {
  const { start } = useGameState();
  const [scene, setScene] = useState<Scene>("start");

  return (
    <div className={cn("relative h-full w-full bg-terminal", className)}>
      {scene === "start" ? (
        <StartScene
          onStart={() => {
            start();
            setScene("game");
          }}
        />
      ) : (
        <GameScene />
      )}
    </div>
  );
}
