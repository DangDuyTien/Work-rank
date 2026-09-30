/**
 * 2048 Core Engine (Pure Functions, Vector Physics & Tile Animation Support)
 */

export const GRID_SIZE = 4;

let globalTileId = 1;
export function nextTileId() {
  return globalTileId++;
}

/**
 * Creates an empty 4x4 board (16 zeros)
 */
export function createEmptyBoard() {
  return Array(GRID_SIZE)
    .fill(0)
    .map(() => Array(GRID_SIZE).fill(0));
}

/**
 * Returns all coordinates [row, col] of empty cells (value === 0)
 */
export function getEmptyCells(board) {
  const empty = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) {
        empty.push({ row: r, col: c });
      }
    }
  }
  return empty;
}

/**
 * Spawns a random tile (90% chance of 2, 10% chance of 4) in an empty cell
 */
export function spawnRandomTile(board) {
  const emptyCells = getEmptyCells(board);
  if (emptyCells.length === 0) return board;

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const value = Math.random() < 0.9 ? 2 : 4;

  const newBoard = board.map((row, r) =>
    row.map((cell, c) => (r === randomCell.row && c === randomCell.col ? value : cell))
  );

  return newBoard;
}

/**
 * Initializes a new board with 2 random tiles
 */
export function createInitialBoard() {
  let board = createEmptyBoard();
  board = spawnRandomTile(board);
  board = spawnRandomTile(board);
  return board;
}

/**
 * Slides and merges a single 1D row/column towards the left.
 * Strict standard 2048 rule: each tile can merge at most once per move.
 */
export function slideAndMergeLine(line) {
  const nonZeros = line.filter((val) => val !== 0);
  const newLine = [];
  let scoreEarned = 0;
  let i = 0;

  while (i < nonZeros.length) {
    if (i + 1 < nonZeros.length && nonZeros[i] === nonZeros[i + 1]) {
      const mergedVal = nonZeros[i] * 2;
      newLine.push(mergedVal);
      scoreEarned += mergedVal;
      i += 2; // skip both merged tiles so they cannot merge again this turn
    } else {
      newLine.push(nonZeros[i]);
      i += 1;
    }
  }

  while (newLine.length < GRID_SIZE) {
    newLine.push(0);
  }

  const moved = line.some((val, idx) => val !== newLine[idx]);

  return { newLine, scoreEarned, moved };
}

/**
 * Rotates matrix 90 degrees clockwise
 */
function rotateClockwise(board) {
  const result = createEmptyBoard();
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      result[c][GRID_SIZE - 1 - r] = board[r][c];
    }
  }
  return result;
}

/**
 * Moves the board in one of 4 directions ('UP', 'DOWN', 'LEFT', 'RIGHT')
 */
export function moveBoard(board, direction) {
  let rotated = board.map((row) => [...row]);
  let rotations = 0;

  if (direction === 'UP') {
    rotated = rotateClockwise(rotateClockwise(rotateClockwise(rotated))); // 270 deg
    rotations = 1;
  } else if (direction === 'RIGHT') {
    rotated = rotateClockwise(rotateClockwise(rotated)); // 180 deg
    rotations = 2;
  } else if (direction === 'DOWN') {
    rotated = rotateClockwise(rotated); // 90 deg
    rotations = 3;
  }

  let totalScoreEarned = 0;
  let hasMoved = false;

  const afterSlide = rotated.map((row) => {
    const { newLine, scoreEarned, moved } = slideAndMergeLine(row);
    if (moved) hasMoved = true;
    totalScoreEarned += scoreEarned;
    return newLine;
  });

  // Rotate back to original orientation
  let result = afterSlide;
  const backRotations = (4 - rotations) % 4;
  for (let i = 0; i < backRotations; i++) {
    result = rotateClockwise(result);
  }

  // If moved, spawn 1 new tile
  let finalBoard = result;
  if (hasMoved) {
    finalBoard = spawnRandomTile(result);
  }

  const maxTile = getMaxTile(finalBoard);
  const gameOver = !hasAvailableMoves(finalBoard);
  const hasWon = maxTile >= 2048;

  return {
    board: finalBoard,
    scoreEarned: totalScoreEarned,
    moved: hasMoved,
    gameOver,
    hasWon,
    maxTile,
  };
}

/**
 * Finds the maximum tile value on the board
 */
export function getMaxTile(board) {
  let max = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] > max) max = board[r][c];
    }
  }
  return max;
}

/**
 * Checks if there are any valid moves remaining on the board
 */
export function hasAvailableMoves(board) {
  // If there is any empty cell, moves are available
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) return true;
    }
  }

  // Check horizontal and vertical merges
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = board[r][c];
      if (r + 1 < GRID_SIZE && board[r + 1][c] === val) return true;
      if (c + 1 < GRID_SIZE && board[r][c + 1] === val) return true;
    }
  }

  return false;
}

/* =========================================================================
 * VECTOR PHYSICS & ANIMATED TILE STATE ENGINE
 * ========================================================================= */

/**
 * Initializes a new animated tile array with 2 random tiles
 */
export function createInitialTileState() {
  const p1 = { r: Math.floor(Math.random() * GRID_SIZE), c: Math.floor(Math.random() * GRID_SIZE) };
  let p2 = { r: Math.floor(Math.random() * GRID_SIZE), c: Math.floor(Math.random() * GRID_SIZE) };
  while (p2.r === p1.r && p2.c === p1.c) {
    p2 = { r: Math.floor(Math.random() * GRID_SIZE), c: Math.floor(Math.random() * GRID_SIZE) };
  }

  const v1 = Math.random() < 0.9 ? 2 : 4;
  const v2 = Math.random() < 0.9 ? 2 : 4;

  return [
    { id: nextTileId(), value: v1, row: p1.r, col: p1.c, isNew: true, isMerged: false, isDisappearing: false },
    { id: nextTileId(), value: v2, row: p2.r, col: p2.c, isNew: true, isMerged: false, isDisappearing: false },
  ];
}

/**
 * Converts tile array to 4x4 integer matrix
 */
export function tilesToMatrix(tiles) {
  const matrix = createEmptyBoard();
  tiles
    .filter((t) => !t.isDisappearing)
    .forEach((t) => {
      if (t.row >= 0 && t.row < GRID_SIZE && t.col >= 0 && t.col < GRID_SIZE) {
        matrix[t.row][t.col] = t.value;
      }
    });
  return matrix;
}

/**
 * Gets maximum tile from active tiles
 */
export function getMaxTileFromTiles(tiles) {
  let max = 0;
  tiles
    .filter((t) => !t.isDisappearing)
    .forEach((t) => {
      if (t.value > max) max = t.value;
    });
  return max;
}

/**
 * Cleans up disappearing/consumed tiles from the animation array
 */
export function cleanupDisappearingTiles(tiles) {
  return tiles
    .filter((t) => !t.isDisappearing)
    .map((t) => ({ ...t, isNew: false, isMerged: false }));
}

/**
 * Executes a vector move on the animated tile array.
 * Preserves tile IDs for smooth CSS transitions and handles merge physics.
 */
export function moveTileState(currentTiles, direction) {
  let dRow = 0;
  let dCol = 0;
  let rowOrder = [0, 1, 2, 3];
  let colOrder = [0, 1, 2, 3];

  if (direction === 'UP') {
    dRow = -1;
  } else if (direction === 'DOWN') {
    dRow = 1;
    rowOrder = [3, 2, 1, 0];
  } else if (direction === 'LEFT') {
    dCol = -1;
  } else if (direction === 'RIGHT') {
    dCol = 1;
    colOrder = [3, 2, 1, 0];
  } else {
    return {
      tiles: currentTiles,
      scoreEarned: 0,
      moved: false,
      gameOver: false,
      hasWon: false,
      maxTile: getMaxTileFromTiles(currentTiles),
      matrix: tilesToMatrix(currentTiles),
    };
  }

  // 1. Build grid of active tiles (clearing previous merge/new animation flags)
  const grid = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(null));

  const activeTiles = currentTiles.filter((t) => !t.isDisappearing);
  activeTiles.forEach((t) => {
    grid[t.row][t.col] = { ...t, isNew: false, isMerged: false };
  });

  const nextTiles = [];
  const mergedPositions = new Set();
  let scoreEarned = 0;
  let hasMoved = false;

  // 2. Traverse tiles in direction order
  for (const r of rowOrder) {
    for (const c of colOrder) {
      const tile = grid[r][c];
      if (!tile) continue;

      let targetR = r;
      let targetC = c;
      let nextR = r + dRow;
      let nextC = c + dCol;

      // Scan furthest open position
      while (
        nextR >= 0 &&
        nextR < GRID_SIZE &&
        nextC >= 0 &&
        nextC < GRID_SIZE &&
        grid[nextR][nextC] === null
      ) {
        targetR = nextR;
        targetC = nextC;
        nextR += dRow;
        nextC += dCol;
      }

      // Check for valid merge
      if (
        nextR >= 0 &&
        nextR < GRID_SIZE &&
        nextC >= 0 &&
        nextC < GRID_SIZE &&
        grid[nextR][nextC] &&
        grid[nextR][nextC].value === tile.value &&
        !mergedPositions.has(`${nextR},${nextC}`) &&
        !grid[nextR][nextC].isDisappearing
      ) {
        const destTile = grid[nextR][nextC];
        mergedPositions.add(`${nextR},${nextC}`);
        hasMoved = true;
        const mergedValue = tile.value * 2;
        scoreEarned += mergedValue;

        grid[r][c] = null;

        // Mark destTile as disappearing in nextTiles
        const existingIdx = nextTiles.findIndex((t) => t.id === destTile.id);
        if (existingIdx !== -1) {
          nextTiles[existingIdx] = { ...nextTiles[existingIdx], isDisappearing: true };
        } else {
          destTile.isDisappearing = true;
          nextTiles.push(destTile);
        }

        // Sliding tile moves to target cell and marks disappearing
        nextTiles.push({
          ...tile,
          row: nextR,
          col: nextC,
          isDisappearing: true,
        });

        // New merged tile born at target cell
        const mergedTile = {
          id: nextTileId(),
          value: mergedValue,
          row: nextR,
          col: nextC,
          isMerged: true,
          isNew: false,
          isDisappearing: false,
        };
        grid[nextR][nextC] = mergedTile;
        nextTiles.push(mergedTile);
      } else if (targetR !== r || targetC !== c) {
        // Tile slides to empty position
        hasMoved = true;
        grid[r][c] = null;
        const updatedTile = {
          ...tile,
          row: targetR,
          col: targetC,
        };
        grid[targetR][targetC] = updatedTile;
        nextTiles.push(updatedTile);
      } else {
        // Tile remains in current position
        nextTiles.push(tile);
      }
    }
  }

  // 3. Spawn a new tile if movement occurred
  if (hasMoved) {
    const emptyCells = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === null) emptyCells.push({ r, c });
      }
    }
    if (emptyCells.length > 0) {
      const spawn = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      const spawnedTile = {
        id: nextTileId(),
        value: Math.random() < 0.9 ? 2 : 4,
        row: spawn.r,
        col: spawn.c,
        isNew: true,
        isMerged: false,
        isDisappearing: false,
      };
      nextTiles.push(spawnedTile);
    }
  }

  const matrix = tilesToMatrix(nextTiles);
  const maxTile = getMaxTileFromTiles(nextTiles);
  const gameOver = !hasAvailableMoves(matrix);
  const hasWon = maxTile >= 2048;

  return {
    tiles: nextTiles,
    scoreEarned,
    moved: hasMoved,
    gameOver,
    hasWon,
    maxTile,
    matrix,
  };
}
