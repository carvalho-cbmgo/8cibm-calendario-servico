const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],read=id=>JSON.parse(scripts.find(([,a])=>a.includes(`id="${id}"`))[2]),data=read('calendar-data'),context=vm.createContext({window:{}});
for(const name of ['AC4Finance','AC4RankingHistory'])vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,AC4RankingHistory:history}=context.window,plain=v=>JSON.parse(JSON.stringify(v)),personnel=[{name:'ST TESTE',ord:1,rg:'999',includeZero:true}],event=(id,extra={})=>({serviceId:id,mode:'OPERACIONAL/SOP',start:'08h00',end:'12h00',hours:4,status:'planned',...extra}),member=events=>({name:'ST TESTE',badges:[],notes:[],events});
const fixture=()=>({'2026-11':{days:[{day:23,members:[member([event('outside')])]},{day:24,members:[member([event('day'),event('night',{start:'20h00',end:'08h00',hours:12,nextDay:true}),event('cancelled',{cancelled:true}),event('invalid',{end:'13h00'}),event('simulation',{simulation:true})])]},{day:25,members:[member([event('future',{executionConfirmed:true})])]}]}});
const rank=(s,asOf,extra={})=>finance.ranking(finance.month(s,'2026-11'),'2026-11-24',true,{personnel,startDate:'2026-11-24',endDate:'2026-11-24',asOf,...extra});

test('exemplo real: noturno de 24/11 não conta às 22h nem às 07h59; entra uma vez exatamente às 08h de 25/11',()=>{
 const personnel=[{name:'2º SGT LUIZ ANTONIO',ord:16,includeZero:true}],summary=finance.month(data,'2026-11',4584000),get=asOf=>finance.ranking(summary,'2026-11-24',true,{personnel,startDate:'2026-11-24',endDate:'2026-11-24',asOf}).rows.find(p=>p.member==='2º SGT LUIZ ANTONIO');
 for(const asOf of ['2026-11-24T22:00:00-03:00','2026-11-25T07:59:59.999-03:00','2026-11-25T10:59:59Z']){const p=get(asOf);assert.equal(p.totalCents,0);assert.equal(p.records.length,0);assert.equal(p.minutes,0);}
 for(const asOf of ['2026-11-25T08:00:00-03:00','2026-11-25T11:00:00Z']){const p=get(asOf);assert.equal(p.totalCents,38100);assert.equal(p.records.length,1);assert.equal(p.minutes,720);assert.equal(p.records[0].status,'forecast');assert.equal(p.records[0].endDate,'2026-11-25');}
});

test('intervalo inclusivo e término são filtros cumulativos; previsto encerrado entra, futuro confirmado não entra',()=>{
 const s=fixture(),a=rank(s,'2026-11-24T22:00:00-03:00',{endDate:'2026-11-25'});assert.deepEqual(plain(a.rows[0].records.map(r=>r.event.serviceId)),['day']);assert.equal(a.totalCents,12000);assert.equal(a.forecastCents,12000);assert.equal(a.executedCents,0);const b=rank(s,'2026-11-25T12:00:00-03:00',{endDate:'2026-11-25'});assert.equal(b.recordCount,3);assert.equal(b.totalCents,62100);assert(!b.rows[0].records.some(r=>r.event.serviceId==='outside'));assert.equal(rank(s,'2026-11-24T11:59:59-03:00').totalCents,0);assert.equal(rank(s,'2026-11-24T12:00:00-03:00').totalCents,12000);
});

test('SAT canônica usa o término da revisão mais recente, sem duplicar continuidade nem usar a revisão antiga já encerrada',()=>{
 const s={'2026-11':{days:[{day:24,members:[],sat:{members:[member([event('sat',{mode:'SAT',revision:1}),event('sat',{mode:'SAT',revision:2,end:'18h00',hours:10}),event('sat',{mode:'SAT',revision:2,end:'18h00',hours:10})])]}}]}};
 assert.equal(rank(s,'2026-11-24T17:59:59-03:00').recordCount,0);const r=rank(s,'2026-11-24T18:00:00-03:00');assert.equal(r.recordCount,1);assert.equal(r.satCents,30000);assert.equal(r.rows[0].minutes,600);
});

test('virada de mês pertence à data inicial e término à meia-noite é comparado no fuso de Brasília',()=>{
 const s={'2026-11':{days:[{day:30,members:[member([event('boundary',{end:'08h00',hours:24,nextDay:true})])]}]},'2026-12':{days:[]}},summary=finance.month(s,'2026-11'),view=asOf=>finance.ranking(summary,'2026-12-01',true,{personnel,startDate:'2026-11-30',endDate:'2026-11-30',asOf});assert.equal(view('2026-12-01T07:59:59-03:00').recordCount,0);assert.equal(view('2026-12-01T08:00:00-03:00').recordCount,1);assert.equal(finance.month(s,'2026-12').records.length,0);
 const midnight={'2026-11':{days:[{day:24,members:[member([event('midnight',{start:'22h00',end:'00h00',hours:2,nextDay:true})])]}]}};assert.equal(rank(midnight,'2026-11-25T02:59:59Z').recordCount,0);assert.equal(rank(midnight,'2026-11-25T03:00:00Z').recordCount,1);
});

test('histórico escolhido permanece no total; histórico vindo do calendário também exclui serviços ainda não terminados',()=>{
 const s=fixture(),summary=finance.month(s,'2026-11'),r=history.rank(s,summary,'2026-11-24',{personnel,startDate:'2026-11-24',endDate:'2026-11-24',historyMonths:1,history:{'2026-10':{'999':7000}},asOf:'2026-11-24T22:00:00-03:00'});assert.equal(r.currentCents,12000);assert.equal(r.historyCents,7000);assert.equal(r.totalCents,19000);assert.equal(r.rows[0].records.length,1);
 const next=history.rank(s,finance.month(s,'2026-12'),'2026-11-24',{personnel,startDate:'2026-12-01',endDate:'2026-12-31',historyMonths:1,history:{},asOf:'2026-11-24T22:00:00-03:00'});assert.equal(next.currentCents,0);assert.equal(next.historyCents,24000);assert.equal(next.totalCents,24000);
});

test('filtro de zerados considera somente os finalizados do intervalo; planejamento mensal e finanças não são alterados',()=>{
 const s=fixture(),source=JSON.stringify(s),summary=finance.month(s,'2026-11',4584000),financial=JSON.stringify(summary),r=rank(s,'2026-11-24T07:00:00-03:00',{excludeZeroAC4:true});assert.equal(r.rows.length,0);const ended=rank(s,'2026-11-24T22:00:00-03:00').rows[0];assert.equal(ended.minutes,240);assert.equal(ended.monthlyMinutes,1440);assert.equal(JSON.stringify(s),source);assert.equal(JSON.stringify(finance.month(s,'2026-11',4584000)),financial);assert.equal(JSON.stringify(summary),financial);
 assert.throws(()=>rank(s,'invalid'),/Instante/);assert.throws(()=>rank(s,null),/Instante/);const incomplete={...summary,records:summary.records.map(r=>({...r,endDate:null}))};assert.equal(finance.ranking(incomplete,'2026-11-24',true,{personnel,startDate:'2026-11-24',endDate:'2026-11-24',asOf:'2026-11-30T22:00:00-03:00'}).recordCount,0);
});
