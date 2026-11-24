// OWNED BY YOU. Request the game data, separate HTTP and JSON failures, and call parseConfig.
//
// Route: GET /api/boards/reference (treasure) or GET /api/ranges/reference (range), same origin.
// Report each failure kind with its own message: network/HTTP failure, malformed JSON, and an
// unexpected definition (parseConfig throws ConfigError). Transport problems are not game status.

import { GENRE } from "./genre.js";
import { ConfigError, parseConfig } from "./supplied/config.js";
import type { ConfigFor } from "./supplied/config.js";

/** The four ways loading can fail. Each one gets its own message, shown in the "api" region. */
export type LoadFailure = "network" | "http" | "malformed" | "unexpected";

/** Thrown by loadConfig. `kind` says which step failed; `message` is ready to show on the page. */
export class GameDataError extends Error {
  readonly kind: LoadFailure;

  constructor(kind: LoadFailure, message: string) {
    super(message);
    this.name = "GameDataError";
    this.kind = kind;
  }
}

/** Same-origin game-data route for the chosen genre. */
const ROUTE = GENRE === "treasure" ? "/api/boards/reference" : "/api/ranges/reference";

/**
 * Load and verify the game data in three separate steps, so each failure is reported on its own:
 *   1. request  -> network failure (no response) or HTTP failure (e.g. 503)
 *   2. JSON     -> malformed body (200 OK, but not valid JSON)
 *   3. verify   -> unexpected definition (valid JSON, but parseConfig rejects it)
 * Resolves with the validated, frozen config. Never touches game state: that is the caller's job.
 */
export async function loadConfig(): Promise<ConfigFor<typeof GENRE>> {
  // 1. Request. fetch() only rejects when there is no response at all (server down, offline).
  let response: Response;
  try {
    response = await fetch(ROUTE, { headers: { Accept: "application/json" } });
  } catch {
    throw new GameDataError("network", `Game data request failed: network error (is the server running?)`);
  }
  // A response arrived, but fetch() does NOT reject on 4xx/5xx, so check the status ourselves.
  if (!response.ok) {
    throw new GameDataError("http", `Game data request failed: HTTP ${response.status} ${response.statusText}`.trim());
  }

  // 2. JSON. Read the body as text first, so a broken body is reported as malformed, not as a crash.
  let data: unknown;
  try {
    data = JSON.parse(await response.text());
  } catch {
    throw new GameDataError("malformed", "Game data is malformed: the response is not valid JSON");
  }

  // 3. Verify. parseConfig checks the shape and that it is exactly the reference definition.
  try {
    return parseConfig(GENRE, data);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw new GameDataError("unexpected", `Unexpected game data: ${error.message}`);
    }
    throw error; // a programming error, not a data problem: let it surface
  }
}
