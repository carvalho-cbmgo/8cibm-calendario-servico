const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createHash } = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const read = id => JSON.parse(scripts.find(s => s[1].includes(`id="${id}"`))[2]);
const data = read('calendar-data'), config = read('ac4-financial-config');
const context = vm.createContext({ window: {} });
for (const name of ['AC4Finance', 'ServiceChief', 'ServiceSimulation', 'ServiceLookup']) {
  vm.runInContext(scripts.find(s => !s[1].includes('application/json') && s[2].includes(`window.${name}=`))[2], context);
}
const { AC4Finance: finance, ServiceChief: chief, ServiceSimulation: simulation, ServiceLookup: lookup } = context.window;
const day = (schedules, number) => schedules['2026-11'].days.find(d => d.day === number);
const previous = () => {
  const copy = structuredClone(data), nineteenth = day(copy, 19);
  delete nineteenth.shiftStart; delete nineteenth.chief;
  nineteenth.members.find(m => m.name === 'ST TAVARES').notes = ['Ordinário'];
  day(copy, 20).members = day(copy, 20).members.filter(m => m.name !== '1º SGT HELLYSSON');
  day(copy, 20).coverage = ['5 recursos de 24h', 'Faltam 1 recurso'];
  Object.assign(day(copy, 22).members.find(m => m.name === '2º SGT LUIZ ANTONIO').events[0], { end:'20h00', nextDay:false, hours:12, endDate:'2026-11-22' });
  day(copy, 22).coverage = ['6 recursos de 24h', 'Meta de 6 recursos'];
  day(copy, 23).members = day(copy, 23).members.filter(m => m.name !== '1º SGT NIKHOLAS');
  Object.assign(day(copy, 24).members.find(m => m.name === '1º SGT HELLYSSON').events[0], { end:'12h00', hours:4 });
  return copy;
};

test('TAVARES é o ACA expressamente designado para as 24h de 19/11, sem atribuir chefia ao AC4 parcial', () => {
  const result = chief.select(day(data, 19));
  assert.equal(result.status, 'selected');
  assert.equal(JSON.stringify(result.assignments), JSON.stringify([{name:'ST TAVARES', start:0, end:1440}]));
  assert.equal(day(data, 19).chief, 'ST TAVARES');
  assert.equal(simulation.coverage(day(data, 19), '2026-11-19').resources, 6);
  assert.equal(createHash('sha256').update(JSON.stringify(previous())).digest('hex'), '95d8d38dbd61ae83db303c94fd9eb84e7ff21f63ffafb5546a86e8fbaece9401');
});

test('HELLYSSON, LUIZ e NIKHOLAS têm os períodos retificados, com identidades e exclusões preservadas', () => {
  const summary = finance.month(data, '2026-11', config.monthlyQuotaCents['2026-11']);
  for (const [number,name,hours,endDate,cost,mode] of [
    [20,'1º SGT HELLYSSON',24,'2026-11-21',99500,'OPERACIONAL/SOP'],
    [22,'2º SGT LUIZ ANTONIO',24,'2026-11-23',96500,'OPERACIONAL/SOP'],
    [23,'1º SGT NIKHOLAS',12,'2026-11-23',36000,'OPERACIONAL/SOP'],
    [24,'1º SGT HELLYSSON',12,'2026-11-24',36000,'PROEBOM 2026'],
  ]) {
    const records = summary.records.filter(r => r.sourceDay === number && r.member === name);
    assert.equal(records.length, 1);
    const r = records[0];
    assert.equal(r.start, '08h00'); assert.equal(r.end, hours === 24 ? '08h00' : '20h00');
    assert.equal(r.endDate, endDate); assert.equal(r.event.hours, hours); assert.equal(r.minutes, hours*60);
    assert.equal(r.event.mode, mode); assert.equal(r.event.nextDay, hours === 24);
    assert.equal(r.costCents, cost); assert.equal(r.status, 'forecast');
    const documents = {20:['385','98726048'],22:['387','98726469'],23:['388','98727025'],24:['389','98752623']};
    assert.equal(r.event.executionConfirmed, undefined); assert.equal(finance.documentInfo(r.event).number, documents[number][0]);
    assert.equal(finance.documentInfo(r.event).sei, documents[number][1]);
    assert.equal(lookup.month(data,'2026-11').filter(s => s.date === `2026-11-${number}` && s.member === name && s.type === 'ac4').length, 1);
  }
  assert(!day(data,21).members.some(m => m.name === '1º SGT HELLYSSON'));
  const hellysson = day(data,20).members.find(m => m.name === '1º SGT HELLYSSON').events[0];
  assert.equal(hellysson.serviceId, 'ac4-operacional-hellysson-2026-11-20-08h');
  assert.equal(finance.documentInfo(hellysson).sei, '98726048');
  const luiz = day(data,22).members.find(m => m.name === '2º SGT LUIZ ANTONIO').events[0];
  assert.equal(luiz.serviceId, 'ac4-operacional-24h-luiz-antonio-2026-11-22-08h');
  assert.equal(luiz.excludeFromSimulation, true);
  assert.equal(day(data,24).members.find(m => m.name === '1º SGT HELLYSSON').events[0].serviceId, 'ac4-proebom-hellysson-2026-11-24-08h');
  for (const [period,number] of [['2026-11',29],['2026-12',6]]) {
    const e = data[period].days.find(d => d.day === number).members.find(m => m.name === '2º SGT LUIZ ANTONIO').events[0];
    assert.equal(e.hours,12); assert.equal(e.start,'08h00'); assert.equal(e.end,'20h00'); assert.equal(e.excludeFromSimulation,true);
  }
});

test('cota R$ 45.840 e AC4 atualizados mantêm tarifas, execuções e simulação coerentes', () => {
  const quota = config.monthlyQuotaCents['2026-11'];
  assert.equal(quota, 4584000);
  const summary = finance.month(data,'2026-11',quota), before = finance.month(previous(),'2026-11',quota);
  assert.equal(summary.records.length,107); assert.equal(summary.committedCents,4582900);
  assert.equal(summary.operationalCents,3699900); assert.equal(summary.satCents,883000);
  assert.equal(summary.forecastCents,3486300); assert.equal(summary.executedCents,1096600);
  assert.equal(summary.remainingCents,1100); assert.equal(summary.committedCents-before.committedCents,208000);
  assert.equal(finance.asOf(summary,'2026-11-19').remainingCents,1951000);
  assert.equal(simulation.coverage(day(data,20),'2026-11-20').resources,6);
  assert.equal(simulation.coverage(day(data,21),'2026-11-21').resources,6);
  assert.equal(simulation.coverage(day(data,22),'2026-11-22').resources,7);
  assert.equal(simulation.coverage(day(data,22),'2026-11-22',undefined,{forSimulation:true}).resources,6);
  assert.equal(simulation.coverage(day(data,23),'2026-11-23').resources,6);
  assert.equal(simulation.coverage(day(data,24),'2026-11-24').resources,6);
  const plan = simulation.plan(data,'2026-11',quota);
  assert.equal(plan.addedServices,0); assert.equal(plan.summary.committedCents,0);
  assert.equal(summary.remainingCents-plan.summary.committedCents,1100);
  for (let n=1;n<=25;n++) assert.equal(day(data,n).confirmation.status,'confirmed');
});
