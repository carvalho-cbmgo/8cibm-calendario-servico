const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],read=id=>JSON.parse(scripts.find(([,a])=>a.includes(`id="${id}"`))[2]),data=read('calendar-data'),rosters=read('ala-rosters'),context=vm.createContext({window:{}});
for(const name of ['AC4Finance','ServiceChief','ServiceSimulation','ServiceLookup'])vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,ServiceChief:chief,ServiceSimulation:simulation,ServiceLookup:lookup}=context.window,note='Empenhado na Operação do Goiás Alerta e Solidário (SEI 202600011013421) no período de 23/11/2026 a 27/11/2026.',day=number=>data['2026-11'].days.find(d=>d.day===number),plain=value=>JSON.parse(JSON.stringify(value));

test('afastamento cobre 23–27/11, com dispensa somente no serviço previsto de 24/11 e duas observações exatas',()=>{
 const away=rosters.absences.filter(a=>a.name==='SD PICCINI'&&a.sei==='202600011013421');assert.equal(away.length,1);assert.equal(away[0].start,'2026-11-23');assert.equal(away[0].end,'2026-11-27');
 for(const number of [23,25,26,27])assert(!day(number).members.some(m=>m.name==='SD PICCINI'));const members=day(24).members.filter(m=>m.name==='SD PICCINI');assert.equal(members.length,1);assert.equal(members[0].ord,27);assert.deepEqual(members[0].badges,[{kind:'disp',text:'DISP. OPERAÇÃO'}]);assert.deepEqual(members[0].notes,[note,'Dispensado do serviço.']);assert.equal(members[0].events.length,0);
 assert(day(20).members.find(m=>m.name==='SD PICCINI').badges.some(b=>b.kind==='ord'));assert(day(28).members.find(m=>m.name==='SD SANTOS').badges.some(b=>b.troca?.numero==='158'));assert.equal(day(25).members.find(m=>m.name==='SD SANTOS').badges[0].kind,'ord');
});

test('dispensa não conta como serviço trabalhado e mantém AC4, valores e chefia',()=>{
 const services=lookup.month(data,'2026-11');assert(!services.some(r=>r.member==='SD PICCINI'&&r.date==='2026-11-24'));assert(services.some(r=>r.member==='SD PICCINI'&&r.date==='2026-11-20'&&r.type==='ordinary'));
 const summary=finance.month(data,'2026-11',4560000);assert.equal(summary.records.length,87);assert.equal(summary.committedCents,3187200);assert.equal(summary.executedCents,1096600);assert.equal(summary.remainingCents,1372800);assert.equal(chief.select(day(24)).assignments[0].name,'ST PASSOS');assert.equal(simulation.coverage(day(24),'2026-11-24').resources,4);assert.deepEqual(day(24).coverage,['4 recursos de 24h','Faltam 2 recursos']);
});

test('simulação complementa o dia 24 com 24h e 12h, sem somar PICCINI ou alterar a escala real',()=>{
 const source=JSON.stringify(data),baseline=structuredClone(data),member=baseline['2026-11'].days.find(d=>d.day===24).members.find(m=>m.name==='SD PICCINI');member.badges=[{kind:'ord',text:'ORDINÁRIO'}];member.notes=['Ordinário'];
 for(const [target,delta]of [[4,0],[5,36000],[6,74100],[7,74100],[8,74100]]){const before=simulation.plan(baseline,'2026-11',4560000,undefined,target),after=simulation.plan(data,'2026-11',4560000,undefined,target);assert.equal(after.summary.committedCents-before.summary.committedCents,delta);for(const number of data['2026-11'].days.map(d=>d.day).filter(n=>n!==24))assert.deepEqual(plain(after.days.get(number)),plain(before.days.get(number)));}
 const plan=simulation.plan(data,'2026-11',4560000),events=plan.days.get(24).members.flatMap(m=>m.events);assert.equal(plan.addedResources,16);assert.equal(plan.addedServices,16);assert.equal(plan.summary.committedCents,1290900);assert.equal(plan.summary.daily.get('2026-11-24').committedCents,110100);assert.deepEqual(plain(events.map(e=>[e.start,e.end,e.hours,e.nextDay])),[['08h00','08h00',24,true],['08h00','20h00',12,false]]);assert.equal(JSON.stringify(data),source);
});
