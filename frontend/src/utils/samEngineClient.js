'use strict';

/**
 * Sam Lốc Client Rule Inspector & Card Utilities
 * Provides instant UX feedback for combination detection,
 * legal move hints, and intelligent card sorting.
 */

export const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
export const SUITS = ['S', 'C', 'D', 'H'];

export const RANK_VALUES = {
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

export const SUIT_ORDER = {
  'S': 1, // Spade ♠
  'C': 2, // Club ♣
  'D': 3, // Diamond ♦
  'H': 4, // Heart ♥
};

export function parseCard(cardStr) {
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

export function sortCardsByRank(cards) {
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

function checkStraight(parsedList) {
  const len = parsedList.length;
  if (len < 3 || len > 10) return null;

  const ranks = parsedList.map((c) => c.rank);
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== len) return null;

  const sorted = [...parsedList].sort((a, b) => a.value - b.value);
  const values = sorted.map((c) => c.value);

  // A-2-3 straight
  if (len === 3 && values[0] === 3 && values[1] === 14 && values[2] === 15) {
    return {
      isA23: true,
      rankValue: 3.5,
      name: 'Sảnh A-2-3 (Sảnh nhỏ nhất)',
    };
  }

  // Regular straight cannot contain 2
  if (values.includes(15)) return null;

  for (let i = 0; i < len - 1; i++) {
    if (values[i + 1] - values[i] !== 1) return null;
  }

  const highRank = sorted[len - 1].rank;
  const lowRank = sorted[0].rank;
  return {
    isA23: false,
    rankValue: values[len - 1],
    name: `Sảnh ${len} lá (${lowRank} → ${highRank})`,
  };
}

export function detectCombination(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return { isValid: false, type: 'INVALID', name: 'Chưa chọn bài', length: 0 };
  }

  const parsed = cards.map(parseCard);
  if (parsed.some((c) => !c)) {
    return { isValid: false, type: 'INVALID', name: 'Lá bài không hợp lệ', length: 0 };
  }

  const len = cards.length;

  // 1. Single
  if (len === 1) {
    return {
      isValid: true,
      type: 'SINGLE',
      length: 1,
      rankValue: parsed[0].value,
      name: `Rác ${parsed[0].rank}`,
    };
  }

  // 2. Pair
  if (len === 2 && parsed[0].value === parsed[1].value) {
    return {
      isValid: true,
      type: 'PAIR',
      length: 2,
      rankValue: parsed[0].value,
      name: `Đôi ${parsed[0].rank}`,
    };
  }

  // 3. Triple
  if (len === 3 && parsed[0].value === parsed[1].value && parsed[1].value === parsed[2].value) {
    return {
      isValid: true,
      type: 'TRIPLE',
      length: 3,
      rankValue: parsed[0].value,
      name: `Sám ${parsed[0].rank}`,
    };
  }

  // 4. Four of a kind
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
      name: `Tứ quý ${parsed[0].rank} (Chặt 2)`,
    };
  }

  // 5. Straight
  const straightInfo = checkStraight(parsed);
  if (straightInfo) {
    return {
      isValid: true,
      type: 'STRAIGHT',
      length: len,
      rankValue: straightInfo.rankValue,
      name: straightInfo.name,
    };
  }

  return {
    isValid: false,
    type: 'INVALID',
    length: len,
    name: 'Tổ hợp không hợp lệ',
  };
}

export function canBeat(selectedCards, lastPlayedCards) {
  const currentCombo = detectCombination(selectedCards);
  if (!currentCombo.isValid) {
    return { canBeat: false, reason: 'Bài chọn không hợp lệ' };
  }

  if (!lastPlayedCards || !lastPlayedCards.cards || lastPlayedCards.cards.length === 0) {
    return { canBeat: true, combo: currentCombo };
  }

  const prevCards = lastPlayedCards.cards;
  const prevCombo = detectCombination(prevCards);
  if (!prevCombo.isValid) {
    return { canBeat: true, combo: currentCombo };
  }

  // Case 1: Tứ quý chặt 2
  if (prevCombo.type === 'SINGLE' && prevCombo.rankValue === 15) {
    if (currentCombo.type === 'FOUR_OF_A_KIND') {
      return { canBeat: true, isChop: true, combo: currentCombo };
    }
  }

  // Case 2: Tứ quý chặt Tứ quý
  if (prevCombo.type === 'FOUR_OF_A_KIND' && currentCombo.type === 'FOUR_OF_A_KIND') {
    if (currentCombo.rankValue > prevCombo.rankValue) {
      return { canBeat: true, isChop: true, combo: currentCombo };
    }
    return { canBeat: false, reason: 'Tứ quý phải lớn hơn tứ quý trước' };
  }

  // Case 3: Cùng loại kết hợp và cùng độ dài
  if (currentCombo.type === prevCombo.type && currentCombo.length === prevCombo.length) {
    if (currentCombo.rankValue > prevCombo.rankValue) {
      return { canBeat: true, combo: currentCombo };
    }
    return { canBeat: false, reason: 'Bộ bài phải lớn hơn bài trên bàn' };
  }

  return { canBeat: false, reason: 'Phải đánh cùng kiểu bộ bài và cùng số lượng lá' };
}

/**
 * Intelligent Smart Sorting (Groups Combinations first: Quads, Triples, Pairs, Straights, Singles)
 */
export function sortCardsSmart(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return [];
  const parsed = cards.map(parseCard).filter(Boolean);

  // Group by rank
  const rankGroups = {};
  parsed.forEach((c) => {
    if (!rankGroups[c.value]) rankGroups[c.value] = [];
    rankGroups[c.value].push(c.id);
  });

  const quads = [];
  const triples = [];
  const pairs = [];
  const singles = [];

  Object.keys(rankGroups)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((val) => {
      const group = rankGroups[val];
      if (group.length === 4) quads.push(...group);
      else if (group.length === 3) triples.push(...group);
      else if (group.length === 2) pairs.push(...group);
      else singles.push(...group);
    });

  return [...quads, ...triples, ...pairs, ...singles];
}
