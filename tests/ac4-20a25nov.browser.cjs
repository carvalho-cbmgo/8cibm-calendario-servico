const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const entries = [
  { day: 20, number: '385', sei: '98726048', resources: 6, services: 3, cost: '995,00', names: ['HELLYSSON', 'WANDERSON', 'RABELO'] },
  { day: 21, number: '386', sei: '98726048', resources: 6, services: 2, cost: '995,00', names: ['DA SILVA', 'PICCINI'] },
  { day: 22, number: '387', sei: '98726469', resources: 7, services: 3, cost: '965,00', names: ['PASSOS', 'LUIZ ANTONIO', 'SANTOS'] },
  { day: 25, number: '388', sei: '98752637', resources: 5, services: 2, cost: '741,00', names: ['DIEGO'] },
];

(async () => {
  const files = { '/': 'index.html', '/assets/cbmgo-emblema.png': 'assets/cbmgo-emblema.png', '/assets/whatsapp.svg': 'assets/whatsapp.svg' };
  const server = http.createServer((req, res) => {
    const file = files[req.url];
    if (!file) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root, file)));
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, timezoneId: 'America/Sao_Paulo' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-19T15:00:00Z'));
    await page.addInitScript(() => {
      window.ClipboardItem = class { constructor(items) { this.items = items; } async getType(type) { return this.items[type]; } };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async text => { window.copiedSEI = text; },
        write: async items => { window.copiedTable = await (await items[0].getType('text/html')).text(); },
      } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const source = await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules));
    await page.evaluate(async () => {
      const roster = JSON.parse(document.getElementById('ranking-personnel').textContent);
      const people = roster.map(person => {
        const match = person.name.match(/^(CAP|ASP OF|ST|[123]º SGT|CB|SD) (.+)$/);
        return { identificacao_site: person.name, graduacao: `${match[1]} ${person.officer ? 'QOC' : 'QP/COMBATENTE'}`, rg: String(90000+person.ord), nome_completo: `${match[2]} MILITAR DE TESTE`, nome_guerra: match[2], ord: person.ord };
      });
      await window.ServiceDirectory.importFile(new File([JSON.stringify({ pessoal_referencia: people })], 'cadastro-ficticio.json'));
    });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const item of entries) {
        if (width < 761) await page.locator('#selecionar-dia').selectOption(String(item.day));
        const card = page.locator(`.day[data-day="${item.day}"]`), toggle = card.locator('[data-area-toggle="operational"]');
        if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
        assert.equal(await card.locator('.scale-confirmed-label').count(), 1);
        assert.equal(await card.locator('.resource-total').textContent(), `${item.resources} recursos de 24h`);
        assert.equal(await card.locator('.resource-ac4').textContent(), `${item.services} AC4`);
        for (const name of item.names) {
          const row = card.locator('.operational-roster .entry').filter({ has: page.locator('.name', { hasText: name }) });
          assert.equal(await row.count(), 1);
          assert.equal(await row.locator('.chip.ac4').textContent(), 'AC4 24h');
          assert((await row.locator('.ac4-cost').textContent()).includes(item.cost));
          await row.locator(`[data-copy-sei="${item.sei}"]`).click();
          assert.equal(await page.evaluate(() => window.copiedSEI), item.sei);
        }
        await card.locator('.operational-section [data-sei-day]').click();
        assert.equal(await page.locator('#sei-order-table tbody tr').count(), item.services);
        for (const name of item.names) {
          const row = page.locator('#sei-order-table tbody tr').filter({ hasText: name });
          const cells = await row.locator('td').allTextContents();
          assert.deepEqual([cells[0],cells[1],cells[2],cells[3],cells[6]], [`${item.day}/11/2026`,'08h00',`${item.day+1}/11/2026`,'08h00','24h']);
          const notes = await page.locator('#sei-scale-table tbody tr').filter({ has: page.locator('td:nth-child(3)', { hasText: name }) }).locator('td').nth(4).textContent();
          assert(notes.includes(item.sei)); assert(notes.includes(item.number));
          assert(!notes.includes('XXX'));
        }
        const option = await page.locator('#sei-order-scope option').filter({ hasText: `OS nº ${item.number}` }).getAttribute('value');
        if (await page.locator('#sei-order-scope').isEnabled()) await page.locator('#sei-order-scope').selectOption(option);
        await page.evaluate(() => { window.copiedTable = null; });
        await page.locator('#sei-copy-order').click();
        await page.waitForFunction(() => window.copiedTable);
        const copied = await page.evaluate(() => { const box=document.createElement('div'); box.innerHTML=window.copiedTable; return { rows:[...box.querySelectorAll('tr')].map(row=>[...row.cells].map(c=>c.textContent)), headers:box.querySelectorAll('th').length }; });
        assert.equal(copied.rows.length, item.names.length); assert.equal(copied.headers, 0);
        assert(copied.rows.every(row => row[6] === '24h' && row[0] === `${item.day}/11/2026` && row[2] === `${item.day+1}/11/2026`));
        await page.evaluate(() => { window.copiedTable = null; });
        await page.locator('#sei-copy-scale').click();
        await page.waitForFunction(() => window.copiedTable);
        assert((await page.evaluate(() => window.copiedTable)).includes(`OS nº ${item.number} (SEI ${item.sei})`));
        assert(!(await page.evaluate(() => window.copiedTable)).includes('XXX'));
        await page.locator('#sei-close').click();
      }
      await page.locator('[data-ac4-simulation]').click();
      await page.locator('#ac4-simulation-target').selectOption('6');
      await page.locator('#ac4-simulation-confirm').click();
      assert.equal(await page.locator('.is-scale-confirmed .simulation-entry').count(), 0);
      assert.equal(await page.locator('.simulation-entry').count(), 0);
      await page.locator('[data-ac4-simulation]').click();
      await page.locator('#ac4-simulation-disregard').click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules)), source);
    assert.deepEqual(errors, []);
    console.log('PASS: 24h AC4 on 20/21/22/25 November, current OS/SEI and resolved OS 386 placeholder, calendar/ES/OS/clipboard, costs, confirmation and no new simulated vacancies; desktop/320/390px.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
