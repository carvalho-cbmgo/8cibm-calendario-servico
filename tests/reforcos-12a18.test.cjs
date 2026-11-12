const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]),context=vm.createContext({window:{}});
for(const name of ['AC4Finance','ServiceChief','ServiceSimulation','ServiceVacancies'])vm.runInContext(scripts.find(([,attrs,source])=>!attrs.includes('application/json')&&source.includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,ServiceSimulation:simulation,ServiceVacancies:vacancies}=context.window;
const documents={12:['367','98339864'],13:['368','98387331'],14:['371','98398500'],15:['372','98398745'],16:['373','98398927'],17:['374','98399055'],18:['375','98399408']};
const entries=[[12,'ST DA SILVA',12,36000],[13,'2º SGT DIEGO',24,99500],[14,'ST PASSOS',24,99500],[14,'3º SGT ROBERTO',24,99500],[15,'CB RABELO',24,96500],[16,'ST AISLAN',24,74100],[17,'1º SGT HELLYSSON',12,36000],[17,'SD MARTINS',24,74100],[18,'SD CAVALCANTE',24,74100],[18,'SD HUGO',24,74100]];

test('dez reforços informados em 11/11 são operacionais previstos, únicos, com períodos e custos corretos',()=>{
 const summary=finance.month(data,'2026-11',4560000);let total=0;
 for(const [day,name,hours,cost] of entries){
  const date=`2026-11-${day}`,matches=summary.records.filter(record=>record.startDate===date&&record.member===name&&record.category==='operational');assert.equal(matches.length,1,`${date} ${name}`);const record=matches[0];
  assert.equal(record.start,'08h00');assert.equal(record.end,hours===12?'20h00':'08h00');assert.equal(record.endDate,hours===12?date:`2026-11-${day+1}`);assert.equal(record.minutes,hours*60);assert.equal(record.costCents,cost);assert.equal(record.status,'forecast');assert.equal(record.event.mode,'OPERACIONAL/SOP');assert.equal(record.event.observation,'REFORÇO OPERACIONAL');assert(!record.event.executionConfirmed);assert.equal(finance.documentInfo(record.event).number,documents[day][0]);assert.equal(finance.documentInfo(record.event).sei,documents[day][1]);total+=cost;
 }
 assert.equal(total,763400);assert.equal(summary.records.length,57);assert.equal(summary.committedCents,2484200);assert.equal(summary.remainingCents,2075800);assert.equal(summary.executedCents,1096600);assert.equal(summary.satCents,318000);
 const documented=summary.records.filter(record=>record.category==='operational'&&record.startDate>='2026-11-12'&&record.startDate<='2026-11-18');assert.equal(documented.length,14);assert(documented.every(record=>record.status==='forecast'));assert.equal(documented.reduce((total,record)=>total+record.costCents,0),966100);for(const record of documented){const expected=record.member==='ST DA SILVA'&&record.startDate==='2026-11-13'?['370','98396238']:documents[Number(record.startDate.slice(8))],actual=finance.documentInfo(record.event);assert.equal(actual.number,expected[0]);assert.equal(actual.sei,expected[1]);}const original=summary.records.filter(record=>record.event.document?.includes('98339864'));assert.equal(original.length,2);assert(original.every(record=>record.startDate==='2026-11-12'&&record.category==='operational'));assert(!summary.records.some(record=>record.category==='sat'&&Object.values(documents).some(([,sei])=>record.event.document?.includes(sei))));
});

test('OS 370 inclui somente um AC4 de 6h do ST DA SILVA em 13/11, sem presumir execução',()=>{
 const day=data['2026-11'].days.find(day=>day.day===13),members=day.members.filter(member=>member.name==='ST DA SILVA'),summary=finance.month(data,'2026-11',4560000),records=summary.records.filter(record=>record.startDate==='2026-11-13'&&record.member==='ST DA SILVA');assert.equal(members.length,1);assert.equal(members[0].events.length,1);assert.equal(members[0].ord,5);assert.equal(records.length,1);const record=records[0];assert.equal(record.start,'08h00');assert.equal(record.end,'14h00');assert.equal(record.endDate,'2026-11-13');assert.equal(record.minutes,360);assert.equal(record.event.hours,6);assert.equal(record.category,'operational');assert.equal(record.costCents,24000);assert.equal(record.status,'forecast');assert(!record.event.executionConfirmed);assert.equal(finance.documentInfo(record.event).number,'370');assert.equal(finance.documentInfo(record.event).sei,'98396238');assert.equal(day.confirmation.status,'confirmed');assert.equal(summary.daily.get('2026-11-13').committedCents,259000);assert.equal(summary.records.length,57);assert.equal(summary.committedCents,2484200);assert.equal(summary.remainingCents,2075800);assert.equal(summary.executedCents,1096600);
});

test('plantões de 12 a 18 atingem seis recursos e não oferecem novamente as vagas preenchidas',()=>{
 const plan=simulation.plan(data,'2026-11',4560000);
 for(let number=12;number<=18;number++){
  const day=data['2026-11'].days.find(day=>day.day===number),result=plan.days.get(number);assert.equal(result.coverage.resources,6);assert(result.coverage.segments.every(segment=>segment.resources>=6));if(number===13){assert(result.coverage.segments.some(segment=>segment.resources===7));assert(result.coverage.segments.some(segment=>segment.resources===6));}assert.equal(parseInt(day.coverage[0]),6);assert.equal(result.addedServices,0);assert.equal(day.confirmation.status,'confirmed');assert.equal(day.confirmation.scope,'calendar');assert.equal(day.confirmation.date,'2026-11-11');
 }
 const message=vacancies.build(data,'2026-11',plan,'2026-11-12','2026-11-18');assert.equal(message.vacancies,0);assert.equal(message.days,7);assert.equal(message.message.match(/Sem vagas/g).length,7);
 assert.equal(plan.addedServices,16);assert.equal(plan.summary.committedCents,1290900);
});
