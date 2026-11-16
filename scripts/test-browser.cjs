const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const tests = readdirSync(join(root, 'tests'))
  .filter(name => name.endsWith('.browser.cjs'))
  .sort();
let failed = 0;
for (const test of tests) {
  console.log(`\n--- ${test} ---`);
  const result = spawnSync(process.execPath, [join(root, 'tests', test)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) failed++;
}
console.log(`\n${tests.length - failed}/${tests.length} testes de navegador aprovados.`);
process.exitCode = failed ? 1 : 0;
