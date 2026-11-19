const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
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
    await page.clock.setFixedTime(new Date('2026-11-16T15:00:00Z'));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      const people = JSON.parse(document.getElementById('ranking-personnel').textContent).map(person => {
        const match = person.name.match(/^(CAP|ASP OF|ST|[123]º SGT|CB|SD) (.+)$/);
        return { identificacao_site: person.name, graduacao: `${match[1]} ${person.officer ? 'QOC' : 'QP/COMBATENTE'}`, rg: String(90000 + person.ord), nome_completo: `${match[2]} MILITAR DE TESTE`, nome_guerra: match[2], ord: person.ord };
      });
      await window.ServiceDirectory.importFile(new File([JSON.stringify({ pessoal_referencia: people })], 'cadastro-ficticio.json'));
    });
    const source = await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [period, number, end, resources] of [['2026-11', 22, '22/11/2026', 6], ['2026-11', 29, '29/11/2026', 6], ['2026-12', 6, '06/12/2026', 5]]) {
        let current = await page.evaluate(() => window.ServiceCalendar.period);
        while (current !== period) {
          await page.locator(current < period ? '#mes-seguinte' : '#mes-anterior').click();
          current = await page.evaluate(() => window.ServiceCalendar.period);
        }
        if (width <= 760) await page.locator('#selecionar-dia').selectOption(String(number));
        const card = page.locator(`.day[data-day="${number}"]`), toggle = card.locator('[data-area-toggle="operational"]');
        if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
        const member = card.locator('.operational-roster .entry').filter({ has: page.locator('.name', { hasText: 'LUIZ ANTONIO' }) });
        assert.equal(await member.count(), 1);
        assert.equal(await member.locator('.chip.ac4').textContent(), 'AC4 12h');
        assert.equal(await member.locator('.ac4-period').textContent(), '8h às 20h');
        assert((await member.locator('.ac4-cost').textContent()).includes('480,00'));
        assert.equal(await card.locator('.resource-total').textContent(), `${resources} recursos de 24h`);
        await card.locator('.operational-section [data-details]').click();
        assert((await page.locator('#detalhes-conteudo').textContent()).includes('LUIZ ANTONIO'));
        assert((await page.locator('#detalhes-conteudo').textContent()).includes('480,00'));
        await page.locator('#fechar-detalhes').click();
        await card.locator('.operational-section [data-sei-day]').click();
        const scale = page.locator('#sei-scale-table tbody tr').filter({ has: page.locator('td:nth-child(3)', { hasText: 'LUIZ ANTONIO' }) });
        const order = page.locator('#sei-order-table tbody tr').filter({ hasText: 'LUIZ ANTONIO' });
        assert.equal(await scale.count(), 1);
        assert.equal(await scale.locator('td').nth(5).textContent(), '12h');
        assert((await scale.locator('td').nth(4).textContent()).includes('PREVISTO'));
        assert.equal(await order.count(), 1);
        const cells = await order.locator('td').allTextContents();
        assert.deepEqual([cells[0], cells[1], cells[2], cells[3], cells[6]], [`${String(number).padStart(2, '0')}/${period.slice(5)}/2026`, '08h00', end, '20h00', '12h']);
        await page.locator('#sei-close').click();
        await page.locator('[data-ac4-simulation]').click();
        await page.locator('#ac4-simulation-target').selectOption('6');
        await page.locator('#ac4-simulation-confirm').click();
        const expected = period === '2026-12' ? 1 : 0;
        assert.equal(await card.locator('.simulation-entry').count(), expected);
        assert.deepEqual(await card.locator('.simulation-entry .ac4-period').allTextContents(), Array(expected).fill('8h às 8h'));
        assert.equal(await member.locator('.chip.ac4').textContent(), 'AC4 12h');
        assert((await member.locator('.ac4-cost').textContent()).includes('480,00'));
        await page.locator('#whatsapp-vacancies-button').click();
        const date = `${period}-${String(number).padStart(2, '0')}`;
        await page.locator('#vacancy-start').selectOption(date);
        await page.locator('#vacancy-end').selectOption(date);
        const message = await page.locator('#vacancy-message').inputValue();
        if (expected) assert(message.includes('AC4 24h (08h às 08h)')); else assert(message.includes('Sem vagas'));
        if (expected) assert(message.includes(expected === 2 ? '02 vagas' : '01 vaga'));
        assert(!message.includes('LUIZ ANTONIO'));
        assert(!message.includes('AC4 12h'));
        await page.locator('#vacancy-close').click();
        await page.locator('[data-ac4-simulation]').click();
        await page.locator('#ac4-simulation-disregard').click();
        assert.equal(await card.locator('.simulation-entry').count(), 0);
        assert.equal(await member.locator('.chip.ac4').textContent(), 'AC4 12h');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules)), source);
    assert.deepEqual(errors, []);
    console.log('PASS: três AC4 12h de LUIZ ANTONIO, R$ 480 cada, ES/OS preservadas e exclusão do cálculo dos reforços; vagas de 24h no calendário/WhatsApp e desativação sem alterar os serviços; 1280/390/320px.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
