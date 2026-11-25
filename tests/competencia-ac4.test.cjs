const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],read=id=>JSON.parse(scripts.find(([,a])=>a.includes(`id="${id}"`))[2]),context=vm.createContext({window:{}});
for(const name of ['AC4Finance','AC4RankingHistory','ServiceLookup'])vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes(`window.${name}=`))[2],context);
const {AC4Finance:f,AC4RankingHistory:h,ServiceLookup:lookup}=context.window,plain=v=>JSON.parse(JSON.stringify(v)),personnel=[{name:'ST TESTE',rg:'999',ord:1,includeZero:true}];
const event=extra=>({serviceId:'quota-fixture',mode:'OPERACIONAL/SOP',start:'08h00',end:'08h00',hours:24,nextDay:true,status:'planned',...extra});
const source=(date,e)=>({[date.slice(0,7)]:{days:[{day:Number(date.slice(8)),ala:'ALPHA',members:[{name:'ST TESTE',badges:[],notes:[],events:[e]}]}]}});
const rank=(data,period,first,last,asOf,extra={})=>h.rank(data,f.month(data,period),'2026-11-24',{personnel,startDate:first,endDate:last,asOf,historyMonths:0,...extra});

test('30/11 08h a 01/12 08h: 16h/R$486 em novembro e 8h/R$255 em dezembro, preservando o serviço de 24h/R$741',()=>{
 const e=event(),data=source('2026-11-30',e),before=JSON.stringify(data),nov=f.month(data,'2026-11',4584000),dec=f.month(data,'2026-12',3800000);
 for(const [s,minutes,cost,start,endDate,end]of [[nov,960,48600,'08h00','2026-12-01','00h00'],[dec,480,25500,'00h00','2026-12-01','08h00']]){assert.equal(s.records.length,1);const r=s.records[0];assert.equal(r.minutes,minutes);assert.equal(r.costCents,cost);assert.equal(r.commitmentCents,cost);assert.equal(r.start,start);assert.equal(r.endDate,endDate);assert.equal(r.end,end);assert.equal(r.originalService.minutes,1440);assert.equal(r.originalService.costCents,74100);assert.equal(r.financialMonth,s.period);assert.equal(s.daily.get(s.period==='2026-11'?'2026-11-30':'2026-12-01').committedCents,cost);}
 assert.equal(nov.committedCents+dec.committedCents,74100);assert.equal(nov.serviceRecords.length,1);assert.equal(dec.serviceRecords.length,0);assert.equal(dec.byEvent.get(e).minutes,1440);assert.equal(dec.byEvent.get(e).costCents,74100);assert.equal(JSON.stringify(data),before);
});

test('entrada de outubro e virada dezembro/janeiro mantêm a tarifa da noite inicial e a tarifa diurna da data de cada trecho',()=>{
 for(const [date,first,next]of [['2026-10-31',17000,34500],['2026-12-31',12600,28500]]){
  const data=source(date,event({start:'20h00',hours:12})),period=date.slice(0,7),following=period==='2026-10'?'2026-11':'2027-01',a=f.month(data,period),b=f.month(data,following);assert.equal(a.committedCents,first);assert.equal(b.committedCents,next);assert.equal(a.committedCents+b.committedCents,f.price(data[period].days[0].members[0].events[0],date).costCents);assert.equal(b.records[0].segments[0].nightStartDate,date);
 }
});

test('meia-noite não perde nem duplica minutos; término às 00h não cria parcela no mês seguinte',()=>{
 for(const [start,end,endDate,minutes,novCost,decCost]of [['23h59','00h01','2026-12-01',2,55,55],['23h59','00h00','2026-12-01',1,55,0],['00h00','00h01','2026-11-30',1,75,0]]){
  const e=event({start,end,endDate,hours:minutes/60}),data=source('2026-11-30',e),a=f.month(data,'2026-11'),b=f.month(data,'2026-12');assert.equal(a.committedCents,novCost);assert.equal(b.committedCents,decCost);assert.equal(a.records.reduce((s,r)=>s+r.minutes,0)+b.records.reduce((s,r)=>s+r.minutes,0),minutes);assert.equal(a.committedCents+b.committedCents,f.price(e,'2026-11-30').costCents);
 }
});

test('revisões, aliases e cancelamento são aplicados antes do rateio nos dois meses',()=>{
 const old=event(),revised=event({revision:2,end:'12h00',hours:28}),data=source('2026-11-30',old);data['2026-12']={days:[{day:1,members:[{name:'ST TESTE',events:[revised,{...revised}],badges:[],notes:[]}]}]};
 // An explicit start date identifies the same service when a canonical alias is on the following page.
 revised.startDate='2026-11-30';data['2026-12'].days[0].members[0].events[1].startDate='2026-11-30';
 assert.equal(f.month(data,'2026-11').committedCents,48600);assert.equal(f.month(data,'2026-12').committedCents,37500);assert.equal(f.month(data,'2026-12').records.length,1);assert.equal(f.month(data,'2026-12').records[0].minutes,720);
 data['2026-12'].days[0].members[0].events.push({...revised,revision:3,cancelled:true});for(const p of ['2026-11','2026-12']){const s=f.month(data,p);assert.equal(s.committedCents,0);assert.equal(s.cancelledCount,1);assert.equal(s.records.length,1);}
});

test('serviço válido que atravessa três competências conserva centavos e duração total',()=>{
 const e=event({endDate:'2026-03-01',hours:29*24}),data=source('2026-01-31',e),whole=f.price(e,'2026-01-31'),parts=['2026-01','2026-02','2026-03'].map(p=>f.month(data,p));assert.equal(whole.valid,true);assert.equal(parts.reduce((s,p)=>s+p.committedCents,0),whole.costCents);assert.equal(parts.reduce((s,p)=>s+p.records[0].minutes,0),whole.minutes);assert.deepEqual(parts.map(p=>p.records[0].minutes),[16*60,28*24*60,8*60]);
});

test('ranking e histórico usam parcelas mensais; somar meses recompõe o valor inteiro sem duplicação',()=>{
 const data=source('2026-11-30',event()),nov=rank(data,'2026-11','2026-11-30','2026-11-30','2026-11-24T22:00:00-03:00'),dec=rank(data,'2026-12','2026-12-01','2026-12-01','2026-11-24T22:00:00-03:00',{historyMonths:1,history:{}});
 assert.equal(nov.currentCents,48600);assert.equal(nov.rows[0].monthlyMinutes,960);assert.equal(dec.currentCents,25500);assert.equal(dec.historyCents,48600);assert.equal(dec.totalCents,74100);assert.equal(dec.rows[0].monthlyMinutes,480);assert.equal(dec.rows[0].records.length,1);
 const consolidated=rank(data,'2026-12','2026-12-01','2026-12-01','2026-11-24T22:00:00-03:00',{historyMonths:1,history:{'2026-11':{'999':48600}}});assert.equal(consolidated.totalCents,74100);assert.equal(consolidated.rows[0].history[0].source,'consolidated');
 const zero=rank(data,'2026-12','2026-12-02','2026-12-02','2026-11-24T22:00:00-03:00',{historyMonths:1,history:{},excludeZeroAC4:true});assert.equal(zero.rows.length,0);
});

test('consulta mantém jornada integral na data inicial, com uma única entrada, mesmo havendo parcelas em duas cotas',()=>{
 const data=source('2026-11-30',event()),rows=lookup.month(data,'2026-11').filter(r=>r.type==='ac4');assert.equal(rows.length,1);assert.equal(rows[0].minutes,1440);assert.equal(rows[0].costCents,74100);assert.equal(rows[0].endDate,'2026-12-01');assert.equal(lookup.month(data,'2026-12').filter(r=>r.type==='ac4').length,0);
});

test('saldos publicados: novembro -R$70 e dezembro R$36.545; cadastro, cotas e execução confirmada preservados',()=>{
 const data=read('calendar-data'),before=JSON.stringify(data),quotas=read('ac4-financial-config').monthlyQuotaCents,nov=f.month(data,'2026-11',quotas['2026-11']),dec=f.month(data,'2026-12',quotas['2026-12']);
 assert.equal(nov.quotaCents,4584000);assert.equal(nov.committedCents,4574000);assert.equal(nov.remainingCents,10000);assert.equal(nov.executedCents,1096600);assert.equal(dec.quotaCents,3800000);assert.equal(dec.committedCents,145500);assert.equal(dec.remainingCents,3654500);assert.equal(dec.executedCents,0);assert.equal(nov.committedCents+dec.committedCents,4599500+120000);
 const id='ac4-operacional-cavalcante-2026-11-30-08h',a=nov.records.find(r=>r.event.serviceId===id),b=dec.records.find(r=>r.event.serviceId===id);assert.equal(a.costCents,48600);assert.equal(b.costCents,25500);assert.equal(f.documentInfo(b.event).number,'397');assert.equal(b.event.hours,24);
 const daSilva=nov.records.find(r=>r.member==='ST DA SILVA'&&r.startDate==='2026-11-19');assert.equal(daSilva.minutes,720);assert.equal(daSilva.costCents,36000);assert.equal(JSON.stringify(data),before);
});
