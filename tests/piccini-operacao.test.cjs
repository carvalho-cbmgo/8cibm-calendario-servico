const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],read=id=>JSON.parse(scripts.find(([,a])=>a.includes(`id="${id}"`))[2]),data=read('calendar-data'),rosters=read('ala-rosters'),context=vm.createContext({window:{}});
for(const name of ['AC4Finance','ServiceChief','ServiceSimulation','ServiceLookup'])vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,ServiceChief:chief,ServiceSimulation:simulation,ServiceLookup:lookup}=context.window,day=number=>data['2026-11'].days.find(d=>d.day===number),plain=value=>JSON.parse(JSON.stringify(value));

test('operação de PICCINI desconsiderada: sem afastamento, dispensa ou observações e ordinário restaurado em 24/11',()=>{
 assert(!rosters.absences.some(a=>a.name==='SD PICCINI'&&a.sei==='202600011013421'));
 assert(!JSON.stringify(data).includes('202600011013421'));
 const members=day(24).members.filter(m=>m.name==='SD PICCINI');assert.equal(members.length,1);assert.equal(members[0].ord,27);assert.deepEqual(members[0].badges,[{kind:'ord',text:'ORDINÁRIO'}]);assert.deepEqual(members[0].notes,['Ordinário']);assert.equal(members[0].events.length,0);
 for(const number of [23,26,27])assert(!day(number).members.some(m=>m.name==='SD PICCINI'));
 assert.equal(day(25).members.find(m=>m.name==='SD PICCINI').badges[0].troca.numero,'171');assert(day(28).members.find(m=>m.name==='SD SANTOS').badges.some(b=>b.troca?.numero==='158'));
});

test('consulta volta a contar 24/11 e a TS 171 de 25/11; AC4, finanças e chefia preservados',()=>{
 const services=lookup.month(data,'2026-11');for(const date of ['2026-11-24','2026-11-25'])assert.equal(services.filter(r=>r.member==='SD PICCINI'&&r.date===date&&r.type==='ordinary').length,1);assert(!services.some(r=>r.member==='SD PICCINI'&&r.date==='2026-11-20'));
 const summary=finance.month(data,'2026-11',4560000);assert.equal(summary.records.length,89);assert.equal(summary.committedCents,3211200);assert.equal(summary.executedCents,1096600);assert.equal(summary.remainingCents,1348800);assert.equal(chief.select(day(24)).assignments[0].name,'ST PASSOS');assert.equal(simulation.coverage(day(24),'2026-11-24').resources,5);assert.deepEqual(day(24).coverage,['5 recursos de 24h','Faltam 1 recurso']);
});

test('retorno de PICCINI elimina somente o reforço integral de 24/11; complemento diurno segue necessário',()=>{
 const source=JSON.stringify(data),away=structuredClone(data),member=away['2026-11'].days.find(d=>d.day===24).members.find(m=>m.name==='SD PICCINI');member.badges=[{kind:'disp',text:'DISP. OPERAÇÃO'}];member.notes=['Dispensado do serviço.'];
 for(const [target,delta]of [[4,0],[5,36000],[6,74100],[7,74100],[8,74100]]){const before=simulation.plan(away,'2026-11',4560000,undefined,target),after=simulation.plan(data,'2026-11',4560000,undefined,target);assert.equal(before.summary.committedCents-after.summary.committedCents,delta);for(const number of data['2026-11'].days.map(d=>d.day).filter(n=>n!==24))assert.deepEqual(plain(after.days.get(number)),plain(before.days.get(number)));}
 const plan=simulation.plan(data,'2026-11',4560000),events=plan.days.get(24).members.flatMap(m=>m.events);assert.equal(plan.addedResources,15);assert.equal(plan.addedServices,15);assert.equal(plan.summary.committedCents,1219800);assert.equal(plan.summary.daily.get('2026-11-24').committedCents,36000);assert.deepEqual(plain(events.map(e=>[e.start,e.end,e.hours,e.nextDay])),[['08h00','20h00',12,false]]);assert.equal(JSON.stringify(data),source);
});
