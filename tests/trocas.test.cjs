const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);
const context=vm.createContext({window:{}});
for(const name of ['window.AC4Finance=','window.ServiceChief=','window.ServiceSimulation='])vm.runInContext(scripts.find(([,attrs,source])=>!attrs.includes('application/json')&&source.includes(name))[2],context);
const day=date=>data[date.slice(0,7)].days.find(day=>day.day===Number(date.slice(8)));
// Current consolidations supplied on 12/11: 17 authorizations, with TS 153/154 sharing one service.
// Each leg is [date, final substitute, replaced member, date worked by the replaced member].
const documents=[
 ['153','97515824',24,[['2026-11-06','SD HUGO','SD MARTINS','2026-10-31']]],
 ['155','97542993',24,[['2026-11-05','SD PICCINI','SD SANTOS','2026-10-31']]],
 ['156','97543668',24,[['2026-11-08','SD SANTOS','SD PICCINI','2026-11-17'],['2026-11-17','SD PICCINI','SD SANTOS','2026-11-08']]],
 ['157','97544001',24,[['2026-11-20','SD SANTOS','SD PICCINI','2026-11-25'],['2026-11-25','SD PICCINI','SD SANTOS','2026-11-20']]],
 ['158','97544104',24,[['2026-11-28','SD SANTOS','SD PICCINI','2026-12-03'],['2026-12-03','SD PICCINI','SD SANTOS','2026-11-28']]],
 ['159','97553091',24,[['2026-11-26','3º SGT HENRIQUE','ST AISLAN','2026-10-31']]],
 ['160','97660634',24,[['2026-11-06','ST TAVARES','ST AISLAN','2026-10-30']]],
 ['161','97703197',24,[['2026-11-05','ST OSVALDIR','ST PASSOS','2026-11-08'],['2026-11-08','ST PASSOS','ST OSVALDIR','2026-11-05']]],
 ['162','97704006',24,[['2026-11-13','ST OSVALDIR','ST PASSOS','2026-11-16'],['2026-11-16','ST PASSOS','ST OSVALDIR','2026-11-13']]],
 ['163','97704646',24,[['2026-11-21','ST OSVALDIR','ST PASSOS','2026-11-24'],['2026-11-24','ST PASSOS','ST OSVALDIR','2026-11-21']]],
 ['164','97705098',24,[['2026-11-14','ST OSVALDIR','ST DA SILVA','2026-11-29'],['2026-11-29','ST DA SILVA','ST OSVALDIR','2026-11-14'],['2026-12-02','ST PASSOS','ST OSVALDIR','2026-11-14']]],
 ['165','97705425',24,[['2026-12-07','ST OSVALDIR','ST PASSOS','2026-12-10'],['2026-12-10','ST PASSOS','ST OSVALDIR','2026-12-07']]],
 ['166','97832330',24,[['2026-11-03','ST AISLAN','2º SGT SCHUSSLER','2026-11-30'],['2026-11-30','2º SGT SCHUSSLER','ST AISLAN','2026-11-03']]],
 ['167','97933840',24,[['2026-11-07','ST AISLAN','2º SGT SCHUSSLER','2027-01-15'],['2027-01-15','2º SGT SCHUSSLER','ST AISLAN','2026-11-07','review']]],
 ['168','98135195',12,[['2026-11-08','2º SGT WANDERSON','3º SGT HENRIQUE','2026-11-29'],['2026-11-29','3º SGT HENRIQUE','2º SGT WANDERSON','2026-11-08']]],
 ['169','98279694',24,[['2026-11-15','ST AISLAN','2º SGT SCHUSSLER','2027-01-20'],['2027-01-20','2º SGT SCHUSSLER','ST AISLAN','2026-11-15','review']]]
];
const matches=(badge,number,sei,kind='ts')=>badge.kind===kind&&String(badge.troca?.numero).split(/\s*\/\s*/).includes(number)&&String(badge.troca?.sei).includes(sei);

test('17 autorizações correspondem a 29 movimentos no período, com 153/154 unificadas e janeiro pendente',()=>{
 let count=0;
 for(const [number,sei,hours,legs] of documents)for(const [date,name,replaced,related,kind='ts'] of legs){
  const members=day(date).members.filter(member=>member.name===name);assert.equal(members.length,1,`${number} ${date} ${name}`);
  const badges=members[0].badges.filter(badge=>matches(badge,number,sei,kind));assert.equal(badges.length,1,`${number} ${date}`);
  assert.equal(badges[0].troca.substituido,replaced);assert.equal(badges[0].troca.data_servico_substituido,related);assert.equal(badges[0].hours||members[0].serviceHours||24,hours);count++;
 }
 assert.equal(documents.length,16);assert.equal(count,29);const hugo=day('2026-11-06').members.filter(member=>member.name==='SD HUGO');assert.equal(hugo.length,1);assert(hugo[0].badges.some(badge=>matches(badge,'154','97518560')));
});

test('TS 166 é compensada em 30/11, com antiguidade correta e sem duplicar a TS 167',()=>{
 for(const [date,name,absent,ord] of [['2026-11-03','ST AISLAN','2º SGT SCHUSSLER',8],['2026-11-30','2º SGT SCHUSSLER','ST AISLAN',14]]){
  const members=day(date).members,member=members.find(member=>member.name===name);
  assert(!members.some(member=>member.name===absent));assert.equal(member.ord,ord);assert.equal(member.events.length,0);assert.equal(member.badges.length,1);assert.equal(member.badges[0].hours||24,24);assert.equal(member.badges[0].troca.numero,'166');
  assert.equal(context.window.ServiceChief.select(day(date)).assignments[0].name,date.endsWith('03')?'ST TAVARES':'ST DA SILVA');
 }
});

test('TS 159 é aplicada em 26/11 e a referência indevida de 17/11 é removida',()=>{
 const seventeenth=day('2026-11-17'),twentysixth=day('2026-11-26');assert(!seventeenth.members.some(member=>['ST AISLAN','3º SGT HENRIQUE'].includes(member.name)));assert(!seventeenth.alerts.some(message=>message.includes('159')));assert.equal(seventeenth.confirmation.status,'confirmed');
 const member=twentysixth.members.find(member=>member.name==='3º SGT HENRIQUE');assert(matches(member.badges[0],'159','97553091'));assert(!twentysixth.members.some(member=>['ST AISLAN','2º SGT SCHUSSLER'].includes(member.name)));assert.equal(context.window.ServiceSimulation.coverage(seventeenth,'2026-11-17').resources,6);assert.equal(context.window.ServiceSimulation.coverage(twentysixth,'2026-11-26').resources,5);
});

test('TS 169 substitui SCHUSSLER em 15/11; as duas contrapartidas de janeiro não aumentam o efetivo',()=>{
 const fifteenth=day('2026-11-15');assert(!fifteenth.members.some(member=>member.name==='2º SGT SCHUSSLER'));assert(matches(fifteenth.members.find(member=>member.name==='ST AISLAN').badges[0],'169','98279694'));assert.equal(fifteenth.confirmation.status,'confirmed');assert.equal(context.window.ServiceSimulation.coverage(fifteenth,'2026-11-15').resources,6);
 for(const date of ['2027-01-15','2027-01-20']){const input=day(date),members=input.members.filter(member=>member.name==='2º SGT SCHUSSLER');assert.equal(members.length,1);assert.equal(members[0].badges[0].kind,'review');assert(members[0].notes.some(note=>note.includes('PENDENTE')));assert(input.alerts.length);assert.equal(context.window.ServiceSimulation.coverage(input,date).resources,5);assert.equal(members[0].events.length,0);}
});

test('TS 164 preserva os três militares e a cadeia de substituição em 29/11, sem duplicação',()=>{
 const entries=Object.entries(data).flatMap(([period,schedule])=>schedule.days.flatMap(day=>day.members.filter(member=>member.badges.some(badge=>matches(badge,'164','97705098'))).map(member=>({date:`${period}-${String(day.day).padStart(2,'0')}`,member}))));
 assert.equal(entries.length,3);assert.deepEqual(entries.map(entry=>entry.date),['2026-11-14','2026-11-29','2026-12-02']);
 const middle=entries[1].member;assert.equal(middle.name,'ST DA SILVA');assert.equal(middle.badges[0].troca.substituido_original,'ST PASSOS');assert(!day('2026-11-29').members.some(member=>member.name==='ST OSVALDIR'));
});

test('conferência das TS preserva a troca parcial 168, confirmações e totais reais/simulados',()=>{
 const {AC4Finance:finance,ServiceSimulation:simulation}=context.window,real=finance.month(data,'2026-11',4560000),plan=simulation.plan(data,'2026-11',4560000);
 assert.equal(real.records.length,56);assert.equal(real.committedCents,2460200);assert.equal(real.executedCents,1096600);assert.equal(plan.addedResources,16);assert.equal(plan.summary.committedCents,1290900);
 assert.equal(data['2026-11'].days.filter(day=>day.confirmation?.status==='confirmed').length,18);
 for(const date of ['2026-11-08','2026-11-29']){const d=day(date),partial=d.members.filter(member=>member.serviceHours===12);assert.equal(partial.length,2);assert.equal(simulation.coverage(d,date).resources,5);}
 assert(!data['2026-10']);
});
