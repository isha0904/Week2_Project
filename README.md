# Week 2 Project: Playable TypeScript Game

A browser-based **treasure hunt** game built in TypeScript as Project 2 of the BP Early Careers Software
Engineering programme (Week 2: TypeScript Programming).

The player starts in the top-left corner of a 3×3 board with 6 moves, picks up the treasure, and must
reach the exit before running out of moves.

```
        x=0     x=1     x=2
y=0     START   .       TREASURE (+10)
y=1     .       WALL    .
y=2     .       .       EXIT
```

- Each move (North, East, South, West) costs one move.
- Stepping on the treasure adds 10 points, once.
- Reaching the exit **with** the treasure wins. Running out of moves first loses.
- Moves into the wall, off the board, after the game has ended, or with an unknown direction are
  rejected, and nothing changes.

## Tech stack

| Area | Used |
|---|---|
| Language | TypeScript 5.9.3 (strict mode), compiled to ES2022 modules |
| Runtime | Node.js 22 |
| Front end | Plain HTML, CSS and the browser DOM (no framework) |
| Game-data API and event collector | Local Node.js server (supplied by the course) |
| Rule tests | Node's built-in test runner (`node:test`) |
| Browser tests | Playwright 1.61.0 (Chromium) |
| Release tooling | Python 3 (`tools/release.py`): pack and SHA-256 verify |

## What I built

### Typed models: `p2/src/models.ts`
- `GameState` with five read-only fields: `position`, `movesRemaining`, `score`, `collected` and `status`.
- Literal union types for `Direction`, `GameStatus` (`playing` / `won` / `lost`) and `RejectReason`
  (`WALL` / `EDGE` / `GAME_COMPLETE` / `INVALID_ACTION`).
- An invariant written beside each field, for example "movesRemaining: never negative".

### Game rules: `p2/src/rules.ts`
- `initialState`, `evaluate` and `isFinished` as **pure functions**: no DOM, network or randomness,
  and the input state is never changed.
- Checks in this order: game over → invalid action → off the board → wall → accept the move.
- An accepted move costs one move, collects the treasure once, and checks for a win before checking
  for a loss.
- A runtime direction check, so bad input such as `"up"` or a missing direction is rejected instead
  of crashing.

### Game-data loading: `p2/src/api.ts`
- Loads the board from `GET /api/boards/reference` in three steps: request, read JSON, verify.
- A separate message for each failure: network error, HTTP error (e.g. 503), malformed JSON, and an
  unexpected board definition.

### Browser app: `p2/src/app.ts`
- Start, Restart and Reload buttons, and North/East/South/West move buttons.
- Shows the game state after every move, the result ("Moved east." / "Rejected north: EDGE") and a
  status line. A loss shows "--Game Over-- Try Again!".
- The move buttons are disabled once the game is won or lost.
- A visual board showing the player, the treasure, the exit, the wall and arrows on the squares the
  player can move to.
- Loading and error messages appear in the "Game data" area only. A failed reload keeps the current game.
- Records every move as an event (run ID, sequence, action, accepted, state before and after) in the
  local event view. A failed recording never undoes the move.

### Tests: `p2/tests/`
- The course's contract fixtures F01–F11: 13 rule tests, all passing.
- My own regression test (`learner.test.mjs`): an invalid direction after a win is rejected as
  `GAME_COMPLETE` and the state is unchanged.
- 10 Playwright browser tests (lifecycle, rejections, loading and failures, events), all passing.

### Release: `releases/playable-01`
- Packed with `tools/release.py pack` (47 files, each with a SHA-256 checksum in `release.json`) and
  confirmed with `verify`.
- Run from its own folder with `serve.py`. The browser tests also pass against the running release.

### Evidence: `p2/evidence.md`
- Written evidence for all seven project outcomes: test runs, page observations, the event-view rows,
  a debugging write-up and the release checks.

## Folder layout

```
Week2_Project_Playable_typescript/
├── p2/                       the project: source, tests, supplied files and evidence
│   ├── src/                  models.ts, rules.ts, api.ts, app.ts, genre.ts (+ supplied/)
│   ├── tests/                fixture tests, learner test, browser tests
│   ├── server/               local game-data API and event collector (supplied)
│   ├── tools/                release and recovery tools (supplied)
│   └── evidence.md
└── releases/
    └── playable-01/          packed, verified local release
```
