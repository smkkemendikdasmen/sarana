#!/usr/bin/env node
const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node _assert_f11_report.cjs <report.json>'); process.exit(99); }

let raw = fs.readFileSync(path, 'utf8').trim();
console.log(`RAW_LEN = ${raw.length} bytes`);

const s = raw.indexOf('{');
const e = raw.lastIndexOf('}');
const cleaned = (s >= 0 && e >= s) ? raw.slice(s, e + 1) : raw;

let j = null;
try {
  j = JSON.parse(cleaned);
} catch (err) {
  console.error('PARSE FAIL:', err.message);
  console.error('CLEANED_HEX:', Buffer.from(cleaned.slice(0, 400)).toString('hex'));
  process.exit(1);
}

console.log(JSON.stringify(j, null, 2));
fs.writeFileSync(path, cleaned);

const ok = j.overall_exit_status === 'EXIT 0';
console.log('');
console.log(`OVERALL_EXIT_STATUS_CHECK = ${j.overall_exit_status} ${ok ? 'PASS ✅' : 'FAIL ❌'}`);
process.exit(ok ? 0 : 2);
