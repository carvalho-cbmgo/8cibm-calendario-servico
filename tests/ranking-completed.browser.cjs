const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium}=require('playwright'),root=path.join(__dirname,'..');
const cents=text=>Math.round(Number(text.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))*100);
const financialSnapshot=()=>Object.keys(window.ServiceCalendar.schedules).map(period=>{
 const f=window.AC4Finance.month(window.ServiceCalendar.schedules,period,window.ServiceCalendar.quotas[period]);
 return [period,f.committedCents,f.executedCents,f.forecastCents,f.remainingCents];
});
(async()=>{
 const files={'/':'index.html','/assets/cbmgo-emblema.png':'assets/cbmgo-emblema.png','/assets/whatsapp.svg':'assets/whatsapp.svg'};
 const server=http.createServer((req,res)=>{const file=files[req.url];if(!file){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,file)));});let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true});
  for(const width of [1280,390,320]){
   // The browser is in Japan; all cutoffs and labels must still use Brasília.
   const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<761,hasTouch:width<761,timezoneId:'Asia/Tokyo'}),page=await context.newPage(),errors=[];
   page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
   await page.clock.setFixedTime(new Date('2026-11-24T22:00:00-03:00'));
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   const source=await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),finances=await page.evaluate(financialSnapshot);
   const open=page.locator('[data-ac4-ranking]');if(width<761)await open.tap();else await open.click();
   const history=page.locator('#ac4-ranking-history'),start=page.locator('#ac4-ranking-start'),end=page.locator('#ac4-ranking-end'),filter=page.locator('#ac4-ranking-exclude-zero');
   const row=name=>page.locator('.ranking-table tbody>.ranking-row').filter({has:page.locator('.ranking-person',{hasText:name})});
   const amount=async(name,column='total')=>cents(await row(name).locator(`.ranking-${column} .ranking-amount`).textContent());
   const range=async(first,last)=>{await start.selectOption(first);await end.selectOption(last);};
   const expand=async name=>{const button=row(name).locator('.ranking-person');if(await button.getAttribute('aria-expanded')!=='true')await button.click();};
   assert.equal(await history.inputValue(),'3');assert.equal(await end.inputValue(),'2026-11-24');
   await history.selectOption('0');await range('2026-11-24','2026-11-24');
   assert.equal(await amount('LUIZ ANTONIO'),0);assert.equal(await row('LUIZ ANTONIO').locator('.ranking-hours').getAttribute('data-period-minutes'),'0');
   assert.equal(await amount('HELLYSSON'),36000);
   assert((await page.locator('#ac4-ranking-status-note').textContent()).includes('24/11/2026, 22:00'));
   await expand('LUIZ ANTONIO');assert.equal(await page.locator('.ranking-services-row:visible .ranking-service-item').count(),0);
   assert((await page.locator('.ranking-services-row:visible').textContent()).includes('Nenhum AC4 finalizado'));
   await history.selectOption('3');assert.equal(await amount('LUIZ ANTONIO','operational'),0);
   const historical=await amount('LUIZ ANTONIO','history');assert(historical>0);assert.equal(await amount('LUIZ ANTONIO'),historical);
   assert.equal(cents(await page.locator('.ranking-total-row .ranking-history .ranking-amount').textContent()),17728600);
   await filter.check();assert.equal(await row('LUIZ ANTONIO').count(),0);assert.equal(await row('HELLYSSON').count(),1);
   await filter.uncheck();await history.selectOption('0');
   await expand('HELLYSSON');assert.equal(await page.locator('.ranking-services-row:visible .ranking-service-item').count(),1);
   assert.equal(await page.locator('.ranking-services-row:visible [data-ranking-date="2026-11-24"]').count(),1);
   assert.equal(await page.locator('.ranking-services-row:visible [data-included=false]').count(),0);
   await range('2026-11-25','2026-11-30');assert.equal(await amount('LUIZ ANTONIO'),89100);
   await expand('LUIZ ANTONIO');assert.equal(await page.locator('.ranking-services-row:visible .ranking-service-item').count(),2);
   await range('2026-11-24','2026-11-24');
   await page.clock.setFixedTime(new Date('2026-11-25T07:59:59.999-03:00'));await history.selectOption('0');assert.equal(await amount('LUIZ ANTONIO'),38100);
   await end.selectOption('2026-11-25');assert.equal(await amount('LUIZ ANTONIO'),0);
   // Expanding a row must take a fresh snapshot, even before the minute refresh.
   await page.clock.setFixedTime(new Date('2026-11-25T08:00:00-03:00'));await row('LUIZ ANTONIO').locator('.ranking-person').click();
   assert.equal(await amount('LUIZ ANTONIO'),38100);await expand('LUIZ ANTONIO');
   assert.equal(await page.locator('.ranking-services-row:visible .ranking-service-item').count(),1);
   assert.equal(await page.locator('.ranking-services-row:visible [data-ranking-date="2026-11-24"]').count(),1);
   assert((await page.locator('.ranking-services-row:visible .service-lookup-end').textContent()).includes('25/11/2026'));
   assert.equal(await page.locator('.ranking-services-row:visible .ranking-state').textContent(),'Previsto');
   assert.equal(await row('LUIZ ANTONIO').locator('.ranking-hours').getAttribute('data-period-minutes'),'720');
   // Sharing also refreshes the ranking before taking the PNG snapshot.
   await page.clock.setFixedTime(new Date('2026-11-24T19:59:00-03:00'));await range('2026-11-24','2026-11-24');assert.equal(await amount('HELLYSSON'),0);
   await page.evaluate(()=>{const original=window.RankingImage.project;window.RankingImage.project=(data,...args)=>{window.completedSharedRanking=data.rows.map(p=>({member:p.member,current:p.currentCents,records:p.records.length}));return original(data,...args);};});
   await page.clock.setFixedTime(new Date('2026-11-24T20:00:00-03:00'));await page.locator('#ac4-ranking-share').click();
   await page.waitForFunction(()=>document.getElementById('ranking-share-dialog').open&&document.getElementById('ranking-share-image').naturalWidth===1280);
   assert.deepEqual(await page.evaluate(()=>window.completedSharedRanking.find(p=>p.member.includes('HELLYSSON'))),{member:'1º SGT HELLYSSON',current:36000,records:1});
   await page.locator('#ranking-share-close').click();await expand('HELLYSSON');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await page.locator('#ac4-ranking-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
   await page.locator('#ac4-ranking-dialog').screenshot({path:path.join(os.tmpdir(),`ranking-completed-${width}.png`),animations:'disabled'});
   await page.locator('#ac4-ranking-close').click();
   // Service lookup keeps showing all registered services, including future ones.
   await page.locator('#service-lookup-button').click();await page.locator('#service-lookup-query').fill('LUIZ ANTONIO');
   assert((await page.locator('#service-lookup-results').textContent()).includes('29/11/2026'));
   assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),source);
   assert.deepEqual(await page.evaluate(financialSnapshot),finances);assert.deepEqual(errors,[]);await context.close();
  }
  // A ranking left open must refresh at the next minute, keeping the chosen row.
  const page=await browser.newPage({viewport:{width:1280,height:1000},timezoneId:'America/Sao_Paulo'});
  await page.clock.install({time:new Date('2026-11-24T19:58:00-03:00')});await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.clock.pauseAt(new Date('2026-11-24T19:59:00-03:00'));
  await page.locator('[data-ac4-ranking]').click();await page.locator('#ac4-ranking-history').selectOption('0');
  await page.locator('#ac4-ranking-start').selectOption('2026-11-24');await page.locator('#ac4-ranking-end').selectOption('2026-11-24');
  const luiz=page.locator('.ranking-table tbody>.ranking-row').filter({has:page.locator('.ranking-person',{hasText:'HELLYSSON'})});await luiz.locator('.ranking-person').click();
  assert.equal(cents(await luiz.locator('.ranking-total .ranking-amount').textContent()),0);
  await page.clock.fastForward(60000);
  assert.equal(cents(await luiz.locator('.ranking-total .ranking-amount').textContent()),36000);
  assert.equal(await luiz.locator('.ranking-person').getAttribute('aria-expanded'),'true');assert.equal(await page.locator('.ranking-services-row:visible .ranking-service-item').count(),1);
  await page.close();console.log('PASS: Fim hoje exige término até a consulta; outros períodos incluem previstos e serviços que terminam no dia seguinte; histórico, filtro, detalhes, PNG e atualização por minuto; fontes preservadas; computador/toque 320/390px com navegador em outro fuso.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
