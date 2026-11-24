const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium}=require('playwright'),root=path.join(__dirname,'..');
const financialSnapshot=()=>Object.keys(window.ServiceCalendar.schedules).map(period=>{
  const f=window.AC4Finance.month(window.ServiceCalendar.schedules,period,window.ServiceCalendar.quotas[period]);
  return [period,f.committedCents,f.operationalCents,f.satCents,f.remainingCents,f.executedCents,f.forecastCents];
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
    page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-11-24T15:00:00Z'));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const source=await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),financial=await page.evaluate(financialSnapshot);
    const open=()=>page.locator('[data-ac4-ranking]').click(),close=()=>page.locator('#ac4-ranking-close').click();
    const filter=page.getByRole('checkbox',{name:'Desconsiderar militares que não tiveram serviços de AC4',exact:true});
    const row=name=>page.locator('.ranking-table tbody>.ranking-row').filter({has:page.locator('.ranking-person',{hasText:name})});
    const members=()=>page.locator('.ranking-table tbody>.ranking-row .ranking-identification').allTextContents();
    const checkMembers=async names=>assert.deepEqual((await members()).slice().sort(),names.slice().sort());
    const setRange=async(start,end)=>{await page.locator('#ac4-ranking-start').selectOption(start);await page.locator('#ac4-ranking-end').selectOption(end);};
    const checkTotals=async()=>{
      const values=await page.evaluate(()=>{
        const cents=text=>Math.round(Number(text.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))*100);
        return ['operational','sat','history','total'].map(kind=>{
          const cells=[...document.querySelectorAll(`.ranking-table tbody>.ranking-row .ranking-${kind} .ranking-amount`)];
          const total=document.querySelector(`.ranking-total-row .ranking-${kind} .ranking-amount`);
          return total?[cells.reduce((sum,cell)=>sum+cents(cell.textContent),0),cents(total.textContent)]:[0,0];
        });
      });for(const [sum,total]of values)assert.equal(total,sum);
    };
    await open();assert.equal(await filter.isChecked(),false);
    assert.equal(await filter.getAttribute('checked'),null);
    assert(await filter.evaluate(input=>input.closest('label').previousElementSibling.querySelector('#ac4-ranking-seniority')!==null));
    await setRange('2026-11-21','2026-11-21');assert.equal(await row('HELLYSSON').count(),1);
    assert(!(await row('HELLYSSON').locator('.ranking-history').textContent()).includes('R$ 0,00'));
    await row('HELLYSSON').locator('.ranking-person').click();
    await filter.check();await checkMembers(['ST DA SILVA','SD PICCINI']);
    assert.equal(await page.locator('.ranking-services-row:visible').count(),0);
    assert.deepEqual(await page.locator('.ranking-table tbody>.ranking-row .ranking-position').allTextContents(),['1','2']);
    await checkTotals();
    for(const count of ['0','1','2','3','4']){
      await page.locator('#ac4-ranking-history').selectOption(count);await checkMembers(['ST DA SILVA','SD PICCINI']);await checkTotals();
    }
    await page.evaluate(()=>{
      const project=window.RankingImage.project;
      window.RankingImage.project=(...args)=>{const result=project(...args);window.filteredRankingImage=result;return result;};
    });
    await page.locator('#ac4-ranking-share').click();
    await page.waitForFunction(()=>document.getElementById('ranking-share-dialog').open&&document.getElementById('ranking-share-image').naturalWidth===1280);
    const shared=await page.evaluate(()=>window.filteredRankingImage.rows);
    assert.equal(shared.length,2);assert(shared.some(r=>r.member.includes('DA SILVA')));assert(shared.some(r=>r.member.includes('PICCINI')));assert(!shared.some(r=>r.member.includes('HELLYSSON')));
    assert.deepEqual(shared.map(r=>r.order),['1','2']);await page.locator('#ranking-share-close').click();
    await page.locator('#ac4-ranking-seniority').check();
    assert.deepEqual(await page.locator('.ranking-table tbody>.ranking-row .ranking-position').allTextContents(),['5','27']);
    await setRange('2026-11-21','2026-11-22');
    await checkMembers(['ST DA SILVA','SD PICCINI','ST PASSOS','SD SANTOS','2º SGT LUIZ ANTONIO']);await checkTotals();
    await setRange('2026-11-27','2026-11-27');
    await checkMembers(['3º SGT BERTONCELLO','3º SGT ROBERTO','3º SGT VALÉRIA']);await checkTotals();
    await setRange('2026-11-20','2026-11-20');
    await checkMembers(['1º SGT HELLYSSON','2º SGT WANDERSON','CB RABELO']);
    await page.locator('#ac4-ranking-officers').check();
    await checkMembers(['ASP OF CARVALHO','1º SGT HELLYSSON','2º SGT WANDERSON','CB RABELO']);
    await checkTotals();await page.locator('#ac4-ranking-history').selectOption('3');
    for(const width of [1280,760,390,320]){
      await page.setViewportSize({width,height:1000});
      const layout=await filter.evaluate(input=>{
        const label=input.closest('label').getBoundingClientRect(),previous=document.getElementById('ac4-ranking-seniority').closest('label').getBoundingClientRect();
        return {below:label.top>=previous.bottom,left:label.left,right:label.right};
      });assert(layout.below);assert(layout.left>=0&&layout.right<=width);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await page.locator('#ac4-ranking-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
      assert(await page.locator('.ranking-table .ranking-row').evaluateAll(rows=>rows.every(row=>row.scrollWidth<=row.clientWidth+1)));
      if(width===320)await page.locator('.ranking-controls').screenshot({path:path.join(os.tmpdir(),'ranking-exclude-zero-320.png'),animations:'disabled'});
    }
    await page.locator('#ac4-ranking-officers').uncheck();await close();await open();assert(await filter.isChecked());
    await checkMembers(['1º SGT HELLYSSON','2º SGT WANDERSON','CB RABELO']);
    await close();await page.locator('#mes-seguinte').click();await open();assert(await filter.isChecked());
    assert.equal((await members()).length,0);assert(await page.locator('.ranking-empty').isVisible());assert(await page.locator('#ac4-ranking-share').isDisabled());
    await setRange('2026-12-01','2026-12-31');await checkMembers(['2º SGT LUIZ ANTONIO']);await checkTotals();
    await close();await page.locator('#mes-seguinte').click();await open();assert(await filter.isChecked());
    assert.equal((await members()).length,0);assert((await page.locator('.ranking-empty').textContent()).includes('diferente de zero'));assert(await page.locator('#ac4-ranking-share').isDisabled());
    await filter.uncheck();assert((await members()).length>=27);await filter.check();assert.equal((await members()).length,0);
    await close();await page.locator('#mes-anterior').click();await open();await checkMembers(['2º SGT LUIZ ANTONIO']);assert(await filter.isChecked());
    assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),source);assert.deepEqual(await page.evaluate(financialSnapshot),financial);
    await page.reload();await open();assert.equal(await filter.isChecked(),false);assert((await members()).length>=27);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),source);assert.deepEqual(await page.evaluate(financialSnapshot),financial);assert.deepEqual(errors,[]);
    console.log('PASS: unchecked default, checkbox placement, inclusive date/value filtering independent of history, officers/seniority, totals/details/numbering/shared PNG, empty periods, month/modal persistence, reload reset and preserved data/financials; desktop/320/390/760px.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
