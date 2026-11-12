const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const json=id=>JSON.parse(scripts.find(([,attrs])=>attrs.includes(`id="${id}"`))[2]);
const schedules=json('calendar-data'),context=vm.createContext({window:{}});
for(const name of ['AC4Finance','ServiceChief','ServiceSimulation','ServiceVacancies'])vm.runInContext(scripts.find(([,attrs,source])=>!attrs.includes('application/json')&&source.includes(`window.${name}=`))[2],context);
const {AC4Finance:finance,ServiceChief:chief,ServiceSimulation:simulation,ServiceVacancies:vacancies}=context.window;
const plan=simulation.plan(schedules,'2026-11',4560000);
const build=(start,end=start)=>vacancies.build(schedules,'2026-11',plan,`2026-11-${start}`,`2026-11-${end}`);

test('mensagem inclui todos os dias do intervalo e não oferece vagas já preenchidas',()=>{
 const result=build('10','14');assert.equal(result.days,5);assert.equal(result.daysWithVacancies,0);assert.equal(result.vacancies,0);
 assert.equal(result.message,[
  '*10/11 (Terça-feira) - ALPHA*\nSem vagas de AC4 na simulação.',
  '*11/11 (Quarta-feira) - BRAVO*\nSem vagas de AC4 na simulação.',
  '*12/11 (Quinta-feira) - CHARLIE*\nSem vagas de AC4 na simulação.',
  '*13/11 (Sexta-feira) - DELTA*\nSem vagas de AC4 na simulação.',
  '*14/11 (Sábado) - ALPHA*\nSem vagas de AC4 na simulação.'
 ].join('\n\n'));
 assert(!/R\$|LUIZ|WANDERSON|HENRIQUE/.test(result.message));
});

test('horários diferentes no mesmo dia geram blocos separados, preservando minutos',()=>{
 const result=build('17');assert.equal(result.vacancies,0);assert(result.message.includes('Sem vagas de AC4 na simulação.'));
 const event=(start,end)=>({simulation:true,status:'planned',start,end,hours:12,startDate:'2026-11-14',endDate:end==='08h00'?'2026-11-15':'2026-11-14'});
 const virtual={days:new Map([[14,{members:[{name:'PREVISTO AC4',events:[event('20h00','08h00')]},{name:'PREVISTO AC4',events:[event('08h00','20h00')]},{name:'PREVISTO AC4',events:[{...event('08h30','20h30'),hours:12}]}]}]])};
 const message=vacancies.build(schedules,'2026-11',virtual,'2026-11-14','2026-11-14').message;
 assert(message.indexOf('(08h às 20h)')<message.indexOf('(20h às 08h)'));assert(message.includes('(08h30 às 20h30)'));assert.equal(message.match(/Voluntários/g).length,3);assert.equal(message.match(/Voluntários \(01 vaga\)\n- \n- /g).length,3);assert(!/\n\n- |^\d+\./m.test(message));
});

test('somente PREVISTO AC4 virtual ativo pode virar vaga; escala cadastrada não é exportada',()=>{
 const event={simulation:true,status:'planned',start:'08h00',end:'20h00',hours:12,startDate:'2026-11-12',endDate:'2026-11-12'};
 const virtual={days:new Map([[12,{members:[{name:'MILITAR CADASTRADO',events:[event]},{name:'PREVISTO AC4',events:[{...event,simulation:false},{...event,cancelled:true}]}]}]])};
 const result=vacancies.build(schedules,'2026-11',virtual,'2026-11-12','2026-11-12');assert.equal(result.vacancies,0);assert(result.message.includes('Sem vagas de AC4 na simulação.'));
});

test('intervalo inclusivo rejeita inversão, outro mês, dia inválido e previsão ausente',()=>{
 for(const [start,end] of [['2026-11-14','2026-11-12'],['2026-11-31','2026-11-31'],['2026-10-31','2026-11-01'],['2026-11-30','2026-12-01']])assert.throws(()=>vacancies.build(schedules,'2026-11',plan,start,end),/intervalo válido/);
 assert.throws(()=>vacancies.build({'2026-11':{days:[]}},'2026-11',plan,'2026-11-12','2026-11-12'),/Não há previsão/);
 assert.equal(build('30').days,1);
});

test('meta configurada altera a mensagem sem modificar os serviços cadastrados',()=>{
 const before=JSON.stringify(schedules),higher=simulation.plan(schedules,'2026-11',4560000,undefined,8),result=vacancies.build(schedules,'2026-11',higher,'2026-11-20','2026-11-20');
 assert.equal(result.vacancies,4);assert(result.message.includes('Voluntários (04 vagas)'));assert.equal(JSON.stringify(schedules),before);
 assert.equal(finance.month(schedules,'2026-11',4560000).committedCents,2484200);
});

test('cancelamento das férias restaura os oito plantões da Alpha, a chefia e a cobertura',()=>{
 const dates=['2026-12-04','2026-12-08','2026-12-12','2026-12-16','2026-12-20','2026-12-24','2026-12-28','2027-01-01'];
 for(const date of dates){
  const day=schedules[date.slice(0,7)].days.find(day=>day.day===Number(date.slice(8))),member=day.members.find(member=>member.name==='ST DA SILVA');
  assert.equal(day.ala,'ALPHA');assert.equal(member.ord,5);assert(!member.afastamento);assert.equal(member.badges.length,1);assert.equal(member.badges[0].kind,'ord');assert.equal(member.events.length,0);
  assert.equal(simulation.coverage(day,date).resources,6);assert.equal(chief.select(day).assignments[0].name,'ST DA SILVA');assert.equal(simulation.plan(schedules,date.slice(0,7)).days.get(day.day).addedServices,0);
 }
 for(const month of Object.values(schedules))for(const day of month.days)assert(!day.members.some(member=>member.name==='ST DA SILVA'&&member.afastamento));
});

test('listas permanentes das alas conservam as 21 lotações e afastamentos conhecidos',()=>{
 const roster=json('ala-rosters');assert.deepEqual(Object.keys(roster.members),['ALPHA','BRAVO','CHARLIE','DELTA']);assert.equal(Object.values(roster.members).flat().length,21);
 assert(!Object.values(roster.members).flat().some(name=>/ASP|CAP/.test(name)));assert(!roster.absences.some(item=>item.name==='ST DA SILVA'));
 assert.equal(roster.absences.find(item=>item.name==='1º SGT HAMILTON').end,'2026-12-04');assert.equal(roster.absences.find(item=>item.name==='2º SGT CÉSAR VIEIRA').end,'2026-12-01');
 assert.equal(roster.absences.find(item=>item.name==='SD SANTOS').type,'Dispensa recompensa');
});
