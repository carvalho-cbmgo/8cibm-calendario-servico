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
const days = [23, 24, 25, 26, 27, 30];
const day = number => data['2026-11'].days.find(d => d.day === number);
const summary = finance.month(data, '2026-11', 4560000);
const added = summary.records.filter(r => r.event.serviceId?.startsWith('ac4-sat-23a30nov-'));
const plain = value => JSON.parse(JSON.stringify(value));
const baseline = () => {
  const copy = structuredClone(data);
  for (const d of copy['2026-11'].days) if (days.includes(d.day)) delete d.sat;
  return copy;
};

test('SAT1/SAT2 com serviços de 27/11 restaurados mantêm 14 AC4/84h e OS 377', () => {
  assert.equal(added.length, 14);
  assert.equal(new Set(added.map(r => r.key)).size, 14);
  assert.equal(added.reduce((total, r) => total + r.minutes, 0), 84 * 60);
  assert.equal(added.reduce((total, r) => total + r.costCents, 0), 271000);
  for (const [number, count, cost] of [[23, 3, 57000], [24, 2, 42000], [25, 2, 27000], [26, 1, 12000], [27, 3, 76000], [30, 3, 57000]]) {
    const date = `2026-11-${number}`;
    const records = added.filter(r => r.startDate === date);
    assert.equal(records.length, count);
    assert.equal(summary.daily.get(date).satCents, cost);
    const expected = [['3º SGT ROBERTO', 'Protocolo', '08h00', '12h00', 4]];
    if ([23, 24, 27, 30].includes(number)) expected.push(['2º SGT WANDERSON', 'Vistoria', '08h00', '18h00', 10]);
    if ([23, 25, 27, 30].includes(number)) expected.push(['3º SGT BERTONCELLO', 'Vistoria', '13h00', '18h00', 5]);
    for (const [name, activity, start, end, hours] of expected) {
      const matches = records.filter(r => r.member === name);
      assert.equal(matches.length, 1);
      const record = matches[0];
      assert.equal(record.category, 'sat');
      assert.equal(record.event.activity, activity);
      assert.equal(record.start, start);
      assert.equal(record.end, end);
      assert.equal(record.endDate, date);
      assert.equal(record.minutes, hours * 60);
      assert.equal(record.event.hours, hours);
      assert.equal(record.costCents, hours * (number === 27 ? 4000 : 3000));
      assert.equal(record.status, 'forecast');
      assert.equal(record.event.executionConfirmed, undefined);
      assert.equal(finance.documentInfo(record.event).number, '377');
      assert.equal(finance.documentInfo(record.event).sei, '98422129');
    }
  }
});

test('nomes sem PSE geram 12 ordinários vespertinos, separados por atividade', () => {
  for (const number of days) {
    const sat = day(number).sat;
    assert.equal(sat.ordinaryStatus, 'informed');
    assert.equal(sat.members.flatMap(m => m.badges).length, 2);
    for (const [name, activity] of [['3º SGT ROBERTO', 'Vistoria'], ['3º SGT VALÉRIA', 'Protocolo']]) {
      const member = sat.members.find(m => m.name === name);
      assert.equal(member.badges.length, 1);
      assert.deepEqual(member.badges[0], { kind: 'ord', text: 'ORDINÁRIO', hours: 5, start: '13h00', end: '18h00', activity });
      if (name.includes('VALÉRIA')) assert.equal(member.events.length, 0);
    }
  }
});

test('todo o calendário anterior à inclusão da SAT permanece preservado', () => {
  // Baseline includes corrected January exchanges, revised 12h AC4, TS 170-175 (TS 170 corrected to 22/11/2026) and cancellation of the operation, without the new SAT.
  assert.equal(createHash('sha256').update(JSON.stringify(baseline())).digest('hex'), '8d01fbdaba07d5f8832a5443a8a5585fadca450822e618f7d9a41059356bf45c');
  const before = baseline();
  for (const number of days) {
    const date = `2026-11-${number}`;
    const original = before['2026-11'].days.find(d => d.day === number);
    assert.deepEqual(plain(simulation.coverage(day(number), date)), plain(simulation.coverage(original, date)));
    assert.deepEqual(plain(chief.select(day(number))), plain(chief.select(original)));
  }
  for (let target = 4; target <= 8; target++) {
    const actual = simulation.plan(data, '2026-11', 4560000, undefined, target);
    const original = simulation.plan(before, '2026-11', 4560000, undefined, target);
    assert.equal(actual.addedResources, original.addedResources);
    assert.equal(actual.summary.committedCents, original.summary.committedCents);
  }
});

test('finanças, acumulados, consulta e ranking incluem os novos AC4 sem duplicar jornadas', () => {
  const before = finance.month(baseline(), '2026-11', 4560000);
  assert.equal(summary.records.length, 98);
  assert.equal(summary.committedCents, 3924300);
  assert.equal(summary.satCents, 913000);
  assert.equal(summary.operationalCents, before.operationalCents);
  assert.equal(summary.remainingCents, 635700);
  assert.equal(summary.executedCents, before.executedCents);
  let cumulative = 0;
  for (let n = 1; n <= 30; n++) {
    const date = `2026-11-${String(n).padStart(2, '0')}`;
    cumulative += added.filter(r => r.startDate === date).reduce((sum, r) => sum + r.costCents, 0);
    assert.equal(summary.daily.get(date).cumulativeCents - before.daily.get(date).cumulativeCents, cumulative);
  }
  const rows = lookup.month(data, '2026-11');
  const range = finance.ranking(summary, '2026-11-16', true, { startDate: '2026-11-23', endDate: '2026-11-30' });
  for (const [member, cost] of [['2º SGT WANDERSON', 130000], ['3º SGT ROBERTO', 76000], ['3º SGT BERTONCELLO', 65000]]) {
    assert.equal(range.rows.find(r => r.member === member).satCents, cost);
  }
  for (const record of added) {
    const services = rows.filter(r => r.type === 'ac4' && r.member === record.member && r.date === record.startDate);
    assert.equal(services.length, 1);
    assert.equal(services[0].minutes, record.minutes);
    assert.equal(services[0].commitmentCents, record.costCents);
  }
});

test('SAT restaurada em 27/11 tem três AC4 e dois ordinários, preservando a TS CIA de DIEGO', () => {
  const input = day(27);
  assert.notEqual(input.sat.expedientStatus, 'holiday');
  assert.equal(input.sat.ordinaryStatus, 'informed');
  assert.equal(input.sat.members.length, 4);
  assert.equal(summary.daily.get('2026-11-27').satCents, 76000);
  assert.equal(summary.records.filter(r => r.category === 'sat' && r.startDate === '2026-11-27').length, 3);
  const services = lookup.month(data, '2026-11').filter(r => r.area === 'sat' && r.date === '2026-11-27');
  assert.equal(services.filter(r => r.type === 'ac4').length, 3);
  assert.equal(services.filter(r => r.type === 'ordinary').length, 2);
  assert.equal(finance.ranking(summary, '2026-11-16', true, { startDate: '2026-11-27', endDate: '2026-11-27' }).totalCents, 76000);
  assert.equal(simulation.coverage(input, '2026-11-27').resources, 6);
  const diego = input.members.find(m => m.name === '2º SGT DIEGO');
  assert.equal(diego.badges[0].kind, 'pay');
  assert.equal(diego.badges[0].troca.sei, '97587323');
  assert.equal(summary.executedCents, 1096600);
});
