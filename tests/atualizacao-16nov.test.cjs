const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const data = JSON.parse(scripts.find(s => s[1].includes('id="calendar-data"'))[2]);
const rosters = JSON.parse(scripts.find(s => s[1].includes('id="ala-rosters"'))[2]);
const context = vm.createContext({ window: {} });
for (const name of ['AC4Finance', 'ServiceChief', 'ServiceSimulation', 'ServiceLookup']) {
  vm.runInContext(scripts.find(s => !s[1].includes('application/json') && s[2].includes(`window.${name}=`))[2], context);
}
const { AC4Finance: finance, ServiceSimulation: simulation, ServiceLookup: lookup } = context.window;
const day = date => data[date.slice(0, 7)].days.find(d => d.day === Number(date.slice(8)));
const newId = 'ac4-proebom-henrique-2026-11-17-08h';
const recentIds = new Set([
  'ac4-operacional-da-silva-2026-11-27-08h', 'ac4-operacional-passos-2026-11-28-08h', 'ac4-operacional-rabelo-2026-11-28-08h', 'ac4-operacional-cavalcante-2026-11-30-08h', 'ac4-operacional-aislan-2026-12-01-08h', 'ac4-operacional-martins-2026-12-02-08h',
  'ac4-operacional-hellysson-2026-11-20-08h', 'ac4-operacional-nikholas-2026-11-23-08h',
  'ac4-operacional-wanderson-2026-11-20-08h', 'ac4-operacional-rabelo-2026-11-20-08h',
  'ac4-operacional-da-silva-2026-11-21-08h', 'ac4-operacional-piccini-2026-11-21-08h',
  'ac4-operacional-passos-2026-11-22-08h', 'ac4-operacional-santos-2026-11-22-08h',
  'ac4-operacional-diego-2026-11-25-08h',
  'ac4-operacional-hugo-2026-11-25-08h',
]);

test('PROEBOM de HENRIQUE em 17/11 custa R$ 120, sem confirmar execução ou ampliar cobertura', () => {
  const summary = finance.month(data, '2026-11', 4584000);
  const records = summary.records.filter(r => r.event.serviceId === newId);
  assert.equal(records.length, 1);
  const r = records[0];
  assert.equal(r.member, '3º SGT HENRIQUE');
  assert.equal(r.startDate, '2026-11-17');
  assert.equal(r.endDate, '2026-11-17');
  assert.equal(r.start, '08h00');
  assert.equal(r.end, '12h00');
  assert.equal(r.minutes, 240);
  assert.equal(r.costCents, 12000);
  assert.equal(r.status, 'forecast');
  assert.equal(r.event.executionConfirmed, undefined);
  assert.equal(finance.documentInfo(r.event).sei, '98399055');
  assert.equal(finance.documentInfo(r.event).number, '374');
  assert.equal(summary.executedCents, 1096600);
  const baseline = JSON.parse(JSON.stringify(data));
  baseline['2026-11'].days.find(d => d.day === 17).members = day('2026-11-17').members.filter(m => m.name !== r.member);
  for (let target = 4; target <= 8; target++) {
    assert.equal(simulation.coverage(day('2026-11-17'), '2026-11-17').resources, 6);
    const actual = simulation.plan(data, '2026-11', 4584000, undefined, target);
    const before = simulation.plan(baseline, '2026-11', 4584000, undefined, target);
    assert.equal(actual.addedResources, before.addedResources);
    assert.equal(actual.summary.committedCents, before.summary.committedCents);
  }
});

test('os 70 eventos AC4 anteriores permanecem integralmente preservados', () => {
  const rows = Object.entries(data).flatMap(([period, schedule]) => schedule.days.flatMap(d =>
    ['members', 'sat'].flatMap(area => (area === 'members' ? d.members : d.sat?.members || []).flatMap(m =>
      m.events.filter(e => !recentIds.has(e.serviceId) && e.serviceId !== newId && e.serviceId !== 'ac4-operacional-santos-2026-11-23-08h' && e.serviceId !== 'ac4-operacional-da-silva-2026-11-19-08h' && e.serviceId !== 'ac4-proebom-hellysson-2026-11-24-08h' && !e.serviceId?.startsWith('ac4-sat-23a30nov-') && !e.serviceId?.startsWith('ac4-operacional-24h-luiz-antonio-') && !e.serviceId?.startsWith('ac4-2026-11-26-')).map(e => JSON.stringify([period, d.day, area, m.name, e])))))).sort();
  assert.equal(rows.length, 70);
  assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'), '30cf9b2444b9745defc777f64bc45bc6b50affe333e17a27ee89e30a31023ce6');
});

test('férias inclusivas de SCHUSSLER excluem oito plantões, com TS 167 após o afastamento e ordinário em 06/01', () => {
  const absence = rosters.absences.find(a => a.name === '2º SGT SCHUSSLER');
  assert.equal(absence.start, '2026-12-05');
  assert.equal(absence.end, '2027-01-03');
  for (const date of ['2026-12-05', '2026-12-09', '2026-12-13', '2026-12-17', '2026-12-21', '2026-12-25', '2026-12-29', '2027-01-02']) {
    const m = day(date).members.find(m => m.name === absence.name);
    assert.equal(m.badges[0].kind, 'disp');
    assert.equal(m.badges[0].text, 'FÉRIAS');
    assert(!lookup.month(data, date.slice(0, 7)).some(r => r.member === absence.name && r.date === date));
    const baseline = JSON.parse(JSON.stringify(day(date)));
    baseline.members = baseline.members.filter(m => m.name !== absence.name);
    assert.equal(simulation.coverage(day(date), date).resources, simulation.coverage(baseline, date).resources);
  }
  assert.equal(day('2026-12-01').members.find(m => m.name === absence.name).badges[0].kind, 'ord');
  assert.equal(day('2027-01-06').members.find(m => m.name === absence.name).badges[0].kind, 'ord');
  assert(!lookup.month(data, '2027-01').some(r => r.member === absence.name && r.date === '2027-01-01'));
  assert(lookup.month(data, '2027-01').some(r => r.member === absence.name && r.date === '2027-01-05' && r.labels.includes('TS')));
});

test('HENRIQUE cumpre EAS de 24h em 18 e 23/11, com observação exata, sem gerar AC4', () => {
  const note = 'Estágio Supervisionado do EAS (SEI 202600011025103) de 24h (8h às 8h).';
  const rows = lookup.month(data, '2026-11');
  const before = JSON.parse(JSON.stringify(data));
  for (const [number, resources, chief] of [[18, 7, 'ST DA SILVA'], [23, 6, 'ST TAVARES']]) {
    const date = `2026-11-${number}`, input = day(date);
    const members = input.members.filter(m => m.name === '3º SGT HENRIQUE');
    assert.equal(members.length, 1);
    assert.deepEqual(members[0].notes, [note]);
    assert.equal(members[0].events.length, 0);
    const services = rows.filter(r => r.member === '3º SGT HENRIQUE' && r.date === date);
    assert.equal(services.length, 1);
    assert.equal(services[0].type, 'ordinary');
    assert.equal(services[0].start, '08h00');
    assert.equal(services[0].end, '08h00');
    assert.equal(services[0].endDate, `2026-11-${number + 1}`);
    assert.equal(services[0].minutes, 1440);
    assert.equal(simulation.coverage(input, date).resources, resources);
    assert.equal(context.window.ServiceChief.select(input).assignments[0].name, chief);
    before['2026-11'].days.find(d => d.day === number).members = input.members.filter(m => m.name !== '3º SGT HENRIQUE');
  }
  const actual = finance.month(data, '2026-11', 4584000);
  const baseline = finance.month(before, '2026-11', 4584000);
  assert.equal(JSON.stringify(actual.records), JSON.stringify(baseline.records));
  assert.equal(actual.committedCents, 4582000);
  assert.equal(actual.executedCents, 1096600);
  assert.equal(actual.remainingCents, 2000);
  const plan = simulation.plan(data, '2026-11', 4584000);
  assert.equal(plan.days.get(18).addedServices, 0);
  assert.equal(plan.days.get(23).addedServices, 0);
  assert.equal(plan.addedResources, 0);
  assert.equal(plan.summary.committedCents, 0);
  assert.equal(data['2026-11'].days.filter(d => d.confirmation?.status === 'confirmed').length, 25);
});
