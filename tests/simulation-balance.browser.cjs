const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');

const root=path.join(__dirname,'..'),normalize=text=>text.replace(/\s+/g,' ').trim();
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const decimal=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const money=cents=>normalize(currency.format(cents/100));

(async()=>{
 const server=http.createServer((req,res)=>{
  const file={'/':'index.html','/index.html':'index.html','/assets/cbmgo-emblema.png':'assets/cbmgo-emblema.png','/assets/whatsapp.svg':'assets/whatsapp.svg'}[req.url];
  if(!file){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(root,file)));
 });
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:1000},timezoneId:'America/Sao_Paulo'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-08T15:00:00Z'));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const original=await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules));
  const configure=async(target,enabled=true)=>{
   await page.locator('[data-ac4-simulation]').click();
   await page.locator('#ac4-simulation-target').selectOption(String(target));
   await page.locator('#ac4-simulation-enabled').setChecked(enabled);
   await page.locator('#ac4-simulation-confirm').click();
  };
  const verify=async(active,target=6)=>{
   const result=await page.evaluate(({active,target})=>{
    const {schedules,period,quotas}=window.ServiceCalendar,real=window.AC4Finance.month(schedules,period,quotas[period]);
    const extra=active?window.ServiceSimulation.plan(schedules,period,quotas[period],real,target).summary.records:[];
    const sum=(records,date,cumulative)=>records.filter(r=>r.valid&&r.status!=='cancelled'&&(cumulative?r.startDate<=date:r.startDate===date)).reduce((total,r)=>total+r.commitmentCents,0);
    const read=element=>{
     const copy=element.cloneNode(true);copy.querySelectorAll('.simulation-delta').forEach(node=>node.remove());
     return {text:copy.textContent,deltas:[...element.querySelectorAll('.simulation-delta')].map(node=>node.textContent)};
    };
    return {quota:real.quotaCents,days:schedules[period].days.map(day=>{
     const date=`${period}-${String(day.day).padStart(2,'0')}`,card=document.getElementById(`dia-${String(day.day).padStart(2,'0')}`);
     return {date,actual:sum(real.records,date,false),actualCumulative:sum(real.records,date,true),extra:sum(extra,date,false),extraCumulative:sum(extra,date,true),
      service:read(card.querySelector('.daily-finance-service .daily-finance-value')),total:read(card.querySelector('.daily-finance-total .daily-finance-value')),balance:read(card.querySelector('.daily-balance .daily-finance-value'))};
    })};
   },{active,target});
   const ratio=cents=>result.quota>0?`${decimal.format(cents/result.quota*100)}%`:'—';
   const row=(actual,base,delta,date)=>{
    assert.equal(normalize(actual.text),`${money(base+delta)} | ${ratio(base+delta)}`,date);
    assert.deepEqual(actual.deltas,delta?[`(${delta<0?'−':'+'}${decimal.format(Math.abs(delta)/100)})`,...(result.quota>0?[`(${delta<0?'−':'+'}${ratio(Math.abs(delta))})`]:[])]:[],`${date} variação acumulada`);
   };
   let previousBalance=result.quota;
   for(const day of result.days){
    row(day.service,day.actual,day.extra,`${day.date} serviço`);
    row(day.total,day.actualCumulative,day.extraCumulative,`${day.date} total`);
    if(result.quota===null){assert.equal(day.balance.text,'COTA NÃO INFORMADA');continue;}
    row(day.balance,result.quota-day.actualCumulative,-day.extraCumulative,`${day.date} disponível`);
    const balance=result.quota-day.actualCumulative-day.extraCumulative;
    assert.equal(balance,previousBalance-day.actual-day.extra,`${day.date}: saldo anterior menos o gasto do serviço`);
    assert.equal(balance+day.actualCumulative+day.extraCumulative,result.quota,`${day.date}: disponível + total = cota`);
    previousBalance=balance;
   }
   return result;
  };
  await verify(false);
  await configure(6);const six=await verify(true);
  assert.deepEqual(six.days.filter(d=>[12,13,14,30].includes(Number(d.date.slice(8)))).map(d=>six.quota-d.actualCumulative-d.extraCumulative),[3121100,2886100,2687100,808900]);
  assert.equal(six.days[26].extra,0);assert.equal(six.days[26].extraCumulative,six.days[25].extraCumulative);
  await configure(4);await verify(true,4);
  await configure(10);const ten=await verify(true,10);assert(ten.quota-ten.days.at(-1).actualCumulative-ten.days.at(-1).extraCumulative<0);
  await configure(6);
  const location=await page.evaluate(()=>{
   const day=window.ServiceCalendar.schedules['2026-11'].days.find(d=>d.day===12),member=day.sat.members.find(m=>m.events.some(event=>event.hours===4));
   return {period:'2026-11',day:12,area:'sat',member:member.name,eventIndex:member.events.findIndex(event=>event.hours===4)};
  });
  const saved=await page.evaluate(location=>{
   const member=window.ServiceCalendar.schedules[location.period].days.find(d=>d.day===location.day).sat.members.find(m=>m.name===location.member);
   return JSON.parse(JSON.stringify(member.events[location.eventIndex]));
  },location);
  await page.evaluate(location=>window.ServiceCalendar.updateAC4(location,{end:'13h00',hours:5}),location);
  const changed=await verify(true);assert.equal(changed.days[11].actual,six.days[11].actual+3000);
  await page.evaluate(location=>window.ServiceCalendar.updateAC4(location,{cancelled:true}),location);await verify(true);
  await page.evaluate(({location,saved})=>{
   const member=window.ServiceCalendar.schedules[location.period].days.find(d=>d.day===location.day).sat.members.find(m=>m.name===location.member),event=member.events[location.eventIndex];
   for(const key of Object.keys(event))delete event[key];Object.assign(event,saved);window.ServiceCalendar.refresh();
  },{location,saved});
  await verify(true);
  for(const width of [320,390,760,1280]){
   await page.setViewportSize({width,height:1000});
   for(const day of [12,13,14,27,28,30]){
    if(width<=760)await page.locator('#selecionar-dia').selectOption(String(day));
    const balance=page.locator(`#dia-${String(day).padStart(2,'0')} .daily-balance`);assert(await balance.isVisible());
   }
   await verify(true);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
  }
  await page.locator('#mes-seguinte').click();await verify(true);
  await page.locator('#mes-seguinte').click();await verify(true);
  await page.locator('#mes-anterior').click();await page.locator('#mes-anterior').click();await verify(true);
  await configure(6,false);await verify(false);assert.equal(await page.locator('.simulation-delta').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),original);
  assert.deepEqual(errors,[]);
  console.log('PASS: saldo diário = saldo anterior − AC4 real/simulado do serviço; valores, percentuais e deltas em todos os dias; metas 4/6/10, saldo negativo, alteração/cancelamento, dias sem gasto, meses sem cota, celular e desativação.');
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
