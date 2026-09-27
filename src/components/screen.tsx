"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { useGameState } from "~/components/game-state-provider";
import { useInsanity } from "~/components/insanity-provider";
import MuteToggle from "~/components/mute-toggle";
import GameScene from "~/components/scenes/game-scene";
import StartScene from "~/components/scenes/start-scene";
import SoundProvider, { useSound } from "~/components/sound-provider";
import { cn } from "~/lib/cn";
import { useTRPC } from "~/lib/trpc/client";

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
  return (
    <div className={cn("relative h-full w-full bg-terminal", className)}>
      {/*
        The sound machine wraps the scenes rather than the whole document: every
        trigger the game has is inside one of them, and the mute switch has to be
        under the same provider as the sounds it silences.
      */}
      <SoundProvider>
        <Display />
      </SoundProvider>
    </div>
  );
}

/** The scene switch, one level in so it can reach the sound machine. */
function Display() {
  const trpc = useTRPC();
  const { start } = useGameState();
  const { reset } = useInsanity();
  const { play, startMusic } = useSound();
  const [scene, setScene] = useState<Scene>("start");

  const endRound = useMutation(trpc.session.end.mutationOptions());

  return (
    <>
      {scene === "start" ? (
        <StartScene
          onStart={() => {
            // The click is also the gesture browsers require before they will
            // play anything, which is why the loop starts here and not on load.
            startMusic();
            play("day-start");
            // Cleared on the way in rather than on the way out: the meter's
            // provider is above this switch and outlives a round, so the menu is
            // what knows a new one is starting.
            reset();
            start();
            setScene("game");
          }}
        />
      ) : (
        <GameScene
          onBackToMenu={() => {
            /*
              The server has to be told, or its ticker outlives the ending and the
              next start joins the abandoned round instead of opening a day.
            */
            endRound.mutate();
            setScene("start");
          }}
        />
      )}
      {/*
        Above both scenes and outside either of them: the switch belongs to the
        machine, not to the round. Placed on the right window's toolbar row, just
        left of its menu, where a browser keeps its extensions — which is the one
        spot on the trading screen that a foreign button can sit without looking
        like part of either website.
      */}
      <MuteToggle className="absolute top-[1.75cqw] right-[2.5cqw]" />
    </>
  );
}
