import type { Metadata } from "next";
import { Geist, Geist_Mono, Silkscreen } from "next/font/google";
import GameStateProvider from "~/components/game-state-provider";
import InformantProvider from "~/components/informant-provider";
import InsanityProvider from "~/components/insanity-provider";
import { TRPCReactProvider } from "~/lib/trpc/client";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
  The start screen's lettering, matching the logo's pixel type. It is loaded for
  the whole document but used only there — the trading screen is a set of real
  websites and reads in the system's own faces.
*/
const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Rise and Fall",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${silkscreen.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <TRPCReactProvider>
          {/*
            Wraps the tree rather than sitting beside it: the panels read the
            world from this provider's context, so it has to be an ancestor.
          */}
          <GameStateProvider>
            {/*
              Inside the world's provider and above every scene: the meter is the
              player rather than the market, and it has to outlive a round so the
              menu is what clears it.
            */}
            <InsanityProvider>
              {/*
                Under the meter, because how many messages are invented depends on
                it, and above both scenes and the desk, because the phone and the
                sound that announces a message are in different subtrees.
              */}
              <InformantProvider>{children}</InformantProvider>
            </InsanityProvider>
          </GameStateProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
