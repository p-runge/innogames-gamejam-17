import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import GameStateProvider from "~/components/game-state-provider";
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

export const metadata: Metadata = {
  title: "Rise and Fall",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <TRPCReactProvider>
          {/*
            Wraps the tree rather than sitting beside it: the panels read the
            world from this provider's context, so it has to be an ancestor.
          */}
          <GameStateProvider>{children}</GameStateProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
