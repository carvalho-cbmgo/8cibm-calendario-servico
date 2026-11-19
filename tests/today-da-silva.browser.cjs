const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), os = require('node:os');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');

(async () => {
  const files = { '/': 'index.html', '/index.html': 'index.html', '/assets/cbmgo-emblema.png': 'assets/cbmgo-emblema.png', '/assets/whatsapp.svg': 'assets/whatsapp.svg' };
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, timezoneId: 'Asia/Tokyo' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-19T15:00:00Z') });
    await page.clock.setFixedTime(new Date('2026-11-19T15:00:00Z'));
    await page.addInitScript(() => {
      window.ClipboardItem = class { constructor(items) { this.items = items; } async getType(type) { return this.items[type]; } };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async text => { window.copiedSEI = text; },
        write: async items => { window.copiedOS = await (await items[0].getType('text/html')).text(); },
      } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    const source = await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules));
    const verifyToday = async date => {
      assert.equal(await page.locator('.day.is-today').count(), 1);
      assert.equal(await page.locator('.day[aria-current="date"]').count(), 1);
      const card = page.locator('.day.is-today');
      assert.equal(await card.getAttribute('data-day'), String(Number(date.slice(8))));
      assert.equal(await card.locator('.day-today').getAttribute('datetime'), date);
      assert.equal(await card.locator('.day-today').textContent(), `HOJE · ${date.split('-').reverse().join('/')}`);
      assert.equal(await card.evaluate(el => getComputedStyle(el).outlineWidth), '3px');
    };
    await verifyToday('2026-11-19');
    await page.evaluate(async () => {
      const roster = JSON.parse(document.getElementById('ranking-personnel').textContent);
      const people = roster.map(person => {
        const match = person.name.match(/^(CAP|ASP OF|ST|[123]º SGT|CB|SD) (.+)$/);
        return { identificacao_site: person.name, graduacao: `${match[1]} ${person.officer ? 'QOC' : 'QP/COMBATENTE'}`, rg: String(90000 + person.ord), nome_completo: `${match[2]} MILITAR DE TESTE`, nome_guerra: match[2], ord: person.ord };
      });
      await window.ServiceDirectory.importFile(new File([JSON.stringify({ pessoal_referencia: people })], 'cadastro-ficticio.json'));
    });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await verifyToday('2026-11-19');
      if (width < 761) assert.equal(await page.locator('#selecionar-dia').inputValue(), '19');
      const card = page.locator('.day[data-day="19"]'), toggle = card.locator('[data-area-toggle="operational"]');
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      assert.equal(await card.locator('.resource-total').textContent(), '6 recursos de 24h');
      assert.equal(await card.locator('.resource-ac4').textContent(), '2 AC4');
      const member = card.locator('.operational-roster .entry').filter({ has: page.locator('.name', { hasText: 'ST DA SILVA' }) });
      assert.equal(await member.count(), 1);
      assert.equal(await member.locator('.chip.ac4').textContent(), 'AC4 12h');
      assert.equal(await member.locator('.ac4-period').textContent(), '8h às 20h');
      assert((await member.locator('.ac4-cost').textContent()).includes('360,00'));
      await member.locator('[data-copy-sei="98682020"]').click();
      assert.equal(await page.evaluate(() => window.copiedSEI), '98682020');
      await card.locator('.operational-section [data-sei-day]').click();
      const row = page.locator('#sei-order-table tbody tr').filter({ hasText: 'DA SILVA' });
      const cells = await row.locator('td').allTextContents();
      assert.deepEqual([cells[0], cells[1], cells[2], cells[3], cells[6]], ['19/11/2026', '08h00', '19/11/2026', '20h00', '12h']);
      const notes = await page.locator('#sei-scale-table tbody tr').filter({ has: page.locator('td:nth-child(3)', { hasText: 'DA SILVA' }) }).locator('td').nth(4).textContent();
      assert(notes.includes('383') && notes.includes('98682020'));
      assert((await page.locator('#sei-validation').textContent()).includes('chefia'));
      const option = await page.locator('#sei-order-scope option').filter({ hasText: '383' }).getAttribute('value');
      await page.locator('#sei-order-scope').selectOption(option);
      await page.evaluate(() => { window.copiedOS = null; });
      await page.locator('#sei-copy-order').click();
      await page.waitForFunction(() => window.copiedOS);
      const copied = await page.evaluate(() => { const box = document.createElement('div'); box.innerHTML = window.copiedOS; return { rows: box.querySelectorAll('tr').length, headers: box.querySelectorAll('th').length, text: box.textContent }; });
      assert.equal(copied.rows, 1); assert.equal(copied.headers, 0); assert(copied.text.includes('DA SILVA'));
      await page.locator('#sei-close').click();
      await page.locator('[data-ac4-simulation]').click();
      await page.locator('#ac4-simulation-target').selectOption('6');
      await page.locator('#ac4-simulation-confirm').click();
      assert.equal(await card.locator('.simulation-entry').count(), 0);
      await verifyToday('2026-11-19');
      await page.locator('[data-ac4-simulation]').click();
      await page.locator('#ac4-simulation-disregard').click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await card.screenshot({ path: path.join(os.tmpdir(), `today-da-silva-${width}.png`), animations: 'disabled' });
    }
    await page.locator('#mes-seguinte').click();
    assert.equal(await page.locator('.day.is-today,.day[aria-current="date"],.day-today').count(), 0);
    await page.locator('#mes-anterior').click();
    await verifyToday('2026-11-19');
    await page.locator('#selecionar-dia').selectOption('18');
    await page.clock.setFixedTime(new Date('2026-11-20T03:01:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await verifyToday('2026-11-20');
    assert.equal(await page.locator('#selecionar-dia').inputValue(), '18');
    await page.clock.setFixedTime(new Date('2026-11-21T15:00:00Z'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await verifyToday('2026-11-21');
    await page.clock.setFixedTime(new Date('2026-11-22T15:00:00Z'));
    await page.clock.runFor(60000);
    await verifyToday('2026-11-22');
    assert.equal(await page.locator('#selecionar-dia').inputValue(), '18');
    await page.clock.setFixedTime(new Date('2026-11-19T02:30:00Z'));
    await page.reload();
    await verifyToday('2026-11-18'); // Tokyo is already on 19/11; Brasília is still on 18/11.
    await page.clock.setFixedTime(new Date('2026-11-19T03:10:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await verifyToday('2026-11-19');
    await page.clock.setFixedTime(new Date('2027-01-01T02:30:00Z'));
    await page.reload();
    await verifyToday('2026-12-31');
    await page.clock.setFixedTime(new Date('2027-01-01T03:10:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    assert.equal(await page.locator('.day.is-today').count(), 0);
    await page.locator('#mes-seguinte').click();
    await verifyToday('2027-01-01');
    assert.equal(await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules)), source);
    assert.deepEqual(errors, []);
    console.log('PASS: today banner/outline/accessibility, Brasília timezone independent of browser, page return/minute rollover without changing selection, month/year navigation; DA SILVA 12h/R$ 360, SEI 98682020, ES/OS/clipboard and six resources without simulated day shift; desktop/320/390px.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
