import Image from "next/image";
import Hands from "~/components/hands";
import Screen from "~/components/screen";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center overflow-hidden bg-black">
      {/*
        The box carries the photo's own aspect ratio and is clamped by both
        viewport axes, which contains the laptop without distorting it. Because
        the box matches the photo exactly, the overlay below can be placed in
        percentages of the image rather than of the viewport.
      */}
      <div className="relative aspect-1672/941 max-h-dvh w-full max-w-[calc(100dvh*1672/941)] @container-size">
        <Image
          src="/laptop.jpeg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-contain"
        />
        {/*
          The display in the photo is an isosceles trapezoid whose bottom edge
          is 3.65% wider than its top. Every value here is measured off the
          image (corners at 132.4/40.7, 1546.7/40.5, 107.0/715.0, 1572.9/714.9
          of 1672x941) and expressed relative to the box, so the overlay tracks
          the photo at any size.

          The bottom edge is the axis of the rotation below and is therefore the
          only edge the transform leaves in place, which makes it the anchor.
          The perspective is given in cqh rather than px so it scales with the
          photo — a fixed px perspective would change the amount of taper with
          the viewport and only line up at one size.
        */}
        <div className="absolute bottom-[22.75%] left-[5.8857%] h-[90%] w-[88.6744%] perspective-[1341.51cqh]">
          {/*
            The photo's top and bottom display edges are parallel, so its
            horizontal vanishing point is at infinity and the screen's true
            aspect ratio cannot be recovered from it. 16:9 is therefore a free
            choice of authoring surface: the angle and perspective above are
            solved for it, and any other ratio reproduces the same outline with
            a different angle. It only decides what a square inside Screen means.
          */}
          <Screen className="origin-bottom rotate-x-[33.964deg]" />
        </div>
        <Hands />
      </div>
    </main>
  );
}
