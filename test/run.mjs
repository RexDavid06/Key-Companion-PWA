const mods = await Promise.all([
  import('./theory.test.mjs'),
  import('./rhythm.test.mjs'),
  import('./pad.test.mjs'),
  import('./ocarina.test.mjs'),
  import('./integration.test.mjs'),
  import('./audio.test.mjs'),
  import('./soundlab.test.mjs'),
]);

let passed = 0, failed = 0;
const failures = [];
for (const m of mods) {
  const r = m.report();
  passed += r.passed;
  failed += r.failed;
  failures.push(...r.failures);
}
console.log('');
console.log('========================================');
console.log('TOTAL: ' + passed + ' passed, ' + failed + ' failed');
if (failures.length > 0) {
  console.log('Failures: ' + failures.join(' | '));
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
