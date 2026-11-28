const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],read=id=>JSON.parse(scripts.find(s=>s[1].includes(`id="${id}"`))[2]),data=read('calendar-data'),config=read('ac4-financial-config'),ctx=vm.createContext({window:{}});
for(const name of ['AC4Finance','ServiceChief','ServiceSimulation','ServiceLookup'])vm.runInContext(scripts.find(s=>!s[1].includes('application/json')&&s[2].includes(`window.${name}=`))[2],ctx);
const {AC4Finance:f,ServiceChief:chief,ServiceSimulation:sim,ServiceLookup:lookup}=ctx.window,plain=x=>JSON.parse(JSON.stringify(x)),days=data['2026-12'].days,summary=()=>f.month(data,'2026-12',config.monthlyQuotaCents['2026-12']);
const expected=[
 [1,'3º SGT ROBERTO','Protocolo','08h00','12h00',4,12000],
 [2,'2º SGT WANDERSON','Vistoria','08h00','18h00',10,30000],
 [2,'3º SGT BERTONCELLO','Vistoria','13h00','18h00',5,15000],
 [2,'3º SGT ROBERTO','Protocolo','08h00','12h00',4,12000],
 [3,'3º SGT BERTONCELLO','Vistoria','13h00','18h00',5,15000],
 [3,'3º SGT ROBERTO','Protocolo','08h00','12h00',4,12000],
 [4,'2º SGT WANDERSON','Vistoria','08h00','18h00',10,40000],
 [4,'3º SGT ROBERTO','Protocolo','08h00','12h00',4,16000],
];
const previous=()=>{const copy=structuredClone(data);for(const d of copy['2026-12'].days){if(d.day<=4)delete d.sat;if(d.day<=2)delete d.confirmation;}return copy;};

test('as duas imagens correspondem a oito AC4 SAT/46h de 01 a 04/12, sem duplicar 30/11 ou o PSE contínuo',()=>{
 const s=summary(),records=s.records.filter(r=>r.category==='sat');assert.equal(records.length,8);assert.equal(new Set(records.map(r=>r.key)).size,8);assert.equal(records.reduce((sum,r)=>sum+r.minutes,0),46*60);assert.equal(records.reduce((sum,r)=>sum+r.costCents,0),152000);
 for(const[number,name,activity,start,end,hours,cost]of expected){const date=`2026-12-${String(number).padStart(2,'0')}`,rows=records.filter(r=>r.member===name&&r.startDate===date);assert.equal(rows.length,1);const r=rows[0];assert.equal(r.event.mode,'SAT');assert.equal(r.event.activity,activity);assert.equal(r.start,start);assert.equal(r.end,end);assert.equal(r.endDate,date);assert.equal(r.minutes,hours*60);assert.equal(r.event.hours,hours);assert.equal(r.event.nextDay,false);assert.equal(r.costCents,cost);assert.equal(r.status,'forecast');assert.equal(r.event.executionConfirmed,undefined);assert.deepEqual(plain(f.documentInfo(r.event)),{number:'',sei:''});assert(r.event.serviceId.startsWith('ac4-sat-01a04dez-'));}
 const nov=f.month(data,'2026-11',4584000),last=nov.records.filter(r=>r.startDate==='2026-11-30'&&r.category==='sat');assert.equal(last.length,3);assert.equal(last.reduce((sum,r)=>sum+r.costCents,0),57000);assert.equal(nov.committedCents,4583000);
});

test('oito ordinários vespertinos ficam separados do AC4: ROBERTO na Vistoria e VALÉRIA no Protocolo',()=>{
 const rows=lookup.month(data,'2026-12').filter(r=>r.area==='sat'&&r.type==='ordinary');assert.equal(rows.length,8);
 for(const number of [1,2,3,4]){const d=days.find(d=>d.day===number);assert.equal(d.sat.ordinaryStatus,'informed');assert.equal(d.sat.members.flatMap(m=>m.badges).length,2);for(const[name,activity]of [['3º SGT ROBERTO','Vistoria'],['3º SGT VALÉRIA','Protocolo']]){const m=d.sat.members.find(m=>m.name===name);assert.deepEqual(m.badges,[{kind:'ord',text:'ORDINÁRIO',hours:5,start:'13h00',end:'18h00',activity}]);const matches=rows.filter(r=>r.member===name&&+r.date.slice(8)===number);assert.equal(matches.length,1);assert.equal(matches[0].minutes,300);assert.equal(matches[0].start,'13h00');assert.equal(matches[0].end,'18h00');assert.equal(matches[0].activity,activity);}}
 const ac4=lookup.month(data,'2026-12').filter(r=>r.area==='sat'&&r.type==='ac4');assert.equal(ac4.length,8);assert.equal(ac4.filter(r=>r.member==='3º SGT VALÉRIA').length,0);
});

test('confirmações de 01 e 02/12 têm escopo de calendário; os demais registros, tarifas e cotas são preservados',()=>{
 for(const d of days){if(d.day<=2)assert.deepEqual(d.confirmation,{status:'confirmed',date:'2026-11-28',source:'user',scope:'calendar',previousAlerts:[]});else assert.equal(d.confirmation,undefined);}
 const before=previous();assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'),'2e2c284b1e6b8283d8188f452dbc055e22ac8e448751076627c52d5c40248034');assert.deepEqual(config.monthlyQuotaCents,{'2026-11':4584000,'2026-12':3800000});
 for(const period of ['2026-11','2027-01'])assert.equal(JSON.stringify(f.month(data,period)),JSON.stringify(f.month(before,period)));
 for(const d of days){const b=before['2026-12'].days.find(x=>x.day===d.day),date=`2026-12-${String(d.day).padStart(2,'0')}`;assert.deepEqual(plain(chief.select(d)),plain(chief.select(b)));assert.deepEqual(plain(sim.coverage(d,date)),plain(sim.coverage(b,date)));}
});

test('SAT acrescenta R$ 1.520, mantém execução e Operacional e aparece uma vez na consulta e no ranking',()=>{
 const s=summary(),old=f.month(previous(),'2026-12',3800000),rank=f.ranking(s,'2026-11-28',true,{startDate:'2026-12-01',endDate:'2026-12-31'});assert.equal(s.records.length,28);assert.equal(s.invalidCount,0);assert.equal(s.duplicateCount,0);assert.equal(s.committedCents,916100);assert.equal(s.committedCents-old.committedCents,152000);assert.equal(s.satCents,152000);assert.equal(s.operationalCents,old.operationalCents);assert.equal(s.operationalCents,764100);assert.equal(s.forecastCents,916100);assert.equal(s.executedCents,0);assert.equal(s.remainingCents,2883900);
 for(const[name,count,minutes,cost]of [['3º SGT ROBERTO',4,960,52000],['2º SGT WANDERSON',2,1200,70000],['3º SGT BERTONCELLO',2,600,30000]]){const p=rank.rows.find(r=>r.member===name);assert.equal(p.records.length,count);assert.equal(p.monthlyMinutes,minutes);assert.equal(p.totalCents,cost);assert.equal(p.monthlyLimitMinutes,11520);}
 for(const[number,increment]of [[1,12000],[2,57000],[3,27000],[4,56000]]){const date=`2026-12-${String(number).padStart(2,'0')}`;assert.equal(s.daily.get(date).committedCents-old.daily.get(date).committedCents,increment);}
});

test('dias confirmados ficam sem reforço simulado; SAT não fornece cobertura operacional em nenhuma meta',()=>{
 const noSAT=structuredClone(data);for(const d of noSAT['2026-12'].days)if(d.day<=4)delete d.sat;const source=JSON.stringify(data);
 for(let target=4;target<=8;target++){const actual=sim.plan(data,'2026-12',3800000,undefined,target),other=sim.plan(noSAT,'2026-12',3800000,undefined,target);assert.equal(actual.addedServices,other.addedServices);assert.equal(actual.summary.committedCents,other.summary.committedCents);for(const number of [1,2])assert.equal(actual.days.get(number).addedServices,0);}
 const plan=sim.plan(data,'2026-12',3800000),old=sim.plan(previous(),'2026-12',3800000);assert.equal(plan.addedServices,29);assert.equal(plan.summary.committedCents,1939600);assert.equal(old.addedServices-plan.addedServices,1);assert.equal(old.summary.committedCents-plan.summary.committedCents,38100);assert.equal(JSON.stringify(data),source);
});
