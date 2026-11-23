const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],data=JSON.parse(scripts.find(([,a])=>a.includes('id="calendar-data"'))[2]),context=vm.createContext({window:{}});
for(const name of ['AC4Finance','ServiceChief','ServiceSimulation','ServiceLookup'])vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,ServiceSimulation:simulation,ServiceChief:chief,ServiceLookup:lookup}=context.window;
const isAnalysis=e=>e?.serviceId?.startsWith('ac4-analise-projetos-'),plain=value=>JSON.parse(JSON.stringify(value));
const baseline=()=>{const copy=structuredClone(data);for(const day of copy['2026-11'].days)if(day.sat)day.sat.members=day.sat.members.map(m=>({...m,events:m.events.filter(e=>!isAnalysis(e))})).filter(m=>m.badges.length||m.events.length);return copy;};

test('três AC4 de análise de projetos têm datas, oficiais e jornadas de 12h sem confirmação presumida',()=>{
 const summary=finance.month(data,'2026-11',4584000),records=summary.records.filter(r=>isAnalysis(r.event));
 assert.equal(records.length,3);assert.equal(new Set(records.map(r=>r.key)).size,3);assert.deepEqual(plain(records.map(r=>[r.startDate,r.member])),[['2026-11-20','ASP OF CARVALHO'],['2026-11-28','ASP OF CARVALHO'],['2026-11-29','ASP OF BESSA']]);
 for(const record of records){assert.equal(record.start,'08h00');assert.equal(record.end,'20h00');assert.equal(record.endDate,record.startDate);assert.equal(record.minutes,720);assert.equal(record.event.hours,12);assert.equal(record.event.nextDay,false);assert.equal(record.category,'sat');assert.equal(record.event.activity,'Análise de Projetos');assert.equal(record.event.integrante_operacional,false);assert.equal(record.status,'forecast');assert(!record.event.executionConfirmed);assert.deepEqual(plain(finance.documentInfo(record.event)),{number:'',sei:''});assert.equal(record.costCents,48000);}
});

test('análise soma 36h/R$ 1.440 na SAT, com acumulados inclusivos e Operacional/execuções preservados',()=>{
 const summary=finance.month(data,'2026-11',4584000),before=finance.month(baseline(),'2026-11',4584000);
 assert.equal(summary.records.length,102);assert.equal(summary.committedCents,4162300);assert.equal(summary.satCents,907000);assert.equal(summary.operationalCents,3255300);assert.equal(summary.executedCents,1096600);assert.equal(summary.forecastCents,3065700);assert.equal(summary.remainingCents,421700);
 assert.equal(summary.committedCents-before.committedCents,144000);assert.equal(summary.satCents-before.satCents,144000);assert.equal(summary.operationalCents,before.operationalCents);assert.equal(summary.executedCents,before.executedCents);
 for(const [date,added]of [['2026-11-19',0],['2026-11-20',48000],['2026-11-27',48000],['2026-11-28',96000],['2026-11-29',144000],['2026-11-30',144000]])assert.equal(finance.asOf(summary,date).committedCents-finance.asOf(before,date).committedCents,added);
});

test('novos AC4 não alteram recursos, intervalos, chefia ou reforços simulados para nenhuma meta',()=>{
 const original=JSON.stringify(data),before=baseline();
 for(const target of [4,5,6,7,8]){
  const actual=simulation.plan(data,'2026-11',4584000,undefined,target),expected=simulation.plan(before,'2026-11',4584000,undefined,target);
  assert.equal(actual.addedResources,expected.addedResources);assert.equal(actual.addedServices,expected.addedServices);assert.equal(actual.summary.committedCents,expected.summary.committedCents);
  for(const day of data['2026-11'].days){const date=`2026-11-${String(day.day).padStart(2,'0')}`,old=before['2026-11'].days.find(d=>d.day===day.day);assert.deepEqual(plain(simulation.coverage(day,date)),plain(simulation.coverage(old,date)));assert.deepEqual(plain(chief.select(day)),plain(chief.select(old)));}
 }
 const plan=simulation.plan(data,'2026-11',4584000);for(const [day,count]of [[20,0],[28,2],[29,0]])assert.equal(plan.days.get(day).addedResources,count);assert.equal(plan.addedResources,4);assert.equal(plan.summary.committedCents,309100);assert.equal(JSON.stringify(data),original);
});

test('modalidade de análise nunca fornece cobertura, mesmo em linha operacional com indicação conflitante',()=>{
 const ordinary=Array.from({length:5},(_,i)=>({name:`ST TESTE ${i}`,badges:[{kind:'ord'}],events:[],notes:[]}));
 for(const mode of ['ANÁLISE DE PROJETOS','ANALISE DE PROJETOS'])for(const integrante_operacional of [false,true]){
  const input={'2026-11':{days:[{day:20,members:[...ordinary,{name:'ASP OF TESTE',badges:[],notes:[],events:[{mode,integrante_operacional,start:'08h00',end:'20h00',hours:12,status:'planned'}]}]}]}};
  const summary=finance.month(input,'2026-11');assert.equal(summary.satCents,48000);assert.equal(summary.operationalCents,0);const plan=simulation.plan(input,'2026-11');assert.equal(plan.days.get(20).members.length,1);assert.equal(plan.days.get(20).members[0].events[0].hours,24);assert(plan.days.get(20).coverage.segments.every(s=>s.resources===5));
 }
});

test('consulta e ranking incluem os três serviços sem duplicar turnos, respeitando o filtro de oficiais',()=>{
 const records=lookup.month(data,'2026-11').filter(r=>isAnalysis(r.event));assert.equal(records.length,3);assert(records.every(r=>r.type==='ac4'&&r.activity==='Análise de Projetos'&&r.area==='sat'));
 const summary=finance.month(data,'2026-11'),personnel=JSON.parse(scripts.find(([,a])=>a.includes('id="ranking-personnel"'))[2]),options={startDate:'2026-11-20',endDate:'2026-11-29',personnel};
 const included=finance.ranking(summary,'2026-11-29',true,{...options,includeOfficers:true}),excluded=finance.ranking(summary,'2026-11-29',true,{...options,includeOfficers:false});assert.equal(included.totalCents-excluded.totalCents,144000);
 for(const [name,total,count]of [['ASP OF CARVALHO',96000,2],['ASP OF BESSA',48000,1]]){const p=included.rows.find(p=>p.member===name);assert.equal(p.satCents,total);assert.equal(p.records.filter(r=>isAnalysis(r.event)).length,count);}
 const holiday=data['2026-11'].days.find(d=>d.day===20).sat;assert.equal(holiday.expedientStatus,'holiday');assert(holiday.members.every(m=>m.badges.length===0));
});
