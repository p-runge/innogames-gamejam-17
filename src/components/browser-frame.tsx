import type { ReactNode } from "react";

import { cn } from "~/lib/cn";

/*
  Every control here is a div, never a button: the chrome is scenery, and a real
  button would take focus, sit in the tab order and invite a click that does
  nothing. The whole frame is hidden from assistive tech for the same reason,
  with one readable line standing in for it.
*/

const ICONS = {
  back: "M15 5l-7 7 7 7",
  forward: "M9 5l7 7-7 7",
  reload: "M20 12a8 8 0 1 1-2.34-5.66M20 3.5V9h-5",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
} as const;

function Icon({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-[2.4cqw]", className)}
    >
      <path d={path} />
    </svg>
  );
}

/*
  macOS window buttons. They are the one red and green on this screen that do
  not mean a direction — the reservation covers the data surface, and these sit
  on the frame, outside the page. Their absence reads as "not a browser" far
  more loudly than their color reads as "up and down".
*/
const TRAFFIC_LIGHTS = ["#ff5f57", "#febc2e", "#28c840"];

export default function BrowserFrame({
  url,
  tabTitle,
  favicon,
  children,
  className,
}: {
  url: string;
  tabTitle: string;
  /** A single letter on a colored tile, standing in for the site's icon. */
  favicon: { label: string; color: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("@container flex flex-col bg-browser", className)}>
      <span className="sr-only">Browser window showing {url}</span>

      <div aria-hidden className="contents">
        {/*
          leading-none throughout: the chrome's height is the sum of these
          paddings plus the type, so letting a line-height into it makes the bar
          thicker than the numbers say.
        */}
        <div className="flex items-end gap-[1.6cqw] px-[1.6cqw] pt-[0.8cqw]">
          <div className="flex items-center gap-[0.8cqw] pb-[0.8cqw]">
            {TRAFFIC_LIGHTS.map((color) => (
              <span
                key={color}
                className="size-[1.2cqw] rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <div className="flex min-w-0 max-w-[60%] flex-1 items-center gap-[1.1cqw] rounded-t-[0.8cqw] bg-browser-tab px-[1.4cqw] py-[0.7cqw] text-[1.9cqw] leading-none text-browser-ink">
            <span
              className="grid size-[2.2cqw] shrink-0 place-items-center rounded-[0.3cqw] text-[1.5cqw] font-black text-white"
              style={{ backgroundColor: favicon.color }}
            >
              {favicon.label}
            </span>
            <span className="truncate">{tabTitle}</span>
            <Icon
              path={ICONS.close}
              className="ml-auto size-[1.9cqw] shrink-0 text-browser-muted"
            />
          </div>

          <Icon
            path={ICONS.plus}
            className="mb-[0.9cqw] size-[2.2cqw] text-browser-muted"
          />
        </div>

        <div className="flex items-center gap-[1.6cqw] bg-browser-tab px-[1.8cqw] py-[0.9cqw]">
          <Icon path={ICONS.back} className="text-browser-ink" />
          {/* Forward is dimmed, as it is on any page you arrived at directly. */}
          <Icon path={ICONS.forward} className="text-browser-muted/40" />
          <Icon path={ICONS.reload} className="text-browser-ink" />

          <div className="flex min-w-0 flex-1 items-center gap-[1.2cqw] rounded-full bg-browser-field px-[1.8cqw] py-[0.45cqw]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="size-[2cqw] shrink-0 text-browser-muted"
            >
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              <rect x="5" y="11" width="14" height="9" rx="2" />
            </svg>
            <span className="truncate text-[2cqw] leading-none text-browser-ink">
              {url}
            </span>
          </div>

          <div className="flex shrink-0 flex-col gap-[0.4cqw]">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-[0.45cqw] rounded-full bg-browser-muted"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
