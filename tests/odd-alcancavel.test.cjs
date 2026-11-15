const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],data=JSON.parse(scripts.find(([,a])=>a.includes('id="calendar-data"'))[2]),context=vm.createContext({window:{}});
for(const name of ['AC4Finance','ServiceChief','ServiceSimulation'])vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,ServiceChief:chief,ServiceSimulation:simulation}=context.window,plain=value=>JSON.parse(JSON.stringify(value));
const isOfficer=member=>member.badges.some(b=>b.kind==='officer'),selected=day=>day.day>=16&&day.day<=29;

test('ODD alcançável cobre os 14 dias inclusivos: Carvalho 16–22 e Bessa 23–29, sem duplicação',()=>{
 const days=data['2026-11'].days.filter(selected);assert.equal(days.length,14);
 for(const day of days){const officers=day.members.filter(isOfficer),name=day.day<=22?'ASP OF CARVALHO':'ASP OF BESSA';assert.equal(officers.length,1);assert.equal(officers[0].name,name);assert.equal(officers[0].ord,day.day<=22?3:2);assert.equal(officers[0].events.length,0);assert.equal(officers[0].badges.length,1);assert.equal(officers[0].badges[0].text,'OFICIAL DE DIA');assert.equal(day.members.filter(m=>m.name===name).length,1);}
 assert.equal(data['2026-11'].days.find(day=>day.day===15).members.find(isOfficer).name,'ASP OF BESSA');assert(!data['2026-11'].days.find(day=>day.day===30).members.some(isOfficer));
});

test('ODD não altera chefia, cobertura, reforços simulados, finanças ou confirmações',()=>{
 const before=structuredClone(data),source=JSON.stringify(data);for(const day of before['2026-11'].days.filter(selected))day.members=day.members.filter(m=>!isOfficer(m));
 for(const day of data['2026-11'].days.filter(selected)){const old=before['2026-11'].days.find(d=>d.day===day.day),date=`2026-11-${day.day}`;assert.deepEqual(plain(chief.select(day)),plain(chief.select(old)));assert.deepEqual(plain(simulation.coverage(day,date)),plain(simulation.coverage(old,date)));assert.deepEqual(day.confirmation,old.confirmation);}
 for(const target of [4,5,6,7,8]){const actual=simulation.plan(data,'2026-11',4560000,undefined,target),expected=simulation.plan(before,'2026-11',4560000,undefined,target);assert.equal(actual.addedResources,expected.addedResources);assert.equal(actual.addedServices,expected.addedServices);assert.equal(actual.summary.committedCents,expected.summary.committedCents);}
 const real=finance.month(data,'2026-11',4560000),original=finance.month(before,'2026-11',4560000);assert.deepEqual(plain(real.records),plain(original.records));assert.equal(real.records.length,70);assert.equal(real.committedCents,2808200);assert.equal(real.remainingCents,1751800);assert.equal(real.executedCents,1096600);assert.equal(JSON.stringify(data),source);
});

test('ODD e AC4 de análise permanecem separados por área, inclusive quando são do mesmo oficial',()=>{
 for(const [number,odd,analysis]of [[20,'ASP OF CARVALHO','ASP OF CARVALHO'],[28,'ASP OF BESSA','ASP OF CARVALHO'],[29,'ASP OF BESSA','ASP OF BESSA']]){
  const day=data['2026-11'].days.find(d=>d.day===number),officer=day.members.find(isOfficer),sat=day.sat.members.filter(m=>m.name===analysis);assert.equal(officer.name,odd);assert.equal(officer.events.length,0);assert.equal(sat.length,1);assert.equal(sat[0].badges.length,0);assert.equal(sat[0].events.length,1);assert.equal(sat[0].events[0].activity,'Análise de Projetos');assert.equal(sat[0].events[0].hours,12);assert.equal(sat[0].events[0].integrante_operacional,false);
 }
});
