// OWNED BY YOU. Precise state and action types, and the invariants they must keep.
// Route: treasure (see src/genre.ts). Field names match fixtures/treasure/F01-F11.

/** A board square. x grows to the east, y grows to the south; (0, 0) is the top-left corner. */
export interface Position {
  readonly x: number; // invariant: whole number, 0 <= x < config.width
  readonly y: number; // invariant: whole number, 0 <= y < config.height
}

/** The four permitted move directions (a literal union, like SwitchAction in W2.04). */
export type Direction = "north" | "east" | "south" | "west";

/** Whether the game can still accept moves. */
export type GameStatus = "playing" | "won" | "lost";

/** The game state your rules return and the page paints. Exactly these 5 fields (tests use deepStrictEqual). */
export interface GameState {
  readonly position: Position; // invariant: always on the board and never on a wall square
  readonly movesRemaining: number; // invariant: never negative; starts at config.initialMoves
  readonly score: number; // invariant: never negative; equals the sum of the values of the collected treasures
  readonly collected: readonly string[]; // invariant: treasure IDs from config.treasures, no duplicates, in pickup order
  readonly status: GameStatus; // invariant: once "won" or "lost", no further move is accepted (GAME_COMPLETE)
}

/**
 * One permitted player action.
 *
 * `direction` is deliberately NOT optional: this type describes a *valid* action. Bad input such as
 * F10A ("up") or F10B (no direction) still reaches evaluate() at runtime from untrusted data, and the
 * rules reject it with INVALID_ACTION; making the field optional would only weaken the type for every
 * caller without helping that runtime check (W2.04 Q17: types can't decide that).
 */
export interface GameAction {
  readonly type: "move";
  readonly direction: Direction;
}

/** Why a move was rejected; the 4 reason codes used by the fixtures. */
export type RejectReason = "WALL" | "EDGE" | "GAME_COMPLETE" | "INVALID_ACTION";

/** The result envelope every evaluate() call returns: { accepted, reason, state }. */
export interface RuleResult {
  readonly accepted: boolean;
  readonly reason: RejectReason | null; // invariant: null exactly when accepted is true
  readonly state: GameState; // invariant: when rejected, equal to the input state (F03, F10B)
}
