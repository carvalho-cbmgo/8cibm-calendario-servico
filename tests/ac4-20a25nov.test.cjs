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
const { AC4Finance: finance, ServiceSimulation: simulation, ServiceChief: chief, ServiceLookup: lookup } = context.window;
const entries = [
  [20, '2º SGT WANDERSON', 'wanderson', '385', '98726048', 99500],
  [20, 'CB RABELO', 'rabelo', '385', '98726048', 99500],
  [21, 'ST DA SILVA', 'da-silva', '386', '98726048', 99500],
  [21, 'SD PICCINI', 'piccini', '386', '98726048', 99500],
  [22, 'ST PASSOS', 'passos', '387', '98726469', 96500],
  [22, 'SD SANTOS', 'santos', '387', '98726469', 96500],
  [25, '2º SGT DIEGO', 'diego', '388', '98752637', 74100],
];
const idFor = (day, key) => `ac4-operacional-${key}-2026-11-${day}-08h`;
const ids = new Set(entries.map(([day, ,key]) => idFor(day, key)));
const previous = () => {
  const copy = structuredClone(data);
  for (const [number, resources] of [[20,4], [21,4], [22,5], [25,4]]) {
    const day = copy['2026-11'].days.find(d => d.day === number);
    day.members = day.members.filter(m => !m.events.some(e => ids.has(e.serviceId)));
    day.coverage = [`${resources} recursos de 24h`, `Faltam ${6-resources} recurso${resources === 5 ? '' : 's'}`];
  }
  return copy;
};

test('sete AC4 de 24h têm os documentos e períodos informados, com OS 386 regularizada em 21/11', () => {
  const summary = finance.month(data, '2026-11', 4584000);
  const records = summary.records.filter(r => ids.has(r.event.serviceId));
  assert.equal(records.length, 7);
  assert.equal(new Set(records.map(r => r.key)).size, 7);
  assert.equal(records.reduce((sum,r) => sum+r.minutes, 0), 168*60);
  assert.equal(records.reduce((sum,r) => sum+r.costCents, 0), 665100);
  for (const [day, name, key, number, sei, cost] of entries) {
    const matches = records.filter(r => r.event.serviceId === idFor(day, key));
    assert.equal(matches.length, 1);
    const r = matches[0];
    assert.equal(r.member, name);
    assert.equal(r.category, 'operational');
    assert.equal(r.startDate, `2026-11-${day}`);
    assert.equal(r.endDate, `2026-11-${day+1}`);
    assert.equal(r.start, '08h00'); assert.equal(r.end, '08h00');
    assert.equal(r.minutes, 1440); assert.equal(r.event.hours, 24); assert.equal(r.event.nextDay, true);
    assert.equal(r.costCents, cost); assert.equal(r.status, 'forecast');
    assert.equal(r.event.executionConfirmed, undefined);
    assert.equal(r.event.document, `OS nº ${number} (SEI ${sei})`);
    const document = finance.documentInfo(r.event);
    assert.equal(document.number, number);
    assert.equal(document.sei, sei);
    assert(!data['2026-11'].days.find(d => d.day === day).members.find(m => m.name === name).notes.some(note => note.includes('XXX')));
    assert.equal(lookup.month(data, '2026-11').filter(s => s.member === name && s.type === 'ac4' && s.date === r.startDate).length, 1);
  }
});

test('novos serviços somam R$ 6.651 sem alterar SAT, execuções ou tarifas', () => {
  const before = finance.month(previous(), '2026-11', 4584000), actual = finance.month(data, '2026-11', 4584000);
  assert.equal(actual.records.length, 103);
  assert.equal(actual.committedCents, 4198300);
  assert.equal(actual.operationalCents, 3315300);
  assert.equal(actual.satCents, 883000);
  assert.equal(actual.forecastCents, 3101700);
  assert.equal(actual.executedCents, 1096600);
  assert.equal(actual.remainingCents, 385700);
  const additions = new Map([['2026-11-20',199000], ['2026-11-21',199000], ['2026-11-22',193000], ['2026-11-25',74100]]);
  let cumulative = 0;
  for (const [date, day] of [...actual.daily].sort(([a],[b]) => a.localeCompare(b))) {
    cumulative += additions.get(date) || 0;
    assert.equal(day.committedCents-before.daily.get(date).committedCents, additions.get(date) || 0);
    assert.equal(day.cumulativeCents-before.daily.get(date).cumulativeCents, cumulative);
  }
});

test('confirmações, dados anteriores e chefia são preservados; cobertura atualiza sem novos reforços simulados', () => {
  const before = previous(), snapshot = JSON.stringify(data);
  assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'), 'cd27e1e1380882874670d7f2d10540fa8d582a992caf8f771225594dfeddddb4');
  for (const [number, resources] of [[20,6], [21,6], [22,7], [25,5]]) {
    const day = data['2026-11'].days.find(d => d.day === number);
    assert.equal(simulation.coverage(day, `2026-11-${number}`).resources, resources);
    assert.equal(parseInt(day.coverage[0]), resources);
    assert.equal(day.confirmation.status, 'confirmed');
    assert.equal(JSON.stringify(chief.select(day)), JSON.stringify(chief.select(before['2026-11'].days.find(d => d.day === number))));
  }
  for (let target = 4; target <= 8; target++) {
    const actual = simulation.plan(data, '2026-11', 4584000, undefined, target);
    const old = simulation.plan(before, '2026-11', 4584000, undefined, target);
    assert.equal(actual.summary.committedCents, old.summary.committedCents);
    assert.equal(actual.addedServices, old.addedServices);
    for (let number = 1; number <= 25; number++) assert.equal(actual.days.get(number).addedServices, 0);
  }
  assert.equal(JSON.stringify(data), snapshot);
});
