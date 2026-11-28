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
  for (const day of copy['2026-11'].days) if (day.day >= 26) delete day.confirmation;
  return copy;
};

test('escalas de 1 a 30/11 estão confirmadas, com cinco novas confirmações em 25/11 e histórico anterior preservado', () => {
  const days = data['2026-11'].days;
  assert.equal(days.filter(d => d.confirmation?.status === 'confirmed').length, 30);
  for (const day of days) {
    assert.equal(day.confirmation.status, 'confirmed');
    if(day.day>=26)assert.deepEqual(day.confirmation,{status:'confirmed',date:'2026-11-25',source:'user',scope:'calendar',previousAlerts:[]});
    if (day.day >= 19 && day.day <= 25) {
      assert.deepEqual(day.confirmation, { status: 'confirmed', date: '2026-11-19', source: 'user', scope: 'calendar', previousAlerts: [] });
    }
  }
  assert.equal(createHash('sha256').update(JSON.stringify(previous())).digest('hex'), '89b3c6dce86d7fe4e2d3536563092a617d4db40f9215c23eab18f35b6671c066');
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
  assert.equal(summary.records.length, 108);
  assert.equal(summary.committedCents, 4583000);
  assert.equal(summary.forecastCents, 3486400);
  assert.equal(summary.executedCents, 1096600);
  assert.equal(summary.remainingCents, 1000);
});

test('todos os dias confirmados ficam fora da simulacao em todas as metas', () => {
  const before=previous(),source=JSON.stringify(data);
  for(let target=4;target<=8;target++){
    const actual=simulation.plan(data,'2026-11',4584000,undefined,target);
    const old=simulation.plan(before,'2026-11',4584000,undefined,target);
    assert.equal(actual.addedServices,0);assert.equal(actual.summary.committedCents,0);
    for(let day=1;day<=30;day++)assert.equal(actual.days.get(day).addedServices,0);
    if(target>=7)assert(old.addedServices>0);
  }
  assert.equal(JSON.stringify(data),source);
});
