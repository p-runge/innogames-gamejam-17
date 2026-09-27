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
const FACTS: Record<TopicSeed, Record<NewsDirection, readonly string[]>> = {
  "supply-chain": {
    up: [
      "the parts that were stuck at the border cleared last night, all of them",
      "the yard is full again and the second gate is open for the first time since spring",
      "the freight company that dropped us in january has been in all morning, signing",
      "they cancelled the overtime ban, which they only ever do when the parts are coming",
      "the shortage list on the wall by the line has one thing left on it",
      "somebody from logistics bought everybody coffee, which has never happened",
    ],
    down: [
      "the second supplier pulled out this morning and nobody has a replacement",
      "the containers that were due wednesday are still sitting where they were",
      "purchasing has been on the phone since seven and nobody is smiling",
      "they have started taking parts off the spares rack to keep the line going",
      "the man who handles the border paperwork has stopped answering his desk phone",
      "there is a hold notice on the pallets and no name on the bottom of it",
    ],
  },
  regulator: {
    up: [
      "the inspection closed with nothing on the report, nothing at all",
      "the file they opened in autumn went back in the cabinet yesterday",
      "the compliance woman has been in a good mood all week, which is new",
      "they took the temporary signage down, the kind you only put up for a visit",
      "the auditor left after an hour and took nothing with him",
      "legal cancelled the standing thursday meeting and did not rebook it",
    ],
    down: [
      "there are two inspectors in the building who were not on any calendar",
      "somebody asked for the maintenance logs going back four years, on paper",
      "they have booked the big room for a week and taken it off the system",
      "legal has been in since before the cleaners and the door is shut",
      "the letter that came friday went straight upstairs, unopened by anyone here",
      "a lawyer nobody recognises has a visitor badge and a desk",
    ],
  },
  "key-customer": {
    up: [
      "the big account signed for another three years and doubled the volume",
      "they have asked us to quote for the whole of their second site",
      "their buyer was here in person, which he has not been since the trouble",
      "we are running their order early because they asked for it early",
      "sales have been told to stop discounting because they do not need to",
      "the account manager who was leaving has quietly unresigned",
    ],
    down: [
      "the big account has not answered a single call since friday",
      "their people were seen at the competitor's stand, twice, for a long time",
      "the standing order for next quarter has not come through and it always has",
      "somebody from their side asked for our contract terms in writing",
      "the visit they had booked for thursday came off the calendar with no reason",
      "their logo came down off the wall in reception and nobody will say who took it",
    ],
  },
  board: {
    up: [
      "the whole board bought in yesterday, quietly, with their own money",
      "the chair has cancelled his holiday and told people he is glad he did",
      "they have stopped talking about the cost programme in the all hands",
      "two of them were in the canteen, actually eating, actually talking to people",
      "the chief executive walked the floor and shook hands with the night shift",
      "the recruitment freeze came off this morning, all departments",
    ],
    down: [
      "the finance chief cleared out her office over the weekend",
      "the board meeting moved forward by a week and nobody moves one forward",
      "the chair has not been in the building since the results and will not say why",
      "two directors have been meeting off site, in a hotel, with the phones away",
      "they have brought in advisers and the advisers have their own room",
      "the succession folder came out of the cabinet and has not gone back",
    ],
  },
  plant: {
    up: [
      "they are running a third shift at nord starting tomorrow",
      "the new line passed its trial run first time, which nobody expected",
      "maintenance has been told to bring the mothballed press back up",
      "they are hiring agency people for nord again, forty of them",
      "the scrap rate this week is the lowest anyone here has seen",
      "the machine that has broken every month since install ran all fortnight",
    ],
    down: [
      "line two at nord is down and the fix is weeks out, not days",
      "the part they need is made in one place and that place has a waiting list",
      "they sent the afternoon shift home and told them to wait for a call",
      "there is a man from the insurer walking the floor taking photographs",
      "the output board has not been updated since tuesday and nobody dares",
      "they have started shipping from stock, which means there is no stock coming",
    ],
  },
  analyst: {
    up: [
      "the desk that hated us all year is rewriting its note tonight",
      "three of them asked for the same model this week, which never happens",
      "investor relations have been told to clear their afternoons",
      "the note that was going out on monday has been pulled for a rewrite",
      "somebody senior at a fund has asked for a site visit, next week",
      "the analysts have stopped asking about the cash and started asking about growth",
    ],
    down: [
      "a research desk has been calling every customer we have, one by one",
      "two funds have asked the same awkward question in the same week",
      "the note that was supposed to be neutral has been delayed twice now",
      "somebody has been in the filings looking at things nobody looks at",
      "investor relations came out of a call looking like they had been shouted at",
      "a short seller's name came up in a meeting and nobody laughed",
    ],
  },
  takeover: {
    up: [
      "someone has been building a stake through three different brokers",
      "there are people in the building doing diligence and calling it an audit",
      "the data room went up last night and the list of names on it is short",
      "a bank nobody has hired has been calling the chair directly",
      "they have asked legal to dust off the change of control clauses",
      "two black cars in the visitor bays at six in the morning, twice this week",
    ],
    down: [
      "the deal everyone was counting on died in a room on the fourth floor",
      "the bankers who were here every day last month have stopped coming",
      "the data room closed and nobody has said what happened",
      "the buyer's team flew home a day early without saying goodbye",
      "the folder marked with the project name went into the shredder queue",
      "the chair told the advisers to send their final invoice",
    ],
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

/**
 * One tip, framed by how sure the informant is.
 *
 * `factId` comes back so a round can avoid repeating itself. Six lines per topic
 * and direction against roughly eight tips a round is room to spare, but the
 * exclusion is what guarantees it rather than hopes for it.
 *
 * `random` is a parameter so tests can pick a line rather than hope for one.
 */
export function drawTip(
  event: NewsEvent,
  exclude: readonly string[] = [],
  random: () => number = Math.random,
): { body: string; factId: string } {
  const pool = FACTS[event.seed][event.direction].map((fact, index) => ({
    factId: `${event.seed}-${event.direction}-${index}`,
    fact,
  }));

  // Falling back to the whole pool rather than going silent: an informant who
  // stopped leaking would read as a broken feature, and a repeat is the cheaper
  // failure by a wide margin.
  const fresh = pool.filter((line) => !exclude.includes(line.factId));
  const usable = fresh.length > 0 ? fresh : pool;

  // Clamped, because `random` is injectable and a stub that returns 1 would
  // otherwise index one past the end.
  const drawn =
    usable[Math.min(usable.length - 1, Math.floor(random() * usable.length))];

  return { factId: drawn.factId, body: FRAMING[event.credibility](drawn.fact) };
}
