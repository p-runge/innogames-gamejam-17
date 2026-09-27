"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import Image from "next/image";
import { useEffect, useRef } from "react";

import InsanityMeter, { formatCost } from "~/components/insanity-meter";
import { type YPost } from "~/hooks/use-y-thread";
import type { Band } from "~/lib/insanity";
import { cn } from "~/lib/cn";
import { MOOD_ORDER, MOOD_WORD } from "~/lib/feed/suggestions";
import type { Mood } from "~/lib/market/types";
import { formatClock } from "~/lib/trading-session";
/*
  There are only two kinds of row in this feed, so the avatar only has to say which
  one it is: the player has a face, everyone replying to them gets a green circle
  and an initial. That reads faster than the handle hash this used to do, which
  spread five colors over the rows and made "mine" something to work out rather
  than see.

  Read off the post's own flag, so it comes out the same on the server as in the
  browser.
*/
const AVATAR_REPLY = "#00ba7c";

/** The player's face. */
const AVATAR_MINE_SRC = "/reicher_dude.jpg";

/**
 * Behind the photo, not instead of it — the blue shows for the moment before the
 * image decodes, so the row never opens with a hole in it.
 */
const AVATAR_MINE = "#1d9bf0";

function Avatar({ post }: { post: Pick<YPost, "author" | "mine"> }) {
  return (
    <div
      aria-hidden
      // relative + overflow-hidden so the filled image is cropped to the circle.
      className="relative grid size-[7cqw] shrink-0 place-items-center overflow-hidden rounded-full text-[3cqw] font-bold text-white"
      style={{ backgroundColor: post.mine ? AVATAR_MINE : AVATAR_REPLY }}
    >
      {post.mine ? (
        <Image
          src={AVATAR_MINE_SRC}
          // Decorative, and the container is already aria-hidden: the author's
          // name is right beside it in text.
          alt=""
          // fill rather than width/height, because the box is sized in cqw and
          // has no pixel size to hand the intrinsic one. object-cover keeps the
          // photo from stretching into the square it is not.
          fill
          // cqw is not a unit `sizes` understands, so this is the avatar's share
          // of the viewport at the size the laptop screen actually renders — only
          // a hint for which optimized file to fetch.
          sizes="10vw"
          className="object-cover"
        />
      ) : (
        post.author.slice(0, 1)
      )}
    </div>
  );
}

/**
 * Fired on the window when the player posts.
 *
 * The hands overlay sits outside the screen, in a different subtree, and listens
 * for this rather than taking a callback threaded down through the panels — a
 * decorative animation should not show up in the props of everything between it
 * and the feed.
 */
export const POST_EVENT = "y-post";

/**
 * How a mood reads on its button. The arrow and the color are the whole tutorial:
 * the word says how it sounds, and these say which way it pushes the price, so
 * pressing one is a decision rather than a guess.
 */
const MOOD_MARK: Record<Mood, { arrow: string; color: string }> = {
  dump: { arrow: "▼▼", color: "#f4212e" },
  bearish: { arrow: "▼", color: "#e0723c" },
  neutral: { arrow: "—", color: "#8b98a5" },
  bullish: { arrow: "▲", color: "#3fb950" },
  moon: { arrow: "▲▲", color: "#00d084" },
};

const compact = new Intl.NumberFormat("en", { notation: "compact" });

const ICONS = {
  reply: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4Z",
  repost: "M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4v1M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4v-1",
  like: "M12 20s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 4.65-7 9-7 9Z",
} as const;

function Engagement({ post, className }: { post: YPost; className?: string }) {
  const counts = [
    { key: "reply", label: "Replies", value: post.replies ?? 0 },
    { key: "repost", label: "Reposts", value: post.reposts ?? 0 },
    { key: "like", label: "Likes", value: post.likes ?? 0 },
  ] as const;

  return (
    <div
      className={cn(
        "flex items-center justify-between pr-[12cqw] text-[2.3cqw] text-feed-muted",
        className,
      )}
    >
      {counts.map((count) => (
        <span key={count.key} className="flex items-center gap-[1.2cqw]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="size-[3cqw]"
          >
            <path d={ICONS[count.key]} />
          </svg>
          <span className="tabular-nums">
            {count.value === 0 ? "" : compact.format(count.value)}
          </span>
          <span className="sr-only">{count.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Shared by the Explore tab and the search field between them. */
const SEARCH_ICON = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3";

/*
  The top bar's navigation, in the order the site it is imitating uses. Home is
  the page the feed is on, so it is the lit one.
*/
const NAV_ICONS = [
  { key: "home", label: "Home", path: "M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5" },
  {
    key: "explore",
    label: "Explore",
    path: SEARCH_ICON,
  },
  {
    key: "notifications",
    label: "Notifications",
    path: "M18 8a6 6 0 1 0-12 0c0 7-2 8-2 8h16s-2-1-2-8M13.7 21a2 2 0 0 1-3.4 0",
  },
  {
    key: "messages",
    label: "Messages",
    path: "M3 6.5h18v11H3zM3 7.2l9 6 9-6",
  },
] as const;

/** Waiting on the bell. A round number nobody is meant to clear. */
const UNREAD_COUNT = 147;

/**
 * The search field, which does not search. A div and not an input on purpose:
 * the only field on this screen that types is the composer, and a real one here
 * would take a click and a keystroke meant for it and then swallow both.
 */
function HeaderSearch() {
  return (
    <div
      aria-hidden
      // flex-1 rather than a width: the field takes whatever the logo and the
      // nav leave, which keeps the nav flush against the right edge.
      className="mx-[3cqw] flex min-w-0 flex-1 items-center gap-[1.6cqw] rounded-full bg-feed-hover px-[2.4cqw] py-[1.2cqw] text-feed-muted"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[3cqw] shrink-0"
      >
        <path d={SEARCH_ICON} />
      </svg>
      <span className="truncate text-[2.5cqw] leading-none">Search</span>
    </div>
  );
}

/**
 * Set dressing. None of it goes anywhere, so it is hidden from assistive tech
 * and stays out of the tab order — the player tabs from the screen into the
 * composer, and four dead icons in between would be four presses of nothing.
 */
function HeaderNav() {
  return (
    <nav aria-hidden className="flex shrink-0 items-center gap-[3.4cqw]">
      {NAV_ICONS.map((icon, index) => (
        <span key={icon.key} className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "size-[3.6cqw]",
              index === 0 ? "text-feed-ink" : "text-feed-muted",
            )}
          >
            <path d={icon.path} />
          </svg>
          {/*
            The badge overhangs the bell's top-right corner the way the real one
            does. min-w with a round shape rather than a fixed size, so three
            digits stretch it into a pill instead of spilling out of a circle.
          */}
          {icon.key === "notifications" && (
            <span className="absolute -top-[1.2cqw] -right-[1.6cqw] grid min-w-[3.4cqw] place-items-center rounded-full bg-feed-alert px-[0.7cqw] py-[0.2cqw] text-[1.9cqw] leading-none font-bold text-white tabular-nums">
              {compact.format(UNREAD_COUNT)}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

function Post({ post }: { post: YPost }) {
  return (
    <article className="flex gap-[2.2cqw] px-[3cqw] py-[2.4cqw] hover:bg-feed-hover">
      <Avatar post={post} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[1.1cqw] text-[2.7cqw]">
          <span className="shrink-0 font-bold">{post.author}</span>
          <span className="truncate text-feed-muted">{post.handle}</span>
          <span className="text-feed-muted">·</span>
          <span className="shrink-0 text-feed-muted tabular-nums">
            {formatClock(post.at)}
          </span>
        </div>
        <p className="mt-[0.5cqw] text-[2.7cqw] leading-normal">{post.body}</p>
        <Engagement post={post} className="mt-[1.6cqw]" />
      </div>
    </article>
  );
}

/**
 * Y — the feed the trading day is shouting into. A flat list of the player's own
 * posts, with no subject post pinned above them: every row is the same kind of
 * thing, and the room that pinned post used to take goes to the posts.
 *
 * Posts render newest first, at the top, so an arriving post lands where the
 * reader is already looking instead of off the bottom edge. `posts` stays in clock
 * order — the reversal is a rendering decision and the list that feeds it keeps
 * reading chronologically.
 */
export default function YFeed({
  posts,
  cooling,
  insanity,
  band,
  costFor,
  onPost,
  className,
}: {
  posts: YPost[];
  /** True while the post cooldown runs, during which the buttons are dead. */
  cooling: boolean;
  /** The meter's reading, shown over the buttons that fill it. */
  insanity: number;
  band: Band;
  /** What each mood costs right now, for the amount on its button. */
  costFor: (mood: Mood) => number;
  onPost: (mood: Mood) => void;
  className?: string;
}) {
  // A fresh array, so reversing it leaves the caller's `posts` alone.
  const newestFirst = [...posts].reverse();

  const threadRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLDivElement>(null);

  /* Slides an arriving post into the thread instead of making it appear. */
  const [listRef] = useAutoAnimate<HTMLUListElement>();

  /*
    Set on submit and consumed by the effect below, because the new post is not
    in the DOM yet when submit runs — it arrives with the next render. A ref
    rather than state: this only needs to survive to that render, not cause one.
  */
  const followOwnPost = useRef(false);

  /*
    Whether the head of the thread — where new posts arrive — is in view. A ref
    and not state on purpose: this changes on every scroll, and as state it would
    re-render the whole feed each time — and setting it from an observer callback
    is the setState-in-effect shape the project's lint rules refuse.
  */
  const atTop = useRef(true);


  /*
    Follows the head of the thread while the reader is already there, and leaves
    them alone when they have scrolled down to read older posts. An observer
    rather than reading scrollTop on every scroll event: no forced layout, and
    `rootMargin` expresses "near enough to the top" without inventing a pixel
    threshold.
  */
  useEffect(() => {
    const thread = threadRef.current;
    const start = startRef.current;
    if (!thread || !start) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        atTop.current = entry.isIntersecting;
      },
      { root: thread, rootMargin: "48px 0px 0px 0px" },
    );

    observer.observe(start);
    return () => observer.disconnect();
  }, []);


  /**
   * Post in the mood the player pressed. The word on the button is the choice;
   * which line carries it belongs to the caller.
   */
  const submit = (mood: Mood) => {
    if (cooling) return;

    // The player's own post always pulls the thread down to it, whether or not
    // they had scrolled away to read older ones.
    followOwnPost.current = true;
    onPost(mood);

    // What the hands overlay taps to. Dispatched here rather than in the overlay
    // so the animation follows the post itself, not a click that was ignored.
    window.dispatchEvent(new Event(POST_EVENT));
  };

  return (
    <div
      className={cn(
        "@container flex flex-col bg-feed-surface font-sans text-feed-ink",
        className,
      )}
    >
      {/*
        Logo left, search in the middle, navigation right — the top bar of the
        app this is pretending to be. Opaque and stacked for the same reason as
        the composer below.
      */}
      <header className="relative z-10 flex shrink-0 items-center border-b border-feed-line bg-feed-surface px-[3cqw] py-[2.2cqw]">
        <span className="shrink-0 text-[5.5cqw] leading-none font-black text-feed-accent">
          Y
        </span>
        <HeaderSearch />
        <HeaderNav />
      </header>

      {/*
        scroll-smooth applies to the scrollTop assignment above as well as to the
        player's own scrolling, and motion-reduce drops it back to an instant
        jump for anyone who asked the OS for less movement.
      */}
      <div
        ref={threadRef}
        className="min-h-0 flex-1 overflow-y-auto scroll-smooth motion-reduce:scroll-auto"
      >
        {/*
          The sentinel the IntersectionObserver above watches. It marks where the
          newest post lands, which is what "the reader is at the top" means; a
          zero-height element cannot intersect, so it needs the pixel.
        */}
        <div aria-hidden className="h-px" />
        {/*
          divide-y rather than a border-b per row: the oldest post sits at the
          bottom of the list, and its own bottom border would run across the
          suggestion panel below it. Dividers draw between posts only, so the list
          ends without a rule.
        */}
        <ul ref={listRef} className="divide-y divide-feed-line">
          {newestFirst.map((post) => (
            <li key={post.id}>
              <Post post={post} />
            </li>
          ))}
        </ul>
      </div>

      {/*
        The suggestions sit above the thread rather than beside it: their own
        background and a stacking order, so a post that scrolls down to them is
        covered instead of showing its dividers through the panel. Only then is
        the border its own line — without the background it was whatever row
        happened to be underneath.
      */}
      <div className="relative z-10 shrink-0 border-t border-feed-line bg-feed-surface px-[3cqw] py-[1.6cqw]">
        {/*
          The cooldown, draining left to right along the panel's top edge. Seven
          seconds of greyed-out buttons with nothing moving reads as broken, where
          three were forgivable — this is what turns the wait into "my next move is
          loading". Mounted only while it runs, which is also what starts it.
        */}
        {cooling && (
          <div
            aria-hidden
            data-cooldown
            style={{ animation: `y-cooldown ${band.cooldownMs}ms linear forwards` }}
            className="absolute inset-x-0 top-0 h-[0.5cqw] origin-left bg-feed-accent"
          />
        )}
        <div className="flex items-center gap-[2cqw]">
          {/* The composer is the player, so it takes the player's blue. */}
          <Avatar post={{ author: "You", mine: true }} />
          <span className="text-[2.4cqw] font-bold text-feed-muted">
            Say something
          </span>
        </div>
        {/*
          The buttons get the panel's full width on their own row. Sharing the
          label's row left each of the five about a ninth of the pane, which was
          too narrow to read the word in — the row costs height, and the word being
          legible is what the button is for.

          All five moods, in sell-to-buy order, so the row reads as one dial and
          every button stays where the player last saw it. Equal fractions rather
          than flex-basis, so the widths do not shift with the words in them.
        */}
        <InsanityMeter insanity={insanity} band={band} className="mt-[1.4cqw]" />
        <ul className="mt-[1.4cqw] grid grid-cols-5 gap-[1.2cqw]">
          {MOOD_ORDER.map((mood) => {
            const mark = MOOD_MARK[mood];

            return (
              <li key={mood} className="flex">
                <button
                  type="button"
                  onClick={() => submit(mood)}
                  // Dead during the cooldown, which is also the window this
                  // button's next line is being written in.
                  disabled={cooling}
                  // Arrow beside the word, price underneath. The arrow earns its
                  // place on the word's line because both say the same thing
                  // about the market; the price is about the player's head and
                  // is a different question, so it gets its own line rather than
                  // squeezing the word down to "Pa…".
                  className="flex w-full flex-col items-center justify-center gap-[0.5cqw] rounded-full border border-feed-line px-[1cqw] py-[1cqw] transition-opacity hover:bg-feed-line/40 focus-visible:outline-2 focus-visible:outline-feed-accent disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <span className="flex items-center gap-[0.8cqw]">
                    <span
                      aria-hidden
                      className="text-[2.2cqw] leading-none font-black"
                      style={{ color: mark.color }}
                    >
                      {mark.arrow}
                    </span>
                    <span className="truncate text-[2.8cqw] leading-none font-bold">
                      {MOOD_WORD[mood]}
                    </span>
                  </span>
                  {/*
                    The effective amount, not the list price, which is how the
                    player finds out that calming down gets more expensive the
                    worse things get.
                  */}
                  <span className="text-[1.9cqw] leading-none text-feed-muted tabular-nums">
                    {formatCost(costFor(mood))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
