const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');

async function importFictitiousDirectory(page) {
  await page.evaluate(async () => {
    const roster = JSON.parse(document.getElementById('ranking-personnel').textContent);
    const people = roster.map(person => {
      const match = person.name.match(/^(CAP|ASP OF|ST|[123]º SGT|CB|SD) (.+)$/);
      return {
        identificacao_site: person.name,
        graduacao: `${match[1]} ${person.officer ? 'QOC' : 'QP/COMBATENTE'}`,
        rg: String(90000 + person.ord), nome_completo: `${match[2]} MILITAR DE TESTE`,
        nome_guerra: match[2], ord: person.ord,
      };
    });
    await window.ServiceDirectory.importFile(new File([
      JSON.stringify({ pessoal_referencia: people }),
    ], 'cadastro-ficticio.json', { type: 'application/json' }));
  });
}

async function openSAT(page, day = 23) {
  if (page.viewportSize().width < 761) await page.locator('#selecionar-dia').selectOption(String(day));
  const card = page.locator(`.day[data-day="${day}"]`);
  const toggle = card.locator('[data-area-toggle="sat"]');
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  await card.locator('.sat-section [data-sei-day]').click();
}

async function setRange(page, start, end) {
  await page.locator('#sei-order-start').fill(start);
  await page.locator('#sei-order-end').fill(end);
}

async function tableRows(page) {
  return page.locator('#sei-order-table tbody tr').evaluateAll(rows =>
    rows.map(row => [...row.cells].map(cell => cell.textContent)));
}

async function copyRows(page) {
  await page.evaluate(() => { window.copiedOS = null; });
  await page.locator('#sei-copy-order').click();
  await page.waitForFunction(() => window.copiedOS);
  return page.evaluate(() => {
    const doc = new DOMParser().parseFromString(window.copiedOS.html, 'text/html');
    return {
      rows: [...doc.querySelectorAll('tr')].map(row => [...row.cells].map(cell => cell.textContent)),
      headers: doc.querySelectorAll('th,thead').length,
      plain: window.copiedOS.plain,
    };
  });
}

function financeSnapshot() {
  return Object.keys(window.ServiceCalendar.schedules).map(period => {
    const summary = window.AC4Finance.month(window.ServiceCalendar.schedules, period);
    return [period, summary.committedCents, summary.operationalCents, summary.satCents,
      summary.forecastCents, summary.executedCents, summary.records.length];
  });
}

(async () => {
  const files = {
    '/': 'index.html', '/assets/cbmgo-emblema.png': 'assets/cbmgo-emblema.png',
    '/assets/whatsapp.svg': 'assets/whatsapp.svg',
  };
  const server = http.createServer((req, res) => {
    const file = files[req.url];
    if (!file) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png'
      : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root, file)));
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH
        || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      headless: true, args: ['--no-sandbox'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, timezoneId: 'America/Sao_Paulo' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-18T15:00:00Z'));
    await page.addInitScript(() => {
      window.ClipboardItem = class { constructor(items) { this.items = items; } };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        write: async items => {
          window.copiedOS = {
            html: await items[0].items['text/html'].text(),
            plain: await items[0].items['text/plain'].text(),
          };
        },
      } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const source = await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules));
    const finances = await page.evaluate(financeSnapshot);
    await importFictitiousDirectory(page);

    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await openSAT(page);
      assert(await page.locator('#sei-order-period').isVisible());
      assert(await page.locator('#sei-scale-section').isHidden());
      assert.equal(await page.locator('#sei-order-start').inputValue(), '2026-11-23');
      assert.equal(await page.locator('#sei-order-end').inputValue(), '2026-11-23');
      assert.equal((await tableRows(page)).length, 3);
      await setRange(page, '2026-11-23', '2026-11-30');
      let rows = await tableRows(page);
      assert.equal(rows.length, 17);
      assert.equal(rows.reduce((sum, row) => sum + Number.parseInt(row[6], 10), 0), 100);
      assert.deepEqual(rows.map(row => row[0]), [
        '23/11/2026', '23/11/2026', '23/11/2026', '24/11/2026', '24/11/2026', '24/11/2026',
        '25/11/2026', '25/11/2026', '26/11/2026', '27/11/2026', '27/11/2026',
        '27/11/2026', '28/11/2026', '29/11/2026', '30/11/2026', '30/11/2026', '30/11/2026',
      ]);
      assert.equal(rows.filter(row => row[4].includes('VALÉRIA')).length, 2);
      assert.equal(rows.filter(row => row[4].includes('WANDERSON')).length, 3);
      assert(rows.filter(row => row[4].includes('WANDERSON')).every(row => row[6] === (row[0] === '23/11/2026' ? '4h' : '10h')));
      let copied = await copyRows(page);
      assert.deepEqual(copied.rows, rows);
      assert.equal(copied.headers, 0);
      assert.equal(copied.plain.split('\n').length, 17);
      const group388 = await page.locator('#sei-order-scope option').filter({ hasText: '388' }).getAttribute('value');
      await page.locator('#sei-order-scope').selectOption(group388);
      rows = await tableRows(page);
      assert.equal(rows.length, 2);
      assert.equal(rows.reduce((sum, row) => sum + Number.parseInt(row[6], 10), 0), 9);
      assert.deepEqual((await copyRows(page)).rows, rows);
      const group = await page.locator('#sei-order-scope option').filter({ hasText: '379' }).getAttribute('value');
      await page.locator('#sei-order-scope').selectOption(group);
      rows = await tableRows(page);
      assert.equal(rows.length, 13);
      assert.equal(rows.reduce((sum, row) => sum + Number.parseInt(row[6], 10), 0), 67);
      copied = await copyRows(page);
      assert.deepEqual(copied.rows, rows);
      await page.locator('#sei-order-end').fill('2026-11-26');
      assert.equal(await page.locator('#sei-order-scope').inputValue(), group);
      assert.equal((await tableRows(page)).length, 7);
      assert.equal((await copyRows(page)).rows.length, 7);
      assert((await page.locator('#sei-date-title').textContent()).includes('23/11/2026 a 26/11/2026'));
      assert(await page.evaluate(() => {
        const dialog = document.getElementById('sei-generator');
        return document.documentElement.scrollWidth <= innerWidth && dialog.scrollWidth <= dialog.clientWidth;
      }));
      for (const id of ['sei-order-start', 'sei-order-end']) {
        assert(await page.locator(`#${id}`).evaluate(input => {
          const rect = input.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth;
        }));
      }
      await page.locator('#sei-close').click();
      await openSAT(page, 24);
      assert.equal(await page.locator('#sei-order-start').inputValue(), '2026-11-24');
      assert.equal(await page.locator('#sei-order-end').inputValue(), '2026-11-24');
      assert.equal((await tableRows(page)).length, 3);
      await page.locator('#sei-close').click();
    }

    await openSAT(page);
    for (const [start, end, message] of [
      ['2026-11-30', '2026-11-23', 'anterior ou igual'],
      ['', '2026-11-23', 'Informe a data'],
      ['2026-10-31', '2026-11-23', 'entre 01/11/2026 e 31/01/2027'],
      ['2026-11-23', '2027-02-01', 'entre 01/11/2026 e 31/01/2027'],
    ]) {
      await setRange(page, start, end);
      assert((await page.locator('#sei-order-period-error').textContent()).includes(message));
      assert.equal((await tableRows(page)).length, 0);
      assert(await page.locator('#sei-copy-order').isDisabled());
      assert(await page.locator('#sei-select-order').isDisabled());
      assert.equal(await page.locator('#sei-order-start').getAttribute('aria-invalid'), 'true');
    }
    await setRange(page, '2026-11-21', '2026-11-22');
    assert.equal((await tableRows(page)).length, 0);
    assert(await page.locator('#sei-os-empty').isVisible());
    await page.locator('#sei-copy-order').click();
    assert((await page.locator('#sei-feedback').textContent()).includes('Nenhum AC4 SAT informado neste período'));
    await setRange(page, '2026-11-23', '2026-11-30');
    assert.equal(await page.locator('#sei-order-start').getAttribute('aria-invalid'), 'false');
    assert.equal((await tableRows(page)).length, 17);
    await importFictitiousDirectory(page);
    assert.equal((await copyRows(page)).rows.length, 17);
    assert.equal(await page.locator('#sei-order-end').inputValue(), '2026-11-30');
    await page.locator('#sei-close').click();

    // The operational dialog still renders one day and has no period controls.
    await page.locator('#selecionar-dia').selectOption('26');
    const operationalToggle = page.locator('.day[data-day="26"] [data-area-toggle="operational"]');
    if (await operationalToggle.getAttribute('aria-expanded') === 'false') await operationalToggle.click();
    const operational = page.locator('.day[data-day="26"] .operational-section');
    await operational.locator('[data-sei-day]').click();
    assert(await page.locator('#sei-order-period').isHidden());
    assert(await page.locator('#sei-scale-section').isVisible());
    let rows = await tableRows(page);
    assert(rows.length > 0);
    assert(rows.every(row => row[0] === '26/11/2026'));
    assert(rows.some(row => row[4].includes('HENRIQUE') && row[6] === '12h'));
    assert.deepEqual((await copyRows(page)).rows, rows);
    await page.locator('#sei-close').click();
    assert.equal(await page.evaluate(() => JSON.stringify(window.ServiceCalendar.schedules)), source);
    assert.deepEqual(await page.evaluate(financeSnapshot), finances);

    // Fictitious fixtures remain in this disposable browser session only.
    await page.evaluate(() => {
      const schedules = window.ServiceCalendar.schedules;
      const member = schedules['2026-11'].days.find(d => d.day === 23).sat.members[0];
      const add = (date, event) => {
        const day = schedules[date.slice(0, 7)].days.find(d => d.day === Number(date.slice(8)));
        day.sat ||= { members: [], alerts: [] };
        day.sat.members.push({ ...member, badges: [], notes: [], events: [{
          mode: 'SAT TESTE', document: 'OS nº 999 (SEI 99999999)', status: 'planned',
          start: '08h00', end: '12h00', hours: 4, nextDay: false, ...event,
        }] });
      };
      add('2026-11-30', { serviceId: 'ficticio-revisado', revision: 1 });
      for (let i = 0; i < 2; i++) add('2026-12-01', {
        serviceId: 'ficticio-revisado', revision: 2, start: '13h00', end: '18h00', hours: 5,
      });
      add('2026-11-30', { serviceId: 'ficticio-cancelado', revision: 1 });
      add('2026-12-01', { serviceId: 'ficticio-cancelado', revision: 2, status: 'cancelled' });
      add('2026-12-31', { serviceId: 'ficticio-noturno', start: '20h00', end: '08h00', hours: 12, nextDay: true });
      add('2027-01-01', { serviceId: 'ficticio-janeiro' });
      add('2027-01-01', { serviceId: 'ficticio-data-explicita', startDate: '2026-12-31', endDate: '2026-12-31' });
      document.dispatchEvent(new CustomEvent('calendar-schedule-change'));
    });
    await openSAT(page);
    await setRange(page, '2026-11-30', '2026-12-01');
    assert.equal((await tableRows(page)).length, 4);
    await setRange(page, '2026-12-01', '2026-12-01');
    rows = await tableRows(page);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].slice(0, 4), ['01/12/2026', '13h00', '01/12/2026', '18h00']);
    assert.equal(rows[0][6], '5h');
    assert.deepEqual((await copyRows(page)).rows, rows);
    await setRange(page, '2026-12-31', '2027-01-01');
    rows = await tableRows(page);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(row => row.slice(0, 4)), [
      ['31/12/2026', '08h00', '31/12/2026', '12h00'],
      ['31/12/2026', '20h00', '01/01/2027', '08h00'],
      ['01/01/2027', '08h00', '01/01/2027', '12h00'],
    ]);
    assert.deepEqual((await copyRows(page)).rows, rows);
    await setRange(page, '2027-01-01', '2027-01-01');
    assert.equal((await tableRows(page)).length, 1);
    await page.evaluate(() => {
      const day = window.ServiceCalendar.schedules['2027-01'].days[0];
      const event = day.sat.members.flatMap(m => m.events).find(e => e.serviceId === 'ficticio-janeiro');
      event.end = '13h00'; event.hours = 5;
      window.ServiceCalendar.refresh();
    });
    rows = await tableRows(page);
    assert.equal(rows[0][3], '13h00');
    assert.equal(rows[0][6], '5h');
    assert.deepEqual((await copyRows(page)).rows, rows);
    await page.evaluate(() => {
      const day = window.ServiceCalendar.schedules['2027-01'].days[0];
      day.sat.members.flatMap(m => m.events).find(e => e.serviceId === 'ficticio-janeiro').hours = 4;
      window.ServiceCalendar.refresh();
    });
    assert(await page.locator('#sei-select-order').isDisabled());
    await page.locator('#sei-copy-order').click();
    assert((await page.locator('#sei-validation').textContent()).includes('conferir data, horários e duração'));
    assert.deepEqual(errors, []);
    console.log('PASS: SAT OS inclusive dates, chronological rows, groups/clipboard, continuous 10h, empty/invalid ranges, reset, refresh/import, month/year rollover, revisions/cancellations, explicit dates, financial preservation and unchanged operational OS; desktop/320/390px.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
