/**
 * Runs once per server instance before the first request. Importing the env
 * schema here is what makes a missing or malformed variable stop the container
 * at startup instead of failing the first request that happens to need it.
 */
export async function register() {
  // Set by Next itself, so it is one of the flags read directly rather than
  // through the schema.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./env");
  }
}
