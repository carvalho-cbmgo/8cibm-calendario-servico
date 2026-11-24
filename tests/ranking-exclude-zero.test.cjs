const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],context=vm.createContext({window:{}});
for(const name of ['AC4Finance','AC4RankingHistory'])vm.runInContext(scripts.find(s=>!s[1].includes('application/json')&&s[2].includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,AC4RankingHistory:history}=context.window,plain=x=>JSON.parse(JSON.stringify(x));
const personnel=[
  {name:'ST CONFIRMADO',ord:1,rg:'1'},{name:'SD FORA DO INTERVALO',ord:2,rg:'2'},
  {name:'CAP TESTE',ord:3,rg:'3',officer:true},{name:'SD PREVISTO',ord:4,rg:'4'},
  {name:'SD CANCELADO',ord:5,rg:'5'},{name:'SD INVALIDO',ord:6,rg:'6'},{name:'SD ZERO',ord:7,rg:'7'},
];
const event=extra=>({mode:'OPERACIONAL/SOP',start:'08h00',end:'12h00',hours:4,status:'planned',...extra});
const member=(name,events)=>({name,badges:[],notes:[],events});
const source=()=>({'2026-11':{days:[
  {day:11,members:[member('SD FORA DO INTERVALO',[event({})])]},
  {day:12,members:[
    member('SD PREVISTO',[event({end:'20h00',hours:12})]),
    member('CAP TESTE',[event({executionConfirmed:true})]),
    member('SD CANCELADO',[event({serviceId:'cancelled',revision:1}),event({serviceId:'cancelled',revision:2,cancelled:true})]),
    member('SD INVALIDO',[event({end:'13h00'})]),
  ],sat:{members:[member('ST CONFIRMADO',[event({mode:'SAT',activity:'Vistoria',executionConfirmed:true})])]}}
]}});
const options={personnel,includeOfficers:false,startDate:'2026-11-12',endDate:'2026-11-12'};
const consolidated={'2026-10':{'1':5000,'2':90000,'3':30000,'4':20000,'7':40000}};
const rank=(s,extra={})=>history.rank(s,finance.month(s,'2026-11'),'2026-11-24',{...options,history:consolidated,historyMonths:1,...extra});

test('filtro é desativado por padrão; ativado considera valores no intervalo, incluindo previstos e confirmados válidos',()=>{
  const s=source(),summary=finance.month(s,'2026-11');
  const defaultView=finance.ranking(summary,'2026-11-24',true,options);
  assert.equal(defaultView.excludeZeroAC4,false);assert.equal(defaultView.rows.length,6);
  assert.deepEqual(plain(defaultView),plain(finance.ranking(summary,'2026-11-24',true,{...options,excludeZeroAC4:false})));
  const filtered=finance.ranking(summary,'2026-11-24',true,{...options,excludeZeroAC4:true});
  assert.equal(filtered.excludeZeroAC4,true);
  assert.deepEqual(plain(filtered.rows.map(p=>p.member)),['SD PREVISTO','ST CONFIRMADO']);
  assert.equal(filtered.recordCount,2);assert.equal(filtered.totalCents,48000);
  assert.equal(filtered.operationalCents,36000);assert.equal(filtered.satCents,12000);
  assert.equal(filtered.forecastCents,36000);assert.equal(filtered.executedCents,12000);
  assert(!filtered.rows.some(p=>/CANCELADO|INVALIDO|ZERO|FORA/.test(p.member)));
});

test('histórico não mantém militares com AC4 zerado no intervalo e totais históricos acompanham somente as linhas exibidas',()=>{
  const s=source(),unfiltered=rank(s),filtered=rank(s,{excludeZeroAC4:true});
  assert.equal(unfiltered.rows.length,6);assert.equal(unfiltered.totalCents,203000);
  assert.deepEqual(plain(filtered.rows.map(p=>p.member)),['SD PREVISTO','ST CONFIRMADO']);
  assert.equal(filtered.currentCents,48000);assert.equal(filtered.historyCents,25000);assert.equal(filtered.totalCents,73000);
  assert.equal(filtered.rows.find(p=>p.member==='SD PREVISTO').monthlyMinutes,720);
  for(const historyMonths of [0,1,2,3,4]){
    const r=rank(s,{excludeZeroAC4:true,historyMonths});
    assert.deepEqual(plain(r.rows.map(p=>p.member).sort()),['SD PREVISTO','ST CONFIRMADO'].sort());
    assert(r.rows.every(p=>p.currentCents!==0));
  }
});

test('filtro combina com oficiais e antiguidade, respeita os limites inclusivos e retorna vazio sem AC4 no intervalo',()=>{
  const s=source(),r=rank(s,{excludeZeroAC4:true,includeOfficers:true,sortBySeniority:true});
  assert.deepEqual(plain(r.rows.map(p=>p.ord)),[1,3,4]);
  assert.equal(r.currentCents,60000);assert.equal(r.historyCents,55000);assert.equal(r.totalCents,115000);
  const outside=rank(s,{excludeZeroAC4:true,startDate:'2026-11-11',endDate:'2026-11-11'});
  assert.deepEqual(plain(outside.rows.map(p=>p.member)),['SD FORA DO INTERVALO']);
  const empty=rank(s,{excludeZeroAC4:true,startDate:'2026-11-13',endDate:'2026-11-13'});
  assert.equal(empty.rows.length,0);assert.equal(empty.recordCount,0);assert.equal(empty.totalCents,0);assert.equal(empty.historyCents,0);
  const summary=finance.month(s,'2026-11'),zeroValues={...summary,records:summary.records.map(r=>({...r,commitmentCents:0}))};
  assert.equal(finance.ranking(zeroValues,'2026-11-24',true,{...options,excludeZeroAC4:true}).rows.length,0);
});

test('filtrar não altera escala, resumo financeiro nem horas dos militares mantidos',()=>{
  const s=source(),before=JSON.stringify(s),summary=finance.month(s,'2026-11',4584000),financial=JSON.stringify(summary);
  const all=rank(s),filtered=rank(s,{excludeZeroAC4:true});
  for(const p of filtered.rows){
    const original=all.rows.find(x=>x.key===p.key);
    assert.deepEqual(plain(p),plain(original));
  }
  assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(summary),financial);
  assert.equal(JSON.stringify(finance.month(s,'2026-11',4584000)),financial);
});
