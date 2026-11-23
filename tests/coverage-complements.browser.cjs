const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),root=path.join(__dirname,'..');
const snapshot=()=>Object.keys(window.ServiceCalendar.schedules).map(period=>{
  const f=window.AC4Finance.month(window.ServiceCalendar.schedules,period,window.ServiceCalendar.quotas[period]);
  return [period,f.committedCents,f.operationalCents,f.satCents,f.forecastCents,f.executedCents,f.remainingCents];
});
(async()=>{
  const files={'/':'index.html','/assets/cbmgo-emblema.png':'assets/cbmgo-emblema.png','/assets/whatsapp.svg':'assets/whatsapp.svg'};
  const server=http.createServer((req,res)=>{
    const file=files[req.url];if(!file){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,file)));
  });let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:1000},timezoneId:'America/Sao_Paulo'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-11-23T15:00:00Z'));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const source=await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),financial=await page.evaluate(snapshot);
    const card=page.locator('.day[data-day="24"]'),total=card.locator('.resource-total');
    const configure=async(target,enabled=true)=>{await page.locator('[data-ac4-simulation]').click();await page.locator('#ac4-simulation-target').selectOption(String(target));await page.locator(enabled?'#ac4-simulation-confirm':'#ac4-simulation-disregard').click();};
    const refreshHellysson=async extra=>page.evaluate(extra=>{
      const day=window.ServiceCalendar.schedules['2026-11'].days.find(d=>d.day===24),event=day.members.find(m=>m.name==='1º SGT HELLYSSON').events[0];
      Object.assign(event,extra);window.ServiceCalendar.refresh();
    },extra);
    for(const width of [1280,390,320]){
      await page.setViewportSize({width,height:1000});if(width<761)await page.locator('#selecionar-dia').selectOption('24');
      const toggle=card.locator('[data-area-toggle="operational"]');if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
      assert.equal(await total.textContent(),'6 recursos de 24h');assert((await total.getAttribute('title')).includes('Turnos complementares'));
      assert.equal(await card.locator('.resource-ordinary').textContent(),'5 ORD');assert.equal(await card.locator('.resource-ac4').textContent(),'2 AC4');
      for(const [name,time]of [['HELLYSSON','8h às 20h'],['LUIZ ANTONIO','20h às 8h']]){
        const member=card.locator('.operational-roster .entry').filter({has:page.locator('.name',{hasText:name})});
        assert.equal(await member.count(),1);assert.equal(await member.locator('.chip.ac4').textContent(),'AC4 12h');assert.equal(await member.locator('.ac4-period').textContent(),time);
      }
      await configure(6);assert.equal(await total.textContent(),'6 recursos de 24h');assert.equal(await card.locator('.simulation-entry').count(),0);
      await configure(6,false);assert.equal(await total.textContent(),'6 recursos de 24h');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await page.evaluate(()=>{
      const d=window.ServiceCalendar.schedules['2026-11'].days.find(d=>d.day===24);d.coverage=['99 recursos de 24h','Texto antigo'];delete d.confirmation;window.ServiceCalendar.refresh();
    });
    assert.equal(await total.textContent(),'6 recursos de 24h');
    await configure(6);assert.equal(await card.locator('.simulation-entry').count(),0);
    await page.locator('#whatsapp-vacancies-button').click();await page.locator('#vacancy-start').selectOption('2026-11-24');await page.locator('#vacancy-end').selectOption('2026-11-24');
    assert((await page.locator('#vacancy-message').inputValue()).includes('Sem vagas'));await page.locator('#vacancy-close').click();
    await configure(7);assert.equal(await total.textContent(),'7 recursos de 24h');assert.equal(await card.locator('.simulation-entry').count(),1);assert.equal(await card.locator('.simulation-entry .chip.ac4').textContent(),'AC4 24h');
    await configure(6,false);
    await refreshHellysson({integrante_operacional:false});assert.equal(await total.textContent(),'5 recursos de 24h');
    await refreshHellysson({integrante_operacional:true,cancelled:true});assert.equal(await total.textContent(),'5 recursos de 24h');
    await refreshHellysson({cancelled:false,end:'19h59',hours:719/60});assert.equal(await total.textContent(),'5 recursos de 24h');
    await refreshHellysson({end:'20h00',hours:12});assert.equal(await total.textContent(),'6 recursos de 24h');
    await page.evaluate(()=>{
      const d=window.ServiceCalendar.schedules['2026-11'].days.find(d=>d.day===24),e=d.members.find(m=>m.name==='2º SGT LUIZ ANTONIO').events[0];
      Object.assign(e,{start:'08h00',end:'20h00',nextDay:false,endDate:'2026-11-24'});window.ServiceCalendar.refresh();
    });assert.equal(await total.textContent(),'5 recursos de 24h');
    await page.evaluate(source=>{Object.assign(window.ServiceCalendar.schedules,JSON.parse(source));window.ServiceCalendar.refresh();},source);
    assert.equal(await total.textContent(),'6 recursos de 24h');assert.equal(await page.locator('.day[data-day="26"] .resource-total').textContent(),'5 recursos de 24h');
    assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),source);assert.deepEqual(await page.evaluate(snapshot),financial);assert.deepEqual(errors,[]);
    console.log('PASS: 24/11 five ordinary + two complementary AC4 = six resources; runtime coverage without simulation/stale labels, explicit PROEBOM designation, exclusions/cancellation/gaps/overlap, full-shift reinforcement only when needed, preserved data and finances; desktop/320/390px.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
