const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]),context=vm.createContext({window:{}});
for(const name of ['window.AC4Finance=','window.ServiceChief=','window.ServiceSimulation='])vm.runInContext(scripts.find(([,attrs,source])=>!attrs.includes('application/json')&&source.includes(name))[2],context);
const day=date=>data[date.slice(0,7)]?.days.find(day=>day.day===Number(date.slice(8)));
// Seven authorizations from the consolidated PDF, plus SEI 98254182 supplied on 10/11.
const documents=[
 ['97586670','2º SGT DIEGO','2026-11-02','2026-11-05'],
 ['97587098','2º SGT DIEGO','2026-11-18','2026-11-11'],
 ['97587323','2º SGT DIEGO','2026-11-14','2026-11-27'],
 ['97654793','3º SGT JORGE','2026-10-30','2026-11-06'],
 ['97766395','SD CAVALCANTE','2026-11-03','2026-11-10'],
 ['97922344','2º SGT DIEGO','2026-11-22','2026-11-29'],
 ['97939827','ST OSVALDIR','2026-11-28','2026-12-05'],
 ['98254182','3º SGT HENRIQUE','2026-11-20','2026-11-13']
];

test('oito autorizações da companhia têm suas 15 movimentações publicadas, sem duplicação',()=>{
 let count=0;
 for(const [sei,name,dispensa,pagamento] of documents)for(const [date,kind] of [[dispensa,'disp'],[pagamento,'pay']]){
  const input=day(date);if(!input)continue;
  const matches=input.members.filter(member=>member.name===name&&member.badges.some(badge=>badge.kind===kind&&badge.troca?.sei===sei));assert.equal(matches.length,1,`${sei} ${date}`);
  const badge=matches[0].badges.find(badge=>badge.kind===kind&&badge.troca?.sei===sei);assert.equal(badge.hours,24);assert.equal(badge.troca.dispensa,dispensa);assert.equal(badge.troca.pagamento,pagamento);assert.equal(badge.troca.numero,null);assert(badge.text.startsWith('TS CIA'));count++;
 }
 assert.equal(count,15);
});

test('HENRIQUE paga 24h na Delta em 13/11 e fica dispensado na Charlie em 20/11',()=>{
 const {ServiceChief:chief,ServiceSimulation:simulation}=context.window,plan=simulation.plan(data,'2026-11',4560000);
 for(const [date,kind,ala,resources,reinforcements] of [['2026-11-13','pay','DELTA',5,1],['2026-11-20','disp','CHARLIE',4,2]]){
  const input=day(date),members=input.members.filter(member=>member.name==='3º SGT HENRIQUE');assert.equal(members.length,1);assert.equal(input.ala,ala);assert(!input.confirmation);assert.equal(members[0].ord,22);
  assert.equal(members[0].badges.length,1);assert.equal(members[0].badges[0].kind,kind);assert.equal(members[0].events.length,0);assert.equal(simulation.coverage(input,date).resources,resources);assert.equal(parseInt(input.coverage[0]),resources);
  assert.equal(plan.days.get(Number(date.slice(8))).addedServices,reinforcements);assert.equal(chief.select(input).assignments[0].name,'ST OSVALDIR');
 }
 assert.equal(day('2026-11-13').members.find(member=>member.name==='SD SANTOS').badges[0].text,'DISP. RECOMPENSA');assert.equal(day('2026-11-13').members.find(member=>member.name==='SD PICCINI').events[0].hours,24);
});

test('OSVALDIR fica dispensado em 28/11 e paga em 05/12, com cobertura e chefia coerentes',()=>{
 const {ServiceChief:chief,ServiceSimulation:simulation}=context.window;
 for(const [date,kind,resources,name] of [['2026-11-28','disp',4,'1º SGT NIKHOLAS'],['2026-12-05','pay',6,'ST OSVALDIR']]){
  const input=day(date),members=input.members.filter(member=>member.name==='ST OSVALDIR');assert.equal(members.length,1);assert.equal(members[0].badges.length,1);assert.equal(members[0].badges[0].kind,kind);assert.equal(members[0].events.length,0);assert.equal(members[0].ord,4);
  assert.equal(simulation.coverage(input,date).resources,resources);assert.equal(parseInt(input.coverage[0]),resources);assert.equal(chief.select(input).assignments[0].name,name);
 }
 assert.equal(day('2026-12-05').members[0].name,'ST OSVALDIR');assert.equal(day('2026-11-28').coverage[1],'Faltam 2 recursos');
});

test('trocas e férias canceladas preservam os AC4 reais e atualizam a necessidade simulada',()=>{
 const {AC4Finance:finance,ServiceSimulation:simulation}=context.window,real=finance.month(data,'2026-11',4560000),november=simulation.plan(data,'2026-11',4560000),december=simulation.plan(data,'2026-12'),january=simulation.plan(data,'2027-01');
 assert.equal(real.records.length,45);assert.equal(real.committedCents,1658700);assert.equal(real.executedCents,1096600);assert.equal(real.remainingCents,2901300);
 assert.equal(november.addedResources,26);assert.equal(november.summary.committedCents,2054300);assert.equal(november.days.get(28).addedResources,2);assert.equal(real.committedCents+november.summary.committedCents,3713000);
 assert.equal(december.addedResources,24);assert.equal(december.summary.committedCents,1987600);assert.equal(december.days.get(5).addedResources,0);assert.equal(december.summary.quotaCents,null);
 assert.equal(january.addedResources,23);assert.equal(january.summary.committedCents,1980700);assert.equal(data['2026-11'].days.filter(day=>day.confirmation?.status==='confirmed').length,11);
});

test('as datas históricas não migram para outro ano e o pagamento de DIEGO não aparece em 19/11',()=>{
 const entries=Object.entries(data).flatMap(([period,schedule])=>schedule.days.flatMap(day=>day.members.flatMap(member=>member.badges.filter(badge=>badge.troca?.sei==='97939827').map(()=>`${period}-${String(day.day).padStart(2,'0')}`))));
 assert.deepEqual(entries,['2026-11-28','2026-12-05']);assert(!data['2026-10']);assert(!data['2026-01']);
 assert(!day('2026-11-19').members.some(member=>member.name==='2º SGT DIEGO'&&member.badges.some(badge=>badge.kind==='pay')));
});
