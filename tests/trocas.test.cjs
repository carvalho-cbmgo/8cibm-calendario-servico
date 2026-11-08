const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);
const context=vm.createContext({window:{}});
for(const name of ['window.AC4Finance=','window.ServiceChief=','window.ServiceSimulation='])vm.runInContext(scripts.find(([,attrs,source])=>!attrs.includes('application/json')&&source.includes(name))[2],context);
const day=date=>data[date.slice(0,7)].days.find(day=>day.day===Number(date.slice(8)));
// Reference extracted from the 13 authorizations in the PDF supplied on 08/11/2026.
// Each leg is [date, final substitute, replaced member, date worked by the replaced member].
const documents=[
 ['153','97515824',24,[['2026-11-06','SD HUGO','SD MARTINS','2026-10-31']]],
 ['155','97542993',24,[['2026-11-05','SD PICCINI','SD SANTOS','2026-10-31']]],
 ['156','97543668',24,[['2026-11-08','SD SANTOS','SD PICCINI','2026-11-17'],['2026-11-17','SD PICCINI','SD SANTOS','2026-11-08']]],
 ['157','97544001',24,[['2026-11-20','SD SANTOS','SD PICCINI','2026-11-25'],['2026-11-25','SD PICCINI','SD SANTOS','2026-11-20']]],
 ['158','97544104',24,[['2026-11-28','SD SANTOS','SD PICCINI','2026-12-03'],['2026-12-03','SD PICCINI','SD SANTOS','2026-11-28']]],
 ['161','97703197',24,[['2026-11-05','ST OSVALDIR','ST PASSOS','2026-11-08'],['2026-11-08','ST PASSOS','ST OSVALDIR','2026-11-05']]],
 ['162','97704006',24,[['2026-11-13','ST OSVALDIR','ST PASSOS','2026-11-16'],['2026-11-16','ST PASSOS','ST OSVALDIR','2026-11-13']]],
 ['163','97704646',24,[['2026-11-21','ST OSVALDIR','ST PASSOS','2026-11-24'],['2026-11-24','ST PASSOS','ST OSVALDIR','2026-11-21']]],
 ['164','97705098',24,[['2026-11-14','ST OSVALDIR','ST DA SILVA','2026-11-29'],['2026-11-29','ST DA SILVA','ST OSVALDIR','2026-11-14'],['2026-12-02','ST PASSOS','ST OSVALDIR','2026-11-14']]],
 ['165','97705425',24,[['2026-12-07','ST OSVALDIR','ST PASSOS','2026-12-10'],['2026-12-10','ST PASSOS','ST OSVALDIR','2026-12-07']]],
 ['166','97832330',24,[['2026-11-03','ST AISLAN','2º SGT SCHUSSLER','2026-11-26'],['2026-11-26','2º SGT SCHUSSLER','ST AISLAN','2026-11-03']]],
 ['167','97933840',24,[['2026-11-07','ST AISLAN','2º SGT SCHUSSLER','2026-11-30'],['2026-11-30','2º SGT SCHUSSLER','ST AISLAN','2026-11-07']]],
 ['168','98135195',12,[['2026-11-08','2º SGT WANDERSON','3º SGT HENRIQUE','2026-11-29'],['2026-11-29','3º SGT HENRIQUE','2º SGT WANDERSON','2026-11-08']]]
];
const matches=(badge,number,sei)=>badge.kind==='ts'&&String(badge.troca?.numero).split(/\s*\/\s*/).includes(number)&&String(badge.troca?.sei).includes(sei);

test('13 autorizações do consolidado têm seus 25 serviços finais no período publicado, uma vez cada',()=>{
 let count=0;
 for(const [number,sei,hours,legs] of documents)for(const [date,name,replaced,related] of legs){
  const members=day(date).members.filter(member=>member.name===name);assert.equal(members.length,1,`${number} ${date} ${name}`);
  const badges=members[0].badges.filter(badge=>matches(badge,number,sei));assert.equal(badges.length,1,`${number} ${date}`);
  assert.equal(badges[0].troca.substituido,replaced);assert.equal(badges[0].troca.data_servico_substituido,related);assert.equal(badges[0].hours||members[0].serviceHours||24,hours);count++;
 }
 assert.equal(documents.length,13);assert.equal(count,25);
});

test('TS 167 substitui os titulares, com antiguidade correta e 24h, sem acrescentar AC4',()=>{
 for(const [date,name,absent,ord] of [['2026-11-07','ST AISLAN','2º SGT SCHUSSLER',8],['2026-11-30','2º SGT SCHUSSLER','ST AISLAN',14]]){
  const members=day(date).members,member=members.find(member=>member.name===name);
  assert(!members.some(member=>member.name===absent));assert.equal(member.ord,ord);assert.equal(member.events.length,0);assert.equal(member.badges.length,1);assert.equal(member.badges[0].hours,24);
  assert.equal(context.window.ServiceChief.select(day(date)).assignments[0].name,date.endsWith('07')?'ST TAVARES':'ST DA SILVA');
 }
});

test('TS 164 preserva os três militares e a cadeia de substituição em 29/11, sem duplicação',()=>{
 const entries=Object.entries(data).flatMap(([period,schedule])=>schedule.days.flatMap(day=>day.members.filter(member=>member.badges.some(badge=>matches(badge,'164','97705098'))).map(member=>({date:`${period}-${String(day.day).padStart(2,'0')}`,member}))));
 assert.equal(entries.length,3);assert.deepEqual(entries.map(entry=>entry.date),['2026-11-14','2026-11-29','2026-12-02']);
 const middle=entries[1].member;assert.equal(middle.name,'ST DA SILVA');assert.equal(middle.badges[0].troca.substituido_original,'ST PASSOS');assert(!day('2026-11-29').members.some(member=>member.name==='ST OSVALDIR'));
});

test('conferência das TS preserva a troca parcial 168, confirmações e totais reais/simulados',()=>{
 const {AC4Finance:finance,ServiceSimulation:simulation}=context.window,real=finance.month(data,'2026-11',4560000),plan=simulation.plan(data,'2026-11',4560000);
 assert.equal(real.records.length,40);assert.equal(real.committedCents,1459200);assert.equal(real.executedCents,1096600);assert.equal(plan.addedResources,25);assert.equal(plan.summary.committedCents,2154300);
 assert.equal(data['2026-11'].days.filter(day=>day.confirmation?.status==='confirmed').length,11);
 for(const date of ['2026-11-08','2026-11-29']){const d=day(date),partial=d.members.filter(member=>member.serviceHours===12);assert.equal(partial.length,2);assert.equal(simulation.coverage(d,date).resources,5);}
 assert(!data['2026-10']);
});
