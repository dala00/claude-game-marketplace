#!/usr/bin/env node
// Reversi engine — pure Node.js, zero dependencies.
//
// Subcommands:
//   node reversi.js init [--human B|W] [--depth N]
//       → outputs initial state JSON
//   echo '<state-json>' | node reversi.js move <pos>
//       → applies a human move (e.g. e3); errors on illegal move
//   echo '<state-json>' | node reversi.js ai
//       → computes AI move using minimax at state.depth
//   echo '<state-json>' | node reversi.js show
//       → re-renders the current state without changing it
//
// State JSON shape (input/output):
//   {
//     board:      "........\n........\n....OX..\n....XO..\n........\n........\n........\n........"
//                 (8 lines of 8 chars: '.' empty, 'X' black, 'O' white)
//     turn:       "X" | "O"   — whose turn it is *now*
//     human:      "X" | "O"   — which side the human controls
//     depth:      number       — minimax search depth used for AI
//     scores:     { X: n, O: n }
//     legalMoves: ["c4","d3",...]  — legal moves for `turn`
//     lastMove:   "e3" | null
//     flipped:    ["d4", ...]
//     passed:     boolean      — true if previous player had to pass
//     gameOver:   boolean
//     winner:     "X" | "O" | "draw" | null
//     message:    string | null
//     render:     "  a b c d e f g h\n1 . . . . . . . .\n..."
//   }

const SIZE = 8;
const EMPTY = '.';
const BLACK = 'X';
const WHITE = 'O';
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
];

// Positional weights — corners > edges > center; X/C-squares penalized.
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
    // Pass — same depth so we keep search budget for the active player.
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

function buildState({ board, turn, human, depth, lastMove = null, flipped = [], message = null, passed = false }) {
  const scores = scoreBoard(board);
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
    depth,
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
    else if (a === '--depth') out.depth = parseInt(args[++i], 10);
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
      const depth = Number.isFinite(flags.depth) ? flags.depth : 3;
      const board = newBoard();
      emit(buildState({
        board,
        turn: BLACK,
        human,
        depth,
        message: `New game. Human plays ${human === BLACK ? 'Black (●)' : 'White (○)'}; AI depth ${depth}.`,
      }));
      break;
    }

    case 'move': {
      const pos = flags.positional[0];
      const text = await readStdin();
      const { board, turn, human, depth } = parseState(text);
      const coord = posToCoord(pos);
      if (!coord) fail(`Invalid position '${pos}'. Use a1-h8.`);
      const [r, c] = coord;
      const result = applyMove(board, r, c, turn);
      if (!result) {
        const legal = legalMoves(board, turn).map(([rr, cc]) => coordToPos(rr, cc));
        fail(`Illegal move ${pos} for ${turn}.`, { legalMoves: legal });
      }
      emit(buildState({
        board: result.board,
        turn: opp(turn),
        human,
        depth,
        lastMove: pos,
        flipped: result.flipped,
        message: `${turn} played ${pos}, flipping ${result.flipped.length}.`,
      }));
      break;
    }

    case 'ai': {
      const text = await readStdin();
      const { board, turn, human, depth } = parseState(text);
      const move = chooseAiMove(board, turn, depth);
      if (!move) fail(`No legal move for ${turn}.`);
      const [r, c] = move;
      const result = applyMove(board, r, c, turn);
      const pos = coordToPos(r, c);
      emit(buildState({
        board: result.board,
        turn: opp(turn),
        human,
        depth,
        lastMove: pos,
        flipped: result.flipped,
        message: `${turn} (AI) played ${pos}, flipping ${result.flipped.length}.`,
      }));
      break;
    }

    case 'show': {
      const text = await readStdin();
      const { board, turn, human, depth } = parseState(text);
      emit(buildState({ board, turn, human, depth }));
      break;
    }

    default:
      process.stderr.write(
        'Usage:\n' +
        '  node reversi.js init [--human X|O] [--depth N]\n' +
        "  echo '<state-json>' | node reversi.js move <pos>\n" +
        "  echo '<state-json>' | node reversi.js ai\n" +
        "  echo '<state-json>' | node reversi.js show\n"
      );
      process.exit(1);
  }
}

main().catch(err => {
  process.stderr.write((err && err.stack) || String(err));
  process.exit(1);
});
