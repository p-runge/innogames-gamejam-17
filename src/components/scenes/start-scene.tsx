import Image from "next/image";

import MenuButton from "~/components/menu-button";

/**
 * The menu the game opens on. Starting a round is the player's move, not the
 * page load's, so this scene owns the only way in.
 */
export default function StartScene({ onStart }: { onStart: () => void }) {
  return (
    /*
      One font size in cqw carries the whole scene: every measurement below is
      in em or in a percentage of the screen, so the menu keeps its proportions
      at any size of the photo it sits inside.
    */
    <div className="flex h-full w-full flex-col items-center justify-center gap-[1.9em] text-[2cqw]">
      <Image
        src="/logo.png"
        alt="Rug-Pull Simulator"
        width={2172}
        height={724}
        priority
        sizes="30vw"
        className="h-auto w-[59%]"
      />
      <nav className="flex w-full flex-col items-center gap-[0.9em]">
        <MenuButton onClick={onStart}>Start Game</MenuButton>
        {/*
          Held open rather than left out: the menu the mockup describes has
          three rows, and a round has no score to list yet.
        */}
        <MenuButton disabled>Highscore List</MenuButton>
      </nav>
    </div>
  );
}
