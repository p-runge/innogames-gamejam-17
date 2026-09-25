// `server-only` throws on import outside React Server Components, which would
// fail every test that touches server modules. Vitest aliases the package to
// this empty module; the real one still guards the Next.js build.
export {};
