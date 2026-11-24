const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createHash } = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const data = JSON.parse(scripts.find(s => s[1].includes('id="calendar-data"'))[2]);
const context = vm.createContext({ window: {} });
for (const name of ['AC4Finance', 'ServiceChief', 'ServiceSimulation']) {
  vm.runInContext(scripts.find(s => !s[1].includes('application/json') && s[2].includes(`window.${name}=`))[2], context);
}
const { AC4Finance: finance, ServiceSimulation: simulation, ServiceChief: chief } = context.window;
const previous = () => {
  const copy = structuredClone(data);
  for (const day of copy['2026-11'].days) if (day.day >= 19 && day.day <= 25) delete day.confirmation;
  return copy;
};

test('escalas de 1 a 25/11 estão confirmadas, com sete novas confirmações em 19/11 e histórico anterior preservado', () => {
  const days = data['2026-11'].days;
  assert.equal(days.filter(d => d.confirmation?.status === 'confirmed').length, 25);
  for (const day of days) {
    if (day.day <= 25) assert.equal(day.confirmation.status, 'confirmed');
    else assert.equal(day.confirmation, undefined);
    if (day.day >= 19 && day.day <= 25) {
      assert.deepEqual(day.confirmation, { status: 'confirmed', date: '2026-11-19', source: 'user', scope: 'calendar', previousAlerts: [] });
    }
  }
  assert.equal(createHash('sha256').update(JSON.stringify(previous())).digest('hex'), 'f0440c4dc6082cccc7521309b1607475a1a6c819f60bc66c971c821f622c52c8');
});

test('confirmar a escala preserva integralmente AC4, execuções, tarifas, cobertura e chefia', () => {
  const before = previous();
  for (const period of Object.keys(data)) {
    const actual = finance.month(data, period), original = finance.month(before, period);
    assert.equal(JSON.stringify(actual.records), JSON.stringify(original.records));
    assert.equal(actual.committedCents, original.committedCents);
    assert.equal(actual.executedCents, original.executedCents);
  }
  for (const day of data['2026-11'].days) {
    const old = before['2026-11'].days.find(d => d.day === day.day);
    assert.equal(JSON.stringify(chief.select(day)), JSON.stringify(chief.select(old)));
    assert.equal(JSON.stringify(simulation.coverage(day, `2026-11-${String(day.day).padStart(2, '0')}`)), JSON.stringify(simulation.coverage(old, `2026-11-${String(day.day).padStart(2, '0')}`)));
  }
  const summary = finance.month(data, '2026-11', 4584000);
  assert.equal(summary.records.length, 103);
  assert.equal(summary.committedCents, 4198300);
  assert.equal(summary.forecastCents, 3101700);
  assert.equal(summary.executedCents, 1096600);
  assert.equal(summary.remainingCents, 385700);
});

test('somente os dias a partir de 26/11 recebem reforços simulados, em todas as metas', () => {
  const before = previous(), source = JSON.stringify(data);
  for (let target = 4; target <= 8; target++) {
    const actual = simulation.plan(data, '2026-11', 4584000, undefined, target);
    const old = simulation.plan(before, '2026-11', 4584000, undefined, target);
    for (let day = 1; day <= 25; day++) assert.equal(actual.days.get(day).addedServices, 0);
    for (let day = 26; day <= 30; day++) assert.equal(JSON.stringify(actual.days.get(day)), JSON.stringify(old.days.get(day)));
  }
  const plan = simulation.plan(data, '2026-11', 4584000);
  assert.equal(plan.addedServices, 3);
  assert.equal(plan.daysAffected, 2);
  assert.equal(plan.summary.committedCents, 273100);
  assert.deepEqual([...plan.days].filter(([,d]) => d.addedServices).map(([day,d]) => [day,d.addedServices]), [[28,2],[30,1]]);
  assert.equal(JSON.stringify(data), source);
});
