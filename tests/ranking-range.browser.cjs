const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),normalize=text=>text.replace(/\s+/g,' ').trim();
const money=cents=>normalize(new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100));

(async()=>{
 const server=http.createServer((req,res)=>{
  const file={'/':'index.html','/index.html':'index.html','/assets/cbmgo-emblema.png':'assets/cbmgo-emblema.png','/assets/whatsapp.svg':'assets/whatsapp.svg'}[req.url];
  if(!file){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,file)));
 });
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:1000},timezoneId:'America/Sao_Paulo'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-09T15:00:00Z'));await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const source=await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules));
  const open=()=>page.locator('[data-ac4-ranking]').click(),close=()=>page.locator('#ac4-ranking-close').click(),start=page.locator('#ac4-ranking-start'),end=page.locator('#ac4-ranking-end');
  const verify=async()=>{
   const expected=await page.evaluate(()=>{
    const {schedules,period}=window.ServiceCalendar,start=document.getElementById('ac4-ranking-start').value,end=document.getElementById('ac4-ranking-end').value,officers=document.getElementById('ac4-ranking-officers').checked;
    const personnel=JSON.parse(document.getElementById('ranking-personnel').textContent),known=new Map(personnel.map(person=>[person.name,person])),records=window.AC4Finance.month(schedules,period).records.filter(record=>record.valid&&record.status!=='cancelled'&&record.startDate>=start&&record.startDate<=end&&(officers||!known.get(record.member)?.officer));
    const rows=new Set(personnel.filter(person=>officers||!person.officer).map(person=>person.name));for(const record of records)rows.add(record.member);
    return {start,end,total:records.reduce((sum,record)=>sum+record.commitmentCents,0),op:records.filter(record=>record.category==='operational').reduce((sum,record)=>sum+record.commitmentCents,0),sat:records.filter(record=>record.category==='sat').reduce((sum,record)=>sum+record.commitmentCents,0),count:records.length,rows:rows.size};
   });
   assert.equal(normalize(await page.locator('.ranking-total-row .ranking-total').textContent()),money(expected.total));assert.equal(normalize(await page.locator('.ranking-total-row .ranking-operational').textContent()),money(expected.op));assert.equal(normalize(await page.locator('.ranking-total-row .ranking-sat').textContent()),money(expected.sat));
   assert.equal(await page.locator('.ranking-table tbody>.ranking-row').count(),expected.rows);
   const summary=await page.locator('#ac4-ranking-summary').textContent();assert(summary.includes(expected.start.split('-').reverse().join('/')));assert(summary.includes(expected.end.split('-').reverse().join('/')));assert(summary.includes(`${expected.count} serviço`));
   return expected;
  };
  const setRange=async(first,last)=>{await start.selectOption(first);await end.selectOption(last);return verify();};
  await open();assert.equal(await start.inputValue(),'2026-11-01');assert.equal(await end.inputValue(),'2026-11-09');assert.equal(await start.locator('option').count(),30);assert.equal(await page.locator('#ac4-ranking-today').count(),0);await verify();
  let result=await setRange('2026-11-12','2026-11-26');assert.equal(result.total,1140400);assert.equal(result.count,20);assert.equal(result.rows,27);
  const luiz=page.locator('.ranking-table tbody>.ranking-row').filter({has:page.locator('.ranking-person',{hasText:'LUIZ ANTONIO'})});
  assert((await page.locator('.ranking-table tbody>.ranking-row').first().textContent()).includes('LUIZ ANTONIO'));assert.equal(normalize(await luiz.locator('.ranking-total').textContent()),money(199500));assert((await luiz.locator('.ranking-member-meta').textContent()).includes('5 previstos'));
  await luiz.locator('.ranking-person').click();assert.equal(await page.locator('.ranking-services-row:visible [data-included="true"]').count(),5);assert.equal(await page.locator('.ranking-services-row:visible [data-included="false"]').count(),4);
  await end.selectOption('2026-11-19');await verify();assert.equal(await page.locator('.ranking-services-row:visible [data-included="true"]').count(),3);assert.equal(await page.locator('.ranking-services-row:visible [data-included="false"]').count(),6);assert.equal(await page.locator('.ranking-services-row:visible .ranking-state-outside').count(),6);
  await start.selectOption('2026-11-17');await verify();assert.equal(normalize(await luiz.locator('.ranking-total').textContent()),money(79200));assert.equal(await page.locator('.ranking-services-row:visible [data-included="true"]').count(),2);
  result=await setRange('2026-11-12','2026-11-12');assert.equal(result.total,119100);result=await setRange('2026-11-13','2026-11-13');assert.equal(result.total,235000);assert.equal(normalize(await luiz.locator('.ranking-total').textContent()),money(0));
  result=await setRange('2026-11-20','2026-11-23');assert.equal(result.total,0);assert.equal(result.rows,27);
  await start.selectOption('2026-11-26');assert.equal(await end.inputValue(),'2026-11-26');result=await verify();assert.equal(result.total,41100);
  await end.selectOption('2026-11-17');assert.equal(await start.inputValue(),'2026-11-17');result=await verify();assert.equal(result.total,148200);
  await setRange('2026-11-01','2026-11-30');await page.locator('#ac4-ranking-officers').check();result=await verify();assert.equal(result.total,2460200);assert.equal(result.rows,31);await page.locator('#ac4-ranking-seniority').check();await verify();
  const order=await page.locator('.ranking-table tbody>.ranking-row .ranking-position').allTextContents();assert.deepEqual(order,[...Array.from({length:30},(_,index)=>String(index+1)),'—']);
  for(const width of [320,390,760,761,1280]){
   await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await page.locator('#ac4-ranking-dialog .ranking-range').evaluate(group=>{const r=group.getBoundingClientRect();return [...group.querySelectorAll('select')].every(select=>{const s=select.getBoundingClientRect();return s.width>0&&s.right<=r.right+1&&s.left>=r.left&&s.height>=44;});}));
   await page.locator('#ac4-ranking-dialog').evaluate(dialog=>dialog.scrollTop=0);if([390,1280].includes(width))await page.locator('#ac4-ranking-dialog').screenshot({path:`/tmp/ranking-range-${width}.png`,animations:'disabled'});
  }
  await close();await open();assert.equal(await start.inputValue(),'2026-11-01');assert.equal(await end.inputValue(),'2026-11-30');await verify();
  const register='/workspace/scratch/CADASTRO_LOCAL_SEI_8CIBM_NAO_PUBLICAR.json';
  if(fs.existsSync(register)){await page.locator('.ranking-register-panel summary').click();await page.locator('#ac4-ranking-file').setInputFiles(register);await page.waitForFunction(()=>document.getElementById('ac4-ranking-import-message').textContent.includes('Cadastro local atualizado'));assert.equal(await end.inputValue(),'2026-11-30');await verify();}
  await close();await page.locator('#mes-seguinte').click();await open();assert.equal(await start.inputValue(),'2026-12-01');assert.equal(await end.inputValue(),'2026-12-01');assert.equal(await start.locator('option').count(),31);await setRange('2026-12-12','2026-12-31');
  await close();await page.locator('#mes-seguinte').click();await open();assert.equal(await start.inputValue(),'2027-01-01');assert.equal(await end.inputValue(),'2027-01-01');await verify();
  await close();await page.locator('#mes-anterior').click();await open();assert.equal(await start.inputValue(),'2026-12-12');assert.equal(await end.inputValue(),'2026-12-31');await verify();
  await close();await page.locator('#mes-anterior').click();await open();assert.equal(await end.inputValue(),'2026-11-30');await verify();await close();
  await page.locator('[data-ac4-simulation]').click();await page.locator('#ac4-simulation-confirm').click();await open();result=await verify();assert.equal(result.total,2460200);assert.equal(await page.locator('.ranking-person').filter({hasText:'PREVISTO AC4'}).count(),0);await close();
  assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),source);
  await page.clock.setFixedTime(new Date('2026-11-10T01:30:00Z'));await page.reload();await open();assert.equal(await end.inputValue(),'2026-11-09');await close();
  await page.clock.setFixedTime(new Date('2026-11-10T03:30:00Z'));await open();assert.equal(await end.inputValue(),'2026-11-10');await close();
  await page.clock.setFixedTime(new Date('2026-12-05T15:00:00Z'));await page.reload();await page.locator('#mes-anterior').click();await open();assert.equal(await end.inputValue(),'2026-11-30');await verify();
  assert.deepEqual(errors,[]);console.log('PASS: Início/Fim inclusivos e atualização imediata; totais, ordenação, detalhes, limites, intervalo vazio, oficiais/antiguidade, preferência por mês, data de Brasília, 320–1280px, cadastro e serviços reais preservados.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
