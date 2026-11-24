// OWNED BY YOU. The application adapter: load -> start -> dispatch -> restart.
//
// Supplied boundary you call:
//   connect(GENRE, { dispatch, start, restart, reload })   once, at startup (src/supplied/controls.ts)
//   playable(enabled)                                      enable/disable the action buttons
//   paint(state)                                           show the state you choose (src/supplied/render.ts)
//   text(region, message)                                  "api" | "status" | "result" | "telemetry"
//   identify(runId)                                        show the run ID and point the event link at it
//   newRunId(), recordEvent(event)                         event helper (src/supplied/telemetry.ts)
//
// This file holds the only mutable state in the app (config, the current session). The rules stay pure:
// app.ts asks evaluate() for a result and decides what to keep and show.
import { GENRE } from "./genre.js";
import { loadConfig } from "./api.js";
import { evaluate, initialState, isFinished } from "./rules.js";
import { connect, playable } from "./supplied/controls.js";
import { identify, paint, text } from "./supplied/render.js";
import { newRunId, recordEvent } from "./supplied/telemetry.js";
// --- retained state -------------------------------------------------------------------------------
/** The last VERIFIED game data. A failed reload never replaces it. */
let config = null;
/** The current game, or null before the first start. A failed reload never clears it. */
let session = null;
/** Counts load requests, so an older, slower response cannot overwrite a newer one. */
let loadNumber = 0;
// --- game data ------------------------------------------------------------------------------------
/** Request the game data. Transport results go to the "api" region only, never to the game status. */
async function load() {
    const mine = ++loadNumber;
    text("api", "Loading game data...");
    try {
        const loaded = await loadConfig();
        if (mine !== loadNumber)
            return; // a newer request has started; ignore this one
        config = loaded;
        text("api", `Game data verified: ${loaded.name}`);
        if (!session)
            text("status", "Ready. Press Start game.");
    }
    catch (error) {
        if (mine !== loadNumber)
            return;
        // Keep the last confirmed config and session; only report the failure.
        text("api", error instanceof Error ? error.message : String(error));
        if (!config)
            text("status", "No game can start until the game data is verified.");
    }
}
// --- lifecycle ------------------------------------------------------------------------------------
/** Start (or restart) a fresh game: new run ID, fresh initial state, sequence back to zero. */
function begin() {
    if (!config) {
        text("status", "No game can start until the game data is verified.");
        return;
    }
    session = { runId: newRunId(), state: initialState(config), sequence: 0 };
    identify(session.runId);
    show(session.state);
    playable(true);
    text("status", "Playing. Find the treasure, then reach the exit.");
    text("result", "No action yet");
    text("telemetry", "No event recorded yet");
}
// --- board picture --------------------------------------------------------------------------------
// A visual aid only: drawn from the same config + state that paint() shows, never read back by the game.
// It sits beside the supplied #state list (not inside it), so the supplied page checks are unaffected.
// Every square has a symbol AND a text label, so colour is never the only signal (see site.css).
/** Arrow showing which button reaches each square next to the player. */
const ARROWS = [
    { dx: 0, dy: -1, arrow: "↑", name: "North" },
    { dx: 1, dy: 0, arrow: "→", name: "East" },
    { dx: 0, dy: 1, arrow: "↓", name: "South" },
    { dx: -1, dy: 0, arrow: "←", name: "West" },
];
/** The board container, created once and placed just before the supplied #state list. */
function boardElement() {
    const existing = document.getElementById("board");
    if (existing)
        return existing;
    const board = document.createElement("div");
    board.id = "board";
    board.setAttribute("role", "img");
    board.style.cssText = "display:grid;gap:.25rem;width:max-content;margin:0 0 .9rem";
    const legend = document.createElement("p");
    legend.id = "board-legend";
    legend.style.cssText = "margin:0 0 .4rem;color:var(--muted);font-size:.9rem";
    legend.textContent = "🙂 you · 💰 treasure · 🚪 exit · ▓ wall · arrows = squares you can move to";
    const list = document.getElementById("state");
    list?.before(legend, board);
    return board;
}
/** Draw the board for this state: player, walls, uncollected treasure, exit and the reachable squares. */
function drawBoard(cfg, state) {
    const board = boardElement();
    board.style.gridTemplateColumns = `repeat(${cfg.width}, 3.5rem)`;
    const at = (p, x, y) => p.x === x && p.y === y;
    const cells = [];
    for (let y = 0; y < cfg.height; y++) {
        for (let x = 0; x < cfg.width; x++) {
            const isWall = cfg.walls.some((w) => at(w, x, y));
            const treasure = cfg.treasures.find((t) => at(t, x, y) && !state.collected.includes(t.id));
            const isExit = at(cfg.exit, x, y);
            const isPlayer = at(state.position, x, y);
            const step = ARROWS.find((a) => state.position.x + a.dx === x && state.position.y + a.dy === y);
            const canMove = step !== undefined && !isWall && state.status === "playing";
            let symbol = "";
            let label = "empty";
            if (isWall)
                [symbol, label] = ["▓", "wall"];
            else if (isPlayer)
                [symbol, label] = [state.status === "won" ? "🏆" : state.status === "lost" ? "😞" : "🙂", "you"];
            else if (treasure)
                [symbol, label] = ["💰", `treasure ${treasure.id} (+${treasure.value})`];
            else if (isExit)
                [symbol, label] = ["🚪", "exit"];
            if (isPlayer && isExit)
                label = "you, on the exit";
            if (canMove && !isPlayer) {
                symbol = symbol ? `${symbol}${step.arrow}` : step.arrow;
                label += `, reachable with ${step.name}`;
            }
            const cell = document.createElement("div");
            cell.textContent = symbol;
            cell.title = `(${x},${y}) ${label}`;
            cell.setAttribute("aria-label", `(${x},${y}) ${label}`);
            cell.style.cssText = [
                "width:3.5rem;height:3.5rem;display:flex;align-items:center;justify-content:center;white-space:nowrap",
                "font-size:1.4rem;border-radius:.3rem;border:.12rem solid #c9d2db;background:var(--paper)",
                isWall ? "background:#4f5d6b;color:#fff;border-color:#4f5d6b" : "",
                isPlayer ? "border:.2rem solid var(--accent);font-weight:700" : "",
                canMove && !isPlayer ? "border:.15rem dashed var(--accent);color:var(--accent);font-weight:700" : "",
            ].join(";");
            cells.push(cell);
        }
    }
    board.replaceChildren(...cells);
    board.setAttribute("aria-label", `Board ${cfg.width} by ${cfg.height}; you are at (${state.position.x},${state.position.y})`);
}
/** Paint the supplied state list and the board picture together. */
function show(state) {
    paint(state);
    if (config)
        drawBoard(config, state);
}
// --- actions --------------------------------------------------------------------------------------
/** Status line for the current state. */
function describe(state) {
    if (state.status === "won")
        return `You won with ${state.score} points and ${state.movesRemaining} moves left.`;
    if (state.status === "lost")
        return "Out of moves: you lost. Press Restart to try again.";
    return `Playing. ${state.movesRemaining} moves left.`;
}
/** One button press: ask the rules, keep what they return, paint it, then record the event. */
function dispatch(action) {
    if (!config || !session) {
        text("status", "Press Start game first.");
        return;
    }
    const current = session; // the session this action belongs to, even if Restart is pressed later
    const before = current.state;
    const result = evaluate(config, before, action);
    // Keep the returned state. On a rejection it is the same state, so nothing changes.
    current.state = result.state;
    current.sequence += 1;
    show(current.state);
    text("result", result.accepted ? `Moved ${action.direction}.` : `Rejected ${action.direction}: ${result.reason}`);
    text("status", describe(current.state));
    playable(!isFinished(current.state));
    // Record AFTER the game has moved on. A failed recording is reported but never undoes the action.
    text("telemetry", "Recording...");
    recordEvent({
        runId: current.runId,
        sequence: current.sequence,
        action: action.direction,
        accepted: result.accepted,
        before,
        after: result.state,
    }).then(() => { if (session === current)
        text("telemetry", "Recorded locally"); }, () => { if (session === current)
        text("telemetry", "Local recording unavailable"); });
}
// --- startup --------------------------------------------------------------------------------------
connect(GENRE, {
    dispatch,
    start: begin,
    restart: begin,
    reload: () => void load(),
});
playable(false); // nothing to move until a game has started
text("status", "Waiting for game data...");
void load();
//# sourceMappingURL=app.js.map