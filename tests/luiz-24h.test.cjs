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
const prefix = 'ac4-operacional-24h-luiz-antonio-';
const entries = [['2026-11-22', '2026-11-23', 5, 'ST DA SILVA'], ['2026-11-29', '2026-11-30', 6, 'ST DA SILVA'], ['2026-12-06', '2026-12-07', 6, 'ST OSVALDIR']];
const summary = period => finance.month(data, period, period === '2026-11' ? 4560000 : undefined);

test('três AC4 de LUIZ ANTONIO são únicos, operacionais de 24h e previstos, a R$ 965 cada', () => {
  for (const [date, end, resources, leader] of entries) {
    const period = date.slice(0, 7), day = data[period].days.find(d => d.day === Number(date.slice(8)));
    const members = day.members.filter(m => m.name === '2º SGT LUIZ ANTONIO');
    assert.equal(members.length, 1);
    assert.equal(members[0].ord, 16);
    assert.equal(members[0].badges.length, 0);
    assert.equal(members[0].events.length, 1);
    const records = summary(period).records.filter(r => r.startDate === date && r.member === members[0].name);
    assert.equal(records.length, 1);
    const record = records[0];
    assert(record.event.serviceId.startsWith(prefix));
    assert.equal(record.start, '08h00');
    assert.equal(record.end, '08h00');
    assert.equal(record.endDate, end);
    assert.equal(record.minutes, 1440);
    assert.equal(record.category, 'operational');
    assert.equal(record.costCents, 96500);
    assert.equal(record.financialMonth, period);
    assert.equal(record.status, 'forecast');
    assert.equal(record.event.executionConfirmed, undefined);
    assert.equal(finance.documentInfo(record.event).number, '');
    assert.equal(finance.documentInfo(record.event).sei, '');
    assert.equal(day.confirmation?.status, undefined);
    assert.equal(simulation.coverage(day, date).resources, resources);
    assert.equal(chief.select(day).assignments[0].name, leader);
    const rows = lookup.month(data, period).filter(r => r.member === members[0].name && r.date === date);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, 'ac4');
    assert.equal(rows[0].minutes, 1440);
    assert.equal(rows[0].commitmentCents, 96500);
  }
});

test('novembro e dezembro recebem apenas os novos custos, sem inventar cota de dezembro', () => {
  const november = summary('2026-11'), december = summary('2026-12');
  assert.equal(november.records.length, 87);
  assert.equal(november.committedCents, 3284200);
  assert.equal(november.operationalCents, 2371200);
  assert.equal(november.satCents, 913000);
  assert.equal(november.remainingCents, 1275800);
  assert.equal(november.executedCents, 1096600);
  assert.equal(december.records.length, 1);
  assert.equal(december.committedCents, 96500);
  assert.equal(december.quotaCents, null);
  assert.equal(december.remainingCents, null);
  assert.equal(december.executedCents, 0);
  const plan = simulation.plan(data, '2026-11', 4560000);
  assert.equal(plan.days.get(22).addedResources, 1);
  assert.equal(plan.days.get(29).addedResources, 0);
  assert.equal(plan.addedResources, 13);
  assert.equal(plan.summary.committedCents, 1023800);
  assert.equal(simulation.plan(data, '2026-12').days.get(6).addedResources, 0);
});

test('a inclusão preserva todos os dados e AC4 anteriores nas três competências', () => {
  const before = structuredClone(data);
  for (const [date, , resources] of entries) {
    const day = before[date.slice(0, 7)].days.find(d => d.day === Number(date.slice(8)));
    day.members = day.members.filter(m => !m.events.some(e => e.serviceId?.startsWith(prefix)));
    const originalResources = resources - 1, missing = 6 - originalResources;
    day.coverage = [`${originalResources} recursos de 24h`, `Faltam ${missing} recurso${missing === 1 ? '' : 's'}`];
  }
  assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'), '97c5af124a30b4084ea3e773ef51a63404a2480f64d183348b700670c25aa38a');
  const original = finance.month(before, '2026-11', 4560000);
  assert.equal(summary('2026-11').committedCents - original.committedCents, 193000);
  assert.equal(summary('2026-11').satCents, original.satCents);
});
