#!/usr/bin/env node
// Static frontend<->backend API contract check. No dependencies, no server needed.
//   node scripts/check-api-contract.cjs [path-to-frontend]
// Lists every /api/... path the frontend calls and whether a backend route exists.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const feRoot = path.resolve(process.argv[2] || path.join(root, '..', 'HYPNEXIX-FRONTEND-main'));
if (!fs.existsSync(path.join(feRoot, 'src'))) { console.error(`frontend not found at ${feRoot}\nusage: node scripts/check-api-contract.cjs <frontend-dir>`); process.exit(2); }

// backend: prefix from server.ts + routes
const server = fs.readFileSync(path.join(root, 'src/server.ts'), 'utf8');
const prefixes = {};
for (const m of server.matchAll(/app\.use\('([^']+)',\s*(\w+)\)/g)) prefixes[m[2]] = m[1];
const importFile = {};
for (const m of server.matchAll(/import (\w+) from '\.\/routes\/(\w+)'/g)) importFile[m[2]] = m[1];
const backend = [];
for (const [file, ident] of Object.entries(importFile)) {
  const prefix = prefixes[ident]; if (!prefix) continue;
  const src = fs.readFileSync(path.join(root, 'src/routes', `${file}.ts`), 'utf8');
  for (const m of src.matchAll(/router\.(get|post|put|delete|patch)\('([^']*)'/g)) backend.push({ method: m[1].toUpperCase(), path: prefix + (m[2] === '/' ? '' : m[2]) });
}
const toRegex = p => new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+') + '$');

// frontend: collect fetch/post/request('/api/...') with method hints
const calls = [];
function walk(dir) { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, f.name); if (f.isDirectory()) walk(full); else if (/\.(ts|tsx)$/.test(f.name)) scan(full); } }
function scan(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/(['"`])(\/api\/[^'"`?]*|\$\{API_BASE\}\/api\/[^'"`?]*)(?:\?[^'"`]*)?\1/g)) {
    let p = m[2].replace('${API_BASE}', '').replace(/\$\{[^}]+\}/g, ':param');
    const before = text.slice(Math.max(0, m.index - 60), m.index);
    const explicit = /method:\s*'(GET|POST|PUT|DELETE|PATCH)'/i.exec(text.slice(m.index, m.index + 200));
    const helper = /\b(post|put|patch|del)(?:<[^>]*>)?\(\s*$/i.exec(before);   // post<T>('/api/..', body)
    const method = explicit ? explicit[1].toUpperCase() : helper ? ({ del: 'DELETE' }[helper[1].toLowerCase()] || helper[1].toUpperCase()) : 'GET';
    calls.push({ file: path.relative(feRoot, file), path: p, method });
  }
}
walk(path.join(feRoot, 'src'));

const seen = new Set(); let missing = 0;
console.log(`backend routes: ${backend.length}, frontend call sites: ${calls.length}\n`);
for (const c of calls) {
  const key = `${c.method} ${c.path}`; if (seen.has(key)) continue; seen.add(key);
  const hit = backend.find(b => b.method === c.method && toRegex(b.path).test(c.path));
  const pathOnly = backend.find(b => toRegex(b.path).test(c.path));
  if (hit) console.log(`  OK       ${key}`);
  else { missing++; console.log(`  MISSING  ${key}  (${c.file})${pathOnly ? `  - path exists but as ${pathOnly.method}` : ''}`); }
}
console.log(`\n${missing} frontend call(s) have no matching backend route.`);
process.exit(missing ? 1 : 0);
