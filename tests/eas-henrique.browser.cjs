const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const note = 'Estágio Supervisionado do EAS (SEI 202600011025103) de 24h (8h às 8h).';
const files = {
  '/': 'index.html',
  '/assets/cbmgo-emblema.png': 'assets/cbmgo-emblema.png',
  '/assets/whatsapp.svg': 'assets/whatsapp.svg',
};

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
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, timezoneId: 'America/Sao_Paulo' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-11-16T15:00:00Z'));
    await page.addInitScript(() => {
      window.ClipboardItem = class { constructor(items) { this.items = items; } async getType(type) { return this.items[type]; } };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        write: async items => { window.copiedEas = await (await items[0].getType('text/html')).text(); },
        writeText: async () => {},
      } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      const roster = JSON.parse(document.getElementById('ranking-personnel').textContent);
      const people = roster.map(p => {
        const match = p.name.match(/^(CAP|ASP OF|ST|[123]º SGT|CB|SD) (.+)$/);
        return { identificacao_site: p.name, graduacao: `${match[1]} ${p.officer ? 'QOC' : 'QP/COMBATENTE'}`, rg: String(90000 + p.ord), nome_completo: `${match[2]} MILITAR DE TESTE`, nome_guerra: match[2], ord: p.ord };
      });
      await window.ServiceDirectory.importFile(new File([JSON.stringify({ pessoal_referencia: people })], 'cadastro-ficticio.json'));
    });
    const source = await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [number, resources, ordinary] of [[18, 7, 5], [23, 6, 6]]) {
        if (width <= 760) await page.locator('#selecionar-dia').selectOption(String(number));
        const card = page.locator(`.day[data-day="${number}"]`);
        const toggle = card.locator('[data-area-toggle="operational"]');
        if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
        const member = card.locator('.operational-roster .entry').filter({ has: page.locator('.name', { hasText: '3º SGT HENRIQUE' }) });
        assert.equal(await member.count(), 1);
        assert.equal(await member.locator('.chip.ord').textContent(), 'ESTÁGIO EAS');
        assert.equal(await member.locator('.ac4-period').textContent(), '8h às 8h');
        assert.equal(await member.locator('.chip.ac4').count(), 0);
        assert.equal(await card.locator('.resource-total').textContent(), `${resources} recursos de 24h`);
        assert.equal(await card.locator('.resource-ordinary').textContent(), `${ordinary} ORD`);
        await card.locator('.operational-section [data-details]').click();
        assert((await page.locator('#detalhes-conteudo').textContent()).includes(note));
        await page.locator('#fechar-detalhes').click();
        await card.locator('.operational-section [data-sei-day]').click();
        const row = page.locator('#sei-scale-table tbody tr').filter({ has: page.locator('td:nth-child(3)', { hasText: 'HENRIQUE' }) });
        assert.equal(await row.count(), 1);
        assert.equal(await row.locator('td').nth(4).textContent(), note);
        assert.equal(await row.locator('td').nth(5).textContent(), '');
        assert.equal(await row.locator('td').nth(6).textContent(), '');
        assert.equal(await page.locator('#sei-order-table tbody tr').filter({ hasText: 'HENRIQUE' }).count(), 0);
        await page.evaluate(() => { window.copiedEas = null; });
        await page.locator('#sei-copy-scale').click();
        await page.waitForFunction(() => window.copiedEas !== null);
        const copiedNote = await page.evaluate(() => {
          const box = document.createElement('div'); box.innerHTML = window.copiedEas;
          return [...box.querySelectorAll('tr')].find(r => r.cells[2]?.textContent.includes('HENRIQUE')).cells[4].textContent;
        });
        assert.equal(copiedNote, note);
        await page.locator('#sei-close').click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules)), source);
    assert.deepEqual(errors, []);
    console.log('PASS: EAS de HENRIQUE em 18 e 23/11, 24h/08h–08h, observação exata na ES e cópia, cobertura e ausência de AC4; computador e 320/390px.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
