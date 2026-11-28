const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],data=JSON.parse(scripts.find(s=>s[1].includes('id="calendar-data"'))[2]),ctx=vm.createContext({window:{}});
for(const n of ['AC4Finance','ServiceChief','ServiceSimulation','ServiceLookup'])vm.runInContext(scripts.find(s=>!s[1].includes('application/json')&&s[2].includes(`window.${n}=`))[2],ctx);
const {AC4Finance:f,ServiceChief:chief,ServiceSimulation:sim,ServiceLookup:lookup}=ctx.window,plain=x=>JSON.parse(JSON.stringify(x));
const expected=[['2º SGT LUIZ ANTONIO','luiz-antonio',16,[1,3,8,10,15,17,22,29],[2,4],[24,31]],['2º SGT MAURO','mauro',12,[7,9,14,16,21,23,28,30],[1,3],[2]]];
const existing=new Set(['ac4-operacional-luiz-antonio-2026-12-01-20h','ac4-operacional-luiz-antonio-2026-12-03-20h']);
const newIds=new Set(expected.flatMap(([,key,,days])=>days.map(day=>`ac4-operacional-${key}-2026-12-${String(day).padStart(2,'0')}-20h`)).filter(id=>!existing.has(id)));

test('plantões noturnos seguem os dias da semana e exceções, sem duplicação de 01 e 03/12',()=>{
 const summary=f.month(data,'2026-12',3800000);
 for(const[name,key,ord,days,weekdays,exceptions]of expected){
  const records=summary.serviceRecords.filter(r=>r.member===name&&r.start==='20h00');assert.equal(records.length,8);assert.deepEqual(plain(records.map(r=>+r.startDate.slice(8)).sort((a,b)=>a-b)),days);
  for(const r of records){const day=+r.startDate.slice(8),source=data['2026-12'].days.find(d=>d.day===day),member=source.members.filter(m=>m.name===name);assert.equal(member.length,1);assert.equal(member[0].ord,ord);assert(weekdays.includes(new Date(r.startDate+'T00:00:00Z').getUTCDay()));assert(!exceptions.includes(day));assert.equal(r.event.serviceId,`ac4-operacional-${key}-${r.startDate}-20h`);assert.equal(r.start,'20h00');assert.equal(r.end,'08h00');assert.equal(r.endDate,new Date(Date.UTC(2026,11,day+1)).toISOString().slice(0,10));assert.equal(r.minutes,720);assert.equal(r.event.hours,12);assert.equal(r.event.nextDay,true);assert.equal(r.status,'forecast');assert.equal(r.event.executionConfirmed,undefined);assert.equal(r.event.excludeFromSimulation,undefined);assert.equal(r.category,'operational');assert.deepEqual(plain(f.documentInfo(r.event)),{number:'',sei:''});}
 }
 const luiz=lookup.month(data,'2026-12').filter(r=>r.member==='2º SGT LUIZ ANTONIO'&&r.type==='ac4');assert.equal(luiz.length,9);assert.equal(luiz.filter(r=>r.date==='2026-12-06'&&r.start==='08h00'&&r.event.excludeFromSimulation===true).length,1);
});

test('horas individuais, cota, execução e reforços são recalculados pelas regras existentes',()=>{
 const s=f.month(data,'2026-12',3800000),rank=f.ranking(s,'2026-11-28',true,{startDate:'2026-12-01',endDate:'2026-12-31'});
 for(const[name,minutes,total,remaining]of [['2º SGT LUIZ ANTONIO',6480,361800,5040],['2º SGT MAURO',5760,304800,5760]]){const row=rank.rows.find(r=>r.member===name);assert.equal(row.monthlyMinutes,minutes);assert.equal(row.totalCents,total);assert.equal(row.remainingMinutes,remaining);assert.equal(row.monthlyLimitMinutes,11520);}
 assert.equal(s.records.length,20);assert.equal(s.committedCents,764100);assert.equal(s.forecastCents,764100);assert.equal(s.executedCents,0);assert.equal(s.remainingCents,3035900);assert.equal(s.satCents,0);const plan=sim.plan(data,'2026-12',3800000);assert.equal(plan.addedServices,30);assert.equal(plan.summary.committedCents,1977700);
});

test('somente 14 inclusões alteram o calendário, preservando todas as jornadas anteriores e os outros meses',()=>{
 const before=structuredClone(data);assert.equal(newIds.size,14);for(const day of before['2026-12'].days){for(const m of day.members)m.events=m.events.filter(e=>!newIds.has(e.serviceId));day.members=day.members.filter(m=>m.events.length||m.badges.length);}
 assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'),'9f1db40707f45f926360fea3e2c1b1c58e82e36a636a73f6b3b1fcacca7f9a6b');
 for(const period of ['2026-11','2027-01'])assert.equal(JSON.stringify(f.month(data,period)),JSON.stringify(f.month(before,period)));
 for(const day of data['2026-12'].days){const old=before['2026-12'].days.find(d=>d.day===day.day),date='2026-12-'+String(day.day).padStart(2,'0');assert.deepEqual(plain(chief.select(day)),plain(chief.select(old)));assert.equal(sim.coverage(day,date).resources,sim.coverage(old,date).resources);}
});
