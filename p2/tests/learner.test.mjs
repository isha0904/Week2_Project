// OWNED BY YOU. Your changed-input regression with an INDEPENDENT expected value.
//
// Choose an input the contract fixtures do not already cover (a changed invalid or completion input
// from your brief), work out the expected result by hand from the rules BEFORE running it, and assert
// the whole result: accepted, reason and every state field. Also check the input was not mutated.
// Keep the test that failed before your repair; do not weaken it to get a green result.
//
// Run with: npm run check:rules   (it builds first, then imports the compiled rules from dist/)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseConfig } from "../dist/supplied/config.js";
import * as rules from "../dist/rules.js";

const board = JSON.parse(readFileSync(new URL("../fixtures/board-reference.json", import.meta.url), "utf8"));
const config = parseConfig("treasure", board);

/** Freeze every nested object so an accidental mutation throws instead of passing silently. */
function deepFreeze(value) {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// Changed input: F09A's completed (won) state, but with F10A's INVALID direction "up".
// No fixture combines "game already over" with "invalid action".
//
// Worked out by hand BEFORE running, from the rule order in src/rules.ts:
//   1. status is "won", so the game is over -> rejected with GAME_COMPLETE (checked first)
//   2. the invalid direction is never reached, so the reason is NOT INVALID_ACTION
//   3. rejected -> the state comes back exactly as it went in
test("learner regression: invalid direction after a win is rejected as GAME_COMPLETE", () => {
  const before = {
    position: { x: 2, y: 2 },
    movesRemaining: 2,
    score: 10,
    collected: ["t1"],
    status: "won",
  };
  const state = deepFreeze(structuredClone(before));
  const action = deepFreeze({ type: "move", direction: "up" });

  const result = rules.evaluate(config, state, action);

  assert.deepStrictEqual(result, {
    accepted: false,
    reason: "GAME_COMPLETE",
    state: {
      position: { x: 2, y: 2 },
      movesRemaining: 2,
      score: 10,
      collected: ["t1"],
      status: "won",
    },
  });
  assert.deepStrictEqual(state, before, "evaluate() must not mutate its input state");
});
