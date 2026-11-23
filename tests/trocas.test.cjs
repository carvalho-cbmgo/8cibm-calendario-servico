const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);
const context=vm.createContext({window:{}});
for(const name of ['window.AC4Finance=','window.ServiceChief=','window.ServiceSimulation='])vm.runInContext(scripts.find(([,attrs,source])=>!attrs.includes('application/json')&&source.includes(name))[2],context);
const day=date=>data[date.slice(0,7)].days.find(day=>day.day===Number(date.slice(8)));
// User corrections: TS 167 on 05/01, TS 169 on 09/01 and TS 170 on 22/11/2026.
// Each leg is [date, final substitute, replaced member, date worked by the replaced member].
const documents=[
 ['153','97515824',24,[['2026-11-06','SD HUGO','SD MARTINS','2026-10-31']]],
 ['155','97542993',24,[['2026-11-05','SD PICCINI','SD SANTOS','2026-10-31']]],
 ['156','97543668',24,[['2026-11-08','SD SANTOS','SD PICCINI','2026-11-17'],['2026-11-17','SD PICCINI','SD SANTOS','2026-11-08']]],
 ['158','97544104',24,[['2026-11-28','SD SANTOS','SD PICCINI','2026-12-03'],['2026-12-03','SD PICCINI','SD SANTOS','2026-11-28']]],
 ['159','97553091',24,[['2026-12-16','3º SGT HENRIQUE','ST AISLAN','2026-10-31']]],
 ['160','97660634',24,[['2026-11-06','ST TAVARES','ST AISLAN','2026-10-30']]],
 ['161','97703197',24,[['2026-11-05','ST OSVALDIR','ST PASSOS','2026-11-08'],['2026-11-08','ST PASSOS','ST OSVALDIR','2026-11-05']]],
 ['162','97704006',24,[['2026-11-13','ST OSVALDIR','ST PASSOS','2026-11-16'],['2026-11-16','ST PASSOS','ST OSVALDIR','2026-11-13']]],
 ['163','97704646',24,[['2026-11-21','ST OSVALDIR','ST PASSOS','2026-11-24'],['2026-11-24','ST PASSOS','ST OSVALDIR','2026-11-21']]],
 ['164','97705098',24,[['2026-11-14','ST OSVALDIR','ST DA SILVA','2026-11-29'],['2026-11-29','ST DA SILVA','ST OSVALDIR','2026-11-14'],['2026-12-02','ST PASSOS','ST OSVALDIR','2026-11-14']]],
 ['165','97705425',24,[['2026-12-07','ST OSVALDIR','ST PASSOS','2026-12-10'],['2026-12-10','ST PASSOS','ST OSVALDIR','2026-12-07']]],
 ['166','97832330',24,[['2026-11-03','ST AISLAN','2º SGT SCHUSSLER','2026-11-30'],['2026-11-30','2º SGT SCHUSSLER','ST AISLAN','2026-11-03']]],
 ['167','97933840',24,[['2026-11-07','ST AISLAN','2º SGT SCHUSSLER','2027-01-05'],['2027-01-05','2º SGT SCHUSSLER','ST AISLAN','2026-11-07']]],
 ['168','98135195',12,[['2026-11-08','2º SGT WANDERSON','3º SGT HENRIQUE','2026-11-29'],['2026-11-29','3º SGT HENRIQUE','2º SGT WANDERSON','2026-11-08']]],
 ['169','98279694',24,[['2026-11-15','ST AISLAN','2º SGT SCHUSSLER','2027-01-09'],['2027-01-09','2º SGT SCHUSSLER','ST AISLAN','2026-11-15']]],
 ['170','98553552',24,[['2026-11-21','ST AISLAN','2º SGT GEYDSON','2026-11-22'],['2026-11-22','2º SGT GEYDSON','ST AISLAN','2026-11-21']]],
 ['171','98562686',24,[['2026-11-20','SD SANTOS','SD PICCINI','2026-11-25'],['2026-11-25','SD PICCINI','SD SANTOS','2026-11-20']]],
 ['172','98563020',24,[['2026-12-06','SD SANTOS','SD PICCINI','2026-12-11'],['2026-12-11','SD PICCINI','SD SANTOS','2026-12-06']]],
 ['173','98563378',24,[['2026-12-14','SD SANTOS','SD PICCINI','2026-12-19'],['2026-12-19','SD PICCINI','SD SANTOS','2026-12-14']]],
 ['174','98563989',24,[['2026-12-22','SD SANTOS','SD PICCINI','2026-12-27'],['2026-12-27','SD PICCINI','SD SANTOS','2026-12-22']]],
 ['175','98565849',24,[['2026-12-30','SD SANTOS','SD PICCINI','2027-01-04'],['2027-01-04','SD PICCINI','SD SANTOS','2026-12-30']]]
];
const matches=(badge,number,sei,kind='ts')=>badge.kind===kind&&String(badge.troca?.numero).split(/\s*\/\s*/).includes(number)&&String(badge.troca?.sei).includes(sei);

test('22 autorizações ativas correspondem a 39 movimentos, com 153/154 unificadas e TS 157 removida',()=>{
 let count=0;
 for(const [number,sei,hours,legs] of documents)for(const [date,name,replaced,related,kind='ts'] of legs){
  const members=day(date).members.filter(member=>member.name===name);assert.equal(members.length,1,`${number} ${date} ${name}`);
  const badges=members[0].badges.filter(badge=>matches(badge,number,sei,kind));assert.equal(badges.length,1,`${number} ${date}`);
  assert.equal(badges[0].troca.substituido,replaced);assert.equal(badges[0].troca.data_servico_substituido,related);assert.equal(badges[0].hours||members[0].serviceHours||24,hours);count++;
 }
 assert.equal(documents.length,21);assert.equal(count,39);const hugo=day('2026-11-06').members.filter(member=>member.name==='SD HUGO');assert.equal(hugo.length,1);assert(hugo[0].badges.some(badge=>matches(badge,'154','97518560')));
});

test('TS 170 usa 21 e 22/11/2026, jornadas únicas de 24h e antiguidade própria, preservando chefia, cobertura e AC4',()=>{
 const {AC4Finance:finance,ServiceSimulation:simulation,ServiceChief:chief}=context.window;
 for(const [date,name,replaced,ord,leader]of [['2026-11-21','ST AISLAN','2º SGT GEYDSON',8,'ST OSVALDIR'],['2026-11-22','2º SGT GEYDSON','ST AISLAN',15,'ST DA SILVA']]){
  const input=day(date),members=input.members.filter(m=>m.name===name);assert.equal(members.length,1);assert(!input.members.some(m=>m.name===replaced));assert.equal(members[0].ord,ord);assert.equal(members[0].events.length,0);assert.equal(members[0].badges.length,1);assert(matches(members[0].badges[0],'170','98553552'));assert.equal(chief.select(input).assignments[0].name,leader);const resources=date==='2026-11-21'?6:7;assert.equal(simulation.coverage(input,date).resources,resources);assert.deepEqual(input.coverage,[`${resources} recursos de 24h`,'Meta de 6 recursos']);
 }
 const snapshot=JSON.stringify(data),baseline=structuredClone(data);for(const [number,name,ord]of [[21,'2º SGT GEYDSON',15],[22,'ST AISLAN',8]]){const member=baseline['2026-11'].days.find(d=>d.day===number).members.find(m=>m.badges.some(b=>b.troca?.numero==='170'));member.name=name;member.ord=ord;member.badges=[{kind:'ord',text:'ORDINÁRIO'}];member.notes=['Ordinário'];}
 for(const period of Object.keys(data))assert.equal(JSON.stringify(finance.month(data,period)),JSON.stringify(finance.month(baseline,period)));
 for(const target of [4,5,6,7,8]){const actual=simulation.plan(data,'2026-11',4584000,undefined,target),before=simulation.plan(baseline,'2026-11',4584000,undefined,target);assert.equal(actual.addedServices,before.addedServices);assert.equal(actual.summary.committedCents,before.summary.committedCents);for(const number of [21,22])assert.equal(JSON.stringify(actual.days.get(number)),JSON.stringify(before.days.get(number)));}
 const badges=Object.values(data).flatMap(s=>s.days.flatMap(d=>d.members.flatMap(m=>m.badges))).filter(b=>b.troca?.numero==='170');assert.equal(badges.length,2);assert(badges.every(b=>b.troca.data.startsWith('2026-11-')&&b.troca.data_servico_substituido.startsWith('2026-11-')));assert.equal(JSON.stringify(data),snapshot);
});

test('TS 157 permanece removida; a nova TS 171 rege 20 e 25/11 sem duplicar serviços ou cobertura',()=>{
 for(const [date,name,absent,ord,resources]of [['2026-11-20','SD SANTOS','SD PICCINI',28,6],['2026-11-25','SD PICCINI','SD SANTOS',27,5]]){
  const input=day(date),members=input.members.filter(m=>m.name===name);assert.equal(members.length,1);assert(!input.members.some(m=>m.name===absent));assert.equal(members[0].ord,ord);assert.equal(members[0].badges.length,1);assert(matches(members[0].badges[0],'171','98562686'));assert.deepEqual(members[0].notes,[`TS nº 171 (SEI 98562686). Substitui ${absent}.`]);assert.equal(members[0].events.length,0);assert.equal(context.window.ServiceSimulation.coverage(input,date).resources,resources);
 }
 for(const month of Object.values(data))for(const input of month.days)for(const member of [...input.members,...(input.sat?.members||[])]){assert(!member.badges.some(b=>String(b.troca?.numero)==='157'||String(b.troca?.sei)==='97544001'));assert(!member.notes.some(note=>/TS\s*n[º°o.]?\s*157\b|97544001/.test(note)));}
});

test('TS 166 é compensada em 30/11, com antiguidade correta e sem duplicar a TS 167',()=>{
 for(const [date,name,absent,ord] of [['2026-11-03','ST AISLAN','2º SGT SCHUSSLER',8],['2026-11-30','2º SGT SCHUSSLER','ST AISLAN',14]]){
  const members=day(date).members,member=members.find(member=>member.name===name);
  assert(!members.some(member=>member.name===absent));assert.equal(member.ord,ord);assert.equal(member.events.length,0);assert.equal(member.badges.length,1);assert.equal(member.badges[0].hours||24,24);assert.equal(member.badges[0].troca.numero,'166');
  assert.equal(context.window.ServiceChief.select(day(date)).assignments[0].name,date.endsWith('03')?'ST TAVARES':'ST DA SILVA');
 }
});

test('TS 159 passa para 16/12; AISLAN retorna em 26/11 e PROEBOM não vira troca',()=>{
 const seventeenth=day('2026-11-17'),november=day('2026-11-26'),december=day('2026-12-16');
 assert(!seventeenth.members.some(m=>m.badges.some(b=>b.troca?.numero==='159')));assert.equal(seventeenth.confirmation.status,'confirmed');
 assert(november.members.some(m=>m.name==='ST AISLAN'));assert(!november.members.some(m=>m.badges.some(b=>b.troca?.numero==='159')));assert(november.members.find(m=>m.name==='3º SGT HENRIQUE').events.every(e=>e.mode==='PROEBOM 2026'));
 assert(matches(december.members.find(m=>m.name==='3º SGT HENRIQUE').badges[0],'159','97553091'));assert(!december.members.some(m=>m.name==='ST AISLAN'));
 assert.equal(context.window.ServiceSimulation.coverage(seventeenth,'2026-11-17').resources,6);assert.equal(context.window.ServiceSimulation.coverage(november,'2026-11-26').resources,5);assert.equal(context.window.ServiceSimulation.coverage(december,'2026-12-16').resources,6);
});

test('TS 167 em 05/01 e TS 169 em 09/01 substituem AISLAN, sem pendência ou duplicação',()=>{
 const fifteenth=day('2026-11-15');assert(!fifteenth.members.some(member=>member.name==='2º SGT SCHUSSLER'));assert(matches(fifteenth.members.find(member=>member.name==='ST AISLAN').badges[0],'169','98279694'));assert.equal(fifteenth.confirmation.status,'confirmed');assert.equal(context.window.ServiceSimulation.coverage(fifteenth,'2026-11-15').resources,6);
 assert(!day('2027-01-01').members.some(m=>m.name==='2º SGT SCHUSSLER'));assert.equal(day('2027-01-01').alerts.length,0);
 for(const [date,number,sei,related]of [['2027-01-05','167','97933840','2026-11-07'],['2027-01-09','169','98279694','2026-11-15']]){
  const input=day(date),members=input.members.filter(m=>m.name==='2º SGT SCHUSSLER');assert.equal(members.length,1);const member=members[0];assert.equal(member.badges.length,1);assert(matches(member.badges[0],number,sei));assert(!member.badges[0].annotationOnly);assert(!member.badges[0].troca.contrapartida_pendente);assert.equal(member.badges[0].troca.data,date);assert.equal(member.badges[0].troca.data_servico_substituido,related);assert.equal(member.events.length,0);assert(!member.notes.some(n=>n.includes('PENDENTE')));assert(!input.members.some(m=>m.name==='ST AISLAN'));assert.equal(input.alerts.length,0);assert.equal(context.window.ServiceSimulation.coverage(input,date).resources,6);
 }
 for(const number of [7,15])assert(!day(`2026-11-${String(number).padStart(2,'0')}`).members.find(m=>m.name==='ST AISLAN').badges.some(b=>b.troca?.contrapartida_pendente));
 for(const date of ['2027-01-15','2027-01-20']){assert(!day(date).members.some(m=>m.name==='2º SGT SCHUSSLER'));assert.equal(day(date).alerts.length,0);}
});

test('TS 164 preserva os três militares e a cadeia de substituição em 29/11, sem duplicação',()=>{
 const entries=Object.entries(data).flatMap(([period,schedule])=>schedule.days.flatMap(day=>day.members.filter(member=>member.badges.some(badge=>matches(badge,'164','97705098'))).map(member=>({date:`${period}-${String(day.day).padStart(2,'0')}`,member}))));
 assert.equal(entries.length,3);assert.deepEqual(entries.map(entry=>entry.date),['2026-11-14','2026-11-29','2026-12-02']);
 const middle=entries[1].member;assert.equal(middle.name,'ST DA SILVA');assert.equal(middle.badges[0].troca.substituido_original,'ST PASSOS');assert(!day('2026-11-29').members.some(member=>member.name==='ST OSVALDIR'));
});

test('conferência das TS preserva a troca parcial 168, confirmações e totais reais/simulados',()=>{
 const {AC4Finance:finance,ServiceSimulation:simulation}=context.window,real=finance.month(data,'2026-11',4584000),plan=simulation.plan(data,'2026-11',4584000);
 assert.equal(real.records.length,102);assert.equal(real.committedCents,4162300);assert.equal(real.executedCents,1096600);assert.equal(plan.addedResources,4);assert.equal(plan.summary.committedCents,309100);
 assert.equal(data['2026-11'].days.filter(day=>day.confirmation?.status==='confirmed').length,25);
 for(const date of ['2026-11-08','2026-11-29']){const d=day(date),partial=d.members.filter(member=>member.serviceHours===12);assert.equal(partial.length,2);assert.equal(simulation.coverage(d,date).resources,date==='2026-11-29'?6:5);}
 assert(!data['2026-10']);
});
