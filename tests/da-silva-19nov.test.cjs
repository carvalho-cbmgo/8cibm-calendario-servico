const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createHash } = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const data = JSON.parse(scripts.find(s => s[1].includes('id="calendar-data"'))[2]);
const context = vm.createContext({ window: {} });
for (const name of ['AC4Finance', 'ServiceChief', 'ServiceSimulation', 'ServiceLookup']) {
  vm.runInContext(scripts.find(s => !s[1].includes('application/json') && s[2].includes(`window.${name}=`))[2], context);
}
const { AC4Finance: finance, ServiceChief: chief, ServiceSimulation: simulation, ServiceLookup: lookup } = context.window;
const id = 'ac4-operacional-da-silva-2026-11-19-08h';
const day = schedules => schedules['2026-11'].days.find(d => d.day === 19);
const previous = () => {
  const copy = structuredClone(data);
  day(copy).members = day(copy).members.filter(m => !m.events.some(e => e.serviceId === id));
  day(copy).coverage = ['5 recursos de 24h', 'Faltam 1 recurso'];
  return copy;
};

test('ST DA SILVA tem um AC4 operacional previsto de 12h em 19/11, OS 383/SEI 98682020, a R$ 360', () => {
  const summary = finance.month(data, '2026-11', 4584000);
  const records = summary.records.filter(r => r.event.serviceId === id);
  assert.equal(records.length, 1);
  const record = records[0];
  assert.equal(record.member, 'ST DA SILVA');
  assert.equal(record.startDate, '2026-11-19');
  assert.equal(record.endDate, '2026-11-19');
  assert.equal(record.start, '08h00');
  assert.equal(record.end, '20h00');
  assert.equal(record.minutes, 720);
  assert.equal(record.event.hours, 12);
  assert.equal(record.event.nextDay, false);
  assert.equal(record.category, 'operational');
  assert.equal(record.costCents, 36000);
  assert.equal(record.status, 'forecast');
  assert.equal(record.event.executionConfirmed, undefined);
  assert.equal(finance.documentInfo(record.event).number, '383');
  assert.equal(finance.documentInfo(record.event).sei, '98682020');
  const services = lookup.month(data, '2026-11').filter(r => r.member === record.member && r.date === record.startDate);
  assert.equal(services.length, 1);
  assert.equal(services[0].type, 'ac4');
  assert.equal(services[0].commitmentCents, 36000);
  const before = finance.month(previous(), '2026-11', 4584000);
  assert.equal(summary.records.length, 107);
  assert.equal(summary.committedCents, 4591000);
  assert.equal(summary.operationalCents, 3708000);
  assert.equal(summary.satCents, 883000);
  assert.equal(summary.forecastCents, 3494400);
  assert.equal(summary.executedCents, 1096600);
  assert.equal(summary.remainingCents, -7000);
  for (const [date, daily] of summary.daily) {
    assert.equal(daily.committedCents - before.daily.get(date).committedCents, date === record.startDate ? 36000 : 0);
    assert.equal(daily.cumulativeCents - before.daily.get(date).cumulativeCents, date >= record.startDate ? 36000 : 0);
  }
  const ranking = finance.ranking(summary, '2026-11-19', true, { startDate: '2026-11-19', endDate: '2026-11-19' });
  assert.equal(ranking.rows.find(r => r.member === record.member).operationalCents, 36000);
});

test('o diurno complementa o noturno de LUIZ, elimina a vaga simulada e preserva os demais dados e tarifas', () => {
  const before = previous(), source = JSON.stringify(data);
  assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'), '3311169c622f3f753fbbf5e926fd42db1b48492e254f864e26a04525105148df');
  const coverage = simulation.coverage(day(data), '2026-11-19');
  assert.equal(coverage.resources, 6);
  assert(coverage.segments.every(s => s.resources === 6));
  assert.deepEqual(day(data).coverage, ['6 recursos de 24h', 'Meta de 6 recursos']);
  // The user expressly assigned the full 24h chief role to TAVARES.
  assert.equal(chief.select(day(data)).status, 'selected');
  assert.equal(chief.select(day(data)).assignments[0].name, 'ST TAVARES');
  for (let target = 4; target <= 8; target++) {
    const unconfirmed = structuredClone(data), originalDay = structuredClone(before);
    delete day(unconfirmed).confirmation; delete day(originalDay).confirmation;
    const actual = simulation.plan(unconfirmed, '2026-11', 4584000, undefined, target);
    const original = simulation.plan(originalDay, '2026-11', 4584000, undefined, target);
    assert.equal(original.summary.committedCents - actual.summary.committedCents, target >= 6 ? 36000 : 0);
    for (const number of data['2026-11'].days.map(d => d.day).filter(n => n !== 19)) {
      assert.equal(JSON.stringify(actual.days.get(number)), JSON.stringify(original.days.get(number)));
    }
  }
  const plan = simulation.plan(data, '2026-11', 4584000);
  assert.equal(plan.days.get(19).addedServices, 0);
  assert.equal(plan.addedServices, 0);
  assert.equal(plan.daysAffected, 0);
  assert.equal(plan.summary.committedCents, 0);
  assert.equal(JSON.stringify(data), source);
});
