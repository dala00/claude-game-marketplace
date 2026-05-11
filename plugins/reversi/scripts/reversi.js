#!/usr/bin/env node
// Reversi engine — pure Node.js, zero dependencies.
//
// Subcommands:
//   node reversi.js init [--human X|O] [--difficulty easy|normal|hard] [--svg <path>]
//       → outputs initial state JSON; if --svg, also writes a board SVG to <path>
//   echo '<state-json>' | node reversi.js move <pos>
//       → applies a human (or LLM-chosen) move (e.g. e3); errors on illegal move
//   echo '<state-json>' | node reversi.js ai
//       → computes AI move using minimax at the state's depth and applies it
//   echo '<state-json>' | node reversi.js analyze
//       → returns per-candidate features (flips, opponent mobility, corner/X/C/edge flags)
//   echo '<state-json>' | node reversi.js show
//       → re-renders the current state without changing it
//
// If state.svgPath is set, init/move/ai/show overwrite that file with the
// current board's SVG. Same path is reused every turn.
//
// State JSON shape (input/output):
//   {
//     board:        "....\n....\n..." (8 lines × 8 chars, '.' empty / 'X' black / 'O' white)
//     turn:         "X" | "O"             — whose turn it is now
//     human:        "X" | "O"             — which side the human controls
//     difficulty:   "easy" | "normal" | "hard"
//     depth:        number                — minimax depth used when 'ai' is invoked
//     emptyCount:   number                — empty squares remaining
//     aiShouldUseEngine: boolean          — true when difficulty + emptyCount say
//                                            engine should take over the AI's move
//                                            (easy: never; normal: ≤16; hard: ≤20)
//     scores:       { X: n, O: n }
//     legalMoves:   ["c4","d3",...]       — legal moves for `turn`
//     lastMove:     "e3" | null
//     flipped:      ["d4", ...]
//     passed:       boolean
//     gameOver:     boolean
//     winner:       "X" | "O" | "draw" | null
//     message:      string | null
//     render:       "   a b c d e f g h\n1  . . . . . . . .\n..."
//   }

const fs = require('fs');

const SIZE = 8;
const EMPTY = '.';
const BLACK = 'X';
const WHITE = 'O';
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
];

const WEIGHTS = [
  [120, -20,  20,   5,   5,  20, -20, 120],
  [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
  [ 20,  -5,  15,   3,   3,  15,  -5,  20],
  [  5,  -5,   3,   3,   3,   3,  -5,   5],
  [  5,  -5,   3,   3,   3,   3,  -5,   5],
  [ 20,  -5,  15,   3,   3,  15,  -5,  20],
  [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
  [120, -20,  20,   5,   5,  20, -20, 120],
];

const CORNER_KEYS = ['0,0', '0,7', '7,0', '7,7'];
// X-square: diagonally adjacent to a corner.
const X_OF_CORNER = {
  '0,0': '1,1', '0,7': '1,6', '7,0': '6,1', '7,7': '6,6',
};
// C-squares: orthogonally adjacent to a corner, on the same edge.
const C_OF_CORNER = {
  '0,0': ['0,1', '1,0'],
  '0,7': ['0,6', '1,7'],
  '7,0': ['6,0', '7,1'],
  '7,7': ['6,7', '7,6'],
};

const opp = p => (p === BLACK ? WHITE : BLACK);
const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

function newBoard() {
  const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  b[3][3] = WHITE;
  b[3][4] = BLACK;
  b[4][3] = BLACK;
  b[4][4] = WHITE;
  return b;
}

function flipsForMove(board, r, c, player) {
  if (!inBounds(r, c) || board[r][c] !== EMPTY) return null;
  const enemy = opp(player);
  const flipped = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc) && board[nr][nc] === enemy) {
      line.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (line.length > 0 && inBounds(nr, nc) && board[nr][nc] === player) {
      flipped.push(...line);
    }
  }
  return flipped.length > 0 ? flipped : null;
}

function legalMoves(board, player) {
  const moves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (flipsForMove(board, r, c, player)) moves.push([r, c]);
    }
  }
  return moves;
}

function applyMove(board, r, c, player) {
  const flipped = flipsForMove(board, r, c, player);
  if (!flipped) return null;
  const nb = board.map(row => row.slice());
  nb[r][c] = player;
  for (const [fr, fc] of flipped) nb[fr][fc] = player;
  return { board: nb, flipped };
}

function scoreBoard(board) {
  let x = 0;
  let o = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === BLACK) x++;
      else if (board[r][c] === WHITE) o++;
    }
  }
  return { X: x, O: o };
}

function countEmpty(board) {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === EMPTY) n++;
    }
  }
  return n;
}

function evaluate(board, player) {
  const enemy = opp(player);
  let positional = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === player) positional += WEIGHTS[r][c];
      else if (board[r][c] === enemy) positional -= WEIGHTS[r][c];
    }
  }
  const myMoves = legalMoves(board, player).length;
  const oppMoves = legalMoves(board, enemy).length;
  const mobility = (myMoves - oppMoves) * 8;
  return positional + mobility;
}

function minimax(board, player, depth, alpha, beta, rootPlayer) {
  const moves = legalMoves(board, player);
  const enemy = opp(player);

  if (moves.length === 0) {
    const enemyMoves = legalMoves(board, enemy);
    if (enemyMoves.length === 0) {
      const s = scoreBoard(board);
      const diff = s[rootPlayer] - s[opp(rootPlayer)];
      return { score: diff * 1000, move: null };
    }
    const r = minimax(board, enemy, depth, alpha, beta, rootPlayer);
    return { score: r.score, move: null };
  }

  if (depth === 0) {
    return { score: evaluate(board, rootPlayer), move: null };
  }

  const maximizing = player === rootPlayer;
  let best = maximizing ? -Infinity : Infinity;
  let bestMove = moves[0];

  for (const [r, c] of moves) {
    const { board: nb } = applyMove(board, r, c, player);
    const { score } = minimax(nb, enemy, depth - 1, alpha, beta, rootPlayer);
    if (maximizing) {
      if (score > best) { best = score; bestMove = [r, c]; }
      if (best > alpha) alpha = best;
    } else {
      if (score < best) { best = score; bestMove = [r, c]; }
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return { score: best, move: bestMove };
}

function chooseAiMove(board, player, depth) {
  const moves = legalMoves(board, player);
  if (moves.length === 0) return null;
  const { move } = minimax(board, player, depth, -Infinity, Infinity, player);
  return move;
}

function posToCoord(pos) {
  if (typeof pos !== 'string') return null;
  const m = pos.toLowerCase().match(/^([a-h])([1-8])$/);
  if (!m) return null;
  const c = m[1].charCodeAt(0) - 'a'.charCodeAt(0);
  const r = parseInt(m[2], 10) - 1;
  return [r, c];
}

function coordToPos(r, c) {
  return String.fromCharCode('a'.charCodeAt(0) + c) + (r + 1);
}

function classifySquare(board, r, c) {
  const key = `${r},${c}`;
  let corner = CORNER_KEYS.includes(key);
  let xSquare = false;
  let cSquare = false;
  for (const ck of CORNER_KEYS) {
    if (X_OF_CORNER[ck] === key) {
      const [cr, cc] = ck.split(',').map(Number);
      if (board[cr][cc] === EMPTY) xSquare = true;
    }
    if (C_OF_CORNER[ck].includes(key)) {
      const [cr, cc] = ck.split(',').map(Number);
      if (board[cr][cc] === EMPTY) cSquare = true;
    }
  }
  const edge = !corner && (r === 0 || r === 7 || c === 0 || c === 7);
  return { corner, xSquare, cSquare, edge };
}

function frontierCount(board, player) {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of DIRS) {
        if (inBounds(r + dr, c + dc) && board[r + dr][c + dc] === EMPTY) {
          n++;
          break;
        }
      }
    }
  }
  return n;
}

function maxOpponentFlip(board, enemy) {
  let max = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const flips = flipsForMove(board, r, c, enemy);
      if (flips && flips.length > max) max = flips.length;
    }
  }
  return max;
}

function opponentCanReachCorner(board, enemy) {
  for (const ck of CORNER_KEYS) {
    const [cr, cc] = ck.split(',').map(Number);
    if (board[cr][cc] !== EMPTY) continue;
    if (flipsForMove(board, cr, cc, enemy)) return true;
  }
  return false;
}

// For each empty cell, compute the size of its 4-connected empty region.
// Non-empty cells get 0. Used for endgame parity heuristics.
function emptyRegionSizes(board) {
  const sizes = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const N4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY || visited[r][c]) continue;
      const cells = [];
      const stack = [[r, c]];
      visited[r][c] = true;
      while (stack.length > 0) {
        const [cr, cc] = stack.pop();
        cells.push([cr, cc]);
        for (const [dr, dc] of N4) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (inBounds(nr, nc) && board[nr][nc] === EMPTY && !visited[nr][nc]) {
            visited[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
      for (const [cr, cc] of cells) sizes[cr][cc] = cells.length;
    }
  }
  return sizes;
}

function renderSvg(state) {
  const boardArr = state.board.split('\n').map(row => row.split(''));
  const lastCoord = state.lastMove ? posToCoord(state.lastMove) : null;
  const legal = Array.isArray(state.legalMoves) ? state.legalMoves : [];

  const CELL = 48;
  const PAD = 28;
  const GRID = SIZE * CELL;
  const W = GRID + PAD * 2;
  const H = GRID + PAD * 2;

  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  parts.push(`<rect width="${W}" height="${H}" fill="#1a1a1a"/>`);
  parts.push(`<rect x="${PAD}" y="${PAD}" width="${GRID}" height="${GRID}" fill="#2e8b57"/>`);

  for (let c = 0; c < SIZE; c++) {
    const x = PAD + c * CELL + CELL / 2;
    const ch = String.fromCharCode(97 + c);
    parts.push(`<text x="${x}" y="${PAD - 8}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#bbb">${ch}</text>`);
    parts.push(`<text x="${x}" y="${PAD + GRID + 18}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#bbb">${ch}</text>`);
  }
  for (let r = 0; r < SIZE; r++) {
    const y = PAD + r * CELL + CELL / 2 + 4;
    parts.push(`<text x="${PAD - 10}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#bbb">${r + 1}</text>`);
    parts.push(`<text x="${PAD + GRID + 12}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#bbb">${r + 1}</text>`);
  }

  for (let i = 0; i <= SIZE; i++) {
    const o = PAD + i * CELL;
    parts.push(`<line x1="${PAD}" y1="${o}" x2="${PAD + GRID}" y2="${o}" stroke="#1a4a2e" stroke-width="1.5"/>`);
    parts.push(`<line x1="${o}" y1="${PAD}" x2="${o}" y2="${PAD + GRID}" stroke="#1a4a2e" stroke-width="1.5"/>`);
  }

  for (const pos of legal) {
    const coord = posToCoord(pos);
    if (!coord) continue;
    const [r, c] = coord;
    const cx = PAD + c * CELL + CELL / 2;
    const cy = PAD + r * CELL + CELL / 2;
    parts.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="#ffffff" fill-opacity="0.25"/>`);
  }

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = boardArr[r][c];
      if (cell === EMPTY) continue;
      const cx = PAD + c * CELL + CELL / 2;
      const cy = PAD + r * CELL + CELL / 2;
      const radius = CELL * 0.4;
      const fill = cell === BLACK ? '#111' : '#f8f8f8';
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" stroke="#000" stroke-opacity="0.4"/>`);
      if (lastCoord && lastCoord[0] === r && lastCoord[1] === c) {
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius + 3}" fill="none" stroke="#ffd700" stroke-width="3"/>`);
      }
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function writeSvgIfRequested(state, suppress = false) {
  if (suppress) return;
  if (!state.svgPath) return;
  try {
    fs.writeFileSync(state.svgPath, renderSvg(state));
  } catch (e) {
    process.stderr.write(`Warning: failed to write SVG to ${state.svgPath}: ${e.message}\n`);
  }
}

function renderBoard(board, hints = []) {
  const hl = new Set(hints.map(([r, c]) => `${r},${c}`));
  let out = '   a b c d e f g h\n';
  for (let r = 0; r < SIZE; r++) {
    out += `${r + 1} `;
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      let ch;
      if (cell === BLACK) ch = '●';
      else if (cell === WHITE) ch = '○';
      else if (hl.has(`${r},${c}`)) ch = '·';
      else ch = '.';
      out += ` ${ch}`;
    }
    out += '\n';
  }
  return out;
}

function depthForDifficulty(d) {
  if (d === 'easy') return 1;
  if (d === 'hard') return 5;
  return 3;
}

function engineEndgameThreshold(difficulty) {
  if (difficulty === 'normal') return 16;
  if (difficulty === 'hard') return 20;
  return -1; // easy: never
}

function shouldEngineDecide(difficulty, emptyCount) {
  return emptyCount <= engineEndgameThreshold(difficulty);
}

function buildState({ board, turn, human, difficulty, depth, svgPath = null, lastMove = null, flipped = [], message = null, passed = false }) {
  const scores = scoreBoard(board);
  const emptyCount = countEmpty(board);
  let activeTurn = turn;
  let didPass = passed;
  let gameOver = false;
  let winner = null;

  let moves = legalMoves(board, activeTurn);
  if (moves.length === 0) {
    const enemyMoves = legalMoves(board, opp(activeTurn));
    if (enemyMoves.length === 0) {
      gameOver = true;
      if (scores.X > scores.O) winner = BLACK;
      else if (scores.O > scores.X) winner = WHITE;
      else winner = 'draw';
      moves = [];
    } else {
      activeTurn = opp(activeTurn);
      moves = enemyMoves;
      didPass = true;
    }
  }

  return {
    board: board.map(row => row.join('')).join('\n'),
    turn: activeTurn,
    human,
    difficulty,
    depth,
    svgPath,
    emptyCount,
    aiShouldUseEngine: shouldEngineDecide(difficulty, emptyCount),
    scores,
    legalMoves: moves.map(([r, c]) => coordToPos(r, c)),
    lastMove,
    flipped: flipped.map(([r, c]) => coordToPos(r, c)),
    passed: didPass,
    gameOver,
    winner,
    message,
    render: renderBoard(board, gameOver ? [] : moves),
  };
}

function parseState(text) {
  const obj = JSON.parse(text);
  const rows = obj.board.split('\n');
  if (rows.length !== SIZE || rows.some(r => r.length !== SIZE)) {
    throw new Error('Invalid board: expected 8x8 grid.');
  }
  const board = rows.map(row => row.split(''));
  return {
    board,
    turn: obj.turn,
    human: obj.human,
    depth: obj.depth,
    difficulty: obj.difficulty,
    svgPath: obj.svgPath || null,
  };
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function fail(message, extra = {}) {
  process.stdout.write(JSON.stringify({ error: message, ...extra }, null, 2) + '\n');
  process.exit(1);
}

function parseFlags(args) {
  const out = { positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--human') out.human = args[++i];
    else if (a === '--difficulty') out.difficulty = args[++i];
    else if (a === '--svg') out.svg = args[++i];
    else if (a === '--no-svg') out.noSvg = true;
    else if (a === '--top') out.top = parseInt(args[++i], 10);
    else out.positional.push(a);
  }
  return out;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  switch (cmd) {
    case 'init': {
      const human = flags.human === WHITE ? WHITE : BLACK;
      const difficulty = ['easy', 'normal', 'hard'].includes(flags.difficulty) ? flags.difficulty : 'normal';
      const depth = depthForDifficulty(difficulty);
      const svgPath = flags.svg || null;
      const board = newBoard();
      const state = buildState({
        board,
        turn: BLACK,
        human,
        difficulty,
        depth,
        svgPath,
        message: `New game. Human plays ${human === BLACK ? 'Black (●)' : 'White (○)'}; difficulty ${difficulty}.${svgPath ? ` SVG board → ${svgPath} (overwritten each turn).` : ''}`,
      });
      emit(state);
      writeSvgIfRequested(state, flags.noSvg);
      break;
    }

    case 'move': {
      const pos = flags.positional[0];
      const text = await readStdin();
      const { board, turn, human, depth, difficulty, svgPath } = parseState(text);
      const coord = posToCoord(pos);
      if (!coord) fail(`Invalid position '${pos}'. Use a1-h8.`);
      const [r, c] = coord;
      const result = applyMove(board, r, c, turn);
      if (!result) {
        const legal = legalMoves(board, turn).map(([rr, cc]) => coordToPos(rr, cc));
        fail(`Illegal move ${pos} for ${turn}.`, { legalMoves: legal });
      }
      const state = buildState({
        board: result.board,
        turn: opp(turn),
        human,
        difficulty,
        depth,
        svgPath,
        lastMove: pos,
        flipped: result.flipped,
        message: `${turn} played ${pos}, flipping ${result.flipped.length}.`,
      });
      emit(state);
      writeSvgIfRequested(state, flags.noSvg);
      break;
    }

    case 'ai': {
      const text = await readStdin();
      const { board, turn, human, depth, difficulty, svgPath } = parseState(text);
      const move = chooseAiMove(board, turn, depth);
      if (!move) fail(`No legal move for ${turn}.`);
      const [r, c] = move;
      const result = applyMove(board, r, c, turn);
      const pos = coordToPos(r, c);
      const state = buildState({
        board: result.board,
        turn: opp(turn),
        human,
        difficulty,
        depth,
        svgPath,
        lastMove: pos,
        flipped: result.flipped,
        message: `${turn} (AI, engine depth ${depth}) played ${pos}, flipping ${result.flipped.length}.`,
      });
      emit(state);
      writeSvgIfRequested(state, flags.noSvg);
      break;
    }

    case 'analyze': {
      const text = await readStdin();
      const { board, turn, human, depth, difficulty } = parseState(text);
      const enemy = opp(turn);
      const moves = legalMoves(board, turn);
      const regionSizes = emptyRegionSizes(board);
      const candidates = moves.map(([r, c]) => {
        const flips = flipsForMove(board, r, c, turn);
        const { board: nb } = applyMove(board, r, c, turn);
        const opMoves = legalMoves(nb, enemy).length;
        const cls = classifySquare(board, r, c);
        const regionSize = regionSizes[r][c];
        return {
          pos: coordToPos(r, c),
          flipped: flips.length,
          opponentMoves: opMoves,
          frontierMine: frontierCount(nb, turn),
          frontierOpp: frontierCount(nb, enemy),
          opponentBestFlip: maxOpponentFlip(nb, enemy),
          opponentCanCorner: opponentCanReachCorner(nb, enemy),
          corner: cls.corner,
          xSquare: cls.xSquare,
          cSquare: cls.cSquare,
          edge: cls.edge,
          regionEmptyCount: regionSize,
          regionParity: regionSize % 2 === 0 ? 'even' : 'odd',
        };
      });
      emit({
        board: board.map(row => row.join('')).join('\n'),
        turn,
        human,
        difficulty,
        depth,
        emptyCount: countEmpty(board),
        aiShouldUseEngine: shouldEngineDecide(difficulty, countEmpty(board)),
        candidates,
      });
      break;
    }

    case 'random-pick': {
      const text = await readStdin();
      const { board, turn } = parseState(text);
      const topN = Number.isFinite(flags.top) && flags.top > 0 ? flags.top : 3;
      const moves = legalMoves(board, turn);
      if (moves.length === 0) fail(`No legal moves for ${turn}.`);

      const enemy = opp(turn);
      const scored = moves.map(([r, c]) => {
        const { board: nb } = applyMove(board, r, c, turn);
        return {
          pos: coordToPos(r, c),
          opponentMoves: legalMoves(nb, enemy).length,
        };
      });

      // Shuffle first so ties get randomized order, then stable-sort by opponentMoves.
      for (let i = scored.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [scored[i], scored[j]] = [scored[j], scored[i]];
      }
      scored.sort((a, b) => a.opponentMoves - b.opponentMoves);

      // Expand the cutoff to include all moves tied with the Nth best, so a
      // fully-tied opening (e.g. all 4 first moves at opp=3) doesn't exclude any.
      const cutIdx = Math.min(topN, scored.length) - 1;
      const cutoffScore = scored[cutIdx].opponentMoves;
      const pool = scored.filter(c => c.opponentMoves <= cutoffScore);

      const picked = pool[Math.floor(Math.random() * pool.length)];

      emit({
        pos: picked.pos,
        pickedFrom: pool.map(c => c.pos),
        topN,
      });
      break;
    }

    case 'show': {
      const text = await readStdin();
      const { board, turn, human, depth, difficulty, svgPath } = parseState(text);
      const state = buildState({ board, turn, human, difficulty, depth, svgPath });
      emit(state);
      writeSvgIfRequested(state, flags.noSvg);
      break;
    }

    default:
      process.stderr.write(
        'Usage:\n' +
        '  node reversi.js init [--human X|O] [--difficulty easy|normal|hard] [--svg <path>]\n' +
        "  echo '<state-json>' | node reversi.js move <pos> [--no-svg]\n" +
        "  echo '<state-json>' | node reversi.js ai [--no-svg]\n" +
        "  echo '<state-json>' | node reversi.js analyze\n" +
        "  echo '<state-json>' | node reversi.js random-pick [--top N]\n" +
        "  echo '<state-json>' | node reversi.js show [--no-svg]\n" +
        '\n' +
        '  --no-svg suppresses the SVG file write for that one invocation\n' +
        '  (use it for simulation/peek calls during AI thinking).\n' +
        '  random-pick returns one of the top-N moves (by opponentMoves) chosen\n' +
        '  uniformly at random. Use it for opening variety; it does NOT apply\n' +
        '  the move — caller must follow up with `move <pos>` to commit.\n'
      );
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    process.stderr.write((err && err.stack) || String(err));
    process.exit(1);
  });
}

module.exports = {
  SIZE, EMPTY, BLACK, WHITE,
  newBoard, flipsForMove, legalMoves, applyMove,
  scoreBoard, countEmpty,
  frontierCount, maxOpponentFlip, opponentCanReachCorner,
  emptyRegionSizes, classifySquare,
  posToCoord, coordToPos,
  depthForDifficulty, engineEndgameThreshold, shouldEngineDecide,
  buildState, parseState,
  renderBoard, renderSvg,
  chooseAiMove, evaluate,
};
