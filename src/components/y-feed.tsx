"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { YPost } from "~/hooks/use-y-thread";
import { cn } from "~/lib/cn";
import {
  type Suggestion,
  SUGGESTIONS_SHOWN,
  suggestionsAt,
} from "~/lib/feed/suggestions";
import type { Mood } from "~/lib/market/types";
import { formatClock } from "~/lib/trading-session";

/*
  Avatars stand in for photos, so they take their color from the handle — the
  same account is the same color every render, and on the server too.
*/
const AVATAR_COLORS = ["#1d9bf0", "#794bc4", "#f91880", "#00ba7c", "#ff7a00"];

function avatarColor(handle: string) {
  const sum = [...handle].reduce((total, char) => total + char.charCodeAt(0), 0);

  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function Avatar({ post }: { post: Pick<YPost, "author" | "handle"> }) {
  return (
    <div
      aria-hidden
      className="grid size-[7cqw] shrink-0 place-items-center rounded-full text-[3cqw] font-bold text-white"
      style={{ backgroundColor: avatarColor(post.handle) }}
    >
      {post.author.slice(0, 1)}
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
 * How a mood reads in the suggestion panel. The arrows are the whole tutorial:
 * the player has to be able to see which line pushes the price which way before
 * clicking it, or picking one is guesswork.
 */
const MOOD_MARK: Record<Mood, { arrow: string; color: string; label: string }> =
  {
    dump: { arrow: "▼▼", color: "#f4212e", label: "Dump" },
    bearish: { arrow: "▼", color: "#e0723c", label: "Bearish" },
    neutral: { arrow: "—", color: "#8b98a5", label: "Neutral" },
    bullish: { arrow: "▲", color: "#3fb950", label: "Bullish" },
    moon: { arrow: "▲▲", color: "#00d084", label: "Moon" },
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

/*
  The opening post gets the conversation-view treatment: the handle drops below
  the name, the body is set larger, and the timestamp sits on its own line above
  the counts.
*/
function RootPost({ post }: { post: YPost }) {
  return (
    <article className="border-b border-feed-line px-[3cqw] py-[2.6cqw]">
      <div className="flex items-center gap-[2.2cqw]">
        <Avatar post={post} />
        <div className="min-w-0">
          <div className="truncate text-[2.7cqw] leading-tight font-bold">
            {post.author}
          </div>
          <div className="truncate text-[2.7cqw] leading-tight text-feed-muted">
            {post.handle}
          </div>
        </div>
      </div>
      <p className="mt-[2.4cqw] text-[3.4cqw] leading-normal">{post.body}</p>
      <div className="mt-[1.8cqw] text-[2.4cqw] text-feed-muted tabular-nums">
        {formatClock(post.at)}
      </div>
      <Engagement
        post={post}
        className="mt-[2cqw] border-t border-feed-line pt-[2cqw]"
      />
    </article>
  );
}

function Reply({ post }: { post: YPost }) {
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
 * Y — the thread the trading day is arguing in. The opening post sits at the
 * top as the thread's subject, and the player's own posts join the same list so
 * they read as part of the conversation rather than a separate log.
 *
 * Posts render newest first, directly under the opening post, so an arriving
 * post lands where the reader is already looking instead of off the bottom edge.
 * `posts` stays in clock order — the reversal is a rendering decision and the
 * thread that feeds it keeps reading chronologically.
 */
export default function YFeed({
  posts,
  onPost,
  className,
}: {
  posts: YPost[];
  onPost: (suggestion: Suggestion) => void;
  className?: string;
}) {
  /*
    Where in the pool the offered suggestions start. Advanced past the three on
    offer after each post, so the player is not looking at the line they just
    used — and an offset rather than a random pick because this renders on the
    server too, where `Math.random()` is a hydration mismatch.
  */
  const [offset, setOffset] = useState(0);
  const suggestions = suggestionsAt(offset);

  // The rest element is a fresh array, so reversing it in place leaves `posts`
  // alone.
  const [root, ...rest] = posts;
  const replies = rest.reverse();

  const threadRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLDivElement>(null);

  const [animateRef, enableAnimation] = useAutoAnimate<HTMLUListElement>();
  const listElement = useRef<HTMLUListElement>(null);
  /*
    useAutoAnimate hands back a ref callback, and the ResizeObserver below needs
    the node too, so the list gets one callback that feeds both.
  */
  const setListRef = useCallback(
    (node: HTMLUListElement | null) => {
      listElement.current = node;
      animateRef(node);
    },
    [animateRef],
  );

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

  // Moving the container's own scrollTop rather than calling scrollIntoView,
  // which walks up and scrolls ancestors too — on a screen this one is rotated
  // inside, that would shift the whole laptop.
  const scrollToStart = useCallback(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = 0;
  }, []);

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

  /*
    Holds the view at the head of the thread while a new post animates in.
    auto-animate grows the arriving entry from zero to its full height, and that
    growth happens above everything the reader can see, so the browser's own
    scroll anchoring would push the thread down to compensate. A ResizeObserver
    follows the height and pins it back, which stays correct if the animation's
    duration ever changes.
  */
  useEffect(() => {
    const list = listElement.current;
    if (!list) return;

    const observer = new ResizeObserver(() => {
      if (atTop.current || followOwnPost.current) scrollToStart();
    });

    observer.observe(list);
    return () => observer.disconnect();
  }, [scrollToStart]);

  useEffect(() => {
    const own = followOwnPost.current;
    followOwnPost.current = false;

    // The player's own post always pulls the thread back up to it; a reply from
    // the crowd only does so if the reader was at the top anyway.
    if (own || atTop.current) scrollToStart();
  }, [posts, scrollToStart]);

  /*
    Animation stays off until the thread has replies in it, and the comparison is
    against 1 rather than 0 because the seeded opening post is always there.

    The feed mounts with that post alone and the server's history lands a render
    later. This effect runs after the first render and before that second one, so
    the batch arrives with animation still off — otherwise every post already in
    the round flies in one after another on load, twenty of them after a
    mid-round reload. The cost is that the very first reply of a fresh round
    appears without animating, which nobody is watching for.
  */
  useEffect(() => {
    enableAnimation(posts.length > 1);
  }, [enableAnimation, posts.length]);

  const submit = (suggestion: Suggestion) => {
    // The player's own post always pulls the thread down to it, whether or not
    // they had scrolled away to read older ones.
    followOwnPost.current = true;
    onPost(suggestion);
    setOffset((previous) => previous + SUGGESTIONS_SHOWN);

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
        {root && <RootPost post={root} />}
        {/*
          The sentinel the IntersectionObserver above watches. It marks where the
          newest reply lands, which is what "the reader is at the top" means; a
          zero-height element cannot intersect, so it needs the pixel.
        */}
        <div ref={startRef} aria-hidden className="h-px" />
        {/*
          divide-y rather than a border-b per row: the oldest reply now sits at
          the bottom of the list, and its own bottom border would run across the
          composer below it. Dividers draw between replies only, so the list ends
          without a rule.
        */}
        <ul ref={setListRef} className="divide-y divide-feed-line">
          {replies.map((reply) => (
            <li key={reply.id}>
              <Reply post={reply} />
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
      <div className="relative z-10 shrink-0 border-t border-feed-line bg-feed-surface px-[3cqw] py-[2.2cqw]">
        <div className="flex items-center gap-[2.2cqw]">
          <Avatar post={{ author: "You", handle: "@you" }} />
          <span className="text-[2.4cqw] font-bold text-feed-muted">
            Post one of these
          </span>
        </div>
        <ul className="mt-[1.8cqw] flex flex-col gap-[1.4cqw]">
          {suggestions.map((suggestion) => {
            const mark = MOOD_MARK[suggestion.mood];

            return (
              <li key={suggestion.id}>
                <button
                  type="button"
                  onClick={() => submit(suggestion)}
                  // The mood is in the accessible name as a word, because the
                  // arrows beside it are decoration a screen reader cannot read.
                  aria-label={`Post "${suggestion.body}" — ${mark.label}`}
                  className="flex w-full items-center gap-[2cqw] rounded-[2cqw] border border-feed-line px-[2.6cqw] py-[1.6cqw] text-left hover:bg-feed-line/40 focus-visible:outline-2 focus-visible:outline-feed-accent"
                >
                  <span
                    aria-hidden
                    className="w-[6cqw] shrink-0 text-center text-[2.6cqw] leading-none font-black"
                    style={{ color: mark.color }}
                  >
                    {mark.arrow}
                  </span>
                  <span className="min-w-0 flex-1 text-[2.6cqw] leading-snug">
                    {suggestion.body}
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
