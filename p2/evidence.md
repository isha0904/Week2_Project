# Project 2 evidence: playable TypeScript game

Owned by you. Write, speak, annotate or record each response; a pair shares the artifact but gives two
individual responses. Record observations you actually made, not what you expected to see.

Learner id (synthetic, e.g. 'learner-01'): LEARNER-21  Pair/team id (e.g. 'p2-team-a'): NONE
Genre route chosen in 'src/genre.ts' ('treasure' / 'range') and the game identity kept from your brief:
'treasure' (GENRE = "treasure" satisfies Genre). Game identity: treasure hunt on the reference 3x3 board

## 1. Plan check (Thursday PM, minute 0-20)
- Brief, minimum slice and acceptance examples brought from W2.10:
  - Game: treasure hunt on a 3x3 board - find the treasure, then reach the exit before running out of moves.
  - Minimum slice: A player starts at (0,0) with 6 moves, uses the North/East/South/West buttons to move
    one square at a time (collecting the treasure t1 at (2,0) for +10 points), and finishes when they reach
    the exit (2,2) holding the treasure (won) or run out of moves first (lost).
  - Deferred: more boards/levels, more treasures, graphics beyond a simple board picture, accounts and
    scores saved between games. The promise survives without them: start, move, collect, win/lose and
    restart all work on the one reference board.
  - Acceptance examples (Given / When / Then):

    | Promise | Given | When | Then | Evidence |
    |---|---|---|---|---|
    | Start | page loaded, game data verified | Start game | (0,0), 6 moves, score 0, collected none, playing | F01; section 5 |
    | Action | (0,0), 6 moves, playing | East | (1,0), 5 moves, accepted | F02; section 5 |
    | Progress | (1,0), 5 moves | East onto the treasure | (2,0), 4 moves, score 10, collected t1 (only once) | F05; section 5 |
    | Finish (public start) | Start | East, East, South, South | (2,2), 2 moves, score 10, status won, buttons disabled | F06; section 5 |
    | Invalid action (during play) | (1,0), 5 moves, playing | South into the wall (1,1) | rejected WALL, state unchanged | F03; browser rejected-action check |



- The seven outcomes and which owned file delivers each:
  1. Typed models -> 'src/models.ts'
  2. Core logic (pure rules + regression) -> 'src/rules.ts', 'tests/learner.test.mjs'
  3. Browser lifecycle (start -> progress -> finish -> restart) -> 'src/app.ts'
  4. API loading and failure -> 'src/api.ts' (called from 'src/app.ts')
  5. Debugging (reproduce, narrow fix, regression) -> whichever owned file held the fault ('src/rules.ts' here)
  6. Event recording -> 'src/app.ts' (calls the supplied 'recordEvent')
  7. Release -> no owned file; supplied 'tools/release.py' packs the built source

## 2. Typed models (acceptance 1)
- Field names, permitted actions and one invariant (quote 'src/models.ts'):

  '''
  export type Direction = "north" | "east" | "south" | "west";
  export type GameStatus = "playing" | "won" | "lost";

  export interface GameState {
    readonly position: Position; // invariant: always on the board and never on a wall square
    readonly movesRemaining: number; // invariant: never negative; starts at config.initialMoves
    readonly score: number; // invariant: never negative; equals the sum of the values of the collected treasures
    readonly collected: readonly string[]; // invariant: treasure IDs from config.treasures, no duplicates, in pickup order
    readonly status: GameStatus; // invariant: once "won" or "lost", no further move is accepted (GAME_COMPLETE)
  }

  export interface GameAction {
    readonly type: "move";
    readonly direction: Direction;
  }

  export type RejectReason = "WALL" | "EDGE" | "GAME_COMPLETE" | "INVALID_ACTION";
  '''

  Permitted action: only '{ type: "move", direction }' with one of the 4 directions. 'direction' is kept
  required, not optional: bad input (F10A "up", F10B missing) arrives at runtime, so 'evaluate' rejects it
  with INVALID_ACTION; types cannot decide that (W2.04 Q17).
- Incompatible value you tried, the compiler diagnostic (code + message), and the restored valid source:


$ npm run build

> p2-playable-typescript-game@1.0.0 build
> tsc -p tsconfig.json

src/models.ts:48:7 - error TS2322: Type '"paused"' is not assignable to type 'GameStatus'.

48 const bad: GameStatus = "paused";
         ~~~


Found 1 error in src/models.ts:48

The compiler rejected a status that isn't in the union.


## 3. Core logic (acceptance 2)
- 'npm run check:rules' result (first red run, then green): paste the pass/fail/skipped lines.

  First red run (after 'initialState' only; 'evaluate' still threw "not implemented"):

  '''
  ok 1 - F01 Start: initial state from the reference board
  not ok 2 - F02 ... not ok 13 - F11   (F02-F11 all failing)
  not ok 20 - learner regression: changed-input case (not written yet)
  # tests 20
  # pass 1
  # fail 13
  # skipped 6
  '''

  Then one fixture group at a time: pass 3 (F02 move) -> 4 (F03 WALL) -> 6 (F04 EDGE, F05 treasure)
  -> 9 (F06-F08 won/lost, win checked before loss) -> 11 (F09A/B GAME_COMPLETE) -> 13 (F10A/B INVALID_ACTION).

  Green run (F01-F11 and the learner regression):

  '''
  ok 1 - F01 ... ok 13 - F11   (all 13 fixture cases)
  ok 20 - learner regression: invalid direction after a win is rejected as GAME_COMPLETE
  # tests 20
  # pass 14
  # fail 0
  # skipped 6
  '''

  The 6 skipped are R01-R05B (range route; 'src/genre.ts' selects "treasure").

- Your changed-input regression: before-state, action, expected result worked out by hand **before** running:
  - Changed input: F09A's completed (won) state combined with F10A's invalid direction. No fixture combines
    "game already over" with "invalid action".
  - Before-state: '{ position: {x:2, y:2}, movesRemaining: 2, score: 10, collected: ["t1"], status: "won" }'
  - Action: '{ type: "move", direction: "up" }'
  - Expected by hand: 'evaluate' checks "game over" first, so the result is
    '{ accepted: false, reason: "GAME_COMPLETE", state: <same 5 fields as before> }'. The invalid direction
    is never reached, so the reason is not 'INVALID_ACTION'.
  - Actual: as expected, passed on its first run ('ok 20' above). It did not fail first, because the
    rules were already complete when the test was written.

- Evidence that inputs are unchanged and invalid/completed actions are rejected:
  - Every fixture case deep-freezes the input state and action, then checks 'JSON.stringify(state)' is identical after 'evaluate' (any mutation would throw or fail). All 13 pass.
  - The learner test also deep-freezes its input and asserts 'state' deep-equals the original afterwards.
  - Rejected actions return the input state unchanged: F03 'WALL', F04 'EDGE', F09A/F09B 'GAME_COMPLETE'
    (after won / lost), F10A/F10B 'INVALID_ACTION' ("up" / no direction).
  - Without the game-over check, F09B (lost, 0 moves) would have moved and made 'movesRemaining' -1,
    breaking the "never negative" invariant in 'src/models.ts'.

## 4. Checkpoints
- Minute 120: start / accepted / rejected checks you can show:
  - Start: F01, 'initialState' gives (0,0), 6 moves, score 0, collected [], "playing".
  - Accepted: F02, East from (0,0) gives (1,0) with 5 moves.
  - Rejected: F03 WALL (South from (1,0) into the wall at (1,1)), state unchanged.
  - All shown by 'npm run check:rules' (pass 14, fail 0, skipped 6).

- Minute 180: one browser action rendered from returned state; the remaining handoff:
  - Action: Start game -> East. 'app.ts' called 'evaluate(config, state, { type: "move", direction: "east" })',
    kept the returned state and painted it: position (1,0), movesRemaining 5, score 0, collected none,
    status playing. Result "Moved east.", recording "Recorded locally"; the board showed 🙂 one square east.
  - Remaining handoff: failure messages observed on the page, the event-view row, the release
    (pack, verify, browser checks against the release) and the evidence write-up.

- Minute 270 (midpoint, about 60 percent): what is complete, what remains, support requested:
  - Complete: typed models, rules (14 pass / 0 fail), learner regression, 'api.ts', 'app.ts', supplied
    browser checks 10 passed.
  - Remains: release (pack, verify, browser checks against the release); observations for sections 5, 6
    and 8; my own parts of sections 1, 10 and 11.
  - Support requested: guided AI assistance (Claude Code) to write some code syntax, and to explain terminal commands (Git Bash vs PowerShell paths, 'P2_URL').

## 5. Browser lifecycle (acceptance 3)
- Public start -> progress -> finish -> fresh restart: steps and what the page showed at each:
  - 'src/app.ts' written: keeps the verified config and the current session (run ID, state, sequence);
    Start/Restart -> 'initialState' + new run ID + 'paint'; each button -> 'evaluate', keep the returned
    state, 'paint', show accepted/rejected reason, disable buttons when 'isFinished'; then 'recordEvent'.

  - Supplied browser checks, first run after wiring ('npm run check:browser'):

    '''
    ok  1 events.spec.mjs › an actual action is recorded and visible in the local event view
    ok  2 events.spec.mjs › a restart starts a new run whose sequence begins at one
    ok  3 events.spec.mjs › collector failure is reported without undoing the action
    ok  4 lifecycle.spec.mjs › public start, progress, finish and fresh restart
    ok  5 lifecycle.spec.mjs › a rejected action is reported and leaves the state unchanged
    ok  6 request-failure.spec.mjs › loading is visible before the response, then the data is verified
    ok  7 request-failure.spec.mjs › HTTP failure is reported and no game starts from it
    ok  8 request-failure.spec.mjs › malformed JSON is reported and no game starts from it
    ok  9 request-failure.spec.mjs › unexpected definition is reported and no game starts from it
    ok 10 request-failure.spec.mjs › a failed reload preserves the last confirmed session
    10 passed (12.3s)
    '''

  - Public path on the page: open -> Start -> East, East, South, South -> Restart. What the page showed:

    | Step | Game status / result | State (position, moves, score, collected, status) | Buttons |
    |---|---|---|---|
    | Open | "Ready. Press Start game." / "No action yet". Run ID: not started | empty | disabled |
    | Start | "Playing. Find the treasure, then reach the exit." Run ID: run-ca38704d | (0,0), 6, 0, none, playing | enabled |
    | East | "Playing. 5 moves left." / "Moved east." | (1,0), 5, 0, none, playing | enabled |
    | East | "Playing. 4 moves left." / "Moved east." (treasure picked up) | (2,0), 4, 10, t1, playing | enabled |
    | South | "Playing. 3 moves left." / "Moved south." | (2,1), 3, 10, t1, playing | enabled |
    | South | "You won with 10 points and 2 moves left." / "Moved south." | (2,2), 2, 10, t1, won | disabled |
    | Restart | "Playing. Find the treasure, then reach the exit." / "No action yet". New run ID: run-db2e79c6 | (0,0), 6, 0, none, playing | enabled |

    Every action showed "Recorded locally". After the win all four move buttons were disabled; Restart gave
    a fresh state and a different run ID.

  - My own run by hand ('npm start', then the same 4 moves). Server log, showing the page load, the
    verified game-data request and one 'POST /api/events' (201) per move:

    P2 (development) listening on http://127.0.0.1:4182/
Local event view: /events.html  (process memory only; Ctrl+C discards stored events)
{"ts":"2026-11-19T09:10:08.607Z","job":"academy-p2","request_id":"b126e952-5f98-4b68-9147-d036b688f7d8","method":"GET","path":"/","status":200,"duration_ms":37,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.662Z","job":"academy-p2","request_id":"20e09f0c-87e1-4289-b595-473305399b59","method":"GET","path":"/dist/app.js","status":200,"duration_ms":3,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.663Z","job":"academy-p2","request_id":"e1509d7f-9179-4c9d-bcf5-64b40923c494","method":"GET","path":"/site.css","status":200,"duration_ms":6,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.687Z","job":"academy-p2","request_id":"4c7deeb0-6728-4ea7-9814-24ce8eaa5060","method":"GET","path":"/dist/genre.js","status":200,"duration_ms":4,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.688Z","job":"academy-p2","request_id":"39133590-2e08-4077-973d-a5a1e40dff3d","method":"GET","path":"/site.css","status":200,"duration_ms":3,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.689Z","job":"academy-p2","request_id":"dd8bed24-7850-4ac0-b5eb-623012342bcd","method":"GET","path":"/dist/supplied/controls.js","status":200,"duration_ms":4,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.694Z","job":"academy-p2","request_id":"97808b6d-5aeb-4165-9c32-4b07ade871bb","method":"GET","path":"/dist/rules.js","status":200,"duration_ms":9,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.705Z","job":"academy-p2","request_id":"653cc5a2-4723-40f6-8c53-f650247b6cd7","method":"GET","path":"/dist/api.js","status":200,"duration_ms":21,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.712Z","job":"academy-p2","request_id":"69b8ade5-fab9-4f8d-ad39-c020c9b096d9","method":"GET","path":"/dist/supplied/render.js","status":200,"duration_ms":26,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.715Z","job":"academy-p2","request_id":"d236638c-4485-49cf-9fd1-1f2e0b75ac45","method":"GET","path":"/dist/supplied/telemetry.js","status":200,"duration_ms":3,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.719Z","job":"academy-p2","request_id":"d9480f22-c71b-4fdb-a9eb-f690d4a9d469","method":"GET","path":"/dist/supplied/config.js","status":200,"duration_ms":5,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.731Z","job":"academy-p2","request_id":"afb79dff-3dd0-483a-aa94-8a5004b75b98","method":"GET","path":"/favicon.ico","status":404,"duration_ms":1,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:08.760Z","job":"academy-p2","request_id":"ac464356-3b1d-4ac5-b1a6-76f42d163b4d","method":"GET","path":"/api/boards/reference","status":200,"duration_ms":35,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:32.152Z","job":"academy-p2","request_id":"0832479a-bdef-47cf-a808-b35ca0e86f7a","method":"POST","path":"/api/events","status":201,"duration_ms":1,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:33.207Z","job":"academy-p2","request_id":"026400eb-12fe-4ffa-8ddd-535097b1595b","method":"POST","path":"/api/events","status":201,"duration_ms":0,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:34.594Z","job":"academy-p2","request_id":"b1a0cae1-44a5-4a4d-956c-51009bf87db9","method":"POST","path":"/api/events","status":201,"duration_ms":0,"release":"development","environment":"local"}
{"ts":"2026-11-19T09:10:35.170Z","job":"academy-p2","request_id":"23f555ab-cb1a-430d-84f9-ba5b52c354a8","method":"POST","path":"/api/events","status":201,"duration_ms":0,"release":"development","environment":"local"}


## 6. API loading and failure (acceptance 4)
- Loading observed before response (how):
  - Supplied server in fault mode "slow" (game data answers after 1.5 s; by hand: 'npm start -- --fault=slow').
    Read the page immediately after it opened, then again after the response:

    '''
    t=0     Game data: "Loading game data..."     Game: "Waiting for game data..."
    t=1.5s  Game data: "Game data verified: Reference treasure hunt"     Game: "Ready. Press Start game."
    '''

  - Also checked by the supplied browser test "loading is visible before the response, then the data is
    verified" (it holds the request, sees /loading/, releases it, sees /verified/): ok.
- Success message: "Game data verified: Reference treasure hunt" (in the "Game data" region).
- HTTP failure / malformed JSON / unexpected definition: message shown for each, and the command or check used:
  - 'src/api.ts' written: 'loadConfig()' has 3 separate steps (request, JSON, verify) and throws a
    'GameDataError' with its own 'kind' and message for each failure.
  - Checked BEFORE the browser was wired: a small Node script ran the compiled 'loadConfig()' against the
    supplied server ('server/app.mjs') in each fault mode. Observed output:

    '''
    normal: OK -> reference, 3x3, initialMoves 6
    http: GameDataError[http] Game data request failed: HTTP 503 Service Unavailable
    malformed: GameDataError[malformed] Game data is malformed: the response is not valid JSON
    unexpected: GameDataError[unexpected] Unexpected game data: Unexpected game definition: this package supports only the fixed reference definition
    down: GameDataError[network] Game data request failed: network error (is the server running?)
    '''

  - On the page ('src/app.ts' wired): the supplied 'request-failure.spec.mjs' intercepts the request and
    passed for each kind: "HTTP failure / malformed JSON / unexpected definition is reported and no game
    starts from it" (each 'ok' in 'npm run check:browser', see section 5). Each message appears in the
    "Game data" region only, never in the game status.
  - On the page, from the supplied server in each fault mode (by hand: 'npm start -- --fault=http' /
    '--fault=malformed' / '--fault=unexpected'), then pressing Start game:

    | Fault | "Game data" region shows | Game status | After Start |
    |---|---|---|---|
    | http (503) | Game data request failed: HTTP 503 Service Unavailable | No game can start until the game data is verified. | no game, State empty (0 rows) |
    | malformed | Game data is malformed: the response is not valid JSON | No game can start until the game data is verified. | no game, State empty (0 rows) |
    | unexpected | Unexpected game data: Unexpected game definition: this package supports only the fixed reference definition | No game can start until the game data is verified. | no game, State empty (0 rows) |

    Each failure has its own message, and the transport detail ("HTTP 503", "malformed", "Unexpected")
    stays in the "Game data" region; the game status only says no game can start.
- Failed reload kept the last confirmed session (state before and after):
  - How: normal server -> Start -> East (Recorded locally) -> stopped the server -> pressed "Reload game data".

    '''
    BEFORE  Game data: "Game data verified: Reference treasure hunt"   Game: "Playing. 5 moves left."
            position (1,0) | movesRemaining 5 | score 0 | collected none | status playing
    AFTER   Game data: "Game data request failed: network error (is the server running?)"
            Game: "Playing. 5 moves left."
            position (1,0) | movesRemaining 5 | score 0 | collected none | status playing
    '''

  - State text identical before and after: true. Move buttons still enabled: true. The failed reload only
    changed the "Game data" message; the last verified board and the current session were kept.
  - Also checked by the supplied browser test "a failed reload preserves the last confirmed session"
    (reload answered HTTP 503): ok.
  - Observed with a small script that started the supplied server ('server/app.mjs') in each fault mode on a
    spare port and read the page in Chromium. Optional: repeat one by hand with 'npm start -- --fault=http'.

## 7. Debugging (acceptance 5)
- Reproducible failing behaviour (input and observed result):
  - Input: F10A, state at (0,0) playing, action '{ type: "move", direction: "up" }' (F10B: no direction).
  - Observed: 'not ok 11 - F10A' and 'not ok 12 - F10B'. 'STEPS["up"]' is 'undefined', so 'step.dx'
    crashed instead of returning a rejection.
- Responsible boundary and the narrow correction:
  - Boundary: 'evaluate' in 'src/rules.ts', where untrusted action data enters the rules. The type
    'GameAction' says direction is always valid, but types are erased at runtime.
  - Narrow correction: added 'isDirection(value)' (a string that is a key of STEPS) and, before the move
    is computed: 'if (action.type !== "move" || !isDirection(action.direction)) return reject("INVALID_ACTION", state);'
- Same regression failing before / passing after (paste both runs):

  '''
  before:  not ok 11 - F10A An unknown direction is rejected as invalid
           not ok 12 - F10B A missing direction is rejected as invalid
           # pass 11   # fail 3
  after:   ok 11 - F10A An unknown direction is rejected as invalid
           ok 12 - F10B A missing direction is rejected as invalid
           # pass 13   # fail 1   (the 1 was the learner test, not yet written)
  '''

- Diagnostic variant requested? (yes/no; when; in which preserved copy): no

## 8. Event (acceptance 6)
- Displayed run ID, sequence, action, acceptance:
  - Run ID on the page: run-ca38704d. First action: sequence 1, "east", accepted (page: "Moved east.",
    "Recorded locally").
- Saved event-view row (paste the row text before stopping the collector):
  - Local event view ('events.html?runId=run-ca38704d'), filtered to this run, 4 rows:

    '''
    Received                 | Run ID       | Seq | Action | Result   | Before -> After
    2026-11-20T06:29:45.235Z | run-ca38704d | 1   | east   | accepted | {"position":{"x":0,"y":0},"movesRemaining":6,"score":0,"collected":[],"status":"playing"}
                                                                        -> {"position":{"x":1,"y":0},"movesRemaining":5,"score":0,"collected":[],"status":"playing"}
    2026-11-20T06:29:45.301Z | run-ca38704d | 2   | east   | accepted | ...(1,0) 5 moves -> (2,0) 4 moves, score 10, collected ["t1"]
    2026-11-20T06:29:45.369Z | run-ca38704d | 3   | south  | accepted | ...(2,0) 4 moves -> (2,1) 3 moves
    2026-11-20T06:29:45.434Z | run-ca38704d | 4   | south  | accepted | ...(2,1) 3 moves -> (2,2) 2 moves, status "won"
    '''

- Comparison of the row's before/after with the page:
  - Row 1 'before' = the page right after Start: (0,0), 6 moves, score 0, collected none, playing.
  - Row 1 'after' = the page after East: (1,0), 5 moves, score 0, collected none, playing.
  - Every row's 'after' equals the next row's 'before' and the page at that step (section 5 table); row 4
    'after' is the won state the page showed. Sequence ran 1-4 for this run, and the restarted run got a
    new run ID (run-db2e79c6), so its events start again at sequence 1.
  - Captured with a script that drove the page and read 'events.html' before the server stopped (the
    collector keeps events in memory only).

## 9. Release (acceptance 7)
- 'npm test' result:

$ npm test

> p2-playable-typescript-game@1.0.0 test
> npm run check:rules && npm run check:browser


> p2-playable-typescript-game@1.0.0 check:rules
> npm run build && node --test tests/fixtures.test.mjs tests/learner.test.mjs


> p2-playable-typescript-game@1.0.0 build
> tsc -p tsconfig.json

✔ F01 Start: initial state from the reference board (1.1957ms)
✔ F02 East from the start is accepted and costs one move (0.406ms)
✔ F03 Moving into the wall is rejected and state is unchanged (0.2087ms)
✔ F04 Moving off the board edge is rejected and state is unchanged (0.0936ms)
✔ F05 Reaching the treasure scores ten and records it once (0.0984ms)
✔ F06 Reaching the exit holding the treasure wins (0.0935ms)
✔ F07 Final-move win: winning is checked before the zero-budget loss (0.1144ms)
✔ F08 Spending the last move without winning loses (0.073ms)
✔ F09A Actions after a win are rejected and state is unchanged (0.4332ms)
✔ F09B Actions after a loss are rejected and state is unchanged (0.3571ms)
✔ F10A An unknown direction is rejected as invalid (0.1158ms)
✔ F10B A missing direction is rejected as invalid (0.054ms)
✔ F11 Reaching the exit without the treasure does not win (0.6403ms)
﹣ R01 Start: two rounds, no score (0.0427ms) # src/genre.ts selects "treasure"
﹣ R02 A hit consumes one round and scores one (0.0303ms) # src/genre.ts selects "treasure"
﹣ R03 A miss consumes one round without score (0.0227ms) # src/genre.ts selects "treasure"
﹣ R04 Using the last round completes the range (0.0199ms) # src/genre.ts selects "treasure"
﹣ R05A An unknown event is rejected and state is unchanged (0.0205ms) # src/genre.ts selects "treasure"
﹣ R05B Events after completion are rejected (0.0196ms) # src/genre.ts selects "treasure"
✔ learner regression: invalid direction after a win is rejected as GAME_COMPLETE (1.2721ms)
ℹ tests 20
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 6
ℹ todo 0
ℹ duration_ms 864.7553

> p2-playable-typescript-game@1.0.0 check:browser
> playwright test


Running 10 tests using 1 worker

  ✓   1 [chromium] › tests\browser\events.spec.mjs:14:1 › an actual action is recorded and visible in the local event view (985ms)
  ✓   2 [chromium] › tests\browser\events.spec.mjs:29:1 › a restart starts a new run whose sequence begins at one (636ms)
  ✓   3 [chromium] › tests\browser\events.spec.mjs:42:1 › collector failure is reported without undoing the action (357ms)
  ✓   4 [chromium] › tests\browser\lifecycle.spec.mjs:5:1 › public start, progress, finish and fresh restart (790ms)
  ✓   5 [chromium] › tests\browser\lifecycle.spec.mjs:26:1 › a rejected action is reported and leaves the state unchanged (444ms)
  ✓   6 [chromium] › tests\browser\request-failure.spec.mjs:5:1 › loading is visible before the response, then the data is verified (241ms)
  ✓   7 [chromium] › tests\browser\request-failure.spec.mjs:27:3 › HTTP failure is reported and no game starts from it (263ms)
  ✓   8 [chromium] › tests\browser\request-failure.spec.mjs:27:3 › malformed JSON is reported and no game starts from it (226ms)
  ✓   9 [chromium] › tests\browser\request-failure.spec.mjs:27:3 › unexpected definition is reported and no game starts from it (299ms)
  ✓  10 [chromium] › tests\browser\request-failure.spec.mjs:37:1 › a failed reload preserves the last confirmed session (435ms)

  10 passed (11.8s)


- Release name, 'pack' and 'verify' output, 'release.json' retained at:

$ python tools/release.py pack ../releases/playable-01
python tools/release.py verify ../releases/playable-01
Rule gate: npm run check:rules

> p2-playable-typescript-game@1.0.0 check:rules
> npm run build && node --test tests/fixtures.test.mjs tests/learner.test.mjs


> p2-playable-typescript-game@1.0.0 build
> tsc -p tsconfig.json

✔ F01 Start: initial state from the reference board (1.2968ms)
✔ F02 East from the start is accepted and costs one move (0.2693ms)
✔ F03 Moving into the wall is rejected and state is unchanged (0.1854ms)
✔ F04 Moving off the board edge is rejected and state is unchanged (0.1057ms)
✔ F05 Reaching the treasure scores ten and records it once (0.1025ms)
✔ F06 Reaching the exit holding the treasure wins (0.0963ms)
✔ F07 Final-move win: winning is checked before the zero-budget loss (0.1173ms)
✔ F08 Spending the last move without winning loses (0.0696ms)
✔ F09A Actions after a win are rejected and state is unchanged (0.2166ms)
✔ F09B Actions after a loss are rejected and state is unchanged (0.2957ms)
✔ F10A An unknown direction is rejected as invalid (0.0995ms)
✔ F10B A missing direction is rejected as invalid (0.0462ms)
✔ F11 Reaching the exit without the treasure does not win (0.5905ms)
﹣ R01 Start: two rounds, no score (0.0407ms) # src/genre.ts selects "treasure"
﹣ R02 A hit consumes one round and scores one (0.0248ms) # src/genre.ts selects "treasure"
﹣ R03 A miss consumes one round without score (0.0192ms) # src/genre.ts selects "treasure"
﹣ R04 Using the last round completes the range (0.0179ms) # src/genre.ts selects "treasure"
﹣ R05A An unknown event is rejected and state is unchanged (0.0184ms) # src/genre.ts selects "treasure"
﹣ R05B Events after completion are rejected (0.0176ms) # src/genre.ts selects "treasure"
✔ learner regression: invalid direction after a win is rejected as GAME_COMPLETE (1.2215ms)
ℹ tests 20
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 6
ℹ todo 0
ℹ duration_ms 647.9805
Packed release playable-01 (treasure): 47 files -> C:\Users\5858vb\BP\Projects_SWEA\releases\playable-01
Run it with: python3 C:\Users\5858vb\BP\Projects_SWEA\releases\playable-01\serve.py
Release playable-01 verified: 47 files match release.json (SHA-256)


- 'P2_URL=http://127.0.0.1:4182 npm run check:browser' result against the running release:

$ cd /c/Users/5858vb/BP/Projects_SWEA/releases/playable-01
python serve.py
P2 (playable-01) listening on http://127.0.0.1:4182/

$ cd /c/Users/5858vb/BP/Projects_SWEA/p2
P2_URL=http://127.0.0.1:4182 npm run check:browser

> p2-playable-typescript-game@1.0.0 check:browser
> playwright test


Running 10 tests using 1 worker

  ✓   1 [chromium] › tests\browser\events.spec.mjs:14:1 › an actual action is recorded and visible in the local event view (1.0s)
  ✓   2 [chromium] › tests\browser\events.spec.mjs:29:1 › a restart starts a new run whose sequence begins at one (1.1s)
  ✓   3 [chromium] › tests\browser\events.spec.mjs:42:1 › collector failure is reported without undoing the action (409ms)
  ✓   4 [chromium] › tests\browser\lifecycle.spec.mjs:5:1 › public start, progress, finish and fresh restart (854ms)
  ✓   5 [chromium] › tests\browser\lifecycle.spec.mjs:26:1 › a rejected action is reported and leaves the state unchanged (525ms)
  ✓   6 [chromium] › tests\browser\request-failure.spec.mjs:5:1 › loading is visible before the response, then the data is verified (224ms)
  ✓   7 [chromium] › tests\browser\request-failure.spec.mjs:27:3 › HTTP failure is reported and no game starts from it (325ms)
  ✓   8 [chromium] › tests\browser\request-failure.spec.mjs:27:3 › malformed JSON is reported and no game starts from it (220ms)
  ✓   9 [chromium] › tests\browser\request-failure.spec.mjs:27:3 › unexpected definition is reported and no game starts from it (249ms)
  ✓  10 [chromium] › tests\browser\request-failure.spec.mjs:37:1 › a failed reload preserves the last confirmed session (385ms)

  10 passed (11.2s)



- Source vs artifact vs process: what each was in your run, and the accurate scope label (local only):
  - Source: my working copy 'p2/' - the TypeScript I edit ('src/*.ts'), tests and supplied files.
    'npm test' (rules 14 pass, browser 10 passed) ran against this source, on a server started from 'p2/'.
  - Artifact: 'releases/playable-01/' - 47 packed files (compiled 'dist/*.js', page, 'site.css', supplied
    'server/', 'fixtures/', 'serve.py'), made by 'release.py pack' only after the rule gate passed.
    'release.json' (kept in 'releases/playable-01/') records name "playable-01", genre "treasure",
    createdUtc 2026-11-19T07:46:49Z, gate "npm run check:rules passed" and a SHA-256 for every file.
    'release.py verify' recomputed them: "47 files match release.json (SHA-256)", so nothing changed after packing.
  - Process: 'python serve.py' run from 'releases/playable-01/' -> "P2 (playable-01) listening on
    http://127.0.0.1:4182/". The page, compiled code, game-data API and event collector all came from the
    artifact, not from 'p2/'. The browser checks ran from 'p2/tests' against that process via 'P2_URL' and
    started no server of their own: 10 passed.
  - Scope label: local only. A local release on 127.0.0.1 on my machine ("not a container or BP deployment",
    as 'release.json' states). Nothing was deployed or published.




## 10. Individual responses
- Changed invalid or completion input: prediction from the brief, execution, actual result:
  - Input: a completed (won) game at the exit, (2,2), 2 moves, score 10, ["t1"], plus an invalid
    direction "up". The game is over AND the action is invalid; no fixture combines the two.
  - Prediction: the rules check "game over" first, so 'GAME_COMPLETE' (not 'INVALID_ACTION'), and the
    state comes back unchanged.
  - Execution: 'tests/learner.test.mjs', run with 'npm run check:rules'.
  - Actual: 'ok 20 - learner regression: invalid direction after a win is rejected as GAME_COMPLETE';
    result '{ accepted: false, reason: "GAME_COMPLETE", state: <unchanged> }', input not mutated.
- Public-start trace and one bounded change you made yourself:
  - Trace: page loads 'dist/app.js' -> 'connect()' wires the buttons -> 'load()' -> 'loadConfig()' in
    'api.ts' -> GET '/api/boards/reference' -> 'parseConfig' verifies it -> "Game data verified" ->
    Start -> 'begin()' -> 'initialState(config)' + 'newRunId()' -> 'identify()' + 'paint()' + board ->
    move buttons enabled.
  - One bounded change I made myself (file, what, why, and the check I ran afterwards):
    - File: 'src/app.ts', function 'describe()' (the game-status text shown for each state).
    - What: changed the lost message from "Out of moves: you lost. Press Restart to try again." to
      "--Game Over-- Try Again!".
    - Why: to give losing a real game feel, like a "Game Over" screen, instead of a plain status sentence.
      It changes presentation only: the rules, the state and the 'status: lost' field are untouched.
    - Check afterwards: 'npm run check:rules' -> pass 14, fail 0, skipped 6; browser checks -> 10 passed.
      Losing path: Start -> East, West, East, West, East, West -> the page showed "--Game Over-- Try Again!",
      status lost, movesRemaining 0, move buttons disabled.
  - Also added: a board picture above the State list, showing me, the treasure, the exit, the wall and arrows on the squares I can move to, so it is easy to see where I am and which button to press next. Details in section 12.

## 11. Assistance and status
- Supplied examples/hints/checkpoints reused (name them):
  - Contract fixtures F01-F11 and 'tests/fixtures.test.mjs' (rules); 'board-reference.json' (learner test).
  - Supplied 'parseConfig'/'ConfigError' ('config.ts'), 'connect'/'playable' ('controls.ts'),
    'paint'/'text'/'identify' ('render.ts'), 'newRunId'/'recordEvent' ('telemetry.ts').
  - Supplied server fault modes (slow, http, malformed, unexpected), browser checks ('tests/browser/'),
    'tools/release.py' (pack, verify) and the release 'serve.py'.
  - W2.04 Q17 hint: types cannot reject bad runtime input ("up", missing direction).
- Status per outcome: completed with guided support. Guided AI assistance (Claude Code) wrote or explained the code step by step; I verified the code, ran the commands, the release and the checks.
- Environment blocked (separately, with what was blocked):
  - 'cd /c/Users/...' failed in PowerShell (Git Bash path style); fixed with the Windows path 'C:\Users\...'.
  - 'npm run check:browser' refused to start while 'npm start' held port 4182; fixed by stopping 'npm start' first (or using 'P2_URL' to test the running server).
  - Nothing blocked permanently.
- Next in-class revisit: 

debug a failing test myself, without assistance. Plan: take one red result (e.g. a fixture that fails after a change), reproduce it with 'npm run check:rules', write down the input and the expected vs actual result, find the responsible function in my owned files, make one narrow fix, and re-run until it turns from 'not ok' to 'ok' with no other test breaking. 
Goal: move debugging (acceptance 5) from "completed with guided support" to "demonstrated independently".

## 12. Extras (beyond the seven outcomes)
- Board picture ('drawBoard' in 'src/app.ts'): a 3x3 grid showing you, the treasure, the exit, the wall and arrows on the squares you can move to. Why: the text-only State list made it hard to see where you are and which button to press next. It is drawn from the same state 'paint()' shows and sits outside '#state', so the rules and the supplied browser checks are unchanged (still 10 passed).
- Race guards in 'src/app.ts': an older, slower game-data response cannot overwrite a newer one, and a late "Recorded locally" from a previous run cannot overwrite the current run's message. Why: quick repeated Reload or Restart clicks could otherwise show stale messages.
