// Tiny .env reader/writer used by the setup and deploy scripts.
// Keeps comments and ordering; replaces existing KEY=... lines or appends new ones.
const fs = require('node:fs');

function parse(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function read(file) {
  return fs.existsSync(file) ? parse(fs.readFileSync(file, 'utf8')) : {};
}

function update(file, values) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  const next = lines.map(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m && Object.prototype.hasOwnProperty.call(values, m[1])) {
      seen.add(m[1]);
      return `${m[1]}=${values[m[1]]}`;
    }
    return line;
  });
  while (next.length && next[next.length - 1] === '') next.pop();
  for (const [k, v] of Object.entries(values)) if (!seen.has(k)) next.push(`${k}=${v}`);
  fs.writeFileSync(file, next.join('\n') + '\n', { mode: 0o600 });
}

module.exports = { parse, read, update };
