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
  for(const document of ['OS nº 347; SEI 97833404','OS nº 347 (SEI 97833404)','OS nº 347 (97833404)','Errata à OS nº 347 (SEI 97833404); SEI relacionado 98122118']){
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

test('AC4 corrente inclui o dia de acesso, Operacional e SAT, sem incluir serviços posteriores',()=>{
  const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]),summary=finance.month(data,'2026-11',4560000);
  const current=finance.asOf(summary,'2026-11-09');assert.equal(current.date,'2026-11-09');assert.equal(current.committedCents,1197700);assert.equal(current.operationalCents,1017700);assert.equal(current.satCents,180000);assert.equal(current.remainingCents,3362300);
  assert.equal(current.committedCents,current.operationalCents+current.satCents);assert.equal(current.committedCents+current.remainingCents,summary.quotaCents);assert(current.committedCents<summary.committedCents);
  assert.equal(finance.asOf(summary,'2026-11-12').committedCents,1402900);assert.equal(finance.asOf(summary,'2026-11-08').committedCents,1096600);
});

test('AC4 corrente respeita meses anteriores/futuros e não inventa cota',()=>{
  const data=schedule([event()]),summary=finance.month(data,'2026-11',4560000);
  assert.equal(finance.asOf(summary,'2026-10-31').committedCents,0);assert.equal(finance.asOf(summary,'2026-10-31').remainingCents,4560000);
  assert.equal(finance.asOf(summary,'2026-12-05').committedCents,12000);assert.equal(finance.asOf(summary,'2026-12-05').cutoffDate,'2026-11-30');
  assert.equal(finance.asOf(finance.month(data,'2026-11'),'2026-11-30').remainingCents,null);assert.throws(()=>finance.asOf(summary,'2026-11-31'),/inválida/);
});

test('acumulados correntes acompanham revisão/cancelamento e usam a data inicial dos noturnos',()=>{
  const original=event({serviceId:'asof-night-test',start:'20h00',end:'08h00',nextDay:true,hours:12}),revised={...original,revision:2,end:'00h00',hours:4};
  const data=schedule([original,revised],5),summary=finance.month(data,'2026-11',4560000);
  assert.equal(finance.asOf(summary,'2026-11-04').committedCents,0);assert.equal(finance.asOf(summary,'2026-11-05').committedCents,12600);assert.equal(finance.asOf(summary,'2026-11-06').committedCents,12600);
  revised.cancelled=true;assert.equal(finance.asOf(finance.month(data,'2026-11',4560000),'2026-11-05').committedCents,0);
});

test('seis AC4 noturnos de LUIZ ANTONIO são previstos de 12h, sem duplicação ou execução presumida',()=>{
  const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);
  const summary=finance.month(data,'2026-11',4560000),dates=[10,12,17,19,24,26];
  const records=summary.records.filter(record=>record.event.serviceId?.startsWith('ac4-operacional-luiz-antonio-'));
  assert.equal(records.length,6);assert.equal(new Set(records.map(record=>record.key)).size,6);
  assert.deepEqual(plain(records.map(record=>[record.startDate,record.endDate,record.costCents])),[
    ['2026-11-10','2026-11-11',38100],['2026-11-12','2026-11-13',41100],['2026-11-17','2026-11-18',38100],['2026-11-19','2026-11-20',41100],['2026-11-24','2026-11-25',38100],['2026-11-26','2026-11-27',41100]
  ]);
  for(const record of records){
    assert.equal(record.member,'2º SGT LUIZ ANTONIO');assert.equal(record.minutes,720);assert.equal(record.start,'20h00');assert.equal(record.end,'08h00');assert.equal(record.financialMonth,'2026-11');
    assert.equal(record.category,'operational');assert.equal(record.status,'forecast');assert.equal(record.event.executionConfirmed,undefined);assert.deepEqual(plain(finance.documentInfo(record.event)),record.startDate==='2026-11-10'?{number:'356/2026',sei:'98274343'}:{number:'',sei:''});
  }
  for(const date of dates){const members=data['2026-11'].days.find(day=>day.day===date).members.filter(member=>member.name==='2º SGT LUIZ ANTONIO');assert.equal(members.length,1);assert.equal(members[0].ord,16);assert.equal(members[0].events.length,1);assert.equal(members[0].badges.length,0);}
  assert.equal(records.reduce((total,record)=>total+record.costCents,0),237600);
  assert.equal(summary.operationalCents,1378800);assert.equal(summary.satCents,318000);assert.equal(summary.committedCents,1696800);assert.equal(summary.forecastCents,600200);assert.equal(summary.executedCents,1096600);assert.equal(summary.remainingCents,2863200);
});

test('errata da OS 356 vincula os três AC4 de 10/11 sem duplicar serviços ou confirmar execução',()=>{
  const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]),summary=finance.month(data,'2026-11',4560000),records=summary.records.filter(record=>record.event.document?.includes('98274343'));
  assert.deepEqual(plain(records.map(record=>[record.member,record.startDate,record.start,record.endDate,record.end,record.costCents])),[
    ['1º SGT HELLYSSON','2026-11-10','08h00','2026-11-10','12h00',12000],
    ['2º SGT LUIZ ANTONIO','2026-11-10','20h00','2026-11-11','08h00',38100],
    ['3º SGT HENRIQUE','2026-11-10','08h00','2026-11-10','12h00',12000]
  ]);
  for(const record of records){assert.deepEqual(plain(finance.documentInfo(record.event)),{number:'356/2026',sei:'98274343'});assert(record.event.document.includes('OS original SEI 98070695'));assert(record.event.document.includes('202500011045608'));assert.equal(record.status,'forecast');assert.equal(record.event.executionConfirmed,undefined);}
  assert.equal(summary.records.length,46);assert.equal(summary.committedCents,1696800);assert.equal(summary.executedCents,1096600);assert.equal(summary.daily.get('2026-11-10').operationalCents,62100);assert.equal(summary.daily.get('2026-11-10').committedCents,107100);
  assert(records.filter(record=>record.member!=='2º SGT LUIZ ANTONIO').every(record=>record.event.mode==='PROEBOM 2026'));assert.equal(data['2026-11'].days[9].confirmation.status,'confirmed');
});

test('chefia respeita antiguidade, ausência, ODD e pendências de períodos parciais',()=>{
  const ordinary=(name,ord,badges=[{kind:'ord'}])=>member([],{name,ord,badges});
  const day={shiftStart:'08h00',members:[ordinary('ASP OF TESTE',1,[{kind:'officer'}]),ordinary('ST AUSENTE',2,[{kind:'disp'}]),ordinary('ST TESTE',3),ordinary('1º SGT TESTE',4)]};
  assert.equal(chief.select(day).assignments[0].name,'ST TESTE');
  assert.equal(chief.select({...day,members:[ordinary('ST SEM ORD',null)]}).status,'pending');
  assert.equal(chief.select({...day,members:[member([event({end:'20h00',hours:12})],{name:'ST PARCIAL',ord:2}),ordinary('ST TESTE',3)]}).status,'pending');
});

test('chefia não conta a anotação de TS como um segundo período ordinário',()=>{
  const ordinary=(name,ord,badges,extra={})=>member([],{name,ord,badges,...extra});
  const partial=ordinary('2º SGT TESTE',17,[{kind:'ord',hours:12,start:'20h00',end:'08h00',nextDay:true},{kind:'ts',hours:12,annotationOnly:true}],{serviceHours:12,serviceStart:'20h00'});
  const day={shiftStart:'08h00',members:[ordinary('ST TESTE',6,[{kind:'ord'}]),partial]};
  const result=chief.select(day);assert.equal(result.status,'selected');assert.equal(result.assignments[0].name,'ST TESTE');assert(!result.warnings.some(message=>/sobreposição/.test(message)));
  const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);
  for(const [number,name] of [[8,'ST PASSOS'],[29,'ST DA SILVA']]){
    const day=data['2026-11'].days.find(day=>day.day===number),result=chief.select(day);
    assert.equal(result.status,'selected');assert.equal(result.assignments[0].name,name);assert(!result.warnings.some(message=>/sobreposição/.test(message)));
    const partials=day.members.filter(m=>m.serviceHours===12);assert.equal(partials.length,2);
    assert.deepEqual(partials.map(m=>m.serviceHours),[12,12]);assert.equal(partials.reduce((sum,m)=>sum+m.serviceHours,0),24);
  }
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

const rankingPersonnel=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="ranking-personnel"'))[2]);

test('relação pública do ranking contém 27 praças e 3 oficiais sem dados pessoais adicionais',()=>{
  assert.equal(rankingPersonnel.length,30);
  assert.equal(rankingPersonnel.filter(person=>person.officer).length,3);
  assert.equal(rankingPersonnel.filter(person=>!person.officer).length,27);
  assert.deepEqual(rankingPersonnel.map(person=>person.ord),Array.from({length:30},(_,i)=>i+1));
  for(const person of rankingPersonnel)assert.deepEqual(Object.keys(person).sort(),['name','officer','ord']);
  assert.deepEqual(rankingPersonnel.slice(0,3).map(person=>person.name),['CAP FRANCISCO LINS','ASP OF BESSA','ASP OF CARVALHO']);
});

test('ranking mantém efetivo com zero AC4 e aplica antiguidade real ao incluir ou excluir oficiais',()=>{
  const summary=finance.month({},'2026-12');
  const options={personnel:rankingPersonnel,includeOfficers:false,sortBySeniority:true};
  const squares=finance.ranking(summary,'2026-11-06',true,options);
  assert.equal(squares.rows.length,27);assert.equal(squares.totalCents,0);assert.equal(squares.recordCount,0);
  assert.deepEqual(plain(squares.rows.map(person=>person.ord)),Array.from({length:27},(_,i)=>i+4));
  assert(squares.rows.every(person=>person.records.length===0&&person.totalCents===0));
  const all=finance.ranking(summary,'2026-11-06',true,{...options,includeOfficers:true});
  assert.equal(all.rows.length,30);assert.deepEqual(plain(all.rows.map(person=>person.ord)),Array.from({length:30},(_,i)=>i+1));
});

test('ranking filtra valores de oficiais e ordena por antiguidade independentemente do custo',()=>{
  const data={'2026-11':{days:[{day:3,members:[member([event()],{name:'ST VETERANO'}),member([event({end:'20h00',hours:12})],{name:'SD MODERNO'}),member([event()],{name:'CAP TESTE'})]}]}};
  const summary=finance.month(data,'2026-11'),personnel=[{name:'CAP TESTE',ord:1,officer:true},{name:'ST VETERANO',ord:4},{name:'SD MODERNO',ord:30}];
  const money=finance.ranking(summary,'2026-11-03',true,{personnel,includeOfficers:false});
  assert.deepEqual(plain(money.rows.map(person=>person.member)),['SD MODERNO','ST VETERANO']);assert.equal(money.totalCents,48000);
  const seniority=finance.ranking(summary,'2026-11-03',true,{personnel,includeOfficers:true,sortBySeniority:true});
  assert.deepEqual(plain(seniority.rows.map(person=>person.ord)),[1,4,30]);assert.equal(seniority.totalCents,60000);
  assert.equal(seniority.totalCents,seniority.operationalCents+seniority.satCents);
});

test('reforço adicional entra somente com AC4 até o corte e fica sem antiguidade inventada',()=>{
  const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);
  const summary=finance.month(data,'2026-11'),options={personnel:rankingPersonnel,includeOfficers:false,sortBySeniority:true};
  const before=finance.ranking(summary,'2026-11-07',false,options),after=finance.ranking(summary,'2026-11-07',true,options);
  assert.equal(before.rows.length,27);assert.equal(before.totalCents,709100);
  assert(!before.rows.some(person=>person.member==='1º SGT FERREIRA'));
  assert.equal(after.rows.length,28);assert.equal(after.totalCents,1000600);
  const extra=after.rows.at(-1);assert.equal(extra.member,'1º SGT FERREIRA');assert.equal(extra.ord,null);assert.equal(extra.totalCents,48000);
  const officers=finance.ranking(summary,'2026-11-07',true,{...options,includeOfficers:true});
  assert.equal(officers.rows.length,31);assert.equal(officers.totalCents,1096600);
  const full=finance.ranking(summary,'2026-12-01',true,{...options,includeOfficers:true});
  assert.equal(full.totalCents,summary.committedCents);assert.equal(full.totalCents,1696800);
});

test('ranking filtra início e fim inclusivos, somando Operacional e SAT pela data inicial do AC4',()=>{
  const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]),summary=finance.month(data,'2026-11');
  const range=(startDate,endDate)=>finance.ranking(summary,'2026-11-09',true,{startDate,endDate});
  const result=range('2026-11-12','2026-11-26');assert.equal(result.startDate,'2026-11-12');assert.equal(result.cutoffDate,'2026-11-26');assert.equal(result.recordCount,10);assert.equal(result.totalCents,377000);assert.equal(result.executedCents,0);assert.equal(result.forecastCents,377000);
  const luiz=result.rows.find(person=>person.member==='2º SGT LUIZ ANTONIO');assert.equal(luiz.records.length,5);assert.equal(luiz.monthlyRecords.length,9);assert.equal(luiz.totalCents,199500);assert.equal(result.rows[0].member,'2º SGT LUIZ ANTONIO');
  const twelfth=range('2026-11-12','2026-11-12');assert.equal(twelfth.operationalCents,41100);assert.equal(twelfth.satCents,42000);assert.equal(twelfth.totalCents,83100);
  const thirteenth=range('2026-11-13','2026-11-13');assert.equal(thirteenth.totalCents,135500);assert(!thirteenth.rows.some(person=>person.member==='2º SGT LUIZ ANTONIO'));
  assert.equal(range('2026-11-01','2026-11-30').totalCents,summary.committedCents);
});

test('intervalos sem AC4 mantêm os 27 praças, e filtros de oficiais e antiguidade usam os valores do período',()=>{
  const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]),summary=finance.month(data,'2026-11'),options={startDate:'2026-11-20',endDate:'2026-11-23',personnel:rankingPersonnel,includeOfficers:false};
  const empty=finance.ranking(summary,'2026-11-09',true,options);assert.equal(empty.rows.length,27);assert.equal(empty.totalCents,0);assert.equal(empty.recordCount,0);assert(!empty.rows.some(person=>person.member==='1º SGT FERREIRA'));
  const all=finance.ranking(summary,'2026-11-09',true,{...options,startDate:'2026-11-12',endDate:'2026-11-26',includeOfficers:true,sortBySeniority:true});assert.equal(all.rows.length,30);assert.deepEqual(plain(all.rows.map(person=>person.ord)),Array.from({length:30},(_,index)=>index+1));assert.equal(all.totalCents,377000);
});

test('ranking rejeita datas inválidas, fora do mês e intervalos invertidos',()=>{
  const summary=finance.month(schedule([event()]),'2026-11');
  for(const [startDate,endDate] of [['2026-11-31','2026-11-31'],['2026-10-31','2026-11-05'],['2026-11-01','2026-12-01'],['2026-11-05','2026-11-04'],['','2026-11-04'],[null,'2026-11-04']])assert.throws(()=>finance.ranking(summary,'2026-11-09',true,{startDate,endDate}),/ranking|selecionado/);
});

test('todos os intervalos dos meses cadastrados conferem com a diferença dos acumulados financeiros',()=>{
  const data=JSON.parse(scripts.find(([,attrs])=>attrs.includes('id="calendar-data"'))[2]);
  for(const period of Object.keys(data)){
    const summary=finance.month(data,period),days=[...summary.daily.values()].sort((a,b)=>a.date.localeCompare(b.date));
    for(let start=0;start<days.length;start++)for(let end=start;end<days.length;end++){
      const result=finance.ranking(summary,'2026-11-09',true,{startDate:days[start].date,endDate:days[end].date});
      assert.equal(result.totalCents,days[end].cumulativeCents-(days[start-1]?.cumulativeCents||0));assert.equal(result.operationalCents,days[end].cumulativeOperationalCents-(days[start-1]?.cumulativeOperationalCents||0));assert.equal(result.satCents,days[end].cumulativeSatCents-(days[start-1]?.cumulativeSatCents||0));
      assert.equal(result.totalCents,result.executedCents+result.forecastCents);assert(result.rows.every((person,index)=>!index||result.rows[index-1].totalCents>=person.totalCents));
    }
  }
});
