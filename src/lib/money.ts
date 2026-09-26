/*
  Built once rather than per call: constructing a NumberFormat loads locale data
  and is comparatively expensive. The locale is what decides German conventions
  — "18.450,72 €" — independently of the currency; swap it for "en-US" to get
  "€18,450.72" in euros still.
*/
const format = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export const euro = (value: number) => format.format(value);

/*
  U+2212 rather than a hyphen, to match the delta in the chart's header and
  because a hyphen sits too high and too short next to tabular figures.
*/
export const signedEuro = (amount: number) =>
  `${amount < 0 ? "−" : "+"}${format.format(Math.abs(amount))}`;
