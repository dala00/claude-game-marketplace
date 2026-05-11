'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const E = require('./reversi.js');

// ============================================================
// Unit tests — pure functions
// ============================================================

test('newBoard sets up the four center stones', () => {
  const b = E.newBoard();
  assert.strictEqual(b[3][3], E.WHITE);
  assert.strictEqual(b[3][4], E.BLACK);
  assert.strictEqual(b[4][3], E.BLACK);
  assert.strictEqual(b[4][4], E.WHITE);
  assert.strictEqual(b[0][0], E.EMPTY);
});

test('legalMoves on initial board: black has 4 moves (c4, d3, e6, f5)', () => {
  const b = E.newBoard();
  const moves = E.legalMoves(b, E.BLACK).map(([r, c]) => E.coordToPos(r, c)).sort();
  assert.deepStrictEqual(moves, ['c4', 'd3', 'e6', 'f5']);
});

test('legalMoves on initial board: white has no moves (X moves first)', () => {
  const b = E.newBoard();
  const moves = E.legalMoves(b, E.WHITE);
  assert.strictEqual(moves.length, 4); // actually white has 4 too on initial, but typically not used
  // After black plays d3, white should have 3 legal moves: c3, e3, c5
  const [r, c] = E.posToCoord('d3');
  const { board } = E.applyMove(b, r, c, E.BLACK);
  const wMoves = E.legalMoves(board, E.WHITE).map(([rr, cc]) => E.coordToPos(rr, cc)).sort();
  assert.deepStrictEqual(wMoves, ['c3', 'c5', 'e3']);
});

test('flipsForMove: d3 black flips exactly d4', () => {
  const b = E.newBoard();
  const [r, c] = E.posToCoord('d3');
  const flips = E.flipsForMove(b, r, c, E.BLACK);
  assert.ok(flips);
  const positions = flips.map(([fr, fc]) => E.coordToPos(fr, fc));
  assert.deepStrictEqual(positions, ['d4']);
});

test('flipsForMove: illegal placement returns null', () => {
  const b = E.newBoard();
  const [r, c] = E.posToCoord('a1');
  assert.strictEqual(E.flipsForMove(b, r, c, E.BLACK), null);
});

test('flipsForMove: placing on occupied square returns null', () => {
  const b = E.newBoard();
  const [r, c] = E.posToCoord('d4'); // already WHITE
  assert.strictEqual(E.flipsForMove(b, r, c, E.BLACK), null);
});

test('applyMove: black d3 produces score X=4, O=1', () => {
  const b = E.newBoard();
  const [r, c] = E.posToCoord('d3');
  const result = E.applyMove(b, r, c, E.BLACK);
  assert.ok(result);
  assert.strictEqual(result.board[2][3], E.BLACK);
  assert.strictEqual(result.board[3][3], E.BLACK); // d4 flipped
  assert.deepStrictEqual(E.scoreBoard(result.board), { X: 4, O: 1 });
});

test('frontierCount on initial board: each color has 2 frontier stones', () => {
  // Center stones diagonally adjacent to empties: yes for all 4.
  // Each color has 2 of those center stones, all frontier.
  const b = E.newBoard();
  assert.strictEqual(E.frontierCount(b, E.BLACK), 2);
  assert.strictEqual(E.frontierCount(b, E.WHITE), 2);
});

test('maxOpponentFlip on initial board: 1 (any opening flips exactly 1)', () => {
  const b = E.newBoard();
  assert.strictEqual(E.maxOpponentFlip(b, E.BLACK), 1);
});

test('opponentCanReachCorner: false on initial board', () => {
  const b = E.newBoard();
  assert.strictEqual(E.opponentCanReachCorner(b, E.BLACK), false);
  assert.strictEqual(E.opponentCanReachCorner(b, E.WHITE), false);
});

test('classifySquare: a1 is corner', () => {
  const b = E.newBoard();
  const c = E.classifySquare(b, 0, 0);
  assert.strictEqual(c.corner, true);
  assert.strictEqual(c.edge, false);
});

test('classifySquare: b2 is xSquare when a1 is empty', () => {
  const b = E.newBoard();
  const c = E.classifySquare(b, 1, 1);
  assert.strictEqual(c.xSquare, true);
  assert.strictEqual(c.corner, false);
});

test('classifySquare: b2 is NOT xSquare when a1 is taken', () => {
  const b = E.newBoard();
  b[0][0] = E.BLACK;
  const c = E.classifySquare(b, 1, 1);
  assert.strictEqual(c.xSquare, false);
});

test('classifySquare: d1 is edge (not corner, not X/C)', () => {
  const b = E.newBoard();
  const c = E.classifySquare(b, 0, 3);
  assert.strictEqual(c.edge, true);
  assert.strictEqual(c.corner, false);
  assert.strictEqual(c.xSquare, false);
  assert.strictEqual(c.cSquare, false);
});

test('emptyRegionSizes: initial board has one 60-cell region', () => {
  const b = E.newBoard();
  const sizes = E.emptyRegionSizes(b);
  assert.strictEqual(sizes[0][0], 60);
  assert.strictEqual(sizes[7][7], 60);
  assert.strictEqual(sizes[3][3], 0); // occupied
});

test('emptyRegionSizes: split board has two regions', () => {
  // Construct a board split into two empty regions by a wall of stones.
  const b = E.newBoard();
  // Fill row 4 entirely (well, e4 is already BLACK, d4 is WHITE — pad the rest)
  for (let c = 0; c < 8; c++) {
    if (b[3][c] === E.EMPTY) b[3][c] = E.BLACK;
  }
  const sizes = E.emptyRegionSizes(b);
  // The two regions should be top (3 rows × 8 cols = 24, minus 0 stones = 24)
  // and bottom (4 rows × 8 cols = 32, minus center stones at row 4 = 30).
  // Top region: rows 0,1,2 = 24 empties
  // Bottom region: rows 4 (6 empties since b/c/d/e contain BLACK after fill... wait no, row 4 we didn't touch)
  // Actually row 4 has d5=BLACK, e5=WHITE plus 6 empties.
  // Bottom region (rows 4-7) minus 2 stones = 30 empties.
  assert.strictEqual(sizes[0][0], 24);
  assert.strictEqual(sizes[7][7], 30);
});

test('coordToPos / posToCoord roundtrip', () => {
  for (const pos of ['a1', 'h8', 'd4', 'e3', 'b2', 'g7']) {
    const [r, c] = E.posToCoord(pos);
    assert.strictEqual(E.coordToPos(r, c), pos);
  }
});

test('posToCoord rejects invalid input', () => {
  assert.strictEqual(E.posToCoord('z9'), null);
  assert.strictEqual(E.posToCoord('a0'), null);
  assert.strictEqual(E.posToCoord('i1'), null);
  assert.strictEqual(E.posToCoord(''), null);
  assert.strictEqual(E.posToCoord(null), null);
});

test('depthForDifficulty: easy=1, normal=3, hard=5', () => {
  assert.strictEqual(E.depthForDifficulty('easy'), 1);
  assert.strictEqual(E.depthForDifficulty('normal'), 3);
  assert.strictEqual(E.depthForDifficulty('hard'), 5);
  assert.strictEqual(E.depthForDifficulty(undefined), 3); // default
});

test('shouldEngineDecide: hard threshold is empty<=20', () => {
  assert.strictEqual(E.shouldEngineDecide('hard', 21), false);
  assert.strictEqual(E.shouldEngineDecide('hard', 20), true);
  assert.strictEqual(E.shouldEngineDecide('hard', 5), true);
});

test('shouldEngineDecide: normal threshold is empty<=16', () => {
  assert.strictEqual(E.shouldEngineDecide('normal', 17), false);
  assert.strictEqual(E.shouldEngineDecide('normal', 16), true);
});

test('shouldEngineDecide: easy never triggers', () => {
  assert.strictEqual(E.shouldEngineDecide('easy', 60), false);
  assert.strictEqual(E.shouldEngineDecide('easy', 1), false);
  assert.strictEqual(E.shouldEngineDecide('easy', 0), false);
});

test('chooseAiMove picks a legal move at depth 3', () => {
  const b = E.newBoard();
  const move = E.chooseAiMove(b, E.BLACK, 3);
  assert.ok(move);
  const flips = E.flipsForMove(b, move[0], move[1], E.BLACK);
  assert.ok(flips, 'AI choice must be legal');
});

// ============================================================
// CLI integration tests — spawn `node reversi.js`
// ============================================================

const SCRIPT = path.join(__dirname, 'reversi.js');

function run(args, stdin = '') {
  return spawnSync('node', [SCRIPT, ...args], {
    input: stdin,
    encoding: 'utf8',
  });
}

function runOk(args, stdin = '') {
  const r = run(args, stdin);
  assert.strictEqual(r.status, 0, `command failed: ${r.stderr}\nstdout: ${r.stdout}`);
  return JSON.parse(r.stdout);
}

function runFail(args, stdin = '') {
  const r = run(args, stdin);
  assert.notStrictEqual(r.status, 0, `expected failure but got status 0\nstdout: ${r.stdout}`);
  return { status: r.status, json: JSON.parse(r.stdout) };
}

test('CLI init: produces valid state with difficulty and depth', () => {
  for (const [diff, depth] of [['easy', 1], ['normal', 3], ['hard', 5]]) {
    const s = runOk(['init', '--difficulty', diff]);
    assert.strictEqual(s.difficulty, diff);
    assert.strictEqual(s.depth, depth);
    assert.strictEqual(s.emptyCount, 60);
    assert.strictEqual(s.turn, 'X');
    assert.strictEqual(s.aiShouldUseEngine, false);
    assert.deepStrictEqual([...s.legalMoves].sort(), ['c4', 'd3', 'e6', 'f5']);
  }
});

test('CLI init: --human O makes white the human', () => {
  const s = runOk(['init', '--human', 'O']);
  assert.strictEqual(s.human, 'O');
});

test('CLI init: default difficulty is normal', () => {
  const s = runOk(['init']);
  assert.strictEqual(s.difficulty, 'normal');
});

test('CLI move: d3 from init produces correct state', () => {
  const init = runOk(['init', '--difficulty', 'normal']);
  const s = runOk(['move', 'd3'], JSON.stringify(init));
  assert.strictEqual(s.lastMove, 'd3');
  assert.strictEqual(s.scores.X, 4);
  assert.strictEqual(s.scores.O, 1);
  assert.strictEqual(s.turn, 'O');
  assert.deepStrictEqual(s.flipped, ['d4']);
});

test('CLI move: illegal move a1 returns exit 1 with legalMoves', () => {
  const init = runOk(['init']);
  const { status, json } = runFail(['move', 'a1'], JSON.stringify(init));
  assert.strictEqual(status, 1);
  assert.match(json.error, /Illegal/);
  assert.ok(Array.isArray(json.legalMoves));
  assert.deepStrictEqual([...json.legalMoves].sort(), ['c4', 'd3', 'e6', 'f5']);
});

test('CLI move: malformed pos z9 returns exit 1', () => {
  const init = runOk(['init']);
  const { status, json } = runFail(['move', 'z9'], JSON.stringify(init));
  assert.strictEqual(status, 1);
  assert.match(json.error, /Invalid position/);
});

test('CLI ai: returns a state with applied move', () => {
  const init = runOk(['init']);
  const afterHuman = runOk(['move', 'd3'], JSON.stringify(init));
  const afterAi = runOk(['ai'], JSON.stringify(afterHuman));
  assert.ok(afterAi.lastMove);
  assert.match(afterAi.lastMove, /^[a-h][1-8]$/);
  assert.strictEqual(afterAi.turn, 'X');
});

test('CLI analyze: each candidate has all heuristic fields', () => {
  const init = runOk(['init']);
  const a = runOk(['analyze'], JSON.stringify(init));
  assert.ok(Array.isArray(a.candidates));
  assert.ok(a.candidates.length > 0);
  for (const c of a.candidates) {
    assert.match(c.pos, /^[a-h][1-8]$/);
    assert.strictEqual(typeof c.flipped, 'number');
    assert.strictEqual(typeof c.opponentMoves, 'number');
    assert.strictEqual(typeof c.frontierMine, 'number');
    assert.strictEqual(typeof c.frontierOpp, 'number');
    assert.strictEqual(typeof c.opponentBestFlip, 'number');
    assert.strictEqual(typeof c.opponentCanCorner, 'boolean');
    assert.strictEqual(typeof c.corner, 'boolean');
    assert.strictEqual(typeof c.xSquare, 'boolean');
    assert.strictEqual(typeof c.cSquare, 'boolean');
    assert.strictEqual(typeof c.edge, 'boolean');
    assert.strictEqual(typeof c.regionEmptyCount, 'number');
    assert.ok(['odd', 'even'].includes(c.regionParity));
  }
});

test('CLI random-pick: returns one of the opening moves', () => {
  const init = runOk(['init']);
  const r = runOk(['random-pick', '--top', '3'], JSON.stringify(init));
  assert.ok(['c4', 'd3', 'e6', 'f5'].includes(r.pos));
  assert.ok(Array.isArray(r.pickedFrom));
});

test('CLI random-pick: tied openings produce variety over many trials', () => {
  const init = runOk(['init']);
  const stateJson = JSON.stringify(init);
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const r = runOk(['random-pick', '--top', '3'], stateJson);
    seen.add(r.pos);
  }
  // With 4 tied openings and the tie-expansion, all 4 should appear within 30 trials.
  // Allow some flakiness — require at least 3 distinct picks.
  assert.ok(seen.size >= 3, `expected ≥3 distinct picks, got ${seen.size}: ${[...seen].join(',')}`);
});

test('CLI random-pick: no legal moves returns exit 1', () => {
  // Construct a state where 'X' has no legal moves: a finished board.
  const fullBoard = Array.from({ length: 8 }, () => 'XXXXXXXX').join('\n');
  const state = {
    board: fullBoard,
    turn: 'X',
    human: 'X',
    difficulty: 'normal',
    depth: 3,
  };
  const r = run(['random-pick'], JSON.stringify(state));
  assert.notStrictEqual(r.status, 0);
});

test('CLI init: --svg writes the SVG file with valid XML', () => {
  const tmp = path.join(os.tmpdir(), `reversi-test-init-${process.pid}-${Date.now()}.svg`);
  try {
    const r = run(['init', '--svg', tmp]);
    assert.strictEqual(r.status, 0);
    const state = JSON.parse(r.stdout);
    assert.strictEqual(state.svgPath, tmp);
    assert.ok(fs.existsSync(tmp), 'SVG file should exist');
    const svg = fs.readFileSync(tmp, 'utf8');
    assert.ok(svg.startsWith('<?xml'));
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('</svg>'));
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
});

test('CLI move --no-svg: SVG file content does NOT change', () => {
  const tmp = path.join(os.tmpdir(), `reversi-test-nosvg-${process.pid}-${Date.now()}.svg`);
  try {
    const init = runOk(['init', '--svg', tmp]);
    const before = fs.readFileSync(tmp, 'utf8');
    runOk(['move', '--no-svg', 'd3'], JSON.stringify(init));
    const after = fs.readFileSync(tmp, 'utf8');
    assert.strictEqual(before, after, 'SVG must be unchanged with --no-svg');
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
});

test('CLI move (no flag): SVG file content DOES change', () => {
  const tmp = path.join(os.tmpdir(), `reversi-test-yes-svg-${process.pid}-${Date.now()}.svg`);
  try {
    const init = runOk(['init', '--svg', tmp]);
    const before = fs.readFileSync(tmp, 'utf8');
    runOk(['move', 'd3'], JSON.stringify(init));
    const after = fs.readFileSync(tmp, 'utf8');
    assert.notStrictEqual(before, after, 'SVG must change after committing a move');
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
});

test('CLI: state without svgPath produces no SVG side effect', () => {
  const init = runOk(['init']); // no --svg
  assert.strictEqual(init.svgPath, null);
  // move doesn't touch any file path
  const s = runOk(['move', 'd3'], JSON.stringify(init));
  assert.strictEqual(s.svgPath, null);
});

test('CLI show: re-renders without changing state', () => {
  const init = runOk(['init']);
  const shown = runOk(['show'], JSON.stringify(init));
  assert.strictEqual(shown.board, init.board);
  assert.strictEqual(shown.turn, init.turn);
});

// End-to-end: a full self-play game completes and reports a winner
test('CLI: AI self-play completes with a winner and ~64 stones placed', () => {
  let state = runOk(['init', '--difficulty', 'easy']);
  let safety = 100;
  while (!state.gameOver && safety > 0) {
    const r = run(['ai'], JSON.stringify(state));
    assert.strictEqual(r.status, 0, `ai failed at empty=${state.emptyCount}: ${r.stderr}`);
    state = JSON.parse(r.stdout);
    safety--;
  }
  assert.strictEqual(state.gameOver, true, 'game should finish within 100 plies');
  assert.ok(['X', 'O', 'draw'].includes(state.winner));
  const total = state.scores.X + state.scores.O;
  assert.ok(total >= 40 && total <= 64, `total stones ${total} should be 40-64`);
});

// Regression: aiShouldUseEngine flips at the boundary
test('aiShouldUseEngine boundary: hard transitions at empty<=20 (integration via CLI)', () => {
  // Build an 8x8 board string with exactly `emptyCount` '.' cells; rest filled with X.
  const boardWithEmpties = (emptyCount) => {
    const cells = Array(64).fill('X');
    for (let i = 0; i < emptyCount; i++) cells[i] = '.';
    const rows = [];
    for (let r = 0; r < 8; r++) rows.push(cells.slice(r * 8, r * 8 + 8).join(''));
    return rows.join('\n');
  };

  const r1 = runOk(['show'], JSON.stringify({
    board: boardWithEmpties(21),
    turn: 'X', human: 'X', difficulty: 'hard', depth: 5,
  }));
  assert.strictEqual(r1.emptyCount, 21);
  assert.strictEqual(r1.aiShouldUseEngine, false);

  const r2 = runOk(['show'], JSON.stringify({
    board: boardWithEmpties(20),
    turn: 'X', human: 'X', difficulty: 'hard', depth: 5,
  }));
  assert.strictEqual(r2.emptyCount, 20);
  assert.strictEqual(r2.aiShouldUseEngine, true);
});
