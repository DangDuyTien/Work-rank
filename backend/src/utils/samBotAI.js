'use strict';

const samEngine = require('./samEngine');

/**
 * Sam Lốc Bot AI Engine
 * Computes valid, legal moves obeying server rule engine strictly.
 */

// Helper to group cards by rank
function groupCardsByRank(handCards) {
  const groups = {};
  for (const card of handCards) {
    const parsed = samEngine.parseCard(card);
    if (!parsed) continue;
    if (!groups[parsed.value]) {
      groups[parsed.value] = [];
    }
    groups[parsed.value].push(card);
  }
  return groups;
}

// Find all pairs
function findAllPairs(handCards) {
  const groups = groupCardsByRank(handCards);
  const pairs = [];
  for (const val of Object.keys(groups)) {
    const cards = groups[val];
    if (cards.length >= 2) {
      // Pick 2 cards
      pairs.push([cards[0], cards[1]]);
    }
  }
  return pairs;
}

// Find all triples
function findAllTriples(handCards) {
  const groups = groupCardsByRank(handCards);
  const triples = [];
  for (const val of Object.keys(groups)) {
    const cards = groups[val];
    if (cards.length >= 3) {
      triples.push([cards[0], cards[1], cards[2]]);
    }
  }
  return triples;
}

// Find all four of a kind
function findAllFourOfAKind(handCards) {
  const groups = groupCardsByRank(handCards);
  const quads = [];
  for (const val of Object.keys(groups)) {
    const cards = groups[val];
    if (cards.length === 4) {
      quads.push([...cards]);
    }
  }
  return quads;
}

// Find all straights
function findAllStraights(handCards, targetLength = null) {
  const groups = groupCardsByRank(handCards);
  const availableRanks = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const straights = [];

  // Special A-2-3 straight: requires ranks 3 (val 3), A (val 14), 2 (val 15)
  if (groups[3] && groups[14] && groups[15]) {
    if (!targetLength || targetLength === 3) {
      straights.push([groups[14][0], groups[15][0], groups[3][0]]);
    }
  }

  // Standard consecutive straights (without 2, values 3 to 14)
  const nonTwoRanks = availableRanks.filter((r) => r >= 3 && r <= 14);

  for (let startIdx = 0; startIdx < nonTwoRanks.length; startIdx++) {
    const currentStraight = [groups[nonTwoRanks[startIdx]][0]];
    let currentVal = nonTwoRanks[startIdx];

    for (let nextIdx = startIdx + 1; nextIdx < nonTwoRanks.length; nextIdx++) {
      if (nonTwoRanks[nextIdx] === currentVal + 1) {
        currentStraight.push(groups[nonTwoRanks[nextIdx]][0]);
        currentVal = nonTwoRanks[nextIdx];

        if (currentStraight.length >= 3) {
          if (!targetLength || targetLength === currentStraight.length) {
            straights.push([...currentStraight]);
          }
        }
      } else {
        break;
      }
    }
  }

  return straights;
}

/**
 * Finds all legal moves the bot can make
 */
function getLegalMoves(handCards, lastPlayedCards) {
  const hand = samEngine.sortCards(handCards || []);
  if (hand.length === 0) return [];

  const legalMoves = [];

  // If new round (no previous cards)
  if (!lastPlayedCards || !lastPlayedCards.cards || lastPlayedCards.cards.length === 0) {
    // 1. All Straights (longer straights preferred)
    const straights = findAllStraights(hand);
    for (const st of straights) {
      const combo = samEngine.detectCombination(st);
      if (combo.isValid) legalMoves.push({ cards: st, combo });
    }

    // 2. All Four of a kind
    const quads = findAllFourOfAKind(hand);
    for (const q of quads) {
      const combo = samEngine.detectCombination(q);
      if (combo.isValid) legalMoves.push({ cards: q, combo });
    }

    // 3. All Triples
    const triples = findAllTriples(hand);
    for (const tr of triples) {
      const combo = samEngine.detectCombination(tr);
      if (combo.isValid) legalMoves.push({ cards: tr, combo });
    }

    // 4. All Pairs
    const pairs = findAllPairs(hand);
    for (const pr of pairs) {
      const combo = samEngine.detectCombination(pr);
      if (combo.isValid) legalMoves.push({ cards: pr, combo });
    }

    // 5. All Singles
    for (const card of hand) {
      const combo = samEngine.detectCombination([card]);
      if (combo.isValid) legalMoves.push({ cards: [card], combo });
    }

    return legalMoves;
  }

  // If responding to previous cards
  const prevCards = lastPlayedCards.cards;
  const prevCombo = samEngine.detectCombination(prevCards);
  if (!prevCombo.isValid) {
    return [];
  }

  if (prevCombo.type === 'SINGLE') {
    // Singles that beat prevCombo
    for (const card of hand) {
      const check = samEngine.canBeat([card], prevCards);
      if (check.canBeat) {
        legalMoves.push({ cards: [card], combo: check.combo, isChop: false });
      }
    }

    // If prev was a 2 (Heo), Four of a kind can chop!
    if (prevCombo.rankValue === 15) {
      const quads = findAllFourOfAKind(hand);
      for (const q of quads) {
        const check = samEngine.canBeat(q, prevCards);
        if (check.canBeat) {
          legalMoves.push({ cards: q, combo: check.combo, isChop: true });
        }
      }
    }
  } else if (prevCombo.type === 'PAIR') {
    const pairs = findAllPairs(hand);
    for (const pr of pairs) {
      const check = samEngine.canBeat(pr, prevCards);
      if (check.canBeat) {
        legalMoves.push({ cards: pr, combo: check.combo });
      }
    }
  } else if (prevCombo.type === 'TRIPLE') {
    const triples = findAllTriples(hand);
    for (const tr of triples) {
      const check = samEngine.canBeat(tr, prevCards);
      if (check.canBeat) {
        legalMoves.push({ cards: tr, combo: check.combo });
      }
    }
  } else if (prevCombo.type === 'FOUR_OF_A_KIND') {
    const quads = findAllFourOfAKind(hand);
    for (const q of quads) {
      const check = samEngine.canBeat(q, prevCards);
      if (check.canBeat) {
        legalMoves.push({ cards: q, combo: check.combo, isChop: true });
      }
    }
  } else if (prevCombo.type === 'STRAIGHT') {
    const straights = findAllStraights(hand, prevCombo.length);
    for (const st of straights) {
      const check = samEngine.canBeat(st, prevCards);
      if (check.canBeat) {
        legalMoves.push({ cards: st, combo: check.combo });
      }
    }
  }

  return legalMoves;
}

/**
 * Decides whether bot should declare Sâm in the opening phase
 */
function decideSam(handCards, difficulty = 'NORMAL') {
  if (!Array.isArray(handCards) || handCards.length !== 10) return false;
  if (difficulty === 'EASY') return false;

  const straights = findAllStraights(handCards);
  const longestStraight = straights.reduce((max, s) => Math.max(max, s.length), 0);
  const quads = findAllFourOfAKind(handCards);
  const twoCount = handCards.filter((c) => c.startsWith('2')).length;

  // If hand has straight >= 8 or quads + multiple 2s
  if (longestStraight >= 8 || (quads.length >= 1 && twoCount >= 2)) {
    return true;
  }

  if (difficulty === 'HARD' && (longestStraight >= 6 && twoCount >= 2)) {
    return true;
  }

  return false;
}

/**
 * Chooses the best legal move for the bot
 */
function chooseMove(handCards, lastPlayedCards, isBaoMot = false, difficulty = 'NORMAL') {
  const legalMoves = getLegalMoves(handCards, lastPlayedCards);

  // If no legal moves available
  if (legalMoves.length === 0) {
    if (!lastPlayedCards || !lastPlayedCards.cards) {
      // Must play at least one card when opening
      const hand = samEngine.sortCards(handCards);
      return {
        action: 'PLAY',
        cardIds: [hand[0]],
        combo: samEngine.detectCombination([hand[0]]),
        decisionReason: 'OPENING_FALLBACK',
      };
    }
    return {
      action: 'PASS',
      cardIds: null,
      combo: null,
      decisionReason: 'NO_LEGAL_MOVE',
      allLegalMoves: [],
    };
  }

  // 1. OPENING MOVE (No previous cards)
  if (!lastPlayedCards || !lastPlayedCards.cards || lastPlayedCards.cards.length === 0) {
    // Sort moves by preference:
    // Prefer playing longer straights first, then triples, pairs, singles
    // To prevent Thối 2: Filter out single 2 if bot has other options or if it's the final card
    const nonEndingTwoMoves = legalMoves.filter((m) => {
      if (m.cards.length === handCards.length) {
        // If this move empties hand, verify it's not ending on 2
        return !samEngine.checkThoi2(m.cards, handCards);
      }
      return true;
    });

    const candidates = nonEndingTwoMoves.length > 0 ? nonEndingTwoMoves : legalMoves;

    // Preference score: Straights (len * 10) > Triples (25) > Pairs (15) > Singles (5)
    candidates.sort((a, b) => {
      const getScore = (m) => {
        if (m.combo.type === 'STRAIGHT') return 40 + m.combo.length * 5;
        if (m.combo.type === 'FOUR_OF_A_KIND') return 10; // Keep quad for chop
        if (m.combo.type === 'TRIPLE') return 30;
        if (m.combo.type === 'PAIR') return 20;
        return 5;
      };
      const scoreDiff = getScore(b) - getScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      // If same score, play the one with lower rank value to clear small cards
      return (a.combo.rankValue || 0) - (b.combo.rankValue || 0);
    });

    const chosen = candidates[0];
    return {
      action: 'PLAY',
      cardIds: chosen.cards,
      combo: chosen.combo,
      decisionReason: `OPENING_${chosen.combo.type}`,
      allLegalMoves: legalMoves,
    };
  }

  // 2. RESPONDING TO PREVIOUS MOVE
  // If opponent is Báo 1 and bot is playing single: must play highest legal card to block
  if (isBaoMot && lastPlayedCards.cards.length === 1) {
    const singleMoves = legalMoves.filter((m) => m.cards.length === 1);
    if (singleMoves.length > 0) {
      singleMoves.sort((a, b) => (b.combo.rankValue || 0) - (a.combo.rankValue || 0));
      const chosen = singleMoves[0];
      return {
        action: 'PLAY',
        cardIds: chosen.cards,
        combo: chosen.combo,
        decisionReason: 'BLOCK_BAO_MOT',
        allLegalMoves: legalMoves,
      };
    }
  }

  // Greedy optimal strategy: Play lowest rank legal combo that beats the opponent
  legalMoves.sort((a, b) => {
    // Non-chop moves first unless only chop is available
    if (a.isChop && !b.isChop) return 1;
    if (!a.isChop && b.isChop) return -1;
    return (a.combo.rankValue || 0) - (b.combo.rankValue || 0);
  });

  const chosen = legalMoves[0];

  // If move would result in Thối 2 and bot has alternative, pass instead
  if (chosen.cards.length === handCards.length && samEngine.checkThoi2(chosen.cards, handCards)) {
    return {
      action: 'PASS',
      cardIds: null,
      combo: null,
      decisionReason: 'AVOID_THOI_2',
      allLegalMoves: legalMoves,
    };
  }

  return {
    action: 'PLAY',
    cardIds: chosen.cards,
    combo: chosen.combo,
    isChop: chosen.isChop,
    decisionReason: `BEAT_${chosen.combo.type}`,
    allLegalMoves: legalMoves,
  };
}

module.exports = {
  findAllPairs,
  findAllTriples,
  findAllFourOfAKind,
  findAllStraights,
  getLegalMoves,
  decideSam,
  chooseMove,
};
