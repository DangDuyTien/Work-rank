'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const samEngine = require('../src/utils/samEngine');

describe('Sam Lốc Rule Engine Unit Tests', () => {
  it('1. Deck creation & Deal 10 cards to each player', () => {
    const deck = samEngine.createDeck();
    assert.equal(deck.length, 52, 'Standard deck must have 52 cards');

    const hands = samEngine.dealCards(4);
    assert.equal(hands.length, 4, 'Must deal to 4 players');
    hands.forEach((hand, idx) => {
      assert.equal(hand.length, 10, `Player ${idx} must receive exactly 10 cards`);
      // Check all cards are distinct
      const set = new Set(hand);
      assert.equal(set.size, 10, `Player ${idx} hand must have unique cards`);
    });

    // Check dealing to 2 or 3 players
    const hands2 = samEngine.dealCards(2);
    assert.equal(hands2.length, 2);
    const hands3 = samEngine.dealCards(3);
    assert.equal(hands3.length, 3);
  });

  it('2. Card sorting respects rank values then suits', () => {
    const unsorted = ['2H', '3S', 'AD', '5C', '3D'];
    const sorted = samEngine.sortCards(unsorted);
    assert.deepEqual(sorted, ['3S', '3D', '5C', 'AD', '2H']);
  });

  it('3. Single, Pair, Triple, Four of a kind combination detection', () => {
    // Single
    const single = samEngine.detectCombination(['5S']);
    assert.equal(single.isValid, true);
    assert.equal(single.type, 'SINGLE');
    assert.equal(single.rankValue, 5);

    // Pair
    const pair = samEngine.detectCombination(['8H', '8C']);
    assert.equal(pair.isValid, true);
    assert.equal(pair.type, 'PAIR');
    assert.equal(pair.rankValue, 8);

    // Invalid pair (mismatched ranks)
    const invalidPair = samEngine.detectCombination(['8H', '9C']);
    assert.equal(invalidPair.isValid, false);

    // Triple
    const triple = samEngine.detectCombination(['QS', 'QD', 'QC']);
    assert.equal(triple.isValid, true);
    assert.equal(triple.type, 'TRIPLE');
    assert.equal(triple.rankValue, 12);

    // Four of a kind (Tứ quý)
    const four = samEngine.detectCombination(['KH', 'KC', 'KD', 'KS']);
    assert.equal(four.isValid, true);
    assert.equal(four.type, 'FOUR_OF_A_KIND');
    assert.equal(four.rankValue, 13);
  });

  it('4. Straight (Sảnh) detection in Sâm Lốc', () => {
    // Standard 3-straight
    const s1 = samEngine.detectCombination(['5S', '6D', '7C']);
    assert.equal(s1.isValid, true);
    assert.equal(s1.type, 'STRAIGHT');
    assert.equal(s1.length, 3);
    assert.equal(s1.rankValue, 7);

    // Standard 5-straight ending in Ace: 10-J-Q-K-A
    const s2 = samEngine.detectCombination(['10S', 'JC', 'QD', 'KH', 'AS']);
    assert.equal(s2.isValid, true);
    assert.equal(s2.type, 'STRAIGHT');
    assert.equal(s2.length, 5);
    assert.equal(s2.rankValue, 14);

    // Special smallest straight: A-2-3
    const sA23 = samEngine.detectCombination(['AH', '2C', '3D']);
    assert.equal(sA23.isValid, true);
    assert.equal(sA23.type, 'STRAIGHT');
    assert.equal(sA23.length, 3);
    assert.equal(sA23.isA23, true);

    // Invalid straight containing 2 with higher cards (e.g. 2-3-4 or K-A-2)
    const invalidS1 = samEngine.detectCombination(['2S', '3C', '4D']);
    assert.equal(invalidS1.isValid, false);

    const invalidS2 = samEngine.detectCombination(['KS', 'AC', '2D']);
    assert.equal(invalidS2.isValid, false);
  });

  it('5. Combination comparison: Same type & same length', () => {
    // Single 9 beats Single 7
    const r1 = samEngine.canBeat(['9S'], ['7D']);
    assert.equal(r1.canBeat, true);

    // Single 5 CANNOT beat Single 7
    const r2 = samEngine.canBeat(['5H'], ['7D']);
    assert.equal(r2.canBeat, false);

    // In Sâm: Single 7♥ does NOT beat Single 7♠ (no suit distinction, must be strictly higher rank)
    const rSuit = samEngine.canBeat(['7H'], ['7S']);
    assert.equal(rSuit.canBeat, false);

    // Pair 10 beats Pair 8
    const r3 = samEngine.canBeat(['10C', '10D'], ['8S', '8H']);
    assert.equal(r3.canBeat, true);

    // Straight comparison: 4-5-6 beats A-2-3 (A-2-3 is smallest)
    const rS1 = samEngine.canBeat(['4S', '5C', '6D'], ['AH', '2C', '3D']);
    assert.equal(rS1.canBeat, true);

    // 7-8-9 beats 5-6-7
    const rS2 = samEngine.canBeat(['7S', '8C', '9D'], ['5H', '6C', '7D']);
    assert.equal(rS2.canBeat, true);

    // Straight of 4 cards CANNOT beat straight of 3 cards
    const rLen = samEngine.canBeat(['5S', '6C', '7D', '8H'], ['7H', '8C', '9D']);
    assert.equal(rLen.canBeat, false);
  });

  it('6. Chop rules: Tứ quý chặt 2 và Tứ quý to chặt Tứ quý nhỏ', () => {
    // Tứ quý 6 chặt 2 Cơ (Single 2)
    const chop2 = samEngine.canBeat(['6S', '6C', '6D', '6H'], ['2H']);
    assert.equal(chop2.canBeat, true);
    assert.equal(chop2.isChop, true);

    // Tứ quý J chặt Tứ quý 9
    const chopFour = samEngine.canBeat(['JS', 'JC', 'JD', 'JH'], ['9S', '9C', '9D', '9H']);
    assert.equal(chopFour.canBeat, true);
    assert.equal(chopFour.isChop, true);

    // Tứ quý 8 KHÔNG chặt được Tứ quý 10
    const failChop = samEngine.canBeat(['8S', '8C', '8D', '8H'], ['10S', '10C', '10D', '10H']);
    assert.equal(failChop.canBeat, false);
  });

  it('7. Thối 2 verification on final hand play', () => {
    // Player has 1 card left ('2H') and plays it -> Thối 2
    const isThoi = samEngine.checkThoi2(['2H'], ['2H']);
    assert.equal(isThoi, true);

    // Player has 1 card left ('9S') and plays it -> Clean finish (NOT Thối)
    const cleanFinish = samEngine.checkThoi2(['9S'], ['9S']);
    assert.equal(cleanFinish, false);

    // Player has 2 cards ('2C', '2D') and plays pair of 2s to finish -> Thối 2
    const pair2Finish = samEngine.checkThoi2(['2C', '2D'], ['2C', '2D']);
    assert.equal(pair2Finish, true);
  });
});
