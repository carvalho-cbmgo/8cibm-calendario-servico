const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');

(async () => {
  const files = { '/': 'index.html', '/assets/cbmgo-emblema.png': 'assets/cbmgo-emblema.png', '/assets/whatsapp.svg': 'assets/whatsapp.svg' };
  const server = http.createServer((req,res) => {
    const file = files[req.url];
    if (!file) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root,file)));
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    browser = await chromium.launch({ executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless:true });
    const page = await browser.newPage({ viewport:{width:1280,height:1000}, timezoneId:'America/Sao_Paulo' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-19T15:00:00Z'));
    await page.addInitScript(() => {
      window.ClipboardItem = class { constructor(items) { this.items=items; } async getType(type) { return this.items[type]; } };
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{window.copiedAdjustment=await(await items[0].getType('text/html')).text();}}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const source = await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules));
    await page.evaluate(async () => {
      const roster = JSON.parse(document.getElementById('ranking-personnel').textContent);
      const people = roster.map(person => {
        const match=person.name.match(/^(CAP|ASP OF|ST|[123]º SGT|CB|SD) (.+)$/);
        return {identificacao_site:person.name,graduacao:`${match[1]} ${person.officer?'QOC':'QP/COMBATENTE'}`,rg:String(90000+person.ord),nome_completo:`${match[2]} MILITAR DE TESTE`,nome_guerra:match[2],ord:person.ord};
      });
      await window.ServiceDirectory.importFile(new File([JSON.stringify({pessoal_referencia:people})],'cadastro-ficticio.json'));
    });
    const openDay = async number => {
      if(page.viewportSize().width<761)await page.locator('#selecionar-dia').selectOption(String(number));
      const card=page.locator(`.day[data-day="${number}"]`),toggle=card.locator('[data-area-toggle="operational"]');
      if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
      return card;
    };
    const copy = async kind => {
      await page.evaluate(()=>{window.copiedAdjustment=null;});
      await page.locator(`#sei-copy-${kind}`).click();
      await page.waitForFunction(()=>window.copiedAdjustment);
      return page.evaluate(()=>{const box=document.createElement('div');box.innerHTML=window.copiedAdjustment;return {headers:box.querySelectorAll('th').length,rows:[...box.querySelectorAll('tr')].map(row=>[...row.cells].map(cell=>cell.textContent))};});
    };
    for(const width of [1280,390,320]) {
      await page.setViewportSize({width,height:1000});
      let card=await openDay(19);
      assert.equal(await card.locator('.chip.chief').count(),1);
      assert.equal(await card.locator('.entry').filter({has:page.locator('.name',{hasText:'TAVARES'})}).locator('.chip.chief').textContent(),'ACA');
      assert.equal(await card.locator('.entry').filter({has:page.locator('.name',{hasText:'DA SILVA'})}).locator('.chip.chief').count(),0);
      assert(!(await card.locator('.operational-section').textContent()).includes('PENDENTE DE CONFERÊNCIA'));
      await card.locator('.operational-section [data-sei-day]').click();
      const tav=page.locator('#sei-scale-table tbody tr').filter({has:page.locator('td:nth-child(3)',{hasText:'TAVARES'})});
      assert.equal(await tav.locator('td').nth(1).textContent(),'CHEFE DE ALA');
      const copiedChief=await copy('scale');
      assert.equal(copiedChief.headers,0);
      assert.equal(copiedChief.rows.filter(row=>row[1]==='CHEFE DE ALA'&&row[2].includes('TAVARES')).length,1);
      await page.locator('#sei-close').click();
      for(const [number,name,hours,endDate,cost,resources,mode] of [
        [20,'HELLYSSON',24,'21/11/2026','995,00',6,'OPERACIONAL/SOP'],
        [22,'LUIZ ANTONIO',24,'23/11/2026','965,00',7,'OPERACIONAL/SOP'],
        [23,'NIKHOLAS',12,'23/11/2026','360,00',6,'OPERACIONAL/SOP'],
        [24,'HELLYSSON',12,'24/11/2026','360,00',6,'PROEBOM 2026'],
      ]) {
        card=await openDay(number);
        assert.equal(await card.locator('.resource-total').textContent(),`${resources} recursos de 24h`);
        const member=card.locator('.operational-roster .entry').filter({has:page.locator('.name',{hasText:name})});
        assert.equal(await member.count(),1);
        assert.equal(await member.locator('.chip.ac4').textContent(),`AC4 ${hours}h`);
        assert.equal(await member.locator('.ac4-period').textContent(),hours===24?'8h às 8h':'8h às 20h');
        assert((await member.locator('.ac4-cost').textContent()).includes(cost));
        await card.locator('.operational-section [data-sei-day]').click();
        const row=page.locator('#sei-order-table tbody tr').filter({hasText:name}),cells=await row.locator('td').allTextContents();
        assert.deepEqual([cells[0],cells[1],cells[2],cells[3],cells[6]],[`${number}/11/2026`,'08h00',endDate,hours===24?'08h00':'20h00',`${hours}h`]);
        const scope=page.locator('#sei-order-scope');
        const orderNumber={20:'385',22:'387',23:'388',24:'389'}[number];
        assert((await scope.textContent()).includes(`OS nº ${orderNumber}`));
        if(await scope.isEnabled())await scope.selectOption(await scope.locator('option').filter({hasText:`OS nº ${orderNumber}`}).filter({hasText:mode}).getAttribute('value'));
        const copied=await copy('order');
        assert.equal(copied.headers,0);assert.equal(copied.rows.length,[20,22].includes(number)?3:number===23?2:1);
        const copiedMember=copied.rows.filter(row=>row[4].includes(name));
        assert.equal(copiedMember.length,1);assert.equal(copiedMember[0][2],endDate);assert.equal(copiedMember[0][6],`${hours}h`);
        await page.locator('#sei-close').click();
      }
      assert((await page.locator('#ac4-month-summary').textContent()).includes('45.840,00'));
      assert((await page.locator('#ac4-month-summary').textContent()).includes('41.863,00'));
      assert((await page.locator('#ac4-month-summary').textContent()).includes('3.977,00'));
      assert((await page.locator('.current-finance-available .current-finance-amount').textContent()).includes('19.510,00'));
      await page.locator('[data-ac4-simulation]').click();await page.locator('#ac4-simulation-target').selectOption('6');await page.locator('#ac4-simulation-confirm').click();
      assert.equal(await page.locator('.simulation-entry').count(),3);
      assert.equal(await page.locator('.day[data-day="22"] .simulation-entry').count(),0);
      assert((await page.locator('#ac4-month-summary').textContent()).includes('44.594,00'));
      assert((await page.locator('#ac4-month-summary').textContent()).includes('1.246,00'));
      await page.locator('[data-ac4-simulation]').click();await page.locator('#ac4-simulation-disregard').click();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),source);
    assert.deepEqual(errors,[]);
    console.log('PASS: TAVARES ACA for 24h on 19/11 in calendar/ES/clipboard, HELLYSSON 20/24, LUIZ 22, NIKHOLAS 23, times/costs/OS copies, quota R$ 45840, real/simulated balances and preserved data; desktop/320/390px.');
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
