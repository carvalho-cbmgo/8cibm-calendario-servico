const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],read=id=>JSON.parse(scripts.find(([,attrs])=>attrs.includes(`id="${id}"`))[2]),data=read('calendar-data'),history=read('ac4-ranking-history-data'),roster=read('ranking-personnel'),identities=read('service-lookup-personnel'),context=vm.createContext({window:{}});
for(const name of ['AC4Finance','AC4RankingHistory','ServiceSimulation'])vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,AC4RankingHistory:ranking,ServiceSimulation:simulation}=context.window,plain=value=>JSON.parse(JSON.stringify(value));
const personnel=roster.map(person=>({...person,rg:identities.find(p=>p.name===person.name).rg}));
const rank=(months,options={},schedules=data,period='2026-11')=>ranking.rank(schedules,finance.month(schedules,period,4584000),'2026-11-16',{historyMonths:months,history,personnel,includeOfficers:false,startDate:`${period}-01`,endDate:`${period}-30`,...options});
const synthetic=(name,extra={})=>({name,ord:1,badges:[],notes:[],events:[{mode:'OPERACIONAL/SOP',start:'08h00',end:'12h00',hours:4,...extra}]});

test('histórico transcrito tem 27 RGs validados por mês, em centavos, sem nomes completos ou dados adicionais',()=>{
 assert.deepEqual(Object.keys(history),['2026-08','2026-09','2026-10']);const squares=new Set(personnel.filter(p=>!p.officer).map(p=>p.rg));
 for(const [period,total]of [['2026-08',4905500],['2026-09',5994800],['2026-10',6828300]]){const values=history[period];assert.equal(Object.keys(values).length,27);assert.deepEqual(new Set(Object.keys(values)),squares);assert.equal(Object.values(values).reduce((a,b)=>a+b,0),total);assert(Object.values(values).every(value=>Number.isSafeInteger(value)&&value>=0));}
 assert.equal(history['2026-10']['1657'],99500);assert(!Object.hasOwn(history['2026-10'],'1567'));assert.equal(history['2026-09']['1542'],0);assert.equal(history['2026-08']['3698'],0);assert.equal(history['2026-10']['3404'],0);assert.equal(history['2026-09']['3404'],220000);assert.equal(history['2026-08']['3404'],392100);
});

test('0 preserva ranking atual e 1/2/3 somam meses anteriores inteiros, sem restringi-los às datas atuais',()=>{
 const options={personnel,includeOfficers:false,startDate:'2026-11-12',endDate:'2026-11-19'},summary=finance.month(data,'2026-11'),original=finance.ranking(summary,'2026-11-16',true,options),zero=rank(0,options);
 assert.deepEqual(plain(zero.rows.map(p=>[p.member,p.totalCents,p.operationalCents,p.satCents,p.records.length])),plain(original.rows.map(p=>[p.member,p.totalCents,p.operationalCents,p.satCents,p.records.length])));assert.equal(zero.totalCents,original.totalCents);
 for(const [months,extra]of [[1,6828300],[2,12823100],[3,17728600]]){const result=rank(months,options);assert.equal(result.historyCents,extra);assert.equal(result.totalCents,original.totalCents+extra);assert.equal(result.operationalCents,original.operationalCents);assert.equal(result.satCents,original.satCents);assert.equal(result.executedCents+result.forecastCents,result.currentCents);assert.equal(result.recordCount,original.recordCount);assert.equal(result.missingHistoryPeople,0);assert(result.rows.every((p,i)=>!i||result.rows[i-1].totalCents>=p.totalCents));}
 const first=rank(3,{startDate:'2026-11-01',endDate:'2026-11-01'}),last=rank(3,{startDate:'2026-11-30',endDate:'2026-11-30'});assert.equal(first.historyCents,last.historyCents);const wanderson=first.rows.find(p=>p.member==='2º SGT WANDERSON');assert.equal(wanderson.historyCents,612100);
});

test('4 inclui julho como não informado; zero explícito permanece conhecido e a soma é parcial',()=>{
 const result=rank(4,{startDate:'2026-11-21',endDate:'2026-11-21'});assert.equal(result.currentCents,199000);assert.equal(result.historyCents,17728600);assert.equal(result.missingHistoryPeople,27);
 const leide=result.rows.find(p=>p.member==='3º SGT LEIDE');assert.equal(leide.historyCents,0);assert.deepEqual(plain(leide.missingHistoryPeriods),['2026-07']);assert(leide.history.filter(p=>p.period!=='2026-07').every(p=>p.amountCents===0&&p.source==='consolidated'));assert.equal(leide.history.find(p=>p.period==='2026-07').amountCents,null);
});

test('a identidade do consolidado usa RG validado, inclusive RG formatado, e não aproxima nomes',()=>{
 const input={'2026-11':{days:[]}},options={personnel:[{name:'ST HOMÔNIMO A',rg:'1.657'},{name:'ST HOMÔNIMO B',rg:'9999'}],includeOfficers:true};const result=rank(1,options,input);assert.equal(result.rows.find(p=>p.member==='ST HOMÔNIMO A').historyCents,99500);assert.equal(result.rows.find(p=>p.member==='ST HOMÔNIMO B').historyCents,0);assert.deepEqual(plain(result.rows.find(p=>p.member==='ST HOMÔNIMO B').missingHistoryPeriods),['2026-10']);
});

test('meses anteriores cadastrados usam AC4 canônicos, sem cancelados, revisões duplicadas ou simulação',()=>{
 const original=synthetic('ST TESTE',{serviceId:'test',revision:1}),revision={...original,events:[{...original.events[0],revision:2,end:'14h00',hours:6}]},input={'2026-10':{days:[{day:6,members:[original,revision,synthetic('ST TESTE',{serviceId:'cancel',cancelled:true}),synthetic('PREVISTO AC4',{serviceId:'virtual',simulation:true})]}]},'2026-11':{days:[{day:3,members:[synthetic('ST TESTE')]}]}};
 let result=rank(1,{history:{},personnel:[{name:'ST TESTE',rg:'999'}],includeOfficers:true},input);assert.equal(result.historyCents,18000);assert.equal(result.currentCents,12000);assert.equal(result.totalCents,30000);assert.equal(result.rows[0].history[0].source,'calendar');assert.equal(result.rows[0].history[0].operationalCents,18000);
 result=rank(1,{history:{'2026-10':{'999':100000}},personnel:[{name:'ST TESTE',rg:'999'}],includeOfficers:true},input);assert.equal(result.historyCents,100000);assert.equal(result.totalCents,112000);assert.equal(result.rows[0].history[0].operationalCents,null);
});

test('dezembro e janeiro usam o calendário de novembro/dezembro sem somar duas vezes o consolidado',()=>{
 const december=rank(4,{},data,'2026-12'),november=rank(0);assert.equal(december.historyCents,november.currentCents+17728600);assert.deepEqual(plain(december.historyPeriods),['2026-11','2026-10','2026-09','2026-08']);assert.equal(december.rows.find(p=>p.member==='2º SGT LUIZ ANTONIO').history[0].amountCents,november.rows.find(p=>p.member==='2º SGT LUIZ ANTONIO').currentCents);
 const january=rank(1,{endDate:'2027-01-31'},data,'2027-01');assert.equal(january.historyCents,224700);assert.deepEqual(plain(ranking.periods('2027-01',4)),['2026-12','2026-11','2026-10','2026-09']);
});

test('inclui militares somente históricos, respeita oficiais/antiguidade e não inventa execução ou serviços',()=>{
 const input={'2026-10':{days:[{day:6,members:[synthetic('SD EXTRA')]}]},'2026-11':{days:[]}},result=rank(1,{history:{},personnel:[{name:'CAP TESTE',officer:true,ord:1},{name:'ST ANTIGO',ord:2}],includeOfficers:false},input);assert(result.rows.some(p=>p.member==='SD EXTRA'&&p.records.length===0&&p.monthlyRecords.length===0&&p.totalCents===12000));assert(!result.rows.some(p=>p.member==='CAP TESTE'));assert.equal(result.recordCount,0);assert.equal(result.executedCents,0);assert.equal(result.forecastCents,0);
 const senior=rank(3,{includeOfficers:true,sortBySeniority:true,startDate:'2026-11-21',endDate:'2026-11-21'});assert.deepEqual(plain(senior.rows.map(p=>p.ord)),Array.from({length:30},(_,i)=>i+1));assert.equal(senior.missingHistoryPeople,3);
});

test('histórico não altera escala, cota, finanças ou simulação e rejeita valores inválidos',()=>{
 const source=JSON.stringify(data),before=finance.month(data,'2026-11',4584000),plan=simulation.plan(data,'2026-11',4584000);for(const months of [0,1,2,3,4])rank(months);assert.equal(JSON.stringify(data),source);const after=finance.month(data,'2026-11',4584000);for(const field of ['committedCents','executedCents','remainingCents','operationalCents','satCents'])assert.equal(after[field],before[field]);assert.equal(simulation.plan(data,'2026-11',4584000).summary.committedCents,plan.summary.committedCents);
 for(const value of [-1,5,1.5,'1'])assert.throws(()=>rank(value),/0 a 4/);assert.throws(()=>rank(1,{history:{'2026-10':{'1657':-1}}}),/Valor ou RG inválido/);assert.throws(()=>ranking.periods('2026-13',1),/0 a 4/);
});
