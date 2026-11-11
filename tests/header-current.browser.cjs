const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),normalize=text=>text.replace(/\s+/g,' ').trim();
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}),decimal=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const money=cents=>normalize(currency.format(cents/100));

(async()=>{
 const server=http.createServer((req,res)=>{
  const file={'/':'index.html','/index.html':'index.html','/assets/cbmgo-emblema.png':'assets/cbmgo-emblema.png','/assets/whatsapp.svg':'assets/whatsapp.svg'}[req.url];
  if(!file){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,file)));
 });let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:1000},timezoneId:'America/Sao_Paulo'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-09T15:00:00Z'));await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const source=await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules));
  const configure=async(target=6,active=true)=>{await page.locator('[data-ac4-simulation]').click();await page.locator('#ac4-simulation-target').selectOption(String(target));await page.locator('#ac4-simulation-enabled').setChecked(active);await page.locator('#ac4-simulation-confirm').click();};
  const verify=async(date,active=false,target=6)=>{
   const expected=await page.evaluate(({date,active,target})=>{
    const {schedules,period,quotas}=window.ServiceCalendar,summary=window.AC4Finance.month(schedules,period,quotas[period]),extra=active?window.ServiceSimulation.plan(schedules,period,quotas[period],summary,target).summary.records:[];
    const totals=records=>{const included=records.filter(record=>record.valid&&record.status!=='cancelled'&&record.startDate<=date);return {total:included.reduce((sum,record)=>sum+record.commitmentCents,0),op:included.filter(record=>record.category==='operational').reduce((sum,record)=>sum+record.commitmentCents,0),sat:included.filter(record=>record.category==='sat').reduce((sum,record)=>sum+record.commitmentCents,0)};};
    return {real:totals(summary.records),extra:totals(extra),quota:summary.quotaCents};
   },{date,active,target});
   assert.equal(await page.locator('.current-finance time').getAttribute('datetime'),date);
   assert.equal(await page.locator('.current-finance time').textContent(),date.split('-').reverse().join('/'));
   const ratio=cents=>expected.quota>0?`${decimal.format(cents/expected.quota*100)}%`:'—';
   for(const [kind,base,delta] of [['total',expected.real.total,expected.extra.total],['operational',expected.real.op,expected.extra.op],['sat',expected.real.sat,expected.extra.sat],['available',expected.quota===null?null:expected.quota-expected.real.total,-expected.extra.total]]){
    const row=page.locator(`.current-finance-${kind}`);
    const clean=async selector=>normalize(await row.locator(selector).evaluate(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('.simulation-delta').forEach(node=>node.remove());return copy.textContent;}));
    assert.equal(await clean('.current-finance-amount'),base===null?'Não informada':money(base+delta));assert.equal(await clean('.current-finance-share'),`| ${base===null?'—':ratio(base+delta)}`);
    assert.equal(await row.locator('.current-finance-amount .simulation-delta').count(),delta&&base!==null?1:0);
   }
   return expected;
  };
  let expected=await verify('2026-11-09');assert.equal(expected.real.total,1197700);assert.equal(expected.real.op,1017700);assert.equal(expected.real.sat,180000);
  for(const active of [false,true]){
   if(active)await configure(10);
   for(const width of [320,390,760,761,1000,1100,1101,1280,1800,2400]){
    await page.setViewportSize({width,height:1000});await verify('2026-11-09',active,10);
    const layout=await page.evaluate(()=>{
     const box=element=>{const r=element.getBoundingClientRect();return {x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
     const text=element=>{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),node=walker.nextNode(),range=document.createRange();range.selectNodeContents(node);return box({getBoundingClientRect:()=>range.getBoundingClientRect()});};
     const rows=[...document.querySelectorAll('.current-finance-row')].map(row=>({label:text(row.querySelector('.current-finance-label')),amount:box(row.querySelector('.current-finance-amount')),share:box(row.querySelector('.current-finance-share'))}));
     const monthly=[...document.querySelectorAll('.finance-metric')].map(row=>({label:box(row.querySelector('.finance-metric-label')),amount:box(row.querySelector('.finance-metric-amount'))}));
     const title=document.querySelector('.header-title'),titleRange=document.createRange();titleRange.selectNodeContents(title);
     return {overflow:document.documentElement.scrollWidth>innerWidth,rows,monthly,heading:box(document.querySelector('.finance-toolbar h2')),days:box(document.querySelector('.finance-days-remaining>span')),dayValue:box(document.querySelector('.finance-days-remaining>strong')),current:box(document.getElementById('ac4-current-summary')),control:box(document.getElementById('ac4-month-summary')),header:box(document.querySelector('.header')),logo:box(document.querySelector('.header-emblem')),titleRows:[...titleRange.getClientRects()].map(rect=>Math.round(rect.top)),titleRight:titleRange.getBoundingClientRect().right};
    });
    assert(!layout.overflow,`overflow ${width}`);assert(layout.logo.x>=layout.header.x&&layout.logo.right<=layout.header.right,`logo ${width}`);
    for(const row of layout.rows){assert(Math.abs(row.amount.x-layout.rows[0].amount.x)<1,`valores ${width}`);assert(Math.abs(row.share.x-layout.rows[0].share.x)<1,`percentuais ${width}`);}
    assert(Math.abs(layout.rows[1].label.x-layout.rows[0].label.x-12)<1);assert(Math.abs(layout.rows[2].label.x-layout.rows[0].label.x-12)<1);assert(Math.abs(layout.rows[3].label.x-layout.rows[0].label.x)<1);
    if(width>760){
     for(const row of layout.monthly){assert(Math.abs(row.label.x-layout.heading.x)<1,`rótulos mensais ${width}`);assert(Math.abs(row.amount.x-layout.monthly[0].amount.x)<1,`valores mensais ${width}`);assert(row.amount.x-row.label.right<100,`distância mensal ${width}`);}
     assert(Math.abs(layout.days.x-layout.heading.x)<1);assert(Math.abs(layout.dayValue.x-layout.monthly[0].amount.x)<1);
    }else{assert.equal(new Set(layout.titleRows).size,1,`título móvel ${width}`);assert(layout.titleRight<=layout.header.right,`título cortado ${width}`);}
    if(width>=1101)assert(layout.current.right<=layout.control.x+1,`bloco à esquerda da divisória ${width}`);
    const scroll=page.locator('.current-finance-scroll');await scroll.evaluate(el=>el.scrollLeft=el.scrollWidth);assert(await scroll.evaluate(el=>[...el.querySelectorAll('.current-finance-share')].every(share=>share.getBoundingClientRect().right<=el.getBoundingClientRect().right+1)));await scroll.evaluate(el=>el.scrollLeft=0);
    if([390,1280,1800].includes(width))await page.locator('.header').screenshot({path:`/tmp/header-current-${active?'simulation':'normal'}-${width}.png`,animations:'disabled'});
   }
  }
  await page.clock.setFixedTime(new Date('2026-11-12T15:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));expected=await verify('2026-11-12',true,10);assert.equal(expected.extra.total,0);
  await configure(6);expected=await verify('2026-11-12',true,6);assert.equal(expected.real.total+expected.extra.total,1438900);
  await page.locator('#mes-seguinte').click();await verify('2026-11-12',true);assert.equal(await page.locator('.current-finance-available .current-finance-amount').textContent(),'Não informada');
  await page.locator('#mes-anterior').click();await configure(6,false);
  await page.clock.setFixedTime(new Date('2026-11-09T15:00:00Z'));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await verify('2026-11-09');
  await page.evaluate(()=>window.ServiceCalendar.updateAC4({period:'2026-11',day:9,member:'SD PICCINI'},{end:'20h00',endDate:'2026-11-09',nextDay:false,hours:12}));expected=await verify('2026-11-09');assert.equal(expected.real.total,1159600);
  await page.evaluate(source=>{Object.assign(window.ServiceCalendar.schedules,JSON.parse(source));window.ServiceCalendar.refresh();},source);await verify('2026-11-09');
  await page.clock.setFixedTime(new Date('2026-12-05T15:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));expected=await verify('2026-12-05');assert.equal(expected.real.total,2460200);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),source);assert.deepEqual(errors,[]);
  console.log('PASS: AC4 CORRENTE inclusivo e por modalidade, valores/percentuais e recuos alinhados; controle mensal compacto; hoje, passado/futuro, simulação, atualização de AC4 e data de Brasília; 320–2400px sem overflow e título móvel preservado.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
