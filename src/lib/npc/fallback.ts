import type { Persona } from "~/lib/llm/schemas";

/**
 * Used when the model is off or unreachable, and to fill gaps when individual
 * generations fail. The game is fully playable on these alone.
 *
 * The first four are the voices the feed shipped with, kept so the thread's
 * established tone survives a model outage.
 *
 * All invented: none of these handles belongs to a real account, and nothing any
 * of them says is a claim about anything tradable.
 */
export const FALLBACK_PERSONAS: Persona[] = [
  {
    name: "Kleinanleger",
    handle: "dieptkauf",
    bio: "buys every dip, regrets every dip, posts through it",
    stance: "bull",
    tic: "calls everyone 'champ'",
  },
  {
    name: "Chart Crimes",
    handle: "chartcrimes",
    bio: "sees a cup and handle in a parking ticket",
    stance: "bull",
    tic: "always says 'textbook'",
  },
  {
    name: "Exit Liquidity",
    handle: "exitliq",
    bio: "sold the bike, sold the car, still here somehow",
    stance: "bear",
    tic: "lists what he has sold so far",
  },
  {
    name: "Market Whisper",
    handle: "whisper",
    bio: "hints at things he does not know, daily, before the open",
    stance: "chaos",
    tic: "signs off 'not financial advice'",
  },
  {
    name: "Pension Rage",
    handle: "pensionrage",
    bio: "thirty years of contributions and this is what they did with it",
    stance: "bear",
    tic: "brings up the pension fund unprompted",
  },
  {
    name: "Margin Call Mike",
    handle: "margincall",
    bio: "leveraged into this at the top and is still explaining why that was smart",
    stance: "bull",
    tic: "says 'in hindsight', learns nothing",
  },
  {
    name: "Shortseller",
    handle: "borrowedshares",
    bio: "has been right about this company since long before you heard of it",
    stance: "bear",
    tic: "quotes his own old posts",
  },
  {
    name: "Blaue Stunde",
    handle: "blaue_stunde",
    bio: "only shows up when it is red and only to say she told you so",
    stance: "bear",
    tic: "opens with 'well well well'",
  },
  {
    name: "Ascendia Watch",
    handle: "ascendiawatch",
    bio: "certain the fund is behind every dip and will explain the mechanism",
    stance: "chaos",
    tic: "numbers his arguments",
  },
  {
    name: "Diamond Hands Dennis",
    handle: "dhdennis",
    bio: "held since the IPO, will hold through the delisting, hears nothing",
    stance: "bull",
    tic: "types in all caps when the price drops",
  },
];
