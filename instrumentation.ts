export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDb } = await import("./lib/db");
    try {
      ensureDb();
    } catch (err) {
      console.error("[kartly] could not initialise the database:", (err as Error).message);
    }
  }
}
