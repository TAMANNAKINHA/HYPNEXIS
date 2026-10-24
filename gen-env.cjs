#!/usr/bin/env node
// Creates backend/.env from .env.example and replaces placeholder role tokens with
// freshly generated random secrets. The backend REJECTS tokens that are shorter
// than 32 characters or start with "replace-with-", so copying .env.example
// verbatim leaves every /api/payments endpoint returning 401.
//
// Usage: node scripts/gen-env.cjs [--force]
//   --force  regenerate the five PAYMENT_*_TOKEN values even if already set
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const env = require('./lib/envfile.cjs');

const root = path.resolve(__dirname, '..');
const example = path.join(root, '.env.example');
const target = path.join(root, '.env');
const force = process.argv.includes('--force');

if (!fs.existsSync(target)) {
  fs.copyFileSync(example, target);
  fs.chmodSync(target, 0o600);
  console.log('created .env from .env.example');
}

const current = env.read(target);
const tokenKeys = ['READER', 'OPERATOR', 'APPROVER', 'EXECUTOR', 'ADMIN'].map(r => `PAYMENT_${r}_TOKEN`);
const updates = {};
for (const key of tokenKeys) {
  const v = current[key];
  if (force || !v || v.startsWith('replace-with-') || v.length < 32) updates[key] = crypto.randomBytes(32).toString('hex');
}
if (Object.keys(updates).length) {
  env.update(target, updates);
  console.log(`generated ${Object.keys(updates).length} payment role token(s) in .env`);
} else {
  console.log('payment role tokens already set; nothing to do');
}
