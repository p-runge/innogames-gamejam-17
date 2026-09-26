"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { POST_EVENT } from "~/components/y-feed";

/**
 * One tap, in percentages of the hand image's own height so the throw scales
 * with the photo. The hand overshoots on the way back up rather than settling
 * straight onto the keys, which is what makes the motion read as cartoonish
 * instead of mechanical.
 */
const TAP: Keyframe[] = [
  { transform: "translateY(0)" },
  { transform: "translateY(3.2%)", offset: 0.45 },
  { transform: "translateY(-0.9%)", offset: 0.75 },
  { transform: "translateY(0)" },
];

const TAP_MS = 150;

/**
 * Taps per post, and the gap between them.
 *
 * Picking a suggestion is one click, but the fiction is that the player typed the
 * line — so one post plays a short burst of alternating taps rather than a single
 * one. Six at 90ms reads as a sentence going in and finishes well before the post
 * has animated into the thread.
 */
const TAPS_PER_POST = 6;
const TAP_GAP_MS = 90;

export default function Hands() {
  const left = useRef<HTMLImageElement>(null);
  const right = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const hands = [left.current, right.current].filter((hand) => hand !== null);
    if (hands.length === 0) return;

    // Whose turn it is, and what each hand is currently playing. Both live in
    // the effect rather than in state: a keystroke has to move an image, not
    // re-render one, and going through React would re-render the whole overlay
    // on every key.
    let turn = 0;
    const playing = new Map<Element, Animation>();
    const pending = new Set<ReturnType<typeof setTimeout>>();

    function tap() {
      const hand = hands[turn % hands.length];
      turn += 1;

      // A burst lands the next tap on this hand before its previous one has
      // finished. Cancelling keeps one animation per hand instead of stacking
      // them, so every tap starts from the resting position.
      playing.get(hand)?.cancel();
      playing.set(
        hand,
        hand.animate(TAP, { duration: TAP_MS, easing: "ease-in-out" }),
      );
    }

    // The listener sits on the window rather than on the feed, because the feed
    // belongs to a subtree this component does not own and a ref into it would go
    // stale the moment it remounted.
    function type() {
      for (let index = 0; index < TAPS_PER_POST; index++) {
        const timer = setTimeout(() => {
          pending.delete(timer);
          tap();
        }, index * TAP_GAP_MS);
        pending.add(timer);
      }
    }

    window.addEventListener(POST_EVENT, type);

    return () => {
      window.removeEventListener(POST_EVENT, type);
      for (const timer of pending) clearTimeout(timer);
      for (const animation of playing.values()) animation.cancel();
    };
  }, []);

  return (
    /*
      The hands reach in from below the photo, so most of each arm hangs past
      the bottom edge. Clipping them to the box keeps the arms inside the laptop
      rather than letting them run into the letterbox bars that appear whenever
      the viewport is taller than the photo.
    */
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/*
        Each hand is placed by its fingertips rather than by its bounding box,
        since the fingertips are what has to meet the keys. Both spreads center
        on y 160 of the 941-tall artwork, and the top offsets carry that line
        onto the home row at y 864 of the photo — the two values differ only
        because the hands have different aspect ratios and therefore render at
        different heights for the same 26% width.

        Horizontally the pair straddles the letter block (x 90 to 1330 of 1672),
        not the photo, because the navigation keys on the right push the photo's
        center line off the board: centering on the photo would park the right
        hand on the bracket keys.
      */}
      <Image
        ref={left}
        src="/left-hand.png"
        alt=""
        width={852}
        height={941}
        sizes="26vw"
        className="absolute top-[83.19%] left-[11.97%] h-auto w-[26%]"
      />
      <Image
        ref={right}
        src="/right-hand.png"
        alt=""
        width={814}
        height={941}
        sizes="26vw"
        className="absolute top-[82.79%] right-[24.03%] h-auto w-[26%]"
      />
    </div>
  );
}
