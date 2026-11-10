const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const file={'/':'index.html','/index.html':'index.html','/assets/cbmgo-emblema.png':'assets/cbmgo-emblema.png','/assets/whatsapp.svg':'assets/whatsapp.svg'}[req.url];
  if(!file){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,file)));
 });let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:1000},timezoneId:'America/Sao_Paulo'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-10T15:00:00Z'));
  await page.addInitScript(()=>{
   window.copiedText=null;window.copiedHTML=null;window.failTextCopy=false;window.fallbackCopies=0;
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
    writeText:async text=>{if(window.failTextCopy)throw new Error('Teste da alternativa de cópia');window.copiedText=text;},
    write:async items=>{window.copiedHTML=await (await items[0].getType('text/html')).text();}
   }});
   document.execCommand=command=>{if(command==='copy'){window.copiedText=document.activeElement.value;window.fallbackCopies++;return true;}return false;};
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const source=await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules));
  await page.evaluate(()=>{window.vacancyBuildCalls=0;const build=window.ServiceVacancies.build;window.ServiceVacancies.build=(...args)=>{window.vacancyBuildCalls++;return build(...args);};});
  const icon=page.locator('#whatsapp-vacancies-button'),dialog=page.locator('#vacancy-dialog'),tooltip=page.locator('#exchange-tooltip');
  assert.equal(await icon.evaluate(el=>el.previousElementSibling.dataset.filter),'DELTA');assert(await icon.locator('img').evaluate(el=>el.complete&&el.naturalWidth>0));
  const hint=async(ala,text)=>{await page.locator(`[data-filter="${ala}"]`).hover();await tooltip.waitFor({state:'visible'});assert((await tooltip.textContent()).includes(text));};
  await hint('ALPHA','ST DA SILVA');assert.equal(await tooltip.locator('p').count(),7);assert((await tooltip.textContent()).includes('2º SGT CÉSAR VIEIRA (Férias: 02/11/2026 a 01/12/2026)'));assert(!(await tooltip.textContent()).includes('DA SILVA ('));
  await hint('DELTA','1º SGT HAMILTON (Férias: 05/11/2026 a 04/12/2026)');assert((await tooltip.textContent()).includes('SD SANTOS (Dispensa recompensa: 13/11/2026)'));
  await page.locator('[data-filter="BRAVO"]').focus();assert((await tooltip.textContent()).includes('1º SGT HELLYSSON'));await page.keyboard.press('Escape');assert(await tooltip.isHidden());
  await page.locator('[data-filter="CHARLIE"]').click();assert.equal(await page.locator('.day:not(.is-hidden)').count(),7);await page.locator('[data-filter="TODAS"]').click();
  await icon.click();assert(await dialog.evaluate(el=>el.open));assert(await page.evaluate(()=>document.documentElement.classList.contains('vacancy-dialog-open')));
  const inactive=async()=>{assert.equal(await page.locator('#vacancy-message').inputValue(),'');assert(await page.locator('#vacancy-output').isHidden());assert(await page.locator('#vacancy-copy').isDisabled());assert(await page.locator('#vacancy-start').isDisabled());assert(await page.locator('#vacancy-end').isDisabled());assert.equal(await page.locator('.simulation-entry').count(),0);assert((await page.locator('#vacancy-summary').textContent()).includes('Ative a Simulação'));};
  await inactive();assert.equal(await page.evaluate(()=>window.vacancyBuildCalls),0);
  await page.locator('#vacancy-copy').dispatchEvent('click');assert.equal(await page.evaluate(()=>window.copiedText),null);assert.equal(await page.evaluate(()=>window.vacancyBuildCalls),0);
  await page.locator('#vacancy-configure').click();await page.locator('#ac4-simulation-target').selectOption('10');await page.locator('#ac4-simulation-cancel').click();await inactive();assert.equal(await page.evaluate(()=>window.vacancyBuildCalls),0);
  await page.locator('#vacancy-configure').click();assert.equal(await page.locator('#ac4-simulation-target').inputValue(),'6');await page.locator('#ac4-simulation-confirm').click();assert(!(await page.locator('#vacancy-start').isDisabled()));assert(await page.locator('#vacancy-start').evaluate(el=>document.activeElement===el));
  assert.equal(await page.locator('#vacancy-start').inputValue(),'2026-11-10');assert.equal(await page.locator('#vacancy-end').inputValue(),'2026-11-30');assert.equal(await page.locator('#vacancy-end option').count(),30);
  const range=async(start,end)=>{await page.locator('#vacancy-start').selectOption(start);await page.locator('#vacancy-end').selectOption(end);};
  const matchesCalendar=async()=>{
   const values=await page.evaluate(()=>{
    const normalize=time=>time.replace(/\b0(?=\d)/g,''),start=Number(document.getElementById('vacancy-start').value.slice(8)),end=Number(document.getElementById('vacancy-end').value.slice(8)),actual={},exported={};
    for(const card of document.querySelectorAll('.day')){const day=Number(card.dataset.day);if(day<start||day>end)continue;for(const row of card.querySelectorAll('.simulation-entry')){const key=[day,row.querySelector('.chip.ac4').textContent,normalize(row.querySelector('.ac4-period').textContent)].join('|');actual[key]=(actual[key]||0)+1;}}
    for(const match of document.getElementById('vacancy-message').value.matchAll(/^\*(\d{2})\/\d{2}.*\*\n(AC4 [\d.]+h) \(([^)\n]+)\)\nVoluntários \((\d+) vagas?\)/gm)){const key=[Number(match[1]),match[2],normalize(match[3])].join('|');exported[key]=(exported[key]||0)+Number(match[4]);}
    return {actual,exported};
   });assert.deepEqual(values.exported,values.actual,'Vagas e horários da mensagem correspondem às linhas PREVISTO AC4 do calendário');
  };
  await range('2026-11-12','2026-11-14');
  const expected=await page.evaluate(()=>{const {schedules,period,quotas}=window.ServiceCalendar,plan=window.ServiceSimulation.plan(schedules,period,quotas[period]);return window.ServiceVacancies.build(schedules,period,plan,'2026-11-12','2026-11-14').message;});
  assert.equal(await page.locator('#vacancy-message').inputValue(),expected);assert(expected.includes('AC4 12h (08h às 20h)'));assert(expected.includes('Voluntários (02 vagas)'));
  await matchesCalendar();
  await page.locator('#vacancy-copy').click();assert.equal(await page.evaluate(()=>window.copiedText),expected);assert((await page.locator('#vacancy-copy-status').textContent()).includes('Mensagem copiada'));
  await page.evaluate(()=>window.failTextCopy=true);await page.locator('#vacancy-copy').click();assert.equal(await page.evaluate(()=>window.fallbackCopies),1);assert.equal(await page.evaluate(()=>window.copiedText),expected);await page.evaluate(()=>window.failTextCopy=false);
  await range('2026-11-10','2026-11-11');assert((await page.locator('#vacancy-message').inputValue()).includes('Sem vagas de AC4 na simulação.'));assert.equal((await page.locator('#vacancy-message').inputValue()).match(/Sem vagas/g).length,2);
  await page.locator('#vacancy-start').selectOption('2026-11-17');assert.equal(await page.locator('#vacancy-end').inputValue(),'2026-11-17');assert.equal((await page.locator('#vacancy-message').inputValue()).match(/\*17\/11/g).length,2);
  await page.locator('#vacancy-end').selectOption('2026-11-12');assert.equal(await page.locator('#vacancy-start').inputValue(),'2026-11-12');
  await page.keyboard.press('Escape');assert(await dialog.isHidden());await page.waitForFunction(()=>!document.documentElement.classList.contains('vacancy-dialog-open'));
  const configure=async target=>{await page.locator('[data-ac4-simulation]').click();await page.locator('#ac4-simulation-target').selectOption(String(target));await page.locator('#ac4-simulation-confirm').click();};
  await configure(10);await icon.click();await range('2026-11-13','2026-11-13');assert((await page.locator('#vacancy-message').inputValue()).includes('Voluntários (05 vagas)'));assert((await page.locator('#vacancy-summary').textContent()).includes('10 recursos'));
  await matchesCalendar();
  for(const target of [4,5,7,8,9,10,6]){await page.locator('#vacancy-configure').click();await page.locator('#ac4-simulation-target').selectOption(String(target));await page.locator('#ac4-simulation-confirm').click();await range('2026-11-01','2026-11-30');await matchesCalendar();assert((await page.locator('#vacancy-summary').textContent()).includes(`${target} recursos`));}
  await range('2026-11-12','2026-11-12');assert((await page.locator('#vacancy-message').inputValue()).includes('AC4 12h (08h às 20h)'));
  await page.evaluate(()=>window.ServiceCalendar.updateAC4({period:'2026-11',day:12,member:'2º SGT LUIZ ANTONIO'},{cancelled:true}));assert((await page.locator('#vacancy-message').inputValue()).includes('AC4 24h (08h às 08h)'));await matchesCalendar();
  await page.evaluate(source=>{Object.assign(window.ServiceCalendar.schedules,JSON.parse(source));window.ServiceCalendar.refresh();},source);await matchesCalendar();assert((await page.locator('#vacancy-message').inputValue()).includes('AC4 12h (08h às 20h)'));
  await page.locator('#vacancy-configure').click();await page.locator('#ac4-simulation-enabled').uncheck();await page.locator('#ac4-simulation-confirm').click();await inactive();
  const calls=await page.evaluate(()=>window.vacancyBuildCalls);await page.locator('#vacancy-copy').dispatchEvent('click');assert.equal(await page.evaluate(()=>window.vacancyBuildCalls),calls);
  await page.locator('#vacancy-close').click();await icon.click();await inactive();
  await page.locator('#vacancy-configure').click();await page.locator('#ac4-simulation-confirm').click();await matchesCalendar();
  await page.locator('#vacancy-close').click();await configure(6);
  // Only fictitious identification data are imported to exercise the SEI clipboard.
  await page.evaluate(async()=>{
   const roster=JSON.parse(document.getElementById('ranking-personnel').textContent),members=Object.values(window.ServiceCalendar.schedules).flatMap(month=>month.days.flatMap(day=>[...day.members,...(day.sat?.members||[])])),names=[...new Set(members.map(member=>member.name))];
   const people=names.map(name=>{const match=name.match(/^(CAP|ASP OF|ST|[123]º SGT|CB|SD(?: [12]ª CL)?) (.+)$/),war=match[2];return {identificacao_site:name,graduacao:`${match[1]} ${match[1]==='CAP'?'QOC':'QP/COMBATENTE'}`,rg:'9999',nome_completo:`${war} MILITAR DE TESTE`,nome_guerra:war,cpf_mascarado:'***.123.456-**',ord:roster.find(person=>person.name===name)?.ord??null};});
   await window.ServiceDirectory.importFile(new File([JSON.stringify({pessoal_referencia:people})],'cadastro-ficticio.json',{type:'application/json'}));
  });
  const expand=async day=>{const card=page.locator(`.day[data-day="${day}"]`),button=card.locator('[data-area-toggle="operational"]');if(await button.getAttribute('aria-expanded')==='false')await button.click();return card;};
  for(const [day,pay,related,sei,name] of [[3,false,'10/11/2026','97766395','CAVALCANTE'],[10,true,'03/11/2026','97766395','CAVALCANTE'],[13,true,'20/11/2026','98254182','HENRIQUE'],[20,false,'13/11/2026','98254182','HENRIQUE']]){
   const card=await expand(day),badge=card.locator(`[data-company-sei="${sei}"]`);await badge.hover();assert.equal(await tooltip.locator('p').first().textContent(),`TS CIA (SEI ${sei})`);assert((await tooltip.textContent()).includes(related));await badge.click({button:'right'});assert.equal(await page.evaluate(()=>window.copiedText),sei);await page.keyboard.press('Escape');
   if(sei==='98254182'){assert.equal(await card.locator('.resource-ordinary').textContent(),'4 ORD');assert.equal(await card.locator('.entry').filter({has:page.locator('.name',{hasText:name})}).count(),1);}
   await card.locator('.operational-section [data-sei-day]').click();
   if(day===10){
    const calendarRow=card.locator('.entry').filter({has:page.locator('.name',{hasText:'LUIZ ANTONIO'})});assert.equal(await calendarRow.locator('.chip.ac4').textContent(),'AC4 12h');assert.equal(await calendarRow.locator('.ac4-period').textContent(),'20h às 8h');assert((await calendarRow.locator('.ac4-cost').textContent()).includes('381,00'));
    const orderRow=page.locator('#sei-order-table tbody tr').filter({hasText:'LUIZ ANTONIO'});assert.equal(await orderRow.count(),1);assert.deepEqual(await orderRow.locator('td').evaluateAll(cells=>[...cells].map(cell=>cell.textContent).filter((_,index)=>[0,1,2,3,6].includes(index))),['10/11/2026','20h00','11/11/2026','08h00','12h']);
   }
   const row=page.locator('#sei-scale-table tbody tr').filter({hasText:name}),obs=row.locator('td').nth(4);
   assert.equal(await obs.locator('strong').nth(0).textContent(),`TS Cia Operacional (SEI ${sei})`);assert.equal(await obs.locator('strong').nth(1).textContent(),pay?'Pagando serviço':'Dispensado do serviço');assert((await obs.textContent()).includes(related));assert.equal(await obs.locator('strong').count(),2);
   assert.equal(await row.evaluate(el=>getComputedStyle(el).color),pay?'rgb(37, 99, 179)':'rgb(192, 0, 0)');assert(!(await page.locator('#sei-validation').textContent()).includes('numeração própria'));
   await page.locator('#sei-copy-scale').click();await page.waitForFunction(()=>window.copiedHTML!==null);
   const payload=await page.evaluate(name=>{const node=document.createElement('div');node.innerHTML=window.copiedHTML;const row=[...node.querySelectorAll('tr')].find(row=>row.textContent.includes(name));return {header:!!node.querySelector('thead,th'),colors:[...row.cells].map(cell=>cell.style.color),obs:row.cells[4].innerHTML};},name);
   assert(!payload.header);assert(payload.colors.every(color=>color===(pay?'rgb(37, 99, 179)':'rgb(192, 0, 0)')));assert(payload.obs.startsWith(`<strong>TS Cia Operacional (SEI ${sei})</strong><br><strong>`));await page.evaluate(()=>window.copiedHTML=null);await page.locator('#sei-close').click();
  }
  await page.locator('#mes-seguinte').click();await hint('ALPHA','ST DA SILVA');assert(!(await tooltip.textContent()).includes('DA SILVA ('));assert((await tooltip.textContent()).includes('CÉSAR VIEIRA (Férias:'));await hint('DELTA','HAMILTON (Férias:');assert(!(await tooltip.textContent()).includes('SANTOS ('));
  let card=await expand(4),silva=card.locator('.operational-roster .entry').filter({hasText:'ST DA SILVA'});assert((await silva.textContent()).includes('ORDINÁRIO'));assert((await silva.textContent()).includes('ACA'));assert(!(await silva.textContent()).includes('FÉRIAS'));assert.equal(await card.locator('.simulation-entry').count(),0);
  await page.locator('#mes-seguinte').click();await hint('ALPHA','ST DA SILVA');assert(!(await tooltip.textContent()).includes('Férias'));await hint('DELTA','1º SGT HAMILTON');assert(!(await tooltip.textContent()).includes('Férias'));card=await expand(1);assert((await card.locator('.operational-roster .entry').filter({hasText:'ST DA SILVA'}).textContent()).includes('ORDINÁRIO'));
  await page.locator('#mes-anterior').click();await page.locator('#mes-anterior').click();
  for(const width of [320,390,760,761,1280,1800]){
   await page.setViewportSize({width,height:900});await icon.click();await range('2026-11-12','2026-11-14');
   const geometry=await page.evaluate(()=>{const dialog=document.getElementById('vacancy-dialog'),r=dialog.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,dialogOverflow:dialog.scrollWidth>dialog.clientWidth,left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
   assert(!geometry.overflow,`página ${width}`);assert(!geometry.dialogOverflow,`janela ${width}`);assert(geometry.left>=0&&geometry.right<=width&&geometry.top>=0&&geometry.bottom<=900,`janela cabe na tela ${width}`);
   if([320,390,1280].includes(width))await dialog.screenshot({path:`/tmp/vagas-whatsapp-${width}.png`});await page.locator('#vacancy-close').click();
   const filters=await page.locator('.filters button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(button);return {width:button.clientWidth,scroll:button.scrollWidth,top:r.top,bottom:r.bottom,textRight:range.getBoundingClientRect().right,right:r.right};}));
   assert(filters.every(button=>button.scroll<=button.width),`filtro cortado ${width}`);assert(filters.every(button=>Math.abs(button.top-filters[0].top)<1),`filtros mesma linha ${width}`);
   await hint('ALPHA','ST DA SILVA');const box=await tooltip.boundingBox();assert(box.x>=0&&box.x+box.width<=width,`dica ${width}`);await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:320,height:640});await icon.click();await page.locator('#vacancy-configure').click();await page.locator('#ac4-simulation-enabled').uncheck();await page.locator('#ac4-simulation-confirm').click();await inactive();await dialog.screenshot({path:'/tmp/vagas-inativa-320.png'});
  await page.locator('#vacancy-configure').click();await page.locator('#ac4-simulation-target').selectOption('8');await page.locator('#ac4-simulation-confirm').click();await matchesCalendar();assert((await page.locator('#vacancy-summary').textContent()).includes('8 recursos'));await page.locator('#vacancy-close').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(window.ServiceCalendar.schedules)),source);assert.deepEqual(errors,[]);
  console.log('PASS: geração e cópia bloqueadas com simulação desligada; ativação/cancelamento, todas as metas 4–10, atualização/cancelamento de AC4 e reativação; vagas/horários idênticos ao PREVISTO AC4 do calendário; TS CIA, cópia, alas e layout de 320–1800px preservados.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
