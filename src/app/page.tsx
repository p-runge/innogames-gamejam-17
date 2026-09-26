import Image from "next/image";
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
        {/*
          The hands reach in from below the photo, so most of each arm hangs
          past the bottom edge. Clipping them to the box keeps the arms inside
          the laptop rather than letting them run into the letterbox bars that
          appear whenever the viewport is taller than the photo.
        */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/*
            Each hand is placed by its fingertips rather than by its bounding
            box, since the fingertips are what has to meet the keys. Both spreads
            center on y 160 of the 941-tall artwork, and the top offsets carry
            that line onto the home row at y 864 of the photo — the two values
            differ only because the hands have different aspect ratios and
            therefore render at different heights for the same 26% width.

            Horizontally the pair straddles the letter block (x 90 to 1330 of
            1672), not the photo, because the navigation keys on the right push
            the photo's center line off the board: centering on the photo would
            park the right hand on the bracket keys.
          */}
          <Image
            src="/left-hand.png"
            alt=""
            width={852}
            height={941}
            sizes="26vw"
            className="absolute top-[83.19%] left-[11.97%] h-auto w-[26%]"
          />
          <Image
            src="/right-hand.png"
            alt=""
            width={814}
            height={941}
            sizes="26vw"
            className="absolute top-[82.79%] right-[24.03%] h-auto w-[26%]"
          />
        </div>
      </div>
    </main>
  );
}
