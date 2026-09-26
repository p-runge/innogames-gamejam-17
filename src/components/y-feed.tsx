"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { YPost } from "~/hooks/use-y-thread";
import { cn } from "~/lib/cn";
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
 * The composer's id. The hands overlay sits outside the screen, in a different
 * subtree, and finds this field by id rather than by a callback threaded down
 * through the panels — a decorative animation should not show up in the props
 * of everything between it and the keyboard.
 */
export const COMPOSER_ID = "y-composer";

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
 * top, everything after it is a reply, and the player's own posts join the same
 * list so they read as part of the conversation rather than a separate log.
 */
export default function YFeed({
  posts,
  onPost,
  className,
}: {
  posts: YPost[];
  onPost: (body: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [root, ...replies] = posts;

  const threadRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

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
    Whether the bottom of the thread is in view. A ref and not state on purpose:
    this changes on every scroll, and as state it would re-render the whole feed
    each time — and setting it from an observer callback is the setState-in-effect
    shape the project's lint rules refuse.
  */
  const atBottom = useRef(true);

  // Moving the container's own scrollTop rather than calling scrollIntoView,
  // which walks up and scrolls ancestors too — on a screen this one is rotated
  // inside, that would shift the whole laptop.
  const scrollToEnd = useCallback(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, []);

  /*
    Follows the end of the thread while the reader is already there, and leaves
    them alone when they have scrolled up to read. An observer rather than
    measuring scrollTop against scrollHeight on every scroll event: no forced
    layout, and `rootMargin` expresses "near enough to the bottom" without
    inventing a pixel threshold.
  */
  useEffect(() => {
    const thread = threadRef.current;
    const end = endRef.current;
    if (!thread || !end) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        atBottom.current = entry.isIntersecting;
      },
      { root: thread, rootMargin: "0px 0px 48px 0px" },
    );

    observer.observe(end);
    return () => observer.disconnect();
  }, []);

  /*
    Keeps the end in view while a new post animates in. auto-animate grows the
    arriving entry from zero to its full height, so a single scroll at render
    time aims at a scrollHeight that does not include it yet and lands short.
    A ResizeObserver follows the height instead, which stays correct if the
    animation's duration ever changes.
  */
  useEffect(() => {
    const list = listElement.current;
    if (!list) return;

    const observer = new ResizeObserver(() => {
      if (atBottom.current || followOwnPost.current) scrollToEnd();
    });

    observer.observe(list);
    return () => observer.disconnect();
  }, [scrollToEnd]);

  useEffect(() => {
    const own = followOwnPost.current;
    followOwnPost.current = false;

    // The player's own post always pulls the thread down; a reply from the crowd
    // only does so if the reader was at the bottom anyway.
    if (own || atBottom.current) scrollToEnd();
  }, [posts, scrollToEnd]);

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

  const submit = () => {
    if (!draft.trim()) return;

    // Only the player's own posts pull the thread down. When the crowd starts
    // replying on its own, an arriving post must not yank the view out from
    // under someone reading.
    followOwnPost.current = true;
    onPost(draft);
    setDraft("");
  };

  return (
    <div
      className={cn(
        "@container flex flex-col bg-feed-surface font-sans text-feed-ink",
        className,
      )}
    >
      <header className="flex items-center gap-[3cqw] border-b border-feed-line px-[3cqw] py-[2.2cqw]">
        <span className="text-[5.5cqw] leading-none font-black text-feed-accent">
          Y
        </span>
        <span className="text-[3cqw] font-bold">Post</span>
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
        <ul ref={setListRef}>
          {replies.map((reply) => (
            <li key={reply.id} className="border-b border-feed-line">
              <Reply post={reply} />
            </li>
          ))}
        </ul>
        {/*
          The sentinel the IntersectionObserver above watches. It marks where the
          thread ends, which is what "the reader is at the bottom" means; a
          zero-height element cannot intersect, so it needs the pixel.
        */}
        <div ref={endRef} aria-hidden className="h-px" />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-center gap-[2.2cqw] border-t border-feed-line px-[3cqw] py-[2.2cqw]"
      >
        <Avatar post={{ author: "You", handle: "@you" }} />
        <textarea
          id={COMPOSER_ID}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter posts, shift+Enter breaks the line — a textarea does not
            // submit its form on its own.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          aria-label="Post your reply"
          placeholder="Post your reply"
          className="min-w-0 flex-1 resize-none bg-transparent text-[2.8cqw] leading-snug placeholder:text-feed-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="shrink-0 rounded-full bg-feed-accent px-[3.6cqw] py-[1.3cqw] text-[2.6cqw] font-bold text-white hover:brightness-95 disabled:opacity-50"
        >
          Reply
        </button>
      </form>
    </div>
  );
}
