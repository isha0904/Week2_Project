// OWNED BY YOU. Pure rules: no DOM, clock, randomness or I/O, and never mutate an input.
//
//   initialState(config)                 -> a fresh state for the validated configuration
//   evaluate(config, state, action)      -> { accepted, reason, state }   (see GAME-CONTRACT.md)
//
// The starter deliberately has NO rule implementation, so `npm run check:rules` is red until you
// write these two functions. Narrow the `config` parameter to TreasureConfig or RangeConfig once
// you have chosen your route in src/genre.ts.

import type { TreasureConfig } from "./supplied/config.js";
import type { Direction, GameAction, GameState, GameStatus, RejectReason, RuleResult } from "./models.js";

export function initialState(config: TreasureConfig): GameState {
  return {
    position: { x: config.start.x, y: config.start.y },
    movesRemaining: config.initialMoves,
    score: 0,
    collected: [],
    status: "playing",
  };
}

/** One square in each direction. y grows to the south, so north is y - 1. */
const STEPS: Readonly<Record<Direction, { readonly dx: number; readonly dy: number }>> = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
};

/** Runtime check: true only for "north" | "east" | "south" | "west" (Object.hasOwn skips "toString" etc.). */
function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && Object.hasOwn(STEPS, value);
}

/** A rejected action: nothing changes, so the input state is passed straight back. */
function reject(reason: RejectReason, state: GameState): RuleResult {
  return { accepted: false, reason, state };
}

export function evaluate(config: TreasureConfig, state: GameState, action: GameAction): RuleResult {
  // Game over (F09A won, F09B lost): checked FIRST, so nothing is accepted once the game has ended.
  if (isFinished(state)) {
    return reject("GAME_COMPLETE", state);
  }

  // Invalid action (F10A "up", F10B no direction): the TYPE says direction is a Direction, but the
  // action can come from untrusted data at runtime, so check the actual value (W2.04 Q17).
  if (action.type !== "move" || !isDirection(action.direction)) {
    return reject("INVALID_ACTION", state);
  }

  const step = STEPS[action.direction];
  const position = { x: state.position.x + step.dx, y: state.position.y + step.dy };

  // Edge (F04): the new square must be on the board, 0 <= x < width and 0 <= y < height.
  if (position.x < 0 || position.x >= config.width || position.y < 0 || position.y >= config.height) {
    return reject("EDGE", state);
  }

  // Wall (F03): rejected, and the SAME input state is returned unchanged.
  if (config.walls.some((wall) => wall.x === position.x && wall.y === position.y)) {
    return reject("WALL", state);
  }

  // Treasure (F05): landing on a treasure not yet collected adds its value and records its ID once.
  let score = state.score;
  let collected = state.collected;
  const treasure = config.treasures.find((t) => t.x === position.x && t.y === position.y);
  if (treasure && !collected.includes(treasure.id)) {
    score += treasure.value;
    collected = [...collected, treasure.id]; // a new array: never push onto the input
  }

  // Status: WIN is checked BEFORE the zero-budget loss (F07), so a win on the last move is a win.
  const movesRemaining = state.movesRemaining - 1;
  const onExit = position.x === config.exit.x && position.y === config.exit.y;
  const hasAllTreasure = config.treasures.every((t) => collected.includes(t.id));
  let status: GameStatus = "playing";
  if (onExit && hasAllTreasure) {
    status = "won"; // F06; F11: on the exit WITHOUT the treasure stays "playing"
  } else if (movesRemaining === 0) {
    status = "lost"; // F08
  }

  // Accepted move (F02): a NEW state object with the new position and one move spent.
  return {
    accepted: true,
    reason: null,
    state: { ...state, position, movesRemaining, score, collected, status },
  };
}

/** True when no further action can be accepted (used by your app to disable the action buttons). */
export function isFinished(state: GameState): boolean {
  return state.status !== "playing";
}
