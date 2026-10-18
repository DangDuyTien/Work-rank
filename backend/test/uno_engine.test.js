'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createDeck,
  shuffle,
  isMoveLegal,
  getNextSeat,
  rebuildDrawPile,
  calculateHandPoints,
  CARD_TYPES,
  COLORS,
} = require('../src/utils/unoEngine');
const { chooseBotMove } = require('../src/utils/unoBotAI');

test('UNO Game Engine - Core Rules & Mechanics Suite', async (t) => {
  await t.test('1. Deck Generation: produces standard 108 cards with correct distribution', () => {
    const deck = createDeck();
    assert.equal(deck.length, 108);

    // Count per color
    for (const color of COLORS) {
      const colorCards = deck.filter((c) => c.color === color);
      assert.equal(colorCards.length, 25); // 1 zero + 18 numbers (1-9 twice) + 6 actions = 25

      const zeros = colorCards.filter((c) => c.value === 0);
      assert.equal(zeros.length, 1);

      const skips = colorCards.filter((c) => c.type === CARD_TYPES.SKIP);
      assert.equal(skips.length, 2);

      const reverses = colorCards.filter((c) => c.type === CARD_TYPES.REVERSE);
      assert.equal(reverses.length, 2);

      const drawTwos = colorCards.filter((c) => c.type === CARD_TYPES.DRAW_TWO);
      assert.equal(drawTwos.length, 2);
    }

    const wilds = deck.filter((c) => c.type === CARD_TYPES.WILD);
    assert.equal(wilds.length, 4);

    const wildDrawFours = deck.filter((c) => c.type === CARD_TYPES.WILD_DRAW_FOUR);
    assert.equal(wildDrawFours.length, 4);
  });

  await t.test('2. Move Legality: correctly validates color, number, action, and wild matches', () => {
    const topCard = { color: 'RED', type: CARD_TYPES.NUMBER, value: 7 };
    const activeColor = 'RED';

    // Same color, different number
    assert.equal(isMoveLegal({ color: 'RED', type: CARD_TYPES.NUMBER, value: 3 }, topCard, activeColor), true);

    // Different color, same number
    assert.equal(isMoveLegal({ color: 'BLUE', type: CARD_TYPES.NUMBER, value: 7 }, topCard, activeColor), true);

    // Action card of same color
    assert.equal(isMoveLegal({ color: 'RED', type: CARD_TYPES.SKIP, value: null }, topCard, activeColor), true);

    // Wild cards
    assert.equal(isMoveLegal({ color: 'WILD', type: CARD_TYPES.WILD, value: null }, topCard, activeColor), true);
    assert.equal(isMoveLegal({ color: 'WILD', type: CARD_TYPES.WILD_DRAW_FOUR, value: null }, topCard, activeColor), true);

    // Illegal: different color, different number
    assert.equal(isMoveLegal({ color: 'GREEN', type: CARD_TYPES.NUMBER, value: 2 }, topCard, activeColor), false);

    // Action on action match (Skip on Skip with different color)
    const topSkip = { color: 'YELLOW', type: CARD_TYPES.SKIP, value: null };
    assert.equal(isMoveLegal({ color: 'BLUE', type: CARD_TYPES.SKIP, value: null }, topSkip, 'YELLOW'), true);
  });

  await t.test('3. Turn Progression: handles CW, CCW, Skips, and 2-Player Reverse', () => {
    const seats4 = [0, 1, 2, 3];

    // Clockwise step 1
    assert.equal(getNextSeat(0, 1, 1, seats4), 1);
    assert.equal(getNextSeat(3, 1, 1, seats4), 0);

    // Counter-Clockwise step 1
    assert.equal(getNextSeat(0, 1, -1, seats4), 3);
    assert.equal(getNextSeat(2, 1, -1, seats4), 1);

    // Skip in CW (step 2)
    assert.equal(getNextSeat(0, 2, 1, seats4), 2);
    assert.equal(getNextSeat(3, 2, 1, seats4), 1);

    // 2-Player scenario: reverse acts as skip (returns back to current player in 2-player)
    const seats2 = [0, 1];
    assert.equal(getNextSeat(0, 2, 1, seats2), 0);
  });

  await t.test('4. Draw Pile Rebuild: re-shuffles discard pile when draw pile is depleted', () => {
    const topCard = { id: 'c_top', color: 'RED', value: 5 };
    const discardPile = [
      { id: 'c1', color: 'BLUE' },
      { id: 'c2', color: 'GREEN' },
      topCard,
    ];

    const result = rebuildDrawPile([], discardPile);
    assert.equal(result.discardPile.length, 1);
    assert.equal(result.discardPile[0].id, 'c_top');
    assert.equal(result.drawPile.length, 2);
  });

  await t.test('5. Bot AI: selects optimal moves and declares UNO', () => {
    const topCard = { color: 'BLUE', type: CARD_TYPES.NUMBER, value: 5 };
    const hand = [
      { id: 'c1', color: 'RED', type: CARD_TYPES.NUMBER, value: 3, scoreValue: 3 },
      { id: 'c2', color: 'BLUE', type: CARD_TYPES.NUMBER, value: 9, scoreValue: 9 },
    ];

    const move = chooseBotMove({
      handCards: hand,
      topDiscardCard: topCard,
      activeColor: 'BLUE',
      difficulty: 'NORMAL',
    });

    assert.equal(move.action, 'PLAY');
    assert.equal(move.card.id, 'c2');
    assert.equal(move.callUno, true); // Hand had 2 cards, so playing 1 leaves 1 card -> callUno is true!
  });
});
