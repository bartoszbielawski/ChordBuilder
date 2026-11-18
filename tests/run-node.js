#!/usr/bin/env node
/* Uruchomienie testów w Node: `node tests/run-node.js` (używane też w GitHub Actions). */
'use strict';
globalThis.window = globalThis;
require('../js/theory.js');
const { run } = require('./theory.test.js');

const results = run(globalThis.Theory);
let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}`);
  if (!r.ok) {
    failed++;
    for (const e of r.errors.slice(0, 10)) console.log('    ' + e);
    if (r.errors.length > 10) console.log(`    … i ${r.errors.length - 10} więcej`);
  }
}
console.log(`\n${results.length - failed}/${results.length} testów zaliczonych`);
process.exit(failed ? 1 : 0);
