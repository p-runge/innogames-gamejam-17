// typescript-eslint needs the classic TypeScript compiler API, which TypeScript 7
// no longer ships: its only root export is `lib/version.cjs`, everything else moved
// behind `./unstable/*`. This package pins TypeScript 6 as its own dependency so
// typescript-eslint resolves that copy, while the app keeps building and
// type-checking with TypeScript 7. See
// https://github.com/typescript-eslint/typescript-eslint/issues/10940 — once
// typescript-eslint speaks the TypeScript 7 API, this package can go away and the
// app can depend on typescript-eslint directly.
import tseslint from "typescript-eslint";

export const typescriptConfigs = tseslint.configs.recommended;
