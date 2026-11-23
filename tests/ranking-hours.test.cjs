const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const read = id => JSON.parse(scripts.find(s => s[1].includes(`id="${id}"`))[2]);
const context = vm.createContext({ window: {} });
for (const name of ['AC4Finance', 'AC4RankingHistory']) {
  vm.runInContext(scripts.find(s => !s[1].includes('application/json') && s[2].includes(`window.${name}=`))[2], context);
}
const { AC4Finance: finance, AC4RankingHistory: history } = context.window;
const personnel = [{name:'ST TESTE',ord:1,rg:'999'},{name:'SD ZERO',ord:2,rg:'998'}];
const event = (serviceId, extra = {}) => ({serviceId,mode:'OPERACIONAL/SOP',start:'08h00',end:'12h00',hours:4,...extra});
const member = (events, name = 'ST TESTE') => ({name,badges:[],notes:[],events});
const fixture = () => ({'2026-11':{days:[
  {day:1,members:[member([event('ordinary-ac4',{end:'08h00',hours:24,nextDay:true})])]},
  {day:2,members:[],sat:{members:[member([
    event('sat',{mode:'SAT',revision:1}),
    event('sat',{mode:'SAT',end:'18h00',hours:10,revision:2}),
    event('sat',{mode:'SAT',end:'18h00',hours:10,revision:2}),
  ])]}},
  {day:3,members:[member([event('proebom',{mode:'PROEBOM 2026',executionConfirmed:true})])]},
  {day:4,members:[],sat:{members:[member([event('analysis',{mode:'ANÁLISE DE PROJETOS',end:'20h00',hours:12})])]}},
  {day:5,members:[member([
    event('half-hour',{end:'08h30',hours:0.5,status:'executed'}),
    event('cancelled',{status:'cancelled'}),
    event('invalid',{end:'13h00'}),
    event('simulation',{simulation:true}),
  ])]},
]}});
const rank = (source, startDate = '2026-11-03', endDate = startDate) => finance.ranking(
  finance.month(source,'2026-11'), '2026-11-23', true, {startDate,endDate,personnel});

test('horas mensais somam modalidades, minutos e estados canônicos sem duplicar revisão/continuidade ou contar cancelamento, inválido e simulação', () => {
  const source = fixture(), before = JSON.stringify(source), result = rank(source);
  const person = result.rows.find(p => p.member === 'ST TESTE');
  assert.equal(person.monthlyMinutes,3030); // 24h + 10h + 4h + 12h + 30min.
  assert.equal(person.minutes,240);
  assert.equal(person.monthlyExecutedMinutes,270);
  assert.equal(person.monthlyForecastMinutes,2760);
  assert.equal(person.monthlyLimitMinutes,11520);
  assert.equal(result.monthlyLimitMinutes,11520);
  assert.equal(person.remainingMinutes,8490);
  assert.equal(person.excessMinutes,0);
  assert.equal(person.limitStatus,'available');
  const zero = result.rows.find(p => p.member === 'SD ZERO');
  assert.equal(zero.monthlyMinutes,0); assert.equal(zero.minutes,0);
  assert.equal(zero.remainingMinutes,11520); assert.equal(zero.limitStatus,'available');
  assert.equal(JSON.stringify(source),before);
});

test('limite mensal de 192h distingue 191h59, 192h e 192h01 mesmo com intervalo de apenas um dia', () => {
  const source = {'2026-11':{days:Array.from({length:8},(_,index)=>({day:index+1,members:[
    member([event(`below-${index}`,{end:index===7?'07h59':'08h00',hours:index===7?1439/60:24,nextDay:true})],'ST ABAIXO'),
    member([event(`exact-${index}`,{end:'08h00',hours:24,nextDay:true})],'ST LIMITE'),
    member([event(`above-${index}`,{end:index===7?'08h01':'08h00',hours:index===7?1441/60:24,nextDay:true})],'ST ACIMA'),
  ]}))}};
  const rows = rank(source,'2026-11-01').rows;
  for (const [name,minutes,status,remaining,excess] of [
    ['ST ABAIXO',11519,'available',1,0],['ST LIMITE',11520,'reached',0,0],['ST ACIMA',11521,'exceeded',0,1],
  ]) {
    const p = rows.find(p => p.member === name);
    assert.equal(p.minutes,1440); assert.equal(p.monthlyMinutes,minutes);
    assert.equal(p.limitStatus,status); assert.equal(p.remainingMinutes,remaining); assert.equal(p.excessMinutes,excess);
  }
});

test('horas pertencem à competência inicial, não duplicam aliases na virada e reiniciam em dezembro e janeiro', () => {
  const overnight = event('month-boundary',{startDate:'2026-11-30',endDate:'2026-12-01',end:'08h00',hours:24,nextDay:true});
  const source = {'2026-11':{days:[{day:30,members:[member([overnight])]}]},'2026-12':{days:[
    {day:1,members:[member([{...overnight},event('december')])]},
  ]},'2027-01':{days:[]}};
  for (const [period,today,minutes] of [['2026-11','2026-11-30',1440],['2026-12','2026-12-31',240],['2027-01','2027-01-31',0]]) {
    const p = finance.ranking(finance.month(source,period),today,true,{personnel}).rows.find(p => p.member==='ST TESTE');
    assert.equal(p.monthlyMinutes,minutes); assert.equal(p.minutes,minutes); assert.equal(p.remainingMinutes,11520-minutes);
  }
});

test('histórico monetário de 0 a 4 meses e ordenação não alteram horas do mês ou do intervalo', () => {
  const source = fixture(), summary = finance.month(source,'2026-11');
  for (const historyMonths of [0,1,2,3,4]) for (const sortBySeniority of [false,true]) {
    const result = history.rank(source,summary,'2026-11-23',{
      personnel,historyMonths,sortBySeniority,startDate:'2026-11-03',endDate:'2026-11-03',
      history:{'2026-10':{'999':1000000}},
    });
    const p = result.rows.find(p => p.member==='ST TESTE');
    assert.equal(p.monthlyMinutes,3030); assert.equal(p.minutes,240); assert.equal(p.remainingMinutes,8490);
    assert.equal(p.historyCents,historyMonths?1000000:0);
  }
});

test('dados publicados mantêm valores e totais financeiros, com 144h de LUIZ, 123h de WANDERSON e 4h de VALÉRIA em novembro', () => {
  const source = read('calendar-data'), before = JSON.stringify(source), summary = finance.month(source,'2026-11',4584000);
  const result = rank(source,'2026-11-01','2026-11-30');
  for (const [name,hours] of [['2º SGT LUIZ ANTONIO',144],['2º SGT WANDERSON',123],['3º SGT VALÉRIA',4]]) {
    const p = result.rows.find(p => p.member===name);
    assert.equal(p.monthlyMinutes,hours*60); assert.equal(p.minutes,hours*60); assert.equal(p.remainingMinutes,(192-hours)*60);
  }
  assert.equal(result.totalCents,summary.committedCents);
  assert.equal(summary.committedCents,4162300); assert.equal(summary.satCents,907000);
  assert.equal(summary.operationalCents,3255300); assert.equal(summary.executedCents,1096600); assert.equal(summary.remainingCents,421700);
  assert.equal(JSON.stringify(source),before);
});
