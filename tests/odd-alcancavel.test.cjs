const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],data=JSON.parse(scripts.find(([,a])=>a.includes('id="calendar-data"'))[2]),context=vm.createContext({window:{}});
for(const name of ['ReachableOfficer','AC4Finance','ServiceChief','ServiceSimulation'])vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,ServiceChief:chief,ServiceSimulation:simulation}=context.window,plain=value=>JSON.parse(JSON.stringify(value));
const rotation=context.window.ReachableOfficer,config=JSON.parse(scripts.find(([,a])=>a.includes('id="odd-alcancavel-config"'))[2]),rosters=JSON.parse(scripts.find(([,a])=>a.includes('id="ala-rosters"'))[2]);rotation.apply(data,config,rosters.absences);
const isOfficer=member=>member.badges.some(b=>b.kind==='officer'),selected=day=>day.day>=16&&day.day<=29;

test('ODD alcançável cobre os 14 dias inclusivos: Carvalho 16–22 e Bessa 23–29, sem duplicação',()=>{
 const days=data['2026-11'].days.filter(selected);assert.equal(days.length,14);
 for(const day of days){const officers=day.members.filter(isOfficer),name=day.day<=22?'ASP OF CARVALHO':'ASP OF BESSA';assert.equal(officers.length,1);assert.equal(officers[0].name,name);assert.equal(officers[0].ord,day.day<=22?3:2);assert.equal(officers[0].events.length,0);assert.equal(officers[0].badges.length,1);assert.equal(officers[0].badges[0].text,'OFICIAL DE DIA');assert.equal(day.members.filter(m=>m.name===name).length,1);}
 assert.equal(data['2026-11'].days.find(day=>day.day===15).members.find(isOfficer).name,'ASP OF BESSA');assert.equal(data['2026-11'].days.find(day=>day.day===30).members.find(isOfficer).name,'ASP OF CARVALHO');
});

test('alternância segue segunda a domingo, cruza meses/ano e alcança novas competências',()=>{
 for(const [date,name]of [['2026-11-01','ASP OF BESSA'],['2026-11-02','ASP OF CARVALHO'],['2026-11-09','ASP OF BESSA'],['2026-11-30','ASP OF CARVALHO'],['2026-12-06','ASP OF CARVALHO'],['2026-12-07','ASP OF BESSA'],['2026-12-14','ASP OF CARVALHO'],['2026-12-21','ASP OF BESSA'],['2026-12-28','ASP OF CARVALHO'],['2027-01-03','ASP OF CARVALHO'],['2027-01-04','ASP OF BESSA'],['2027-01-11','ASP OF CARVALHO'],['2027-01-18','ASP OF BESSA'],['2027-01-25','ASP OF CARVALHO']]){
  const duty=rotation.resolve(date,config);assert.equal(duty.assigned,name,date);assert.equal(new Date(duty.weekStart+'T00:00:00Z').getUTCDay(),1);assert.equal(new Date(duty.weekEnd+'T00:00:00Z').getUTCDay(),0);const day=data[date.slice(0,7)].days.find(d=>d.day===Number(date.slice(8)));assert.equal(day.members.find(isOfficer).name,name);
 }
 const future={'2027-02':{days:[{day:1,members:[],alerts:[]}]}};rotation.apply(future,config);assert.equal(future['2027-02'].days[0].members[0].name,'ASP OF BESSA');assert(!future['2027-03']);
});

test('afastamento parcial usa limites inclusivos e retorno imediato sem deslocar a sequência',()=>{
 const absences=[{name:'ASP OF CARVALHO',type:'Férias',start:'2026-11-18',end:'2026-11-20'}];
 for(const [date,name,status]of [['2026-11-17','ASP OF CARVALHO','assigned'],['2026-11-18','ASP OF BESSA','substitute'],['2026-11-20','ASP OF BESSA','substitute'],['2026-11-21','ASP OF CARVALHO','assigned'],['2026-11-23','ASP OF BESSA','assigned']]){const duty=rotation.resolve(date,config,absences);assert.equal(duty.assigned,name);assert.equal(duty.status,status);}
 const full=[{name:'ASP OF BESSA',type:'Licença',start:'2026-12-07',end:'2026-12-13'}];assert.equal(rotation.resolve('2026-12-07',config,full).assigned,'ASP OF CARVALHO');assert.equal(rotation.resolve('2026-12-13',config,full).assigned,'ASP OF CARVALHO');assert.equal(rotation.resolve('2026-12-14',config,full).nominal,'ASP OF CARVALHO');
 const crossYear=[{name:'ASP OF CARVALHO',type:'Férias',start:'2026-12-30',end:'2027-01-02'}];for(const date of ['2026-12-30','2027-01-02'])assert.equal(rotation.resolve(date,config,crossYear).assigned,'ASP OF BESSA');assert.equal(rotation.resolve('2027-01-03',config,crossYear).assigned,'ASP OF CARVALHO');
});

test('dois afastamentos deixam ODD pendente somente na sobreposição e preservam AC4',()=>{
 const source=structuredClone(data),absences=[{name:'ASP OF CARVALHO',type:'Férias',start:'2026-11-18',end:'2026-11-20'},{name:'ASP OF BESSA',type:'Férias',start:'2026-11-19',end:'2026-11-21'}],before=finance.month(source,'2026-11',4584000);rotation.apply(source,config,absences);
 for(const number of [19,20]){const day=source['2026-11'].days.find(d=>d.day===number);assert(!day.members.some(isOfficer));assert.equal(day.alerts.filter(a=>a.startsWith('ODD Alcançável:')).length,1);assert.equal(rotation.resolve(`2026-11-${number}`,config,absences).status,'pending');}
 assert.equal(source['2026-11'].days.find(d=>d.day===18).members.find(isOfficer).name,'ASP OF BESSA');assert.equal(source['2026-11'].days.find(d=>d.day===21).members.find(isOfficer).name,'ASP OF CARVALHO');assert.deepEqual(plain(finance.month(source,'2026-11',4584000).records),plain(before.records));
 rotation.apply(source,config,[]);for(const number of [19,20]){const day=source['2026-11'].days.find(d=>d.day===number);assert.equal(day.members.find(isOfficer).name,'ASP OF CARVALHO');assert(!day.alerts.some(a=>a.startsWith('ODD Alcançável:')));}
});

test('aplicação é idempotente e a substituição não cria AC4, recursos ou chefia',()=>{
 const source=structuredClone(data),absences=[{name:'ASP OF CARVALHO',type:'Férias',start:'2026-11-16',end:'2026-11-22'}],before=finance.month(source,'2026-11',4584000),plans=[4,6,8].map(target=>simulation.plan(source,'2026-11',4584000,undefined,target));rotation.apply(source,config,absences);const once=JSON.stringify(source);rotation.apply(source,config,absences);assert.equal(JSON.stringify(source),once);
 const day=source['2026-11'].days.find(d=>d.day===20);assert.equal(day.members.find(isOfficer).name,'ASP OF BESSA');assert(day.members.find(isOfficer).notes.some(note=>note.includes('ASP OF CARVALHO')&&note.includes('Férias')));assert.deepEqual(plain(finance.month(source,'2026-11',4584000).records),plain(before.records));
 for(const [index,target]of [4,6,8].entries()){const actual=simulation.plan(source,'2026-11',4584000,undefined,target);assert.equal(actual.addedServices,plans[index].addedServices);assert.equal(actual.summary.committedCents,plans[index].summary.committedCents);}
 assert.deepEqual(plain(chief.select(day)),plain(chief.select(data['2026-11'].days.find(d=>d.day===20))));
});

test('afastamentos cancelados e de outros militares não alteram a escala; dados inválidos não deixam alterações parciais',()=>{
 const absences=[{name:'ASP OF CARVALHO',start:'2026-11-16',end:'2026-11-22',cancelled:true},{name:'ASP OF BESSA',start:'2026-11-16',end:'2026-11-29',active:false},{name:'ST TESTE',start:'2026-11-16',end:'2026-11-29'}];assert.equal(rotation.resolve('2026-11-16',config,absences).assigned,'ASP OF CARVALHO');assert.equal(rotation.resolve('2026-11-23',config,absences).assigned,'ASP OF BESSA');
 for(const range of [{start:'2026-11-31',end:'2026-12-01'},{start:'2026-11-20',end:'2026-11-19'}]){const copy=structuredClone(data),before=JSON.stringify(copy);assert.throws(()=>rotation.apply(copy,config,[{name:'ASP OF CARVALHO',...range}]),/Data inválida|término/);assert.equal(JSON.stringify(copy),before);}
 assert.throws(()=>rotation.resolve('2026-11-31',config),/Data inválida/);assert.throws(()=>rotation.resolve('2026-11-16',{...config,anchorMonday:'2026-11-17'}),/segunda-feira/);
});

test('ODD não altera chefia, cobertura, reforços simulados, finanças ou confirmações',()=>{
 const before=structuredClone(data),source=JSON.stringify(data);for(const day of before['2026-11'].days.filter(selected))day.members=day.members.filter(m=>!isOfficer(m));
 for(const day of data['2026-11'].days.filter(selected)){const old=before['2026-11'].days.find(d=>d.day===day.day),date=`2026-11-${day.day}`;assert.deepEqual(plain(chief.select(day)),plain(chief.select(old)));assert.deepEqual(plain(simulation.coverage(day,date)),plain(simulation.coverage(old,date)));assert.deepEqual(day.confirmation,old.confirmation);}
 for(const target of [4,5,6,7,8]){const actual=simulation.plan(data,'2026-11',4584000,undefined,target),expected=simulation.plan(before,'2026-11',4584000,undefined,target);assert.equal(actual.addedResources,expected.addedResources);assert.equal(actual.addedServices,expected.addedServices);assert.equal(actual.summary.committedCents,expected.summary.committedCents);}
 const real=finance.month(data,'2026-11',4584000),original=finance.month(before,'2026-11',4584000);assert.deepEqual(plain(real.records),plain(original.records));assert.equal(real.records.length,108);assert.equal(real.committedCents,4583000);assert.equal(real.remainingCents,1000);assert.equal(real.executedCents,1096600);assert.equal(JSON.stringify(data),source);
});

test('ODD e AC4 de análise permanecem separados por área, inclusive quando são do mesmo oficial',()=>{
 for(const [number,odd,analysis]of [[20,'ASP OF CARVALHO','ASP OF CARVALHO'],[28,'ASP OF BESSA','ASP OF CARVALHO'],[29,'ASP OF BESSA','ASP OF BESSA']]){
  const day=data['2026-11'].days.find(d=>d.day===number),officer=day.members.find(isOfficer),sat=day.sat.members.filter(m=>m.name===analysis);assert.equal(officer.name,odd);assert.equal(officer.events.length,0);assert.equal(sat.length,1);assert.equal(sat[0].badges.length,0);assert.equal(sat[0].events.length,1);assert.equal(sat[0].events[0].activity,'Análise de Projetos');assert.equal(sat[0].events[0].hours,12);assert.equal(sat[0].events[0].integrante_operacional,false);
 }
});
