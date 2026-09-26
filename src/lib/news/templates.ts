import type {
  NewsCredibility,
  NewsDirection,
  NewsEvent,
  TopicSeed,
} from "./types";

/**
 * Tips for when the model cannot answer: switched off, unreachable, or every
 * request past its timeout.
 *
 * Without these the newsticker is only half a feature — the schedule runs, the
 * impulses land, and the player is told nothing about why the chart jumped.
 * They are deliberately plain: not trying to pass for the model's output, just
 * keeping the mechanic whole.
 *
 * They obey the same rule the prompt states: report the fact, never what it
 * does to the price.
 */
const FACTS: Record<TopicSeed, Record<NewsDirection, string>> = {
  "supply-chain": {
    up: "the parts that were stuck at the border cleared last night, all of them",
    down: "the second supplier pulled out this morning and nobody has a replacement",
  },
  regulator: {
    up: "the inspection closed with nothing on the report, nothing at all",
    down: "there are two inspectors in the building who were not on any calendar",
  },
  "key-customer": {
    up: "the big account signed for another three years and doubled the volume",
    down: "the big account has not answered a single call since friday",
  },
  board: {
    up: "the whole board bought in yesterday, quietly, with their own money",
    down: "the finance chief cleared out her office over the weekend",
  },
  plant: {
    up: "they are running a third shift at nord starting tomorrow",
    down: "line two at nord is down and the fix is weeks out, not days",
  },
  analyst: {
    up: "the desk that hated us all year is rewriting its note tonight",
    down: "a research desk has been calling every customer we have, one by one",
  },
  takeover: {
    up: "someone has been building a stake through three different brokers",
    down: "the deal everyone was counting on died in a room on the fourth floor",
  },
};

/**
 * The framing carries the credibility, which is the only thing the player can
 * read the risk off. Two clearly different registers rather than a hedging
 * word, because a hedge is easy to miss in a message this short.
 */
const FRAMING: Record<NewsCredibility, (fact: string) => string> = {
  confirmed: (fact) =>
    `${fact}. i saw the paperwork myself. you did not get this from me`,
  rumor: (fact) =>
    `cannot stand this one up, but what i am hearing is: ${fact}. do what you want with that`,
};

export function templatedTip(event: NewsEvent): string {
  return FRAMING[event.credibility](FACTS[event.seed][event.direction]);
}
