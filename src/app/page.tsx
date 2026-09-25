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
      <div className="relative aspect-1672/941 max-h-dvh w-full max-w-[calc(100dvh*1672/941)] [container-type:size]">
        <Image
          src="/laptop.jpeg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-contain"
        />
        {/*
          The display area of the photo is a trapezoid, 2.6% wider along its
          bottom edge than along its top, so the overlay is placed as the
          rectangle through its half height (x 120..1560, y 36..713 of 1672x941)
          and tilted back into the same shape below. Top and height carry the
          offset the tilt introduces, which keeps the projected edges flush with
          the photo. Tying the perspective to the container's height rather than
          to a pixel value keeps the amount of tilt constant at any size.
        */}
        <div className="absolute top-[2%] left-1/2 ml-1 -translate-x-1/2 flex h-[75.5%] w-[89.2%] perspective-near">
          {/* Full height plus the component's own 16:10 ratio and auto margins
              centre the display in the wider panel. */}
          <Screen className="h-full rotate-x-1 origin-bottom" />
        </div>
      </div>
    </main>
  );
}
