const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), os = require('node:os');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const channels = color => color.match(/\d+/g).slice(0, 3).map(Number);
const luminance = color => channels(color).map(value => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (text, background) => {
  const values = [luminance(text), luminance(background)].sort((a,b) => b-a);
  return (values[0]+0.05)/(values[1]+0.05);
};

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
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, timezoneId: 'America/Sao_Paulo' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-19T15:00:00Z'));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const source = await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules));
    const checkSummary = async () => {
      const styles = await page.evaluate(() => {
        const panel = document.getElementById('ac4-current-summary'), style = getComputedStyle(panel);
        const heading = getComputedStyle(panel.querySelector('h2'));
        return {
          background: style.backgroundColor, border: style.borderWidth,
          heading: heading.color, headingBackground: heading.backgroundColor, weight: Number(heading.fontWeight),
          rows: ['total','operational','sat','available'].map(kind => [...panel.querySelector(`.current-finance-${kind}`).children].map(el => ({ color: getComputedStyle(el).color, weight: Number(getComputedStyle(el).fontWeight) }))),
        };
      });
      assert(channels(styles.background).every(value => value >= 235));
      assert.equal(styles.border, '1px');
      assert(contrast(styles.heading, styles.headingBackground) >= 4.5);
      assert(styles.weight >= 800);
      assert.equal(new Set(styles.rows.map(row => row[0].color)).size, 4);
      for (const row of styles.rows) {
        assert.equal(row.length, 3);
        assert(row.every(cell => cell.color === row[0].color && contrast(cell.color, styles.background) >= 4.5));
      }
      assert([...styles.rows[0], ...styles.rows[3]].every(cell => cell.weight >= 800));
      assert.equal(await page.locator('.current-finance h2').textContent(), 'AC4 HOJE - 19/11/2026');
      assert((await page.locator('.current-finance-total .current-finance-amount').textContent()).includes('26.330,00'));
      assert((await page.locator('.current-finance-available .current-finance-amount').textContent()).includes('19.510,00'));
    };
    assert.deepEqual(await page.locator('.day.is-scale-confirmed').evaluateAll(cards => cards.map(c => Number(c.dataset.day))), Array.from({ length: 25 }, (_, i) => i + 1));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      await checkSummary();
      assert.equal(await page.locator('.current-finance time').getAttribute('datetime'), '2026-11-19');
      assert((await page.locator('#ac4-month-summary').textContent()).includes('41.863,00'));
      for (const day of [1, 25, 26]) {
        if (width < 761) await page.locator('#selecionar-dia').selectOption(String(day));
        const card = page.locator(`.day[data-day="${day}"]`);
        assert.equal(await card.locator('.scale-confirmed-label').count(), day <= 25 ? 1 : 0);
        const toggle = card.locator('[data-area-toggle="operational"]');
        if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
        await card.locator('.operational-section [data-details]').click();
        const note = page.locator('.scale-confirmation-note');
        if (day <= 25) assert((await note.textContent()).includes(day === 1 ? '05/11/2026' : '19/11/2026'));
        else assert.equal(await note.count(), 0);
        await page.locator('#fechar-detalhes').click();
      }
      await page.locator('[data-ac4-simulation]').click();
      await page.locator('#ac4-simulation-target').selectOption('6');
      await page.locator('#ac4-simulation-confirm').click();
      assert.equal(await page.locator('.is-scale-confirmed .simulation-entry').count(), 0);
      assert.deepEqual(await page.locator('.simulation-entry').evaluateAll(rows => rows.map(row => Number(row.closest('.day').dataset.day))), [28, 28, 30]);
      assert((await page.locator('#ac4-month-summary').textContent()).includes('44.594,00'));
      assert((await page.locator('#ac4-month-summary').textContent()).includes('1.246,00'));
      await checkSummary();
      await page.locator('[data-ac4-simulation]').click();
      await page.locator('#ac4-simulation-disregard').click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('.header').screenshot({ path: path.join(os.tmpdir(), `confirmation-summary-${width}.png`), animations: 'disabled' });
    }
    await page.clock.setFixedTime(new Date('2026-11-20T15:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    assert.equal(await page.locator('.current-finance time').textContent(), '20/11/2026');
    assert.equal(await page.locator('.current-finance h2').textContent(), 'AC4 HOJE - 20/11/2026');
    assert.equal(await page.locator('.day.is-today').getAttribute('data-day'), '20');
    await page.locator('#mes-seguinte').click();
    assert.equal(await page.locator('.day.is-scale-confirmed').count(), 0);
    assert((await page.locator('.current-finance-available').textContent()).includes('38.000,00'));
    await page.locator('#mes-anterior').click();
    assert.equal(await page.locator('.day.is-scale-confirmed').count(), 25);
    assert.equal(await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules)), source);
    assert.deepEqual(errors, []);
    console.log('PASS: AC4 HOJE dynamic title, soft background, four distinct category colors with readable contrast and matching label/value/percentage, real/simulated totals, 1-25 November confirmations and preserved data; desktop/320/390px.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
