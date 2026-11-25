const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],data=JSON.parse(scripts.find(([,a])=>a.includes('id="calendar-data"'))[2]);
const context=vm.createContext({window:{}});for(const name of ['AC4Finance','ServiceLookup'])vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes(`window.${name}=`))[2],context);
const {ServiceLookup:lookup,AC4Finance:finance}=context.window,plain=value=>JSON.parse(JSON.stringify(value));
const member=(name,badges,events=[],extra={})=>({name,badges,events,notes:[],...extra});
const ac4=extra=>({mode:'SAT',start:'08h00',end:'18h00',hours:10,...extra});

test('consulta inclui ordinário, TS, TS CIA de pagamento, oficial e compensação; exclui dispensa e pendência',()=>{
 const members=[member('SD TESTE',[{kind:'ord'},{kind:'ts',troca:{numero:'1'}}]),member('SD PAGO',[{kind:'pay'}]),member('SD DISPENSADO',[{kind:'ord'},{kind:'disp'}]),member('SD PENDENTE',[{kind:'ord'},{kind:'review'}]),member('ASP OF TESTE',[{kind:'officer'}]),member('SD AFASTADO',[{kind:'ord'}],[],{afastado:true})];
 const input={'2026-11':{days:[{day:1,ala:'ALPHA',members,sat:{members:[member('SD SAT',[{kind:'compensation',start:'08h00',end:'12h00',hours:4,activity:'Vistoria'}])]}}]}};
 const rows=lookup.month(input,'2026-11');assert.equal(rows.length,4);assert(!rows.some(r=>/DISPENSADO|PENDENTE|AFASTADO/.test(r.member)));
 const ordinary=rows.find(r=>r.member==='SD TESTE');assert.deepEqual(plain(ordinary.labels),['TS']);assert.equal(ordinary.start,'08h00');assert.equal(ordinary.endDate,'2026-11-02');assert.equal(ordinary.minutes,1440);
 assert.deepEqual(plain(rows.find(r=>r.member==='SD PAGO').labels),['TS CIA · Pagamento']);assert.equal(rows.find(r=>r.member==='SD SAT').minutes,240);
});

test('períodos parciais da TS 168 e ordinários da SAT preservam os horários complementares',()=>{
 const rows=lookup.month(data,'2026-11');
 for(const day of ['2026-11-08','2026-11-29']){
  const partial=rows.filter(r=>r.date===day&&r.type==='ordinary'&&/WANDERSON|HENRIQUE/.test(r.member));assert.equal(partial.length,2);assert(partial.every(r=>r.minutes===720));assert.deepEqual(plain(partial.map(r=>[r.start,r.end])),[['08h00','20h00'],['20h00','08h00']]);
 }
 const sat=rows.find(r=>r.date==='2026-11-16'&&r.member==='3º SGT ROBERTO'&&r.type==='ordinary'&&r.area==='sat');assert.equal(sat.start,'13h00');assert.equal(sat.end,'18h00');assert.equal(sat.minutes,300);assert.equal(sat.activity,'Vistoria');
 assert(!rows.some(r=>r.date==='2026-11-20'&&r.area==='sat'&&r.type==='ordinary'));
});

test('AC4 canônico exclui cancelamentos e simulação, deduplica continuidade SAT e aplica revisões',()=>{
 const original=ac4({serviceId:'sat-test'}),revised=ac4({serviceId:'sat-test',revision:2,end:'12h00',hours:4}),cancelled=ac4({serviceId:'cancel-test',cancelled:true});
 const input={'2026-11':{days:[{day:1,ala:'ALPHA',members:[member('PREVISTO AC4',[],[ac4({simulation:true,mode:'OPERACIONAL/SOP'})],{simulationId:'virtual'})],sat:{members:[member('SD TESTE',[],[original,revised,cancelled,ac4({simulation:true,serviceId:'virtual-sat'})])]}}]}};
 const rows=lookup.month(input,'2026-11');assert.equal(rows.length,1);assert.equal(rows[0].minutes,240);assert.equal(rows[0].commitmentCents,16000);
 const real=lookup.month(data,'2026-11').filter(r=>r.type==='ac4');assert.equal(real.length,108);assert.equal(real.reduce((sum,r)=>sum+r.commitmentCents,0),4599500);
 const continuous=real.filter(r=>r.date==='2026-11-16'&&r.member==='2º SGT WANDERSON'&&r.area==='sat');assert.equal(continuous.length,1);assert.equal(continuous[0].minutes,600);assert.equal(continuous[0].commitmentCents,30000);
});

test('serviço pertence ao mês inicial e não duplica na virada do mês',()=>{
 const night=ac4({startDate:'2026-11-30',endDate:'2026-12-01',start:'20h00',end:'08h00',hours:12,serviceId:'night'}),input={'2026-11':{days:[{day:30,ala:'DELTA',members:[member('SD TESTE',[],[night])]}]},'2026-12':{days:[{day:1,ala:'ALPHA',members:[member('SD TESTE',[],[{...night}])]}]}};
 assert.equal(lookup.month(input,'2026-11').length,1);assert.equal(lookup.month(input,'2026-12').length,0);assert.equal(lookup.month(input,'2026-11')[0].endDate,'2026-12-01');assert.deepEqual(plain(lookup.month(input,'2027-02')),[]);
});

test('busca usa nome sem acentos, vários termos e RG formatado do cadastro; preserva homônimos e zero serviços',()=>{
 const directory=[{siteName:'SD TESTE',full:'JOÃO MILITAR TESTE',war:'TESTE',grade:'SD QP/COMBATENTE',rg:'98.765'},{siteName:'SD OUTRO',full:'JOÃO OUTRO',war:'OUTRO',rg:'98.766'},{siteName:'CAP FRANCISCO LINS',full:'FRANCISCO LINS DE SOUSA',war:'FRANCISCO LINS',rg:'98.767'}];
 const people=lookup.people(data,[{name:'CAP LINS'}],directory);assert.equal(lookup.search(people,'joao').length,2);assert.equal(lookup.search(people,'militar joao')[0].name,'SD TESTE');assert.equal(lookup.search(people,'RG 98.765')[0].name,'SD TESTE');assert.equal(lookup.search(people,'98766')[0].name,'SD OUTRO');assert.equal(lookup.search(people,'98767').length,1);assert.equal(people.filter(p=>p.key==='CAP FRANCISCO LINS').length,1);assert.equal(lookup.search(people,'00000000').length,0);assert.equal(lookup.search(people,' ').length,0);
});

test('pendências de janeiro e dispensas não viram serviços; consulta preserva escala e finanças',()=>{
 const source=JSON.stringify(data),before=finance.month(data,'2026-11',4584000);
 const january=lookup.month(data,'2027-01');assert(!january.some(r=>r.member==='2º SGT SCHUSSLER'&&['2027-01-01','2027-01-02','2027-01-15','2027-01-20'].includes(r.date)));
 const november=lookup.month(data,'2026-11');assert(!november.some(r=>r.member==='3º SGT HENRIQUE'&&r.date==='2026-11-20'&&r.type==='ordinary'));assert(november.some(r=>r.member==='3º SGT HENRIQUE'&&r.date==='2026-11-13'&&r.labels.includes('TS CIA · Pagamento')));
 assert.equal(JSON.stringify(data),source);const after=finance.month(data,'2026-11',4584000);for(const field of ['committedCents','executedCents','remainingCents','operationalCents','satCents'])assert.equal(after[field],before[field]);
});

test('horários ordinários incompletos permanecem a conferir',()=>{
 const input={'2026-11':{days:[{day:1,members:[member('SD TESTE',[{kind:'ord',hours:12}])]}]}};const row=lookup.month(input,'2026-11')[0];assert.equal(row.start,null);assert.equal(row.end,null);assert.equal(row.minutes,null);
});

test('cadastro público de pesquisa contém somente nome da escala e RG',()=>{
 const roster=JSON.parse(scripts.find(([,a])=>a.includes('id="service-lookup-personnel"'))[2]);assert.equal(roster.length,30);assert.equal(new Set(roster.map(p=>p.rg.replace(/\D/g,''))).size,30);
 for(const person of roster){assert(/^[\d.]+$/.test(person.rg));assert.deepEqual(Object.keys(person).sort(),['name','rg']);}
 const people=lookup.people({},[{name:'SD TESTE',rg:'99999'}],[{siteName:'SD 1ª CL TESTE',war:'TESTE',full:'MILITAR TESTE',rg:'99999',grade:'SD 1ª CL QP/COMBATENTE'}]);assert.equal(people.length,1);assert.equal(lookup.search(people,'99999')[0].name,'SD TESTE');
});
