const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],context=vm.createContext({window:{}});
for(const name of ['window.AC4Finance=','window.ServiceSimulation='])vm.runInContext(scripts.find(([,attrs,source])=>!attrs.includes('application/json')&&source.includes(name))[2],context);
const {AC4Finance:finance,ServiceSimulation:simulation}=context.window;
const data=()=>JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);
const member=(name,badges=[{kind:'ord'}],events=[])=>({name,badges,events,notes:[]});
const shift=(start,end)=>({kind:'ord',hours:12,start,end});
const ac4=(extra={})=>({mode:'OPERACIONAL/SOP',start:'08h00',end:'08h00',nextDay:true,hours:24,status:'planned',...extra});
const input=members=>({'2026-11':{days:[{day:12,members}]}});

test('dois turnos complementares de 12h formam um recurso, horários iguais não formam',()=>{
  const day={members:[member('SGT DIA',[shift('08h00','20h00')]),member('SGT NOITE',[shift('20h00','08h00')])]};
  assert.equal(simulation.coverage(day,'2026-11-12').resources,1);
  day.members[1].badges=[shift('08h00','20h00')];assert.equal(simulation.coverage(day,'2026-11-12').resources,0);
  day.members.push(member('ST INTEGRAL'));assert.equal(simulation.coverage(day,'2026-11-12').resources,1);
});

test('uma pessoa com horas sobrepostas e a anotação de TS não duplicam recursos',()=>{
  const person=member('ST TESTE',[{kind:'ord'},{kind:'ts',annotationOnly:true}], [ac4()]);
  person.notes=['AC4 adicional de 08h às 20h.'];
  const day={members:[person,member('ST TESTE',[{kind:'ord'}]),member('SGT TS',[{kind:'ts'}]),member('SGT CIA',[{kind:'pay'}])]};
  const result=simulation.coverage(day,'2026-11-12');assert.equal(result.resources,3);assert.equal(result.valid,true);
});

test('alcançável, dispensas, pendências, SAT, PROEBOM e AC4 cancelado não completam o Operacional',()=>{
  const source=input([member('ASP TESTE',[{kind:'officer'}]),member('ST DISPENSADO',[{kind:'disp'},{kind:'ord'}]),member('SGT PENDENTE',[{kind:'review'}]),member('SGT SAT',[],[ac4({mode:'SAT'})]),member('SGT PROEBOM',[],[ac4({mode:'PROEBOM 2026'})]),member('SGT CANCELADO',[],[ac4({cancelled:true})]),member('ST ATIVO')]);
  source['2026-11'].days[0].sat={members:[member('SGT SAT SEPARADO',[],[ac4({mode:'SAT'})])]};
  assert.equal(simulation.plan(source,'2026-11').days.get(12).coverage.resources,1);
  assert.equal(simulation.plan(source,'2026-11').days.get(12).addedResources,5);
});

test('revisões canônicas e cancelamentos atualizam a necessidade de reforço',()=>{
  const original=ac4(),cancelled=ac4({revision:2,cancelled:true}),source=input([member('ST TESTE',[],[original,cancelled])]);
  let result=simulation.plan(source,'2026-11');assert.equal(result.days.get(12).coverage.resources,0);assert.equal(result.addedResources,6);
  cancelled.cancelled=false;result=simulation.plan(source,'2026-11');assert.equal(result.days.get(12).coverage.resources,1);assert.equal(result.addedResources,5);
});

test('meta atingida e escala confirmada não recebem reforços; horário parcial inválido fica pendente',()=>{
  const source=input(Array.from({length:6},(_,i)=>member(`ST ${i}`)));
  assert.equal(simulation.plan(source,'2026-11').addedResources,0);
  source['2026-11'].days[0].members=[];source['2026-11'].days[0].confirmation={status:'confirmed'};
  assert.equal(simulation.plan(source,'2026-11').addedResources,0);
  delete source['2026-11'].days[0].confirmation;source['2026-11'].days[0].members=[member('SGT PARCIAL',[{kind:'ord',hours:12}])];
  const pending=simulation.plan(source,'2026-11');assert.equal(pending.addedResources,0);assert.equal(pending.warnings.length,1);
  source['2026-11'].days[0].members[0].badges[0].hours=0;assert.equal(simulation.plan(source,'2026-11').days.get(12).coverage.resources,0);assert.equal(simulation.plan(source,'2026-11').warnings.length,1);
});

test('dados atuais respeitam as coberturas registradas e a TS 168, sem modificar serviços',()=>{
  const source=data(),before=JSON.stringify(source);
  for(const period of Object.keys(source)){
    const plan=simulation.plan(source,period);
    for(const day of source[period].days)assert.equal(plan.days.get(day.day).coverage.resources,parseInt(day.coverage[0]),`${period}/${day.day}`);
    assert.equal(plan.warnings.length,0);
  }
  for(const day of [8,29])assert.equal(simulation.coverage(source['2026-11'].days[day-1],`2026-11-${String(day).padStart(2,'0')}`).resources,5);
  assert.equal(JSON.stringify(source),before);
});

test('novembro simula 25 recursos em 18 dias, cobra cada reforço uma vez e preserva execuções',()=>{
  const source=data(),plan=simulation.plan(source,'2026-11',4560000),real=finance.month(source,'2026-11',4560000);
  assert.equal(source['2026-11'].days.filter(day=>day.confirmation?.status==='confirmed').length,11);
  for(let day=1;day<=11;day++)assert.equal(plan.days.get(day).addedResources,0);
  assert.equal(plan.days.get(27).addedResources,0);assert.equal(plan.days.get(13).addedResources,2);assert.equal(plan.days.get(29).addedResources,1);
  assert.equal(plan.addedResources,25);assert.equal(plan.daysAffected,18);assert.equal(plan.summary.committedCents,2154300);
  assert.equal(new Set(plan.summary.records.map(record=>record.key)).size,25);assert.equal(plan.summary.executedCents,0);assert.equal(plan.summary.satCents,0);
  assert.equal(plan.summary.daily.get('2026-11-30').cumulativeCents,2154300);
  assert.equal(real.records.length,40);assert.equal(real.committedCents,1459200);assert.equal(real.executedCents,1096600);
  assert.equal(real.committedCents+plan.summary.committedCents,3613500);assert.equal(real.remainingCents-plan.summary.committedCents,946500);
});

test('tarifa acompanha cada data e o mês financeiro usa o início do reforço',()=>{
  const source={'2026-11':{days:[{day:13,members:Array.from({length:5},(_,i)=>member(`ST ${i}`))},{day:30,members:Array.from({length:5},(_,i)=>member(`ST ${i}`))}]}},plan=simulation.plan(source,'2026-11');
  assert.equal(plan.summary.daily.get('2026-11-13').committedCents,99500);assert.equal(plan.summary.daily.get('2026-11-30').committedCents,74100);
  const last=plan.summary.records.find(record=>record.startDate==='2026-11-30');assert.equal(last.endDate,'2026-12-01');assert.equal(last.financialMonth,'2026-11');assert.equal(plan.summary.quotaCents,null);
});
