'use strict';

/**
 * Sam Lốc Rule Engine (Server-Authoritative)
 * Implements standard northern Vietnamese Sâm Lốc card game mechanics.
 */

const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS = ['S', 'C', 'D', 'H']; // Spade ♠, Club ♣, Diamond ♦, Heart ♥

const RANK_VALUES = {
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
  '2': 15,
};

const SUIT_ORDER = {
  'S': 1,
  'C': 2,
  'D': 3,
  'H': 4,
};

/**
 * Parses card string (e.g. '3S', '10D', 'AH')
 */
function parseCard(cardStr) {
  if (!cardStr || typeof cardStr !== 'string') return null;
  const suit = cardStr.slice(-1).toUpperCase();
  const rank = cardStr.slice(0, -1).toUpperCase();
  if (!RANK_VALUES[rank] || !SUIT_ORDER[suit]) return null;
  return {
    id: `${rank}${suit}`,
    rank,
    suit,
    value: RANK_VALUES[rank],
    suitOrder: SUIT_ORDER[suit],
  };
}

/**
 * Sorts an array of card strings in ascending order (by rank value, then suit)
 */
function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const cardA = parseCard(a);
    const cardB = parseCard(b);
    if (!cardA || !cardB) return 0;
    if (cardA.value !== cardB.value) {
      return cardA.value - cardB.value;
    }
    return cardA.suitOrder - cardB.suitOrder;
  });
}

/**
 * Generates a full standard 52-card deck
 */
function createDeck() {
  const deck = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

/**
 * Shuffles an array in place using Fisher-Yates
 */
function shuffleDeck(deck) {
  const array = [...deck];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Deals 10 cards to each player (up to 4 players)
 */
function dealCards(playerCount = 4) {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error('Số người chơi Sâm phải từ 2 đến 4 người');
  }
  const deck = shuffleDeck(createDeck());
  const hands = [];
  for (let p = 0; p < playerCount; p++) {
    const rawHand = deck.slice(p * 10, (p + 1) * 10);
    hands.push(sortCards(rawHand));
  }
  return hands;
}

/**
 * Detects whether card set forms a valid Straight (Sảnh) in Sâm Lốc
 * Sâm Lốc Straight rules:
 * - Length >= 3
 * - Smallest straight: A-2-3 (values represented: A=14, 2=15, 3=3 -> in Sâm A-2-3 has highest rank evaluated as special 3)
 * - Standard straights: 3-4-5, 4-5-6, ..., 10-J-Q-K-A
 * - No wraps containing 2 in the middle (e.g. K-A-2 or 2-3-4 are invalid).
 */
function checkStraight(parsedList) {
  const len = parsedList.length;
  if (len < 3 || len > 10) return null;

  // Check unique ranks
  const ranks = parsedList.map((c) => c.rank);
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== len) return null;

  // Sorted by standard value (3 -> 15)
  const sorted = [...parsedList].sort((a, b) => a.value - b.value);
  const values = sorted.map((c) => c.value);

  // Check special Sâm straight: A - 2 - 3 (length 3 only, or A-2-3-4 if allowed, standard northern Sâm: A-2-3 is smallest 3-straight)
  if (len === 3 && values[0] === 3 && values[1] === 14 && values[2] === 15) {
    // ranks are '3', 'A', '2' -> valid A-2-3 straight!
    return {
      isA23: true,
      rankValue: 3.5, // Evaluated below 3-4-5 (which has rankValue 5), making A-2-3 the smallest straight
      highCard: sorted.find((c) => c.rank === '3').id,
    };
  }

  // Check standard consecutive values without 2 (2 value is 15)
  // A straight cannot contain 2 unless it is the special A-2-3
  if (values.includes(15)) {
    return null; // 2 cannot be in regular straights
  }

  for (let i = 0; i < len - 1; i++) {
    if (values[i + 1] - values[i] !== 1) {
      return null;
    }
  }

  // Highest value in straight determines its rank
  const highValue = values[len - 1];
  return {
    isA23: false,
    rankValue: highValue,
    highCard: sorted[len - 1].id,
  };
}

/**
 * Detects the combination of an array of cards
 */
function detectCombination(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return { isValid: false, type: 'INVALID', length: 0, rankValue: 0, name: 'Không hợp lệ' };
  }

  const parsed = cards.map(parseCard);
  if (parsed.some((c) => !c)) {
    return { isValid: false, type: 'INVALID', length: 0, rankValue: 0, name: 'Lá bài không hợp lệ' };
  }

  const len = cards.length;

  // 1. SINGLE (Rác)
  if (len === 1) {
    return {
      isValid: true,
      type: 'SINGLE',
      length: 1,
      rankValue: parsed[0].value,
      rank: parsed[0].rank,
      highCard: parsed[0].id,
      name: `Rác ${parsed[0].rank}`,
    };
  }

  // 2. PAIR (Đôi)
  if (len === 2 && parsed[0].value === parsed[1].value) {
    return {
      isValid: true,
      type: 'PAIR',
      length: 2,
      rankValue: parsed[0].value,
      rank: parsed[0].rank,
      highCard: parsed[1].id,
      name: `Đôi ${parsed[0].rank}`,
    };
  }

  // 3. TRIPLE (Sám)
  if (len === 3 && parsed[0].value === parsed[1].value && parsed[1].value === parsed[2].value) {
    return {
      isValid: true,
      type: 'TRIPLE',
      length: 3,
      rankValue: parsed[0].value,
      rank: parsed[0].rank,
      highCard: parsed[2].id,
      name: `Sám ${parsed[0].rank}`,
    };
  }

  // 4. FOUR OF A KIND (Tứ quý)
  if (
    len === 4 &&
    parsed[0].value === parsed[1].value &&
    parsed[1].value === parsed[2].value &&
    parsed[2].value === parsed[3].value
  ) {
    return {
      isValid: true,
      type: 'FOUR_OF_A_KIND',
      length: 4,
      rankValue: parsed[0].value,
      rank: parsed[0].rank,
      highCard: parsed[3].id,
      name: `Tứ quý ${parsed[0].rank}`,
    };
  }

  // 5. STRAIGHT (Sảnh)
  const straightInfo = checkStraight(parsed);
  if (straightInfo) {
    return {
      isValid: true,
      type: 'STRAIGHT',
      length: len,
      rankValue: straightInfo.rankValue,
      isA23: straightInfo.isA23,
      highCard: straightInfo.highCard,
      name: straightInfo.isA23 ? 'Sảnh A-2-3' : `Sảnh ${len} lá (đến ${parsed.find((c) => c.value === straightInfo.rankValue)?.rank || ''})`,
    };
  }

  return { isValid: false, type: 'INVALID', length: len, rankValue: 0, name: 'Bộ bài không hợp lệ' };
}

/**
 * Validates whether `currentCards` can beat `prevCards`
 * Returns `{ canBeat: boolean, reason?: string, isChop?: boolean }`
 */
function canBeat(currentCards, prevCards) {
  const currentCombo = detectCombination(currentCards);
  if (!currentCombo.isValid) {
    return { canBeat: false, reason: 'Bộ bài đánh ra không hợp lệ' };
  }

  // If no previous cards in current round (first play of the round)
  if (!prevCards || !Array.isArray(prevCards) || prevCards.length === 0) {
    return { canBeat: true, combo: currentCombo };
  }

  const prevCombo = detectCombination(prevCards);
  if (!prevCombo.isValid) {
    return { canBeat: true, combo: currentCombo };
  }

  // Case 1: Chặt 2 (Heo) bằng Tứ Quý
  if (prevCombo.type === 'SINGLE' && prevCombo.rankValue === 15) {
    if (currentCombo.type === 'FOUR_OF_A_KIND') {
      return {
        canBeat: true,
        isChop: true,
        chopType: 'FOUR_OF_A_KIND_BEATS_TWO',
        combo: currentCombo,
      };
    }
  }

  // Case 2: Tứ quý chặt Tứ quý nhỏ hơn
  if (prevCombo.type === 'FOUR_OF_A_KIND' && currentCombo.type === 'FOUR_OF_A_KIND') {
    if (currentCombo.rankValue > prevCombo.rankValue) {
      return {
        canBeat: true,
        isChop: true,
        chopType: 'FOUR_OF_A_KIND_BEATS_FOUR_OF_A_KIND',
        combo: currentCombo,
      };
    }
    return { canBeat: false, reason: 'Tứ quý phải lớn hơn tứ quý trước' };
  }

  // Case 3: Cùng loại kết hợp và cùng độ dài
  if (currentCombo.type === prevCombo.type && currentCombo.length === prevCombo.length) {
    if (currentCombo.rankValue > prevCombo.rankValue) {
      return { canBeat: true, combo: currentCombo };
    }
    return {
      canBeat: false,
      reason: `Bộ bài phải có giá trị lớn hơn (${currentCombo.name} không thắng được ${prevCombo.name})`,
    };
  }

  return {
    canBeat: false,
    reason: `Phải đánh cùng kiểu bộ bài (${prevCombo.name}) và cùng số lượng lá`,
  };
}

/**
 * Checks whether cards played on final turn violates Thối 2 rule
 */
function checkThoi2(cardsPlayed, remainingCardsBeforePlay) {
  // If player played all their remaining cards
  if (cardsPlayed.length === remainingCardsBeforePlay.length) {
    const parsed = cardsPlayed.map(parseCard);
    // Ending on a 2 (Single 2 or Pair of 2s) is Thối 2
    const hasTwo = parsed.some((c) => c && c.value === 15);
    if (hasTwo) {
      return true;
    }
  }
  return false;
}

module.exports = {
  RANKS,
  SUITS,
  RANK_VALUES,
  SUIT_ORDER,
  parseCard,
  sortCards,
  createDeck,
  shuffleDeck,
  dealCards,
  detectCombination,
  canBeat,
  checkThoi2,
};
