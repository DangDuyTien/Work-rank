#!/usr/bin/env node
/**
 * AUDIT TĨNH: chữ tiếng Anh còn sót trong UI Game Center.
 *
 * Chỉ quét phần NGƯỜI DÙNG NHÌN THẤY:
 * - text node trong JSX
 * - thuộc tính title / placeholder / aria-label / alt
 *
 * Không quét tên biến, class CSS, route, gameType, socket event hay comment —
 * những thứ đó phải giữ nguyên tiếng Anh để không phá hợp đồng nội bộ.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as parser from '@babel/parser';
import traversePkg from '@babel/traverse';

const traverse = traversePkg.default || traversePkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

const SCOPE = [
  'pages/GameHub.jsx',
  'pages/ArcadeGame.jsx',
  'pages/DrawingGame.jsx',
  'pages/CreativeGallery.jsx',
  'pages/TypingHub.jsx',
  'pages/TypingBattle.jsx',
  'components/Sidebar.jsx',
  'components/CreativeCornerSection.jsx',
  'components/GameComingSoon.jsx',
  'components/arcade/ArcadeLobby.jsx',
  'components/arcade/ArcadePlay.jsx',
  'components/arcade/ArcadeResult.jsx',
  'components/arcade/ArcadeShared.jsx',
  'components/arcade/ArcadeTutorial.jsx',
  'components/arcade/ComputerStation.jsx',
  'components/arcade/DirectionArena.jsx',
  'components/arcade/MemoryBoard.jsx',
  'components/arcade/RaceStrip.jsx',
  'components/arcade/SavedGameHistory.jsx',
  'components/arcade/TypingArcadeView.jsx',
  'games/arcade/catalog.js',
  'config/navigation.js',
];

// Từ tiếng Anh không được xuất hiện trong UI đã Việt hóa.
const FORBIDDEN = [
  'typing', 'battle', 'computer', 'rush', 'direction', 'memory', 'flash', 'drawing',
  'play', 'again', 'ready', 'waiting', 'start', 'game', 'center', 'leaderboard',
  'score', 'time', 'combo', 'accuracy', 'result', 'winner', 'rank', 'best', 'personal',
  'room', 'create', 'join', 'leave', 'brush', 'eraser', 'color', 'size', 'undo', 'redo',
  'clear', 'save', 'draft', 'publish', 'gallery', 'creative', 'corner', 'solo', 'duo',
  'trio', 'team', 'mode', 'player', 'lobby', 'submit', 'cancel', 'close', 'next',
  'previous', 'loading', 'error', 'success', 'view', 'back',
];

// Thương hiệu và thuật ngữ kỹ thuật được giữ nguyên.
const ALLOWED_PHRASES = [
  'WORK RANK ARCADE',
  'WORK RANK',
  'WPM',
  'XP',
  'PNG',
  'BACKSPACE',
  'ENTER',
  'SPACE',
  'CTRL',
  'CMD',
  'ESC',
  'WASD',
  'YOUTUBE',
  'KPI',
  'BXH',
  'GRAND',
  'MEDIA & CONTENT',
];

const TEXT_ATTRS = new Set(['title', 'placeholder', 'aria-label', 'alt']);

function stripAllowed(text) {
  let output = text;
  for (const phrase of ALLOWED_PHRASES) {
    output = output.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  return output;
}

function findForbidden(text) {
  const haystack = stripAllowed(text);
  return FORBIDDEN.filter((word) => new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, 'iu').test(haystack));
}

const findings = [];

for (const relative of SCOPE) {
  const file = path.join(srcDir, relative);
  if (!fs.existsSync(file)) continue;
  const code = fs.readFileSync(file, 'utf8');

  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'importMeta', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch (error) {
    findings.push({ file: relative, line: 0, text: `PARSE ERROR: ${error.message}`, words: ['SYNTAX'] });
    continue;
  }

  traverse(ast, {
    JSXText(nodePath) {
      const text = nodePath.node.value.replace(/\s+/g, ' ').trim();
      if (text.length < 3) return;
      const words = findForbidden(text);
      if (words.length) {
        findings.push({ file: relative, line: nodePath.node.loc?.start.line || 0, text: text.slice(0, 90), words });
      }
    },
    JSXAttribute(nodePath) {
      const name = nodePath.node.name?.name;
      if (!TEXT_ATTRS.has(name)) return;
      const value = nodePath.node.value;
      if (!value || value.type !== 'StringLiteral') return;
      const words = findForbidden(value.value);
      if (words.length) {
        findings.push({ file: relative, line: nodePath.node.loc?.start.line || 0, text: `${name}="${value.value.slice(0, 80)}"`, words });
      }
    },
  });
}

if (!findings.length) {
  console.log(`✅ [Game Center i18n] Không còn chữ Anh trong ${SCOPE.length} file UI.`);
  process.exit(0);
}

console.error(`❌ [Game Center i18n] ${findings.length} chuỗi còn tiếng Anh:\n`);
for (const finding of findings) {
  console.error(`  ${finding.file}:${finding.line}  [${finding.words.join(', ')}]  ${finding.text}`);
}
process.exit(1);
