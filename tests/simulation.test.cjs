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
const ordinary=count=>Array.from({length:count},(_,index)=>member(`ST ORDINÁRIO ${index+1}`));
const partial=extra=>member('SGT AC4',[],[ac4({hours:12,...extra})]);

test('cinco ordinários e AC4 noturno recebem somente complemento diurno de 12h',()=>{
  const source=input([...ordinary(5),partial({start:'20h00',end:'08h00',nextDay:true})]),before=JSON.stringify(source),plan=simulation.plan(source,'2026-11',4560000),day=plan.days.get(12),event=day.members[0].events[0];
  assert.equal(day.coverage.resources,5);assert.equal(day.addedResources,1);assert.equal(day.addedServices,1);
  assert.deepEqual([event.start,event.end,event.hours,event.nextDay,event.startDate,event.endDate],['08h00','20h00',12,false,'2026-11-12','2026-11-12']);assert.equal(plan.summary.committedCents,36000);
  const combined=simulation.coverage({...source['2026-11'].days[0],members:[...source['2026-11'].days[0].members,...day.members]},'2026-11-12');assert(combined.segments.every(segment=>segment.resources===6));assert.equal(JSON.stringify(source),before);
});

test('cinco ordinários e AC4 diurno recebem complemento noturno com tarifa da virada',()=>{
  const source=input([...ordinary(5),partial({start:'08h00',end:'20h00',nextDay:false})]),plan=simulation.plan(source,'2026-11',4560000),day=plan.days.get(12),event=day.members[0].events[0];
  assert.deepEqual([event.start,event.end,event.hours,event.nextDay,event.startDate,event.endDate],['20h00','08h00',12,true,'2026-11-12','2026-11-13']);assert.equal(plan.summary.committedCents,41100);
  assert.equal(simulation.coverage({...source['2026-11'].days[0],members:[...source['2026-11'].days[0].members,...day.members]},'2026-11-12').resources,6);
});

test('déficit de dois recursos combina reforço de 24h e complemento de 12h',()=>{
  const source=input([...ordinary(4),partial({start:'20h00',end:'08h00',nextDay:true})]),plan=simulation.plan(source,'2026-11',4560000),day=plan.days.get(12);
  assert.equal(day.addedResources,2);assert.equal(day.addedServices,2);assert.deepEqual(Array.from(day.members,member=>member.events[0].hours),[24,12]);assert.equal(plan.summary.committedCents,113100);
  const combined=simulation.coverage({...source['2026-11'].days[0],members:[...source['2026-11'].days[0].members,...day.members]},'2026-11-12');assert(combined.segments.every(segment=>segment.resources===6));
});

test('complementos existentes, serviços cancelados, SAT, PROEBOM e sobreposição são respeitados',()=>{
  const night={start:'20h00',end:'08h00',nextDay:true},daylight={start:'08h00',end:'20h00',nextDay:false};
  const paired=input([...ordinary(5),partial(night),{...partial(daylight),name:'SGT DIA'}]);assert.equal(simulation.plan(paired,'2026-11').addedServices,0);
  for(const extra of [{cancelled:true},{mode:'SAT'},{mode:'PROEBOM 2026'}]){
    const source=input([...ordinary(5),partial({...night,...extra})]),plan=simulation.plan(source,'2026-11');assert.equal(plan.days.get(12).members[0].events[0].hours,24);
  }
  const overlapping=ordinary(5);overlapping[0].events=[ac4({hours:12,...night})];assert.equal(simulation.plan(input(overlapping),'2026-11').days.get(12).members[0].events[0].hours,24);
  const twice=input([...ordinary(5),partial(night),{...partial(night),name:'SGT SEGUNDO NOTURNO'}]),plan=simulation.plan(twice,'2026-11');assert.equal(plan.addedServices,1);assert.equal(plan.days.get(12).members[0].events[0].hours,12);
});

test('lacunas separadas distinguem quantidade de serviços da cobertura de 24h',()=>{
  const source=input([...ordinary(5),partial({start:'10h00',end:'22h00',nextDay:false})]),plan=simulation.plan(source,'2026-11',4560000),day=plan.days.get(12);
  assert.equal(day.addedResources,1);assert.equal(day.addedServices,2);assert.equal(plan.addedResources,1);assert.equal(plan.addedServices,2);
  assert.deepEqual(Array.from(day.members,member=>[member.events[0].start,member.events[0].end,member.events[0].hours]),[['08h00','10h00',2],['22h00','08h00',10]]);assert.equal(plan.summary.committedCents,41100);
  const combined=simulation.coverage({...source['2026-11'].days[0],members:[...source['2026-11'].days[0].members,...day.members]},'2026-11-12');assert(combined.segments.every(segment=>segment.resources===6));
});

test('complemento noturno no último dia fica no mês de início e respeita a referência de horário',()=>{
  const source={'2026-11':{days:[{day:30,shiftStart:'06h00',members:[...ordinary(5),partial({start:'06h00',end:'18h00',nextDay:false})]}]}},plan=simulation.plan(source,'2026-11'),event=plan.days.get(30).members[0].events[0];
  assert.deepEqual([event.start,event.end,event.hours,event.startDate,event.endDate],['18h00','06h00',12,'2026-11-30','2026-12-01']);assert.equal(plan.summary.records[0].financialMonth,'2026-11');assert.equal(plan.summary.committedCents,38100);
});

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

test('todas as metas completam somente o déficit por horário nos três meses cadastrados',()=>{
  const source=data(),before=JSON.stringify(source);
  for(const period of Object.keys(source))for(let target=4;target<=10;target++){
    const plan=simulation.plan(source,period,null,undefined,target);
    assert.equal(plan.addedServices,[...plan.days.values()].reduce((total,day)=>total+day.members.length,0));
    for(const day of source[period].days){
      const date=`${period}-${String(day.day).padStart(2,'0')}`,planned=plan.days.get(day.day),combined=simulation.coverage({...day,members:[...day.members,...planned.members]},date);
      for(const segment of combined.segments){const original=planned.coverage.segments.find(part=>part.start<=segment.start&&part.end>=segment.end);assert(original);assert.equal(segment.resources,day.confirmation?.status==='confirmed'?original.resources:Math.max(original.resources,target),`${date} meta ${target}, ${segment.start}–${segment.end}`);}
    }
  }
  assert.equal(JSON.stringify(source),before);
});

test('novembro simula 26 recursos em 18 dias, cobra cada reforço uma vez e preserva execuções',()=>{
  const source=data(),plan=simulation.plan(source,'2026-11',4560000),real=finance.month(source,'2026-11',4560000);
  assert.equal(source['2026-11'].days.filter(day=>day.confirmation?.status==='confirmed').length,11);
  for(let day=1;day<=11;day++)assert.equal(plan.days.get(day).addedResources,0);
  assert.equal(plan.days.get(27).addedResources,0);assert.equal(plan.days.get(13).addedResources,1);assert.equal(plan.days.get(20).addedResources,2);assert.equal(plan.days.get(29).addedResources,1);
  assert.equal(plan.addedResources,26);assert.equal(plan.addedServices,26);assert.equal(plan.daysAffected,18);assert.equal(plan.summary.committedCents,2054300);
  assert.equal(new Set(plan.summary.records.map(record=>record.key)).size,26);assert.equal(plan.summary.executedCents,0);assert.equal(plan.summary.satCents,0);
  assert.equal(plan.summary.daily.get('2026-11-30').cumulativeCents,2054300);
  assert.equal(real.records.length,46);assert.equal(real.committedCents,1696800);assert.equal(real.executedCents,1096600);
  assert.equal(real.committedCents+plan.summary.committedCents,3751100);assert.equal(real.remainingCents-plan.summary.committedCents,808900);
  assert.equal(plan.summary.records.filter(record=>record.minutes===720).length,5);assert.equal(plan.summary.records.reduce((total,record)=>total+record.minutes/60,0),564);
  for(const number of [12,17,19,24,26]){const complements=plan.days.get(number).members.filter(member=>member.events[0].hours===12);assert.equal(complements.length,1);assert.deepEqual([complements[0].events[0].start,complements[0].events[0].end],['08h00','20h00']);}
});

test('tarifa acompanha cada data e o mês financeiro usa o início do reforço',()=>{
  const source={'2026-11':{days:[{day:13,members:Array.from({length:5},(_,i)=>member(`ST ${i}`))},{day:30,members:Array.from({length:5},(_,i)=>member(`ST ${i}`))}]}},plan=simulation.plan(source,'2026-11');
  assert.equal(plan.summary.daily.get('2026-11-13').committedCents,99500);assert.equal(plan.summary.daily.get('2026-11-30').committedCents,74100);
  const last=plan.summary.records.find(record=>record.startDate==='2026-11-30');assert.equal(last.endDate,'2026-12-01');assert.equal(last.financialMonth,'2026-11');assert.equal(plan.summary.quotaCents,null);
});

test('meta de 4 a 10 altera somente os reforços necessários, sem remover recursos existentes',()=>{
  const source=data(),before=JSON.stringify(source),real=finance.month(source,'2026-11',4560000);
  const four=simulation.plan(source,'2026-11',4560000,real,4),five=simulation.plan(source,'2026-11',4560000,real,5),ten=simulation.plan(source,'2026-11',4560000,real,10);
  assert.equal(four.addedResources,0);assert.equal(four.summary.committedCents,0);assert.equal(four.days.get(12).coverage.resources,5);
  assert.equal(five.addedResources,8);assert.equal(five.summary.committedCents,678700);
  assert.equal(ten.addedResources,102);assert.equal(ten.daysAffected,19);assert.equal(ten.targetResources,10);
  for(const day of source['2026-11'].days){const planned=ten.days.get(day.day);assert.equal(planned.addedResources,day.confirmation?.status==='confirmed'?0:10-planned.coverage.resources);}
  assert.equal(ten.summary.quotaCents,4560000);assert(real.remainingCents-ten.summary.committedCents<0);assert.equal(JSON.stringify(source),before);
});

test('meta inválida é rejeitada e a meta padrão continua sendo 6',()=>{
  const source=input([member('ST TESTE')]);assert.equal(simulation.plan(source,'2026-11').targetResources,6);
  for(const target of[3,11,4.5,'6',null,NaN])assert.throws(()=>simulation.plan(source,'2026-11',null,undefined,target),/meta deve ser um número inteiro de 4 a 10/);
});

test('AC4 corrente em simulação inclui apenas os acréscimos até o acesso, sem alterar o cadastro',()=>{
  const source=data(),before=JSON.stringify(source),real=finance.month(source,'2026-11',4560000),plan=simulation.plan(source,'2026-11',4560000);
  assert.equal(finance.asOf(plan.summary,'2026-11-09').committedCents,0);
  const current=finance.asOf(real,'2026-11-12'),extra=finance.asOf(plan.summary,'2026-11-12');
  assert.equal(extra.committedCents,36000);assert.equal(current.committedCents+extra.committedCents,1438900);assert.equal(current.remainingCents-extra.committedCents,3121100);assert(extra.committedCents<plan.summary.committedCents);assert.equal(JSON.stringify(source),before);
});
