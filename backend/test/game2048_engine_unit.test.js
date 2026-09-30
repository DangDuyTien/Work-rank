'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Import pure engine functions (CommonJS adapted or pure logic)
function slideAndMergeLine(line) {
  const GRID_SIZE = 4;
  const nonZeros = line.filter((val) => val !== 0);
  const newLine = [];
  let scoreEarned = 0;
  let i = 0;

  while (i < nonZeros.length) {
    if (i + 1 < nonZeros.length && nonZeros[i] === nonZeros[i + 1]) {
      const mergedVal = nonZeros[i] * 2;
      newLine.push(mergedVal);
      scoreEarned += mergedVal;
      i += 2;
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

function hasAvailableMoves(board) {
  const GRID_SIZE = 4;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) return true;
    }
  }
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = board[r][c];
      if (r + 1 < GRID_SIZE && board[r + 1][c] === val) return true;
      if (c + 1 < GRID_SIZE && board[r][c + 1] === val) return true;
    }
  }
  return false;
}

test('2048 Engine Line Merge & Move Unit Tests', async (t) => {
  await t.test('Edge Case: [2, 2, 2, 2] merges into [4, 4, 0, 0] with score 8', () => {
    const res = slideAndMergeLine([2, 2, 2, 2]);
    assert.deepEqual(res.newLine, [4, 4, 0, 0]);
    assert.equal(res.scoreEarned, 8);
    assert.equal(res.moved, true);
  });

  await t.test('Edge Case: [4, 2, 2, 0] merges into [4, 4, 0, 0] with score 4', () => {
    const res = slideAndMergeLine([4, 2, 2, 0]);
    assert.deepEqual(res.newLine, [4, 4, 0, 0]);
    assert.equal(res.scoreEarned, 4);
    assert.equal(res.moved, true);
  });

  await t.test('Edge Case: [2, 0, 2, 4] merges into [4, 4, 0, 0] with score 4', () => {
    const res = slideAndMergeLine([2, 0, 2, 4]);
    assert.deepEqual(res.newLine, [4, 4, 0, 0]);
    assert.equal(res.scoreEarned, 4);
    assert.equal(res.moved, true);
  });

  await t.test('Edge Case: [2, 2, 4, 8] merges into [4, 4, 8, 0] with score 4', () => {
    const res = slideAndMergeLine([2, 2, 4, 8]);
    assert.deepEqual(res.newLine, [4, 4, 8, 0]);
    assert.equal(res.scoreEarned, 4);
    assert.equal(res.moved, true);
  });

  await t.test('Edge Case: [4, 4, 2, 2] merges into [8, 4, 0, 0] with score 12', () => {
    const res = slideAndMergeLine([4, 4, 2, 2]);
    assert.deepEqual(res.newLine, [8, 4, 0, 0]);
    assert.equal(res.scoreEarned, 12);
    assert.equal(res.moved, true);
  });

  await t.test('Edge Case: [2, 4, 8, 16] has zero merges and moved is false', () => {
    const res = slideAndMergeLine([2, 4, 8, 16]);
    assert.deepEqual(res.newLine, [2, 4, 8, 16]);
    assert.equal(res.scoreEarned, 0);
    assert.equal(res.moved, false);
  });

  await t.test('Edge Case: [0, 2, 0, 0] slides to [2, 0, 0, 0] with moved = true and score = 0', () => {
    const res = slideAndMergeLine([0, 2, 0, 0]);
    assert.deepEqual(res.newLine, [2, 0, 0, 0]);
    assert.equal(res.scoreEarned, 0);
    assert.equal(res.moved, true);
  });

  await t.test('Game Over detection on fully blocked board', () => {
    const blockedBoard = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    assert.equal(hasAvailableMoves(blockedBoard), false, 'Blocked board has no moves');

    const playableBoard = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 2], // adjacent 2s in row 3
      [4, 2, 4, 2],
    ];
    assert.equal(hasAvailableMoves(playableBoard), true, 'Playable board has valid merge move');
  });
});
