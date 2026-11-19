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
// Preserve service IDs when revising the original 24h services to 12h.
const entries = [['2026-11-22', '2026-11-22', 6, 'ST DA SILVA'], ['2026-11-29', '2026-11-29', 6, 'ST DA SILVA'], ['2026-12-06', '2026-12-06', 5, 'ST OSVALDIR']];
const summary = period => finance.month(data, period, period === '2026-11' ? 4560000 : undefined);

test('três AC4 de LUIZ ANTONIO são únicos, operacionais de 12h e previstos, a R$ 480 cada', () => {
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
    assert.equal(record.end, '20h00');
    assert.equal(record.endDate, end);
    assert.equal(record.minutes, 720);
    assert.equal(record.event.hours, 12);
    assert.equal(record.event.nextDay, false);
    assert.equal(record.event.excludeFromSimulation, true);
    assert.equal(record.category, 'operational');
    assert.equal(record.costCents, 48000);
    assert.equal(record.financialMonth, period);
    assert.equal(record.status, 'forecast');
    assert.equal(record.event.executionConfirmed, undefined);
    assert.equal(finance.documentInfo(record.event).number, '');
    assert.equal(finance.documentInfo(record.event).sei, '');
    assert.equal(day.confirmation?.status, date === '2026-11-22' ? 'confirmed' : undefined);
    assert.equal(simulation.coverage(day, date).resources, resources);
    assert.equal(chief.select(day).assignments[0].name, leader);
    const rows = lookup.month(data, period).filter(r => r.member === members[0].name && r.date === date);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, 'ac4');
    assert.equal(rows[0].minutes, 720);
    assert.equal(rows[0].commitmentCents, 48000);
  }
});

test('novembro e dezembro recebem apenas os novos custos, sem inventar cota de dezembro', () => {
  const november = summary('2026-11'), december = summary('2026-12');
  assert.equal(november.records.length, 98);
  assert.equal(november.committedCents, 3924300);
  assert.equal(november.operationalCents, 3011300);
  assert.equal(november.satCents, 913000);
  assert.equal(november.remainingCents, 635700);
  assert.equal(november.executedCents, 1096600);
  assert.equal(december.records.length, 1);
  assert.equal(december.committedCents, 48000);
  assert.equal(december.quotaCents, null);
  assert.equal(december.remainingCents, null);
  assert.equal(december.executedCents, 0);
  const plan = simulation.plan(data, '2026-11', 4560000);
  assert.equal(plan.days.get(22).addedResources, 0);
  assert.equal(plan.days.get(29).addedResources, 0);
  assert.equal(plan.addedResources, 4);
  assert.equal(plan.summary.committedCents, 309100);
  assert.equal(simulation.plan(data, '2026-12').days.get(6).addedResources, 1);
  for (const [date] of entries) {
    const planned = simulation.plan(data, date.slice(0, 7)).days.get(Number(date.slice(8)));
    const events = planned.members.flatMap(m => m.events);
    assert.equal(events.length, date === '2026-12-06' ? 1 : 0);
    assert(events.every(e => e.hours === 24 && e.start === '08h00' && e.end === '08h00'));
  }
});

// Baseline includes removal of TS 157, cancellation of the operation and TS 170-175 (TS 170 corrected to 22/11/2026).
test('a inclusão preserva todos os dados e AC4 anteriores nas três competências', () => {
  const before = structuredClone(data);
  for (const [date, , resources] of entries) {
    const day = before[date.slice(0, 7)].days.find(d => d.day === Number(date.slice(8)));
    day.members = day.members.filter(m => !m.events.some(e => e.serviceId?.startsWith(prefix)));
    const originalResources = resources, missing = 6 - originalResources;
    day.coverage = [`${originalResources} recursos de 24h`, missing > 0 ? `Faltam ${missing} recurso${missing === 1 ? '' : 's'}` : 'Meta de 6 recursos'];
  }
  assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'), 'c96cf85e0ffb57f1832cd6d05e30d7d73a9abd4fab470b2e22e25e736562fa03');
  const original = finance.month(before, '2026-11', 4560000);
  assert.equal(summary('2026-11').committedCents - original.committedCents, 96000);
  assert.equal(summary('2026-11').satCents, original.satCents);
});

test('a retificação altera só duração, término e cobertura dos três serviços originais', () => {
  const previous = structuredClone(data);
  for (const [date, , resources] of entries) {
    const day = previous[date.slice(0, 7)].days.find(d => d.day === Number(date.slice(8)));
    const event = day.members.find(m => m.name === '2º SGT LUIZ ANTONIO').events[0];
    delete event.excludeFromSimulation;
    const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    Object.assign(event, { hours: 24, end: '08h00', nextDay: true, endDate: next.toISOString().slice(0, 10) });
    const full = resources + 1, missing = 6 - full;
    day.coverage = [`${full} recursos de 24h`, missing > 0 ? `Faltam ${missing} recurso` : 'Meta de 6 recursos'];
  }
  assert.equal(createHash('sha256').update(JSON.stringify(previous)).digest('hex'), '81a36357970a7358e29f7d2bb91c2dc6949cbb0c5932bf8b7f780ec342326b99');
  assert.equal(finance.month(previous, '2026-11', 4560000).committedCents - summary('2026-11').committedCents, 97000);
  assert.equal(finance.month(previous, '2026-12').committedCents - summary('2026-12').committedCents, 48500);
});

test('exclusão da simulação limita-se aos três AC4 e preserva a cobertura real e as finanças', () => {
  const flagged = Object.entries(data).flatMap(([period, month]) => month.days.flatMap(day =>
    day.members.flatMap(m => m.events.filter(e => e.excludeFromSimulation).map(() => `${period}-${String(day.day).padStart(2, '0')}`))));
  assert.deepEqual(flagged, entries.map(([date]) => date));
  const withoutServices = structuredClone(data);
  for (const [date] of entries) {
    const input = data[date.slice(0, 7)].days.find(d => d.day === Number(date.slice(8)));
    const normal = simulation.coverage(input, date);
    const excluded = simulation.coverage(input, date, undefined, { forSimulation: true });
    const at = (coverage, minute) => coverage.segments.find(s => s.start <= minute && s.end > minute).resources;
    assert.equal(at(normal, 0), at(excluded, 0) + 1);
    assert.equal(at(normal, 720), at(excluded, 720));
    withoutServices[date.slice(0, 7)].days.find(d => d.day === input.day).members = input.members.filter(m => !m.events.some(e => e.serviceId?.startsWith(prefix)));
  }
  const source = JSON.stringify(data);
  for (const period of ['2026-11', '2026-12']) for (let target = 4; target <= 8; target++) {
    for (const rules of [{}, { 0: { day: target, night: 4 } }, { 0: { day: 4, night: target } }]) {
      const actual = simulation.plan(data, period, null, undefined, target, rules);
      const baseline = simulation.plan(withoutServices, period, null, undefined, target, rules);
      assert.equal(actual.summary.committedCents, baseline.summary.committedCents);
      assert.equal(actual.addedServices, baseline.addedServices);
      for (const [date] of entries.filter(([date]) => date.startsWith(period))) {
        const number = Number(date.slice(8));
        assert.equal(JSON.stringify(actual.days.get(number)), JSON.stringify(baseline.days.get(number)));
      }
    }
  }
  assert.equal(JSON.stringify(data), source);
  assert.equal(summary('2026-11').committedCents, 3924300);
  assert.equal(summary('2026-12').committedCents, 48000);
});

test('a exclusão por evento não remove ordinários ou outros AC4 do mesmo militar', () => {
  const member = { name: 'SD TESTE', badges: [], notes: [], events: [
    { mode: 'OPERACIONAL/SOP', start: '08h00', end: '20h00', hours: 12, excludeFromSimulation: true },
    { mode: 'OPERACIONAL/SOP', start: '20h00', end: '08h00', hours: 12, nextDay: true },
  ] };
  const input = { day: 22, members: [member] }, date = '2026-11-22';
  const excluded = simulation.coverage(input, date, undefined, { forSimulation: true });
  assert.equal(excluded.segments[0].resources, 0);
  assert.equal(excluded.segments.at(-1).resources, 1);
  assert.equal(simulation.coverage(input, date).resources, 1);
  member.badges.push({ kind: 'ord', hours: 24 });
  assert.equal(simulation.coverage(input, date, undefined, { forSimulation: true }).resources, 1);
});
