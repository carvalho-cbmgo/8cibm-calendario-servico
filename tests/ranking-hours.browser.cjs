const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require('playwright');
const root = path.join(__dirname,'..');
const snapshot = () => Object.keys(window.ServiceCalendar.schedules).map(period => {
  const s = window.AC4Finance.month(window.ServiceCalendar.schedules,period,window.ServiceCalendar.quotas[period]);
  return [period,s.committedCents,s.operationalCents,s.satCents,s.forecastCents,s.executedCents,s.remainingCents];
});

(async () => {
  const files = {'/':'index.html','/assets/cbmgo-emblema.png':'assets/cbmgo-emblema.png','/assets/whatsapp.svg':'assets/whatsapp.svg'};
  const server = http.createServer((req,res) => {
    const file = files[req.url];
    if (!file) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root,file)));
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true});
    const page = await browser.newPage({viewport:{width:1280,height:1000},timezoneId:'America/Sao_Paulo'}), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-23T15:00:00Z'));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const source = await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules));
    const finances = await page.evaluate(snapshot);
    const open = async () => { await page.locator('[data-ac4-ranking]').click(); await page.locator('#ac4-ranking-history').selectOption('0'); };
    const close = () => page.locator('#ac4-ranking-close').click();
    const row = name => page.locator('.ranking-table tbody>.ranking-row').filter({has:page.locator('.ranking-person',{hasText:name})});
    const hours = name => row(name).locator('.ranking-hours');
    const verify = async (name,monthly,selected,status,text) => {
      const box=hours(name);
      assert.equal(await box.count(),1);assert.equal(await box.getAttribute('data-monthly-minutes'),String(monthly));
      assert.equal(await box.getAttribute('data-period-minutes'),String(selected));assert.equal(await box.getAttribute('data-limit-status'),status);
      assert((await box.textContent()).includes(text));
    };
    for (const width of [1280,390,320]) {
      await page.setViewportSize({width,height:1000});await open();
      await page.locator('#ac4-ranking-end').selectOption('2026-11-23');await page.locator('#ac4-ranking-start').selectOption('2026-11-01');
      await verify('LUIZ ANTONIO',8640,6480,'available','Restam 48h');
      assert.equal(await hours('LUIZ ANTONIO').locator('.ranking-hours-value').textContent(),'144h / 192h');
      assert((await page.locator('#ac4-ranking-hours-note').textContent()).includes('Histórico e simulações não somam horas'));
      await page.locator('#ac4-ranking-start').selectOption('2026-11-21');await page.locator('#ac4-ranking-end').selectOption('2026-11-21');
      await verify('LUIZ ANTONIO',8640,0,'available','No intervalo: 0h');
      for(const count of ['3','4']){await page.locator('#ac4-ranking-history').selectOption(count);await verify('LUIZ ANTONIO',8640,0,'available','Restam 48h');}
      const personButton=row('LUIZ ANTONIO').locator('.ranking-person');
      if(await personButton.getAttribute('aria-expanded')==='false')await personButton.click();
      const note=await page.locator('.ranking-services-row:visible .ranking-service-note').first().textContent();
      assert(note.includes('Execução confirmada: 36h'));assert(note.includes('Previstas: 108h'));
      await page.locator('#ac4-ranking-officers').check();await page.locator('#ac4-ranking-seniority').check();
      await verify('LUIZ ANTONIO',8640,0,'available','Restam 48h');
      assert.equal(await page.locator('.ranking-table tbody>.ranking-row .ranking-hours').count(),await page.locator('.ranking-table tbody>.ranking-row').count());
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await page.locator('#ac4-ranking-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
      assert(await page.locator('.ranking-table .ranking-row').evaluateAll(rows=>rows.every(row=>row.scrollWidth<=row.clientWidth+1)));
      await page.locator('#ac4-ranking-officers').uncheck();await page.locator('#ac4-ranking-seniority').uncheck();
      await page.locator('#ac4-ranking-history').selectOption('0');await page.locator('#ac4-ranking-end').selectOption('2026-11-30');await page.locator('#ac4-ranking-start').selectOption('2026-11-01');
      // Full-period hour subtotals are queried after the November services end.
      await page.clock.setFixedTime(new Date('2026-12-01T15:00:00Z'));await page.locator('#ac4-ranking-history').selectOption('0');
      await verify('WANDERSON',6780,6780,'available','Restam 79h');await verify('VALÉRIA',480,480,'available','Restam 184h');
      if(width!==390){
        await page.locator('#ac4-ranking-dialog').screenshot({path:path.join(os.tmpdir(),`ranking-hours-${width}.png`),animations:'disabled'});
        await row('LUIZ ANTONIO').screenshot({path:path.join(os.tmpdir(),`ranking-hours-row-${width}.png`),animations:'disabled'});
      }
      await close();
    }
    await page.setViewportSize({width:1280,height:1000});
    await page.locator('[data-ac4-simulation]').click();await page.locator('#ac4-simulation-target').selectOption('8');await page.locator('#ac4-simulation-confirm').click();
    await open();await verify('LUIZ ANTONIO',8640,8640,'available','Restam 48h');
    assert.equal(await page.locator('.ranking-person').filter({hasText:'PREVISTO AC4'}).count(),0);await close();
    await page.locator('[data-ac4-simulation]').click();await page.locator('#ac4-simulation-disregard').click();
    await page.locator('#mes-seguinte').click();await open();await verify('LUIZ ANTONIO',720,0,'available','Restam 180h');await close();
    await page.locator('#mes-seguinte').click();await open();await verify('LUIZ ANTONIO',0,0,'available','Restam 192h');await close();
    await page.locator('#mes-anterior').click();await page.locator('#mes-anterior').click();
    assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),source);
    await page.evaluate(()=>{
      for(const number of [27,28]){
        const day=window.ServiceCalendar.schedules['2026-11'].days.find(d=>d.day===number);
        let person=day.members.find(m=>m.name==='2º SGT LUIZ ANTONIO');
        if(!person){person={name:'2º SGT LUIZ ANTONIO',ord:16,badges:[],notes:[],events:[]};day.members.push(person);}
        person.events.push({serviceId:`ranking-hours-fixture-${number}`,mode:'OPERACIONAL/SOP',start:'08h00',end:'08h00',nextDay:true,hours:24,status:'planned'});
      }
      window.ServiceCalendar.refresh();
    });
    await open();await page.locator('#ac4-ranking-start').selectOption('2026-11-21');await page.locator('#ac4-ranking-end').selectOption('2026-11-21');
    await verify('LUIZ ANTONIO',11520,0,'reached','Limite atingido');
    await page.evaluate(()=>{
      const day=window.ServiceCalendar.schedules['2026-11'].days.find(d=>d.day===29),person=day.members.find(m=>m.name==='2º SGT LUIZ ANTONIO');
      person.events.push({serviceId:'ranking-hours-fixture-extra',mode:'OPERACIONAL/SOP',start:'08h00',end:'08h30',hours:0.5,status:'planned'});
      window.ServiceCalendar.refresh();
    });
    await verify('LUIZ ANTONIO',11550,0,'exceeded','Excede em 0h30');
    assert.equal(await hours('LUIZ ANTONIO').locator('.ranking-hours-value').textContent(),'192h30 / 192h');
    await page.evaluate(()=>{
      const e=window.ServiceCalendar.schedules['2026-11'].days.find(d=>d.day===29).members.flatMap(m=>m.events).find(e=>e.serviceId==='ranking-hours-fixture-extra');
      e.hours=1;window.ServiceCalendar.refresh();
    });
    await verify('LUIZ ANTONIO',11520,0,'reached','Limite atingido');
    assert((await page.locator('#ac4-ranking-hours-note').textContent()).includes('registros inválidos'));
    await page.evaluate(()=>{
      const events=window.ServiceCalendar.schedules['2026-11'].days.flatMap(d=>d.members.flatMap(m=>m.events));
      const e=events.find(e=>e.serviceId==='ranking-hours-fixture-extra');e.hours=0.5;e.cancelled=true;
      events.find(e=>e.serviceId==='ranking-hours-fixture-27').cancelled=true;window.ServiceCalendar.refresh();
    });
    await verify('LUIZ ANTONIO',10080,0,'available','Restam 24h');
    await page.evaluate(source=>{Object.assign(window.ServiceCalendar.schedules,JSON.parse(source));window.ServiceCalendar.refresh();},source);
    await verify('LUIZ ANTONIO',8640,0,'available','Restam 48h');
    assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),source);
    assert.deepEqual(await page.evaluate(snapshot),finances);assert.deepEqual(errors,[]);
    console.log('PASS: monthly/range AC4 hours, 192h exact/exceeded/remaining, fractional hours, history/filters, zero hours and month rollover, simulation excluded, live refresh/cancellation/invalid warnings, preserved data/finances; desktop/320/390px.');
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
