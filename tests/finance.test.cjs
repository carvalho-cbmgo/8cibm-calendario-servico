const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const context=vm.createContext({window:{}});
for(const name of ['window.AC4Finance=','window.ServiceChief=']){
  vm.runInContext(scripts.find(([,attrs,source])=>!attrs.includes('application/json')&&source.includes(name))[2],context);
}
const finance=context.window.AC4Finance,chief=context.window.ServiceChief;
const event=(overrides={})=>({mode:'OPERACIONAL/SOP',start:'08h00',end:'12h00',nextDay:false,hours:4,status:'planned',...overrides});
const member=(events,extra={})=>({name:'ST TESTE',ord:1,badges:[],notes:[],events,...extra});
const schedule=(events,day=3)=>({'2026-11':{days:[{day,members:[member(events)]}]}});
const plain=value=>JSON.parse(JSON.stringify(value));

test('tarifas diurnas, noturnas e classificação da noite após meia-noite',()=>{
  for(const [date,input,expected] of [
    ['2026-11-03',event(),12000],
    ['2026-11-07',event({end:'20h00',hours:12}),48000],
    ['2026-11-05',event({start:'20h00',end:'08h00',nextDay:true,hours:12}),41100],
    ['2026-11-08',event({start:'20h00',end:'08h00',nextDay:true,hours:12}),48500],
    ['2026-11-06',event({start:'00h00',end:'05h00',hours:5}),16500],
    ['2026-11-05',event({start:'20h30',end:'22h30',hours:2}),6150],
    ['2026-11-09',event({end:'08h00',nextDay:true,hours:24}),74100]
  ]){
    const priced=finance.price(input,date);
    assert.equal(priced.valid,true,date);assert.equal(priced.costCents,expected,date);
    assert.equal(priced.segments.reduce((sum,segment)=>sum+segment.amountCents,0),expected);
  }
});

test('mesmo validador aceita horários curtos, com h ou dois-pontos e término explícito',()=>{
  for(const [start,end] of [['8h','12h'],['08h00','12h00'],['08:00','12:00']]){
    const priced=finance.price(event({start,end}),'2026-11-03');
    assert.equal(priced.valid,true);assert.equal(priced.start,'08h00');assert.equal(priced.end,'12h00');assert.equal(priced.costCents,12000);
  }
  const overnight=finance.price(event({startDate:'2026-11-30',endDate:'2026-12-01',end:'08h00',hours:24}),'2026-11-03');
  assert.equal(overnight.valid,true);assert.equal(overnight.endDate,'2026-12-01');assert.equal(overnight.financialMonth,'2026-11');
  assert.equal(finance.price(event({hours:12}),'2026-11-03').valid,false);
  assert.equal(finance.price(event(),'2026-11-31').valid,false);
  assert.equal(finance.price(event({start:'25h00'}),'2026-11-03').valid,false);
});

test('OS e SEI são identificados independentemente da confirmação da execução',()=>{
  for(const document of ['OS nº 347; SEI 97833404','OS nº 347 (SEI 97833404)','OS nº 347 (97833404)']){
    assert.deepEqual(plain(finance.documentInfo(event({document}))),{number:'347',sei:'97833404'});
  }
  assert.deepEqual(plain(finance.documentInfo(event({document:'OS nº 347/2026; Processo SEI 202600011035274; SEI 97833404'}))),{number:'347/2026',sei:'97833404'});
  for(const document of ['OS a definir; Processo SEI 202600011035274',null,undefined]){
    assert.deepEqual(plain(finance.documentInfo(event({document}))),{number:'',sei:''});
  }
  assert.equal(finance.documentInfo(event({document:'OS nº 347; Processo SEI 202600011035274'})).sei,'');
});

test('revisões e cancelamentos têm um registro canônico para finanças e tabelas',()=>{
  const original=event(),revised=event({revision:2,document:'OS nº 347; SEI 97833404'});
  const summary=finance.month(schedule([original,revised]),'2026-11',4560000);
  assert.equal(summary.committedCents,12000);assert.equal(summary.duplicateCount,1);assert.equal(summary.records.length,1);
  assert.equal(summary.byEvent.get(original).event,revised);assert.equal(summary.byEvent.get(revised).event,revised);
  const cancelled=event({revision:3,cancelled:true});
  const after=finance.month(schedule([original,revised,cancelled]),'2026-11',4560000);
  assert.equal(after.committedCents,0);assert.equal(after.cancelledCount,1);assert.equal(after.byEvent.get(original).event,cancelled);
});

test('competência usa início do serviço e mantém aliases consultáveis em outro mês',()=>{
  const source=event({startDate:'2026-11-30',endDate:'2026-12-01',end:'08h00',hours:24});
  const data=schedule([source],30),november=finance.month(data,'2026-11',4560000),december=finance.month(data,'2026-12');
  assert.equal(november.committedCents,74100);assert.equal(december.committedCents,0);assert.equal(december.quotaCents,null);
  assert.equal(december.byEvent.get(source).event,source);
});

test('SAT e PROEBOM, acumulados inclusivos, execução confirmada e saldo',()=>{
  const op=event({mode:'PROEBOM 2026'}),sat=event({mode:'SAT',executionConfirmed:true});
  const data={'2026-11':{days:[{day:3,members:[member([op])],sat:{members:[member([sat],{name:'3º SGT TESTE'})]}},{day:5,members:[member([event({cancelled:true})])]}]}};
  const summary=finance.month(data,'2026-11',4560000),day=summary.daily.get('2026-11-03');
  assert.equal(summary.operationalCents,12000);assert.equal(summary.satCents,12000);assert.equal(summary.forecastCents,12000);assert.equal(summary.executedCents,12000);
  assert.equal(day.cumulativeCents,24000);assert.equal(day.cumulativeOperationalCents,12000);assert.equal(day.cumulativeSatCents,12000);assert.equal(day.remainingCents,4536000);
  assert.equal(summary.daily.get('2026-11-02').cumulativeCents,0);assert.equal(summary.daily.get('2026-11-30').cumulativeCents,24000);
  assert.equal(finance.month(data,'2026-11').remainingCents,null);
});

test('todos os meses cadastrados mantêm totais e acumulados consistentes',()=>{
  const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);
  const quotas=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="ac4-financial-config"'))[2]).monthlyQuotaCents;
  for(const [period,input] of Object.entries(data)){
    const summary=finance.month(data,period,quotas[period]),days=new Set(input.days.map(d=>d.day));
    assert.equal(days.size,input.days.length);assert.equal(summary.invalidCount,0);assert.equal(summary.duplicateCount,0);
    assert.equal(summary.committedCents,summary.operationalCents+summary.satCents);assert.equal(summary.committedCents,summary.forecastCents+summary.executedCents);
    for(const day of summary.daily.values()){
      const records=summary.records.filter(r=>r.valid&&r.status!=='cancelled'&&r.startDate<=day.date);
      assert.equal(day.cumulativeCents,records.reduce((sum,r)=>sum+r.costCents,0));
      assert.equal(day.cumulativeCents,day.cumulativeOperationalCents+day.cumulativeSatCents);
    }
  }
});

test('chefia respeita antiguidade, ausência, ODD e pendências de períodos parciais',()=>{
  const ordinary=(name,ord,badges=[{kind:'ord'}])=>member([],{name,ord,badges});
  const day={shiftStart:'08h00',members:[ordinary('ASP OF TESTE',1,[{kind:'officer'}]),ordinary('ST AUSENTE',2,[{kind:'disp'}]),ordinary('ST TESTE',3),ordinary('1º SGT TESTE',4)]};
  assert.equal(chief.select(day).assignments[0].name,'ST TESTE');
  assert.equal(chief.select({...day,members:[ordinary('ST SEM ORD',null)]}).status,'pending');
  assert.equal(chief.select({...day,members:[member([event({end:'20h00',hours:12})],{name:'ST PARCIAL',ord:2}),ordinary('ST TESTE',3)]}).status,'pending');
});

test('ranking soma Operacional e SAT, inclui previstos e ordena pelo total numérico',()=>{
  const data={'2026-11':{days:[
    {day:3,members:[member([event({executionConfirmed:true})]),member([event({end:'20h00',hours:12})],{name:'2º SGT OUTRO'})],sat:{members:[member([event({mode:'SAT',start:'13h00',end:'18h00',hours:5})])]}},
    {day:4,members:[member([event({mode:'PROEBOM 2026'})])]},
    {day:5,members:[member([event()])]}
  ]}};
  const summary=finance.month(data,'2026-11'),included=finance.ranking(summary,'2026-11-04'),excluded=finance.ranking(summary,'2026-11-04',false);
  assert.deepEqual(plain(included.rows.map(row=>row.member)),['ST TESTE','2º SGT OUTRO']);
  assert.deepEqual(plain(excluded.rows.map(row=>row.member)),['2º SGT OUTRO','ST TESTE']);
  assert.equal(included.rows[0].operationalCents,24000);assert.equal(included.rows[0].satCents,15000);assert.equal(included.rows[0].totalCents,39000);
  assert.equal(included.rows[0].records.length,3);assert.equal(included.rows[0].monthlyRecords.length,4);
  assert.equal(included.totalCents,75000);assert.equal(excluded.totalCents,63000);assert.equal(excluded.cutoffDate,'2026-11-03');
  assert.equal(included.executedCents,12000);assert.equal(included.forecastCents,63000);
  assert.equal(included.totalCents,included.operationalCents+included.satCents);
});

test('ranking exclui cancelados, inválidos e versões duplicadas',()=>{
  const original=event(),updated=event({revision:2,executionConfirmed:true}),cancelled=event({start:'13h00',end:'17h00',cancelled:true}),invalid=event({start:'18h00',end:'20h00',hours:12});
  const result=finance.ranking(finance.month(schedule([original,updated,cancelled,invalid]),'2026-11'),'2026-11-30');
  assert.equal(result.rows.length,1);assert.equal(result.recordCount,1);assert.equal(result.totalCents,12000);assert.equal(result.rows[0].monthlyRecords.length,1);
});

test('ranking considera a data de início inclusive nas viradas de mês',()=>{
  const data=schedule([event({startDate:'2026-11-30',endDate:'2026-12-01',end:'08h00',hours:24})],30),summary=finance.month(data,'2026-11');
  assert.equal(finance.ranking(summary,'2026-11-30').totalCents,74100);
  assert.equal(finance.ranking(summary,'2026-11-30',false).totalCents,0);
  assert.equal(finance.ranking(summary,'2026-12-01',false).totalCents,74100);
  assert.equal(finance.ranking(summary,'2026-10-31').rows.length,0);
  assert.equal(finance.ranking(finance.month(data,'2026-12'),'2026-12-01').totalCents,0);
  assert.throws(()=>finance.ranking(summary,'2026-11-31'));
});

test('ranking tem desempate estável e mantém os serviços mensais em ordem de data',()=>{
  const data={'2026-11':{days:[{day:5,members:[member([event()],{name:'ST BRAVO'})]},{day:3,members:[member([event()],{name:'ST ALPHA'}),member([event()],{name:'ST BRAVO'})]}]}};
  const result=finance.ranking(finance.month(data,'2026-11'),'2026-11-03');
  assert.deepEqual(plain(result.rows.map(row=>row.member)),['ST ALPHA','ST BRAVO']);
  assert.deepEqual(plain(result.rows[1].monthlyRecords.map(row=>row.startDate)),['2026-11-03','2026-11-05']);
});

test('ranking confere com os acumulados diários de todos os meses cadastrados',()=>{
  const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);
  for(const period of Object.keys(data)){
    const summary=finance.month(data,period);
    for(const day of summary.daily.values()){
      const result=finance.ranking(summary,day.date);
      assert.equal(result.totalCents,day.cumulativeCents);assert.equal(result.operationalCents,day.cumulativeOperationalCents);assert.equal(result.satCents,day.cumulativeSatCents);
      assert(result.rows.every((row,index)=>!index||result.rows[index-1].totalCents>=row.totalCents));
      assert.equal(result.totalCents,result.forecastCents+result.executedCents);
    }
  }
});
