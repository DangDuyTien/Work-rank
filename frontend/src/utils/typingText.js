const segmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('und', { granularity: 'grapheme' })
  : null;

export function normalizeText(value) {
  return String(value ?? '').normalize('NFC');
}

export function graphemes(value) {
  const text = normalizeText(value);
  return segmenter ? Array.from(segmenter.segment(text), ({ segment }) => segment) : Array.from(text);
}

export function graphemeCount(value) {
  return graphemes(value).length;
}

export function foldCase(value) {
  try { return normalizeText(value).toLocaleLowerCase('und'); } catch { return normalizeText(value).toLowerCase(); }
}

export function sameCharacter(a, b) {
  return foldCase(a) === foldCase(b);
}
