const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],read=id=>JSON.parse(scripts.find(s=>s[1].includes(`id="${id}"`))[2]),data=read('calendar-data'),ctx=vm.createContext({window:{}});
for(const name of ['AC4Finance','ServiceChief','ServiceSimulation','ServiceLookup'])vm.runInContext(scripts.find(s=>!s[1].includes('application/json')&&s[2].includes(`window.${name}=`))[2],ctx);
const {AC4Finance:f,ServiceChief:c,ServiceSimulation:sim,ServiceLookup:lookup}=ctx.window,plain=x=>JSON.parse(JSON.stringify(x)),day=(s,date)=>s[date.slice(0,7)].days.find(d=>d.day===+date.slice(8));
const legs=[['2026-12-13','3º SGT JORGE','ST DA SILVA',19,5,'176','98654384','2026-12-20','ST DA SILVA',4],['2026-12-20','ST DA SILVA','3º SGT JORGE',5,19,'176','98654384','2026-12-13','ST AISLAN',6],['2026-12-28','ST DA SILVA','ST PASSOS',5,6,'177','98760346','2027-01-24','ST PASSOS',6],['2027-01-24','ST PASSOS','ST DA SILVA',6,5,'177','98760346','2026-12-28','ST DA SILVA',5]];

test('TS 176 e 177 têm quatro substituições de 24h, referências recíprocas e chefia pela antiguidade',()=>{
 for(const[date,replaced,name,,ord,number,sei,related,chief,resources]of legs){
  const d=day(data,date),members=d.members.filter(m=>m.name===name);assert.equal(members.length,1);assert(!d.members.some(m=>m.name===replaced));const m=members[0];assert.equal(m.ord,ord);assert.equal(m.events.length,0);assert.equal(m.badges.length,1);assert.deepEqual(plain(m.badges[0].troca),{numero:number,sei,data:date,substituido:replaced,data_servico_substituido:related});assert.equal(m.badges[0].hours,24);assert.equal(m.badges[0].kind,'ts');assert.equal(c.select(d).assignments[0].name,chief);assert.equal(sim.coverage(d,date).resources,resources);
  const rows=lookup.month(data,date.slice(0,7)).filter(r=>r.member===name&&r.date===date&&r.type==='ordinary');assert.equal(rows.length,1);assert.equal(rows[0].minutes,1440);assert.equal(rows[0].start,'08h00');assert.equal(rows[0].end,'08h00');assert(rows[0].labels.includes('TS'));
 }
});

test('LUIZ ANTONIO tem dois AC4 noturnos previstos de 12h, sem herdar exclusões de outros serviços',()=>{
 const s=f.month(data,'2026-12',3800000);
 for(const[date,end,cost]of [['2026-12-01','2026-12-02',38100],['2026-12-03','2026-12-04',41100]]){
  const rows=s.serviceRecords.filter(r=>r.event.serviceId===`ac4-operacional-luiz-antonio-${date}-20h`);assert.equal(rows.length,1);const r=rows[0];assert.equal(r.member,'2º SGT LUIZ ANTONIO');assert.equal(r.start,'20h00');assert.equal(r.end,'08h00');assert.equal(r.startDate,date);assert.equal(r.endDate,end);assert.equal(r.minutes,720);assert.equal(r.costCents,cost);assert.equal(r.status,'forecast');assert.equal(r.event.excludeFromSimulation,undefined);assert.equal(r.event.executionConfirmed,undefined);assert.deepEqual(plain(f.documentInfo(r.event)),{number:'',sei:''});
 }
 assert.equal(s.records.length,20);assert.equal(s.committedCents,764100);assert.equal(s.remainingCents,3035900);assert.equal(s.executedCents,0);
 const plan=sim.plan(data,'2026-12',3800000);assert.equal(plan.addedServices,30);assert.equal(plan.summary.committedCents,1977700);assert.equal(plan.days.get(1).addedServices,0);assert.equal(plan.days.get(3).coverage.resources,4);
});

test('somente os dois AC4, quatro trocas e cobertura derivada mudam; novembro e os demais registros são preservados',()=>{
 const before=structuredClone(data);for(const date of ['2026-12-01','2026-12-03'])day(before,date).members=day(before,date).members.filter(m=>m.name!=='2º SGT LUIZ ANTONIO');day(before,'2026-12-01').coverage=['5 recursos de 24h','Faltam 1 recurso'];
 for(const[date,replaced,name,ord]of legs){const d=day(before,date);d.members[d.members.findIndex(m=>m.name===name)]={name:replaced,badges:[{kind:'ord',text:'ORDINÁRIO'}],notes:['Ordinário'],events:[],ord};}
 assert.equal(createHash('sha256').update(JSON.stringify(before)).digest('hex'),'675d569ec157285e56c24afe28abe238284232cd587e1f003852bb19f510665f');
 for(const period of Object.keys(data)){const a=f.month(data,period),b=f.month(before,period);assert.equal(a.committedCents-b.committedCents,period==='2026-12'?79200:0);assert.equal(a.executedCents,b.executedCents);assert.equal(a.satCents,b.satCents);assert.equal(JSON.stringify(read('ac4-financial-config').monthlyQuotaCents),JSON.stringify({'2026-11':4584000,'2026-12':3800000}));}
});
