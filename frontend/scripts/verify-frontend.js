#!/usr/bin/env node

/**
 * WORKRANK FRONTEND STATIC ANALYSIS & RUNTIME INTEGRITY AUDITOR
 * 
 * Verifies:
 * 1. Syntax integrity across all JSX/JS files.
 * 2. Undefined identifiers and JSX tags (no missing imports, no undefined components).
 * 3. Module import resolution (relative paths, default vs named exports).
 * 4. Third-party library exports (e.g., lucide-react icon existence).
 * 5. Route lazy import resolution and default export validity.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as parser from '@babel/parser';
import traversePkg from '@babel/traverse';
import * as lucide from 'lucide-react';

const traverse = traversePkg.default || traversePkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

function getAllFiles(dir, exts = ['.jsx', '.js']) {
  let files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== 'dist') {
        files = files.concat(getAllFiles(fullPath, exts));
      }
    } else if (exts.includes(path.extname(item.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = getAllFiles(srcDir);
console.log(`🔍 [WorkRank Frontend Audit] Scanning ${allFiles.length} files in src/...`);

const KNOWN_GLOBALS = new Set([
  'window', 'document', 'console', 'Math', 'JSON', 'Promise', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'fetch', 'localStorage', 'sessionStorage',
  'encodeURIComponent', 'decodeURIComponent', 'URLSearchParams', 'URL', 'Array', 'Object',
  'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Error', 'TypeError', 'ReferenceError',
  'RangeError', 'SyntaxError', 'URIError', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Intl',
  'Event', 'CustomEvent', 'FileReader', 'Image', 'Blob', 'File', 'FormData', 'performance',
  'navigator', 'location', 'history', 'alert', 'confirm', 'prompt', 'requestAnimationFrame',
  'cancelAnimationFrame', 'AbortController', 'AbortSignal', 'WebSocket', 'MutationObserver', 'IntersectionObserver',
  'ResizeObserver', 'Audio', 'Notification', 'process', 'globalThis', 'self', 'NaN', 'Infinity',
  'undefined', 'null', 'eval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'React', 'atob', 'btoa',
  'crypto', 'indexedDB', 'Headers', 'Request', 'Response'
]);

const fileExportsMap = new Map(); // path -> { hasDefault: boolean, named: Set<string> }

function resolveImportPath(fromFile, importSource) {
  if (!importSource.startsWith('.')) return null;
  const dir = path.dirname(fromFile);
  const candidates = [
    path.resolve(dir, importSource),
    path.resolve(dir, importSource + '.jsx'),
    path.resolve(dir, importSource + '.js'),
    path.resolve(dir, importSource, 'index.jsx'),
    path.resolve(dir, importSource, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return 'NOT_FOUND:' + path.resolve(dir, importSource);
}

let errors = [];

// PASS 1: Extract exports
for (const filePath of allFiles) {
  const code = fs.readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'importMeta', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator']
    });
  } catch (err) {
    errors.push({
      file: path.relative(srcDir, filePath),
      type: 'SYNTAX_ERROR',
      message: err.message
    });
    continue;
  }

  const fileExports = { hasDefault: false, named: new Set() };

  traverse(ast, {
    ExportDefaultDeclaration() {
      fileExports.hasDefault = true;
    },
    ExportNamedDeclaration(pathNode) {
      if (pathNode.node.declaration) {
        if (pathNode.node.declaration.declarations) {
          pathNode.node.declaration.declarations.forEach(d => {
            if (d.id && d.id.name) fileExports.named.add(d.id.name);
          });
        }
        if (pathNode.node.declaration.id && pathNode.node.declaration.id.name) {
          fileExports.named.add(pathNode.node.declaration.id.name);
        }
      }
      if (pathNode.node.specifiers) {
        pathNode.node.specifiers.forEach(s => {
          if (s.exported && s.exported.name) {
            if (s.exported.name === 'default') fileExports.hasDefault = true;
            else fileExports.named.add(s.exported.name);
          }
        });
      }
    }
  });

  fileExportsMap.set(filePath, fileExports);
}

// PASS 2: Audit symbols & imports
for (const filePath of allFiles) {
  const relPath = path.relative(srcDir, filePath);
  const code = fs.readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'importMeta', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator']
    });
  } catch (err) {
    continue; // Already recorded in Pass 1
  }

  traverse(ast, {
    // 1. JSX element names
    JSXIdentifier(pathNode) {
      if (pathNode.parent.type === 'JSXOpeningElement' && pathNode.parent.name === pathNode.node) {
        const name = pathNode.node.name;
        if (/^[a-z]/.test(name)) return;
        if (!pathNode.scope.hasBinding(name) && !KNOWN_GLOBALS.has(name)) {
          errors.push({
            file: relPath,
            line: pathNode.node.loc?.start?.line,
            col: pathNode.node.loc?.start?.column,
            type: 'UNDEFINED_JSX_ELEMENT',
            message: `JSX component <${name} /> is used but not imported or declared in scope`
          });
        }
      }
    },

    // 2. Undefined identifiers in expressions
    Identifier(pathNode) {
      const name = pathNode.node.name;
      if (pathNode.parent.type === 'MemberExpression' && pathNode.parent.property === pathNode.node && !pathNode.parent.computed) return;
      if (pathNode.parent.type === 'OptionalMemberExpression' && pathNode.parent.property === pathNode.node && !pathNode.parent.computed) return;
      if (pathNode.parent.type === 'ObjectProperty' && pathNode.parent.key === pathNode.node && !pathNode.parent.computed) return;
      if (pathNode.parent.type === 'ObjectMethod' && pathNode.parent.key === pathNode.node) return;
      if (pathNode.parent.type === 'ClassMethod' && pathNode.parent.key === pathNode.node) return;
      if (pathNode.parent.type === 'ClassProperty' && pathNode.parent.key === pathNode.node && !pathNode.parent.computed) return;
      if (pathNode.parent.type === 'ImportSpecifier' || pathNode.parent.type === 'ImportDefaultSpecifier' || pathNode.parent.type === 'ImportNamespaceSpecifier') return;
      if (pathNode.parent.type === 'ExportSpecifier') return;
      if (pathNode.parent.type === 'FunctionDeclaration' && pathNode.parent.id === pathNode.node) return;
      if (pathNode.parent.type === 'FunctionExpression' && pathNode.parent.id === pathNode.node) return;
      if (pathNode.parent.type === 'VariableDeclarator' && pathNode.parent.id === pathNode.node) return;
      if (pathNode.parent.type === 'CatchClause' && pathNode.parent.param === pathNode.node) return;
      if (pathNode.parent.type === 'LabeledStatement') return;
      if (pathNode.parent.type === 'BreakStatement' || pathNode.parent.type === 'ContinueStatement') return;
      if (pathNode.parent.type === 'JSXAttribute') return;
      if (pathNode.parent.type === 'MetaProperty') return;

      if (!pathNode.scope.hasBinding(name) && !KNOWN_GLOBALS.has(name)) {
        if (pathNode.parent.type === 'UnaryExpression' && pathNode.parent.operator === 'typeof') return;
        errors.push({
          file: relPath,
          line: pathNode.node.loc?.start?.line,
          col: pathNode.node.loc?.start?.column,
          type: 'UNDEFINED_VARIABLE',
          message: `Variable '${name}' is referenced but not declared or imported in scope`
        });
      }
    },

    // 3. Imports check
    ImportDeclaration(pathNode) {
      const source = pathNode.node.source.value;
      const line = pathNode.node.loc?.start?.line;

      if (source === 'lucide-react') {
        pathNode.node.specifiers.forEach(s => {
          if (s.type === 'ImportSpecifier') {
            const importedName = s.imported.name;
            if (!lucide[importedName]) {
              errors.push({
                file: relPath,
                line,
                type: 'INVALID_LUCIDE_ICON',
                message: `lucide-react does not export icon '${importedName}'`
              });
            }
          }
        });
        return;
      }

      if (source.startsWith('.')) {
        const resolved = resolveImportPath(filePath, source);
        if (!resolved || resolved.startsWith('NOT_FOUND:')) {
          errors.push({
            file: relPath,
            line,
            type: 'FILE_NOT_FOUND',
            message: `Cannot resolve imported path '${source}' from ${relPath}`
          });
          return;
        }

        const targetExports = fileExportsMap.get(resolved);
        if (targetExports) {
          pathNode.node.specifiers.forEach(s => {
            if (s.type === 'ImportDefaultSpecifier') {
              if (!targetExports.hasDefault) {
                errors.push({
                  file: relPath,
                  line,
                  type: 'MISSING_DEFAULT_EXPORT',
                  message: `Module '${source}' does not provide a default export`
                });
              }
            } else if (s.type === 'ImportSpecifier') {
              const importedName = s.imported.name;
              if (!targetExports.named.has(importedName)) {
                errors.push({
                  file: relPath,
                  line,
                  type: 'MISSING_NAMED_EXPORT',
                  message: `Module '${source}' does not export '${importedName}'`
                });
              }
            }
          });
        }
      }
    },

    // 4. Dynamic/Lazy imports check
    CallExpression(pathNode) {
      if (pathNode.node.callee && (pathNode.node.callee.name === 'import' || pathNode.node.callee.type === 'Import')) {
        const arg = pathNode.node.arguments[0];
        if (arg && arg.type === 'StringLiteral') {
          const source = arg.value;
          const line = pathNode.node.loc?.start?.line;
          if (source.startsWith('.')) {
            const resolved = resolveImportPath(filePath, source);
            if (!resolved || resolved.startsWith('NOT_FOUND:')) {
              errors.push({
                file: relPath,
                line,
                type: 'LAZY_IMPORT_FILE_NOT_FOUND',
                message: `Dynamic import '${source}' could not be resolved`
              });
            } else {
              const targetExports = fileExportsMap.get(resolved);
              if (targetExports && !targetExports.hasDefault) {
                errors.push({
                  file: relPath,
                  line,
                  type: 'LAZY_IMPORT_NO_DEFAULT',
                  message: `Dynamic import target '${source}' must provide a default export for React.lazy`
                });
              }
            }
          }
        }
      }
    }
  });
}

if (errors.length > 0) {
  console.error(`\n❌ [WorkRank Frontend Audit Failed] Found ${errors.length} integrity error(s):`);
  errors.forEach((err, idx) => {
    console.error(`  ${idx + 1}. [${err.type}] ${err.file}${err.line ? `:${err.line}` : ''} -> ${err.message}`);
  });
  process.exit(1);
} else {
  console.log(`\n✅ [WorkRank Frontend Audit Passed] 100% integrity across all ${allFiles.length} files. 0 errors detected.\n`);
  process.exit(0);
}
