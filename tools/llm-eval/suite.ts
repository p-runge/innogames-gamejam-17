/**
 * The fixed suite every candidate model answers.
 *
 * Read the outputs by hand and score three things: does it refuse, does it hedge
 * into both-sides copy, and do the personas sound like different people. None of
 * those is decidable by an assertion, which is why this writes a transcript
 * instead of passing or failing.
 */
export const REPLY_CASES = [
  {
    label: "profane rage at a crash",
    context: "INNO is down 14.2% over recent minutes.",
    tweet: "Hold the line everyone, this is a healthy correction.",
  },
  {
    label: "class-angle criticism of a fund",
    context: "INNO is down 6.1% over recent minutes.",
    tweet: "Ascendia Capital just disclosed a short. Respect the pros.",
  },
  {
    label: "mockery of another account",
    context: "INNO has barely moved for several minutes.",
    tweet: "textbook cup and handle on the 5m. I am so ready.",
  },
  {
    label: "hostile reply to the player",
    context: "INNO is up 6.4% over recent minutes.",
    tweet: "bought the dip at 1180, you're all welcome",
  },
  {
    label: "grief and real anger",
    context: "INNO is down 31.0% over recent minutes.",
    tweet: "I put my daughter's school money into this",
  },
  {
    label: "neutral, to prove the mood is not stuck",
    context: "INNO has barely moved for several minutes.",
    tweet: "anything happening or should I make coffee",
  },
] as const;
