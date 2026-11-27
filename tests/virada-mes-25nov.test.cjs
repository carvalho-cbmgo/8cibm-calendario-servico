const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],read=id=>JSON.parse(scripts.find(([,a])=>a.includes(`id="${id}"`))[2]),data=read('calendar-data'),context=vm.createContext({window:{}});
for(const n of ['AC4Finance','ServiceSimulation','ServiceLookup'])vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes(`window.${n}=`))[2],context);
const {AC4Finance:f,ServiceSimulation:sim,ServiceLookup:lookup}=context.window,plain=v=>JSON.parse(JSON.stringify(v)),day=(s,n)=>s['2026-11'].days.find(d=>d.day===n),events=d=>[...d.members,...(d.sat?.members||[])].flatMap(m=>m.events),find=(s,n,id)=>events(day(s,n)).find(e=>e.serviceId===id),nov=()=>f.month(data,'2026-11',4584000);
const changes=[['ac4-operacional-hugo-2026-11-25-08h','SD HUGO','2026-11-25',24,'08h00','2026-11-26',74100,'388','98752637'],['ac4-2026-11-26-hellysson-08h','1º SGT HELLYSSON','2026-11-26',9,'17h00','2026-11-26',27000,'393','98894389'],['ac4-operacional-da-silva-2026-11-27-08h','ST DA SILVA','2026-11-27',12,'20h00','2026-11-27',48000,'394','98894413']];

test('retificações preservam identidades e previsão: HUGO 24h, HELLYSSON 9h, DA SILVA 12h',()=>{
 const summary=nov();for(const[id,name,date,hours,end,endDate,cost,os,sei]of changes){const matches=summary.serviceRecords.filter(r=>r.event.serviceId===id);assert.equal(matches.length,1);const r=matches[0];assert.equal(r.member,name);assert.equal(r.startDate,date);assert.equal(r.start,'08h00');assert.equal(r.end,end);assert.equal(r.endDate,endDate);assert.equal(r.minutes,hours*60);assert.equal(r.costCents,cost);assert.equal(r.status,'forecast');assert.equal(r.event.executionConfirmed,undefined);assert.equal(f.documentInfo(r.event).number,os);assert.equal(f.documentInfo(r.event).sei,sei);const rows=lookup.month(data,'2026-11').filter(r=>r.type==='ac4'&&r.event.serviceId===id);assert.equal(rows.length,1);assert.equal(rows[0].minutes,hours*60);}
});

test('todos os quatro AC4 de 25/11, operacionais e SAT, usam OS 388/SEI 98752637',()=>{
 const records=nov().serviceRecords.filter(r=>r.startDate==='2026-11-25');assert.equal(records.length,4);assert.deepEqual(plain(records.map(r=>r.member).sort()),['2º SGT DIEGO','3º SGT BERTONCELLO','3º SGT ROBERTO','SD HUGO']);for(const r of records){assert.equal(f.documentInfo(r.event).number,'388');assert.equal(f.documentInfo(r.event).sei,'98752637');}assert.equal(records.reduce((s,r)=>s+r.costCents,0),175200);
 const sameNumber=nov().records.filter(r=>r.member==='SD SANTOS'&&r.startDate==='2026-11-23');assert.equal(f.documentInfo(sameNumber[0].event).sei,'98727025');
});

test('apenas períodos/documentos solicitados e coberturas derivadas mudam; todas as confirmações são preservadas',()=>{
 const before=structuredClone(data);day(before,26).members=day(before,26).members.filter(m=>m.name!=='SD CAVALCANTE');delete day(before,27).chief;delete day(before,27).shiftStart;day(before,27).members.find(m=>m.name==='ST TAVARES').notes=['Ordinário'];
 Object.assign(find(before,25,changes[0][0]),{end:'20h00',nextDay:false,hours:12,endDate:'2026-11-25',document:'OS a definir (não informada)'});
 for(const e of day(before,25).sat.members.flatMap(m=>m.events))e.document='OS nº 379 (SEI 98570810)';
 Object.assign(find(before,26,changes[1][0]),{end:'16h00',hours:8});Object.assign(find(before,27,changes[2][0]),{end:'08h00',hours:24,nextDay:true,endDate:'2026-11-28'});day(before,25).coverage=['5 recursos de 24h','Faltam 1 recurso'];day(before,27).coverage=['7 recursos de 24h','Meta de 6 recursos'];
 assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'),'a947fed00f54057f673ad6ce03f0c88dd66853b33b0e661d2f462c22ed75d49b');
 const after=nov(),old=f.month(before,'2026-11',4584000);assert.equal(after.committedCents-old.committedCents,25600);assert.equal(after.executedCents,old.executedCents);assert.equal(after.satCents,old.satCents);for(const n of [25,26,27]){assert.deepEqual(day(data,n).confirmation,day(before,n).confirmation);assert.equal(sim.coverage(day(data,n),`2026-11-${n}`).resources,6);}assert.equal(sim.plan(data,'2026-11',4584000).addedServices,0);
});

test('saldos são recalculados: novembro R$45.830 e saldo R$10; dezembro conserva R$1.455 e R$36.545',()=>{
 const n=nov(),d=f.month(data,'2026-12',3800000);assert.equal(n.records.length,108);assert.equal(n.invalidCount,0);assert.equal(n.duplicateCount,0);assert.equal(n.committedCents,4583000);assert.equal(n.operationalCents,3700000);assert.equal(n.satCents,883000);assert.equal(n.forecastCents,3486400);assert.equal(n.executedCents,1096600);assert.equal(n.remainingCents,1000);assert.equal(d.committedCents,224700);assert.equal(d.remainingCents,3575300);
 const rank=asOf=>f.ranking(n,'2026-11-25',true,{startDate:'2026-11-25',endDate:'2026-11-26',asOf}).rows.find(r=>r.member==='SD HUGO');assert.equal(rank('2026-11-26T07:59:59-03:00'),undefined);assert.equal(rank('2026-11-26T08:00:00-03:00').totalCents,74100);
});

test('Virada de mês mostra o mesmo AC4 e as duas parcelas em 30/11 e 01/12, sem alterar preços',()=>{
 const before=JSON.stringify(data),n=nov(),d=f.month(data,'2026-12',3800000),a=f.monthTurn(n,'2026-11-30'),b=f.monthTurn(d,'2026-12-01');assert.equal(a.length,1);assert.equal(b.length,1);assert.deepEqual(plain(a),plain(b));assert.equal(a[0].member,'SD CAVALCANTE');assert.equal(a[0].minutes,1440);assert.equal(a[0].costCents,74100);assert.deepEqual(plain(a[0].parts.map(p=>[p.period,p.minutes,p.costCents])),[['2026-11',960,48600],['2026-12',480,25500]]);assert.equal(f.monthTurn(n,'2026-11-01').length,0);assert.equal(f.monthTurn(n,'2026-11-29').length,0);assert.equal(f.monthTurn(n,'2026-12-01').length,0);assert.equal(JSON.stringify(data),before);
});

test('Virada de mês individualiza vários serviços, resolve revisões e exclui cancelados, inválidos e simulados',()=>{
 const e=(id,extra={})=>({serviceId:id,mode:'SAT',start:'20h00',end:'08h00',nextDay:true,hours:12,status:'planned',...extra}),input={'2026-11':{days:[{day:30,members:[],sat:{members:[{name:'ST TESTE',events:[e('sat',{revision:1}),e('sat',{revision:2}),e('cancelled',{cancelled:true}),e('invalid',{hours:10}),e('simulation',{simulation:true})]},{name:'SD TESTE',events:[e('operational',{mode:'OPERACIONAL/SOP',start:'08h00',hours:24})]}]}}]}};
 for(const[period,date]of [['2026-11','2026-11-30'],['2026-12','2026-12-01']]){const records=f.monthTurn(f.month(input,period),date);assert.equal(records.length,2);assert.equal(new Set(records.map(r=>r.key)).size,2);assert.deepEqual(plain(records.map(r=>r.event.serviceId).sort()),['operational','sat']);assert.equal(records.reduce((s,r)=>s+r.parts.find(p=>p.period===period).costCents,0),period==='2026-11'?61200:51000);}
});

test('Virada de mês reconhece ano bissexto e virada de ano; término à meia-noite não cria uma parcela vazia',()=>{
 const make=(period,day,end='08h00',hours=24)=>({[period]:{days:[{day,members:[{name:'ST TESTE',events:[{serviceId:'edge',mode:'OPERACIONAL/SOP',start:'08h00',end,nextDay:true,hours,status:'planned'}]}]}]}});
 const leap=make('2028-02',29);assert.equal(f.monthTurn(f.month(leap,'2028-02'),'2028-02-29').length,1);assert.equal(f.monthTurn(f.month(leap,'2028-03'),'2028-03-01').length,1);assert.equal(f.monthTurn(f.month(leap,'2028-02'),'2028-02-28').length,0);
 const year=make('2026-12',31),records=f.monthTurn(f.month(year,'2027-01'),'2027-01-01');assert.deepEqual(plain(records[0].parts.map(p=>[p.period,p.costCents])),[['2026-12',48600],['2027-01',28500]]);
 const midnight=make('2026-11',30,'00h00',16);assert.equal(f.monthTurn(f.month(midnight,'2026-11'),'2026-11-30').length,0);assert.equal(f.monthTurn(f.month(midnight,'2026-12'),'2026-12-01').length,0);
});
