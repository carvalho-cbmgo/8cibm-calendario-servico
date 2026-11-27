const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const data = JSON.parse(scripts.find(s => s[1].includes('id="calendar-data"'))[2]);
const context = vm.createContext({ window: {} });
for (const name of ['AC4Finance', 'ServiceChief', 'ServiceSimulation', 'ServiceLookup']) {
  vm.runInContext(scripts.find(s => !s[1].includes('application/json') && s[2].includes(`window.${name}=`))[2], context);
}
const { AC4Finance: finance, ServiceChief: chief, ServiceSimulation: simulation, ServiceLookup: lookup } = context.window;
const id = 'ac4-proebom-hellysson-2026-11-24-08h';
const day = schedules => schedules['2026-11'].days.find(d => d.day === 24);
const previous = () => {
  const before = structuredClone(data);
  day(before).members = day(before).members.filter(m => !m.events.some(e => e.serviceId === id));
  return before;
};

test('HELLYSSON tem um único PROEBOM previsto de 12h em 24/11, 08h–20h, R$ 360 e OS 389', () => {
  const summary = finance.month(data, '2026-11', 4584000);
  const records = summary.records.filter(r => r.event.serviceId === id);
  assert.equal(records.length, 1);
  const record = records[0];
  assert.equal(record.member, '1º SGT HELLYSSON');
  assert.equal(record.event.mode, 'PROEBOM 2026');
  assert.equal(record.event.integrante_operacional, true);
  assert.equal(record.startDate, '2026-11-24');
  assert.equal(record.endDate, '2026-11-24');
  assert.equal(record.start, '08h00');
  assert.equal(record.end, '20h00');
  assert.equal(record.minutes, 720);
  assert.equal(record.event.hours, 12);
  assert.equal(record.event.nextDay, false);
  assert.equal(record.category, 'operational');
  assert.equal(record.costCents, 36000);
  assert.equal(record.status, 'forecast');
  assert.equal(record.event.executionConfirmed, undefined);
  assert.equal(finance.documentInfo(record.event).number, '389');
  assert.equal(finance.documentInfo(record.event).sei, '98752623');
  const services = lookup.month(data, '2026-11').filter(r => r.member === record.member && r.date === record.startDate);
  assert.equal(services.length, 1);
  assert.equal(services[0].type, 'ac4');
  assert.equal(services[0].commitmentCents, 36000);
  assert.equal(summary.records.length, 108);
  assert.equal(summary.committedCents, 4583000);
  assert.equal(summary.operationalCents, 3700000);
  assert.equal(summary.satCents, 883000);
  assert.equal(summary.forecastCents, 3486400);
  assert.equal(summary.executedCents, 1096600);
  assert.equal(summary.remainingCents, 1000);
  const before = finance.month(previous(), '2026-11', 4584000);
  assert.equal(summary.committedCents - before.committedCents, 36000);
  for (const [date, daily] of summary.daily) {
    assert.equal(daily.committedCents - before.daily.get(date).committedCents, date === record.startDate ? 36000 : 0);
    assert.equal(daily.cumulativeCents - before.daily.get(date).cumulativeCents, date >= record.startDate ? 36000 : 0);
  }
  const options = { startDate: '2026-11-24', endDate: '2026-11-24' };
  const rank = finance.ranking(summary, '2026-11-18', true, options);
  assert.equal(rank.rows.find(r => r.member === record.member).operationalCents, 36000);
});

test('HELLYSSON designado para cobertura complementa o noturno, preservando chefia e reforços de 4 a 8 recursos', () => {
  const before = previous(), source = JSON.stringify(data);
  assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'), '10fa93ffbfc07c0a2f5d0541c87189833b53c32224b6c58dd14d172fd283ccfb');
  assert.equal(simulation.coverage(day(data), '2026-11-24').resources, 6);
  assert.equal(simulation.coverage(day(before), '2026-11-24').resources, 5);
  assert.equal(JSON.stringify(chief.select(day(data))), JSON.stringify(chief.select(day(before))));
  for (let target = 4; target <= 8; target++) {
    const actual = simulation.plan(data, '2026-11', 4584000, undefined, target);
    const original = simulation.plan(before, '2026-11', 4584000, undefined, target);
    assert.equal(actual.addedServices, original.addedServices);
    assert.equal(actual.summary.committedCents, original.summary.committedCents);
    assert.equal(JSON.stringify(actual.days.get(24).members), JSON.stringify(original.days.get(24).members));
    assert.equal(actual.days.get(24).coverage.resources, 6);
    assert.equal(original.days.get(24).coverage.resources, 5);
  }
  assert.equal(JSON.stringify(data), source);
});
