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
const day = number => data['2026-11'].days.find(d => d.day === number);

test('SEI 98630755 dispensa HUGO em 20/11 e registra um pagamento de 24h em 29/11', () => {
  const references = [];
  for (const month of Object.values(data)) for (const input of month.days) for (const member of input.members) {
    for (const badge of member.badges) if (badge.troca?.sei === '98630755') references.push([input.day, member.name, badge.kind]);
  }
  assert.deepEqual(references, [[20, 'SD HUGO', 'disp'], [29, 'SD HUGO', 'pay']]);
  for (const [number, kind, ala, resources, leader] of [[20, 'disp', 'CHARLIE', 6, 'ST OSVALDIR'], [29, 'pay', 'DELTA', 6, 'ST DA SILVA']]) {
    const input = day(number), members = input.members.filter(m => m.name === 'SD HUGO');
    assert.equal(members.length, 1);
    const member = members[0];
    assert.equal(member.ord, 30);
    assert.equal(member.events.length, 0);
    assert.equal(member.badges.length, 1);
    const badge = member.badges[0];
    assert.equal(badge.kind, kind);
    assert.equal(badge.hours, 24);
    assert.equal(badge.troca.numero, null);
    assert.equal(badge.troca.sei, '98630755');
    assert.equal(badge.troca.dispensa, '2026-11-20');
    assert.equal(badge.troca.pagamento, '2026-11-29');
    assert.equal(input.ala, ala);
    assert.equal(simulation.coverage(input, `2026-11-${number}`).resources, resources);
    assert.equal(parseInt(input.coverage[0]), resources);
    assert.equal(chief.select(input).assignments[0].name, leader);
  }
});

test('consulta e simulação respeitam a dispensa e o pagamento sem gerar AC4 para HUGO', () => {
  const services = lookup.month(data, '2026-11').filter(r => r.member === 'SD HUGO');
  assert(!services.some(r => r.date === '2026-11-20' && r.type === 'ordinary'));
  const payment = services.filter(r => r.date === '2026-11-29' && r.type === 'ordinary');
  assert.equal(payment.length, 1);
  assert.equal(payment[0].minutes, 1440);
  assert.equal(payment[0].start, '08h00');
  assert.equal(payment[0].end, '08h00');
  assert.equal(payment[0].endDate, '2026-11-30');
  assert(payment[0].labels.includes('TS CIA · Pagamento'));
  const summary = finance.month(data, '2026-11', 4584000);
  assert(!summary.records.some(r => r.member === 'SD HUGO' && ['2026-11-20', '2026-11-29'].includes(r.startDate)));
  const plan = simulation.plan(data, '2026-11', 4584000);
  assert.equal(plan.days.get(20).addedResources, 0);
  assert.equal(plan.days.get(29).addedResources, 0);
});

test('HENRIQUE 12h e HELLYSSON 4h são reforços operacionais em 26/11, com OS a definir', () => {
  const summary = finance.month(data, '2026-11', 4584000);
  const records = summary.records.filter(r => r.event.serviceId?.startsWith('ac4-2026-11-26-'));
  assert.deepEqual([...records.map(r => r.member)].sort(), ['1º SGT HELLYSSON', '3º SGT HENRIQUE']);
  assert.equal(records.length, 2);
  assert.equal(new Set(records.map(r => r.key)).size, 2);
  for (const record of records) {
    const hours = record.member.includes('HENRIQUE') ? 12 : 4;
    assert.equal(record.event.mode, 'OPERACIONAL/SOP');
    assert.equal(record.event.observation, 'REFORÇO OPERACIONAL');
    assert.equal(record.startDate, '2026-11-26');
    assert.equal(record.endDate, '2026-11-26');
    assert.equal(record.start, '08h00');
    assert.equal(record.end, hours === 12 ? '20h00' : '12h00');
    assert.equal(record.minutes, hours * 60);
    assert.equal(record.event.hours, hours);
    assert.equal(record.event.nextDay, false);
    assert.equal(record.category, 'operational');
    assert.equal(record.costCents, hours * 3000);
    assert.equal(record.status, 'forecast');
    assert.equal(record.event.executionConfirmed, undefined);
    assert.equal(finance.documentInfo(record.event).number, '');
    assert.equal(finance.documentInfo(record.event).sei, '');
    const matches = lookup.month(data, '2026-11').filter(r => r.member === record.member && r.date === '2026-11-26' && r.type === 'ac4');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].commitmentCents, hours * 3000);
  }
  const without = structuredClone(data);
  without['2026-11'].days.find(d => d.day === 26).members = day(26).members.filter(m => !m.events.some(e => e.serviceId?.startsWith('ac4-2026-11-26-')));
  assert.equal(simulation.coverage(day(26), '2026-11-26').resources, 6);
  assert.equal(chief.select(day(26)).assignments[0].name, 'ST DA SILVA');
  for (let target = 4; target <= 8; target++) {
    const actual = simulation.plan(data, '2026-11', 4584000, undefined, target);
    const original = simulation.plan(without, '2026-11', 4584000, undefined, target);
    assert.equal(original.addedServices - actual.addedServices, target >= 6 ? 1 : 0);
    assert.equal(original.summary.committedCents - actual.summary.committedCents, target === 6 ? 36000 : target >= 7 ? 48000 : 0);
    assert.equal(actual.days.get(26).coverage.resources, 6);
    assert.equal(original.days.get(26).coverage.resources, 5);
  }
  assert.equal(summary.records.length, 102);
  assert.equal(summary.committedCents, 4162300);
  assert.equal(summary.operationalCents, 3279300);
  assert.equal(summary.satCents, 883000);
  assert.equal(summary.executedCents, 1096600);
  assert.equal(summary.remainingCents, 421700);
});

test('inclusões de 18/11 preservam integralmente os demais dados do calendário', () => {
  const before = structuredClone(data), days = before['2026-11'].days;
  const twentieth = days.find(d => d.day === 20), twentyNinth = days.find(d => d.day === 29);
  const hugo = twentieth.members.find(m => m.name === 'SD HUGO');
  hugo.badges = [{ kind: 'ord', text: 'ORDINÁRIO' }]; hugo.notes = ['Ordinário'];
  twentyNinth.members = twentyNinth.members.filter(m => m.name !== 'SD HUGO');
  twentieth.coverage = ['4 recursos de 24h', 'Faltam 2 recursos'];
  twentyNinth.coverage = ['5 recursos de 24h', 'Faltam 1 recurso'];
  const input = days.find(d => d.day === 26);
  input.members = input.members.filter(m => !m.events.some(e => e.serviceId?.startsWith('ac4-2026-11-26-')));
  input.coverage = ['5 recursos de 24h', 'Faltam 1 recurso'];
  assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'), 'b8e57e19cd60611ade56515c8c19f147711574b2a77f3eb1a5dad9018c066939');
});
