'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const samBotAI = require('../src/utils/samBotAI');
const samEngine = require('../src/utils/samEngine');

test('Sam Lốc Bot AI Unit Tests', async (t) => {
  await t.test('1. Finds pairs, triples, four of a kind, and straights correctly', () => {
    const hand = ['3S', '3D', '4C', '4H', '4D', '5S', '6C', '7H', '8D', '8C'];
    const pairs = samBotAI.findAllPairs(hand);
    assert.ok(pairs.length >= 3); // 3s, 4s, 8s

    const triples = samBotAI.findAllTriples(hand);
    assert.equal(triples.length, 1); // 4s

    const straights = samBotAI.findAllStraights(hand);
    assert.ok(straights.length > 0);
    // Should find straight 3-4-5-6-7-8
    const longStraight = straights.find((s) => s.length >= 5);
    assert.ok(longStraight);
  });

  await t.test('2. Bot chooses legal opening move (prioritizes straight / combos)', () => {
    const hand = ['3S', '4C', '5D', '7H', '7S', '9C', 'JS', 'QD', 'KD', '2H'];
    const move = samBotAI.chooseMove(hand, null, false, 'NORMAL');
    assert.equal(move.action, 'PLAY');
    assert.ok(move.cardIds.length >= 1);
    // Should choose straight 3-4-5 or pair 7
    assert.ok(['STRAIGHT', 'PAIR', 'SINGLE'].includes(move.combo.type));
  });

  await t.test('3. Bot responds with valid beating move', () => {
    const hand = ['5S', '8D', '9C', 'JH', '2C'];
    const lastPlayed = { cards: ['4S'], comboType: 'SINGLE', rankValue: 4 };

    const move = samBotAI.chooseMove(hand, lastPlayed, false, 'NORMAL');
    assert.equal(move.action, 'PLAY');
    assert.equal(move.cardIds.length, 1);
    // Should pick lowest beating card (5S)
    assert.equal(move.cardIds[0], '5S');
  });

  await t.test('4. Bot chops 2 with Four of a Kind', () => {
    const hand = ['5S', '5C', '5D', '5H', '8D', '9C'];
    const lastPlayed = { cards: ['2H'], comboType: 'SINGLE', rankValue: 15 };

    const move = samBotAI.chooseMove(hand, lastPlayed, false, 'NORMAL');
    assert.equal(move.action, 'PLAY');
    assert.equal(move.isChop, true);
    assert.equal(move.cardIds.length, 4);
    assert.equal(move.combo.type, 'FOUR_OF_A_KIND');
  });

  await t.test('5. Bot passes when no card in hand can beat', () => {
    const hand = ['3S', '4C', '5D'];
    const lastPlayed = { cards: ['KD'], comboType: 'SINGLE', rankValue: 13 };

    const move = samBotAI.chooseMove(hand, lastPlayed, false, 'NORMAL');
    assert.equal(move.action, 'PASS');
    assert.equal(move.cardIds, null);
  });

  await t.test('6. Bot blocks opponent Báo 1 by playing highest card', () => {
    const hand = ['4S', '8D', 'AD', '2C'];
    const lastPlayed = { cards: ['3S'], comboType: 'SINGLE', rankValue: 3 };

    const move = samBotAI.chooseMove(hand, lastPlayed, true, 'NORMAL');
    assert.equal(move.action, 'PLAY');
    // In Báo 1 mode, bot plays highest card (2C) to block
    assert.equal(move.cardIds[0], '2C');
  });
});
