const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require('playwright'), root = path.join(__dirname, '..');
const files = { '/': 'index.html', '/assets/cbmgo-emblema.png': 'assets/cbmgo-emblema.png', '/assets/whatsapp.svg': 'assets/whatsapp.svg' };
(async () => {
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, timezoneId: 'America/Sao_Paulo' }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-18T15:00:00Z'));
    await page.addInitScript(() => {
      window.ClipboardItem = class { constructor(items) { this.items = items; } async getType(type) { return this.items[type]; } };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {}, write: async items => { window.copiedProebom = await (await items[0].getType('text/html')).text(); } } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      const roster = JSON.parse(document.getElementById('ranking-personnel').textContent);
      const people = roster.map(person => {
        const match = person.name.match(/^(CAP|ASP OF|ST|[123]º SGT|CB|SD) (.+)$/);
        return { identificacao_site: person.name, graduacao: `${match[1]} ${person.officer ? 'QOC' : 'QP/COMBATENTE'}`, rg: String(90000 + person.ord), nome_completo: `${match[2]} MILITAR DE TESTE`, nome_guerra: match[2], ord: person.ord };
      });
      await window.ServiceDirectory.importFile(new File([JSON.stringify({ pessoal_referencia: people })], 'cadastro-ficticio.json'));
    });
    const source = await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules));
    for (const width of [1280, 390, 320]) for (const day of [24, 26]) {
      const names = day === 24 ? ['HELLYSSON'] : ['HENRIQUE', 'HELLYSSON'];
      const serviceCount = day === 24 ? 2 : 3;
      await page.setViewportSize({ width, height: 1000 });
      if (width <= 760) await page.locator('#selecionar-dia').selectOption(String(day));
      const card = page.locator(`.day[data-day="${day}"]`), toggle = card.locator('[data-area-toggle="operational"]');
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      assert.equal(await card.locator('.resource-total').textContent(), '6 recursos de 24h');
      assert.equal(await card.locator('.resource-ac4').textContent(), `${serviceCount} AC4`);
      for (const name of names) {
        const hours = day === 24 || name === 'HENRIQUE' ? 12 : 8, cost = hours === 12 ? '360,00' : '240,00';
        const row = card.locator('.operational-roster .entry').filter({ has: page.locator('.name', { hasText: name }) });
        assert.equal(await row.count(), 1);
        assert.equal(await row.locator('.chip.ac4').textContent(), `AC4 ${hours}h`);
        assert.equal(await row.locator('.ac4-period').textContent(), hours === 12 ? '8h às 20h' : '8h às 16h');
        assert((await row.locator('.ac4-cost').textContent()).includes(cost));
      }
      await card.locator('.operational-section [data-sei-day]').click();
      assert.equal(await page.locator('#sei-order-table tbody tr').count(), serviceCount);
      for (const name of names) {
        const hours = day === 24 || name === 'HENRIQUE' ? 12 : 8, end = hours === 12 ? '20h00' : '16h00';
        const order = page.locator('#sei-order-table tbody tr').filter({ hasText: name });
        assert.equal(await order.count(), 1);
        const cells = await order.locator('td').allTextContents();
        assert.deepEqual([cells[0], cells[1], cells[2], cells[3], cells[6]], [`${day}/11/2026`, '08h00', `${day}/11/2026`, end, `${hours}h`]);
        const scale = page.locator('#sei-scale-table tbody tr').filter({ has: page.locator('td:nth-child(3)', { hasText: name }) });
        assert.equal(await scale.count(), 1);
        const notes = await scale.locator('td').nth(4).textContent();
        assert(notes.includes(day === 24 ? 'PROEBOM 2026' : 'REFORÇO OPERACIONAL')); assert(notes.includes(day === 24 ? 'OS nº 389 (SEI 98752623)' : 'OS nº 393 (SEI 98894389)')); assert(!notes.includes('98630755'));
      }
      await page.evaluate(() => { window.copiedProebom = null; });
      await page.locator('#sei-copy-order').click(); await page.waitForFunction(() => window.copiedProebom !== null);
      const copied = await page.evaluate(() => { const box = document.createElement('div'); box.innerHTML = window.copiedProebom; return [...box.querySelectorAll('tr')].map(r => [...r.cells].map(c => c.textContent)); });
      assert.equal(copied.length, serviceCount);
      for (const name of names) assert.equal(copied.filter(cells => cells[4].includes(name) && cells[6] === `${day === 24 || name === 'HENRIQUE' ? 12 : 8}h`).length, 1);
      await page.locator('#sei-close').click();
      await page.locator('[data-ac4-simulation]').click(); await page.locator('#ac4-simulation-target').selectOption('6'); await page.locator('#ac4-simulation-confirm').click();
      assert.equal(await card.locator('.simulation-entry').count(), 0);
      await page.locator('[data-ac4-simulation]').click(); await page.locator('#ac4-simulation-disregard').click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules)), source);
    assert.deepEqual(errors, []);
    console.log('PASS: HELLYSSON PROEBOM 12h/OS 389 em 24/11 e reforços operacionais HENRIQUE 12h/HELLYSSON 8h em 26/11, OS 393, períodos/valores/ES/OS/cópia, seis recursos e nenhum reforço simulado adicional; 1280/390/320px.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
