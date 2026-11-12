const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],context=vm.createContext({window:{}});
for(const name of ['AC4Finance','ServiceSimulation'])vm.runInContext(scripts.find(([,attrs,source])=>!attrs.includes('application/json')&&source.includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,ServiceSimulation:simulation}=context.window;
const plain=value=>JSON.parse(JSON.stringify(value)),ordinary=count=>Array.from({length:count},(_,index)=>({name:`ST TESTE ${index}`,badges:[{kind:'ord'}],notes:[],events:[]}));
const source=members=>({'2026-11':{days:[{day:12,members}]}}),custom=(day,night,members=ordinary(5))=>simulation.plan(source(members),'2026-11',4560000,undefined,6,{4:{day,night}});
const shifts=day=>plain(day.members.map(member=>[member.events[0].start,member.events[0].end,member.events[0].hours]));
const data=()=>JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);

test('meta somente diurna acrescenta dois AC4 de 12h e preserva o efetivo noturno cadastrado',()=>{
 const plan=custom(7,4),day=plan.days.get(12);assert.deepEqual(shifts(day),[['08h00','20h00',12],['08h00','20h00',12]]);assert.equal(plan.summary.committedCents,72000);assert.equal(day.dayResources,7);assert.equal(day.nightResources,5);assert.equal(day.addedResources,0);assert.equal(day.addedServices,2);
});

test('meta somente noturna não transforma três militares de 12h em três recursos de 24h',()=>{
 const plan=custom(4,8),day=plan.days.get(12);assert.deepEqual(shifts(day),Array.from({length:3},()=>['20h00','08h00',12]));assert.equal(day.dayResources,5);assert.equal(day.nightResources,8);assert.equal(day.addedResources,0);assert.equal(day.addedServices,3);assert.equal(plan.summary.committedCents,123300);assert(plan.summary.records.every(record=>record.endDate==='2026-11-13'));
});

test('metas diferentes combinam o reforço comum de 24h com complementos noturnos',()=>{
 const plan=custom(6,8),day=plan.days.get(12);assert.deepEqual(shifts(day),[['08h00','08h00',24],['20h00','08h00',12],['20h00','08h00',12]]);assert.equal(day.dayResources,6);assert.equal(day.nightResources,8);assert.equal(day.addedResources,1);assert.equal(day.addedServices,3);assert.equal(plan.summary.committedCents,159300);
});

test('a noite usa a regra do dia inicial e os dias desmarcados usam a meta geral',()=>{
 const input={'2026-11':{days:[20,21,23].map(day=>({day,members:ordinary(5)}))}},plan=simulation.plan(input,'2026-11',4560000,undefined,6,{5:{day:5,night:7},6:{day:8,night:4}});
 assert.deepEqual(shifts(plan.days.get(20)),[['20h00','08h00',12],['20h00','08h00',12]]);assert.equal(plan.summary.daily.get('2026-11-20').committedCents,103000);assert(plan.days.get(20).members.every(member=>member.events[0].endDate==='2026-11-21'));
 assert.deepEqual(shifts(plan.days.get(21)),Array.from({length:3},()=>['08h00','20h00',12]));assert.equal(plan.summary.daily.get('2026-11-21').committedCents,144000);assert.deepEqual(shifts(plan.days.get(23)),[['08h00','08h00',24]]);assert.equal(plan.summary.committedCents,321100);
});

test('todas as combinações de 4 a 8 respeitam as metas por turno, as confirmações e os dados reais',()=>{
 const input=data(),before=JSON.stringify(input);
 for(const period of Object.keys(input))for(let dayTarget=4;dayTarget<=8;dayTarget++)for(let nightTarget=4;nightTarget<=8;nightTarget++){
  const rules=Object.fromEntries(Array.from({length:7},(_,weekday)=>[weekday,{day:dayTarget,night:nightTarget}])),plan=simulation.plan(input,period,null,undefined,6,rules);
  for(const day of input[period].days){
   const date=`${period}-${String(day.day).padStart(2,'0')}`,planned=plan.days.get(day.day),combined=simulation.coverage({...day,members:[...day.members,...planned.members]},date);
   for(const segment of combined.segments){const previous=planned.coverage.segments.find(part=>part.start<=segment.start&&part.end>=segment.end),clock=(combined.anchor+segment.start)%1440,target=clock>=480&&clock<1200?dayTarget:nightTarget;assert(previous);assert.equal(segment.resources,day.confirmation?.status==='confirmed'?previous.resources:Math.max(previous.resources,target),`${date} ${dayTarget}/${nightTarget}`);}
   assert.equal(planned.addedResources,combined.resources-planned.coverage.resources);if(day.confirmation?.status==='confirmed')assert.equal(planned.addedServices,0);
  }
 }
 assert.equal(JSON.stringify(input),before);
});

test('metas iguais nos dois turnos reproduzem a regra uniforme nos três meses cadastrados',()=>{
 const input=data(),rules=Object.fromEntries(Array.from({length:7},(_,day)=>[day,{day:7,night:7}]));
 for(const period of Object.keys(input)){const uniform=simulation.plan(input,period,null,undefined,7),personalized=simulation.plan(input,period,null,undefined,6,rules);assert.equal(personalized.summary.committedCents,uniform.summary.committedCents);assert.deepEqual(plain([...personalized.days].map(([day,value])=>[day,value.members])),plain([...uniform.days].map(([day,value])=>[day,value.members])));}
});

test('regras inválidas são rejeitadas e as configurações são copiadas sem alterar o chamador',()=>{
 for(const rules of [null,[],{'7':{day:6,night:6}},{'SEX':{day:6,night:6}},{4:{day:9,night:6}},{4:{day:6,night:3}},{4:{day:'6',night:6}},{4:{day:6}}])assert.throws(()=>simulation.plan(source(ordinary(5)),'2026-11',null,undefined,6,rules),/Regras|personalizado/);
 const rules={4:{day:5,night:8}},plan=simulation.plan(source(ordinary(5)),'2026-11',null,undefined,6,rules);rules[4].night=4;assert.equal(plan.rules[4].night,8);assert.equal(plan.days.get(12).targets.night,8);
});

test('cancelar um AC4 cadastrado recalcula os reforços personalizados sem duplicar cobertura',()=>{
 const event={serviceId:'teste-noturno',mode:'OPERACIONAL/SOP',start:'20h00',end:'08h00',nextDay:true,hours:12,status:'planned'},input=source([...ordinary(5),{name:'SGT NOTURNO TESTE',badges:[],notes:[],events:[event]}]),rules={4:{day:7,night:8}};
 let plan=simulation.plan(input,'2026-11',null,undefined,6,rules);assert.deepEqual(shifts(plan.days.get(12)),[['08h00','08h00',24],['08h00','08h00',24]]);event.cancelled=true;
 plan=simulation.plan(input,'2026-11',null,undefined,6,rules);assert.deepEqual(shifts(plan.days.get(12)),[['08h00','08h00',24],['08h00','08h00',24],['20h00','08h00',12]]);assert.equal(plan.days.get(12).dayResources,7);assert.equal(plan.days.get(12).nightResources,8);
});
