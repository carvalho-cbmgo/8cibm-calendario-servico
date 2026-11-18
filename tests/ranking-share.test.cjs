const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],context=vm.createContext({window:{}});vm.runInContext(scripts.find(([,a,s])=>!a.includes('application/json')&&s.includes('window.RankingImage='))[2],context);const image=context.window.RankingImage,plain=value=>JSON.parse(JSON.stringify(value));
const personnel=JSON.parse(scripts.find(([,a])=>a.includes('id="ranking-personnel"'))[2]);
const data=()=>({period:'2026-11',startDate:'2026-11-01',cutoffDate:'2026-11-16',historyMonths:3,sortBySeniority:false,missingHistoryPeople:1,rows:[{member:'2º SGT LUIZ ANTONIO',ord:16,totalCents:1353600,missingHistoryPeriods:['2026-08']},{member:'ASP OF CARVALHO',ord:3,totalCents:96000},{member:'1º SGT FERREIRA',ord:null,totalCents:48000}]});

test('a imagem contém somente ordem e identificação abreviada dos militares da unidade na ordem apresentada',()=>{
 const source=data(),before=JSON.stringify(source),snapshot=image.project(source,'Novembro/2026',[],personnel);assert.deepEqual(plain(snapshot.rows),[{order:'1',member:'2º SGT LUIZ ANTONIO'},{order:'2',member:'ASP OF CARVALHO'}]);assert.equal(snapshot.period,'01/11/2026 a 16/11/2026');assert.equal(snapshot.historyMonths,3);assert.equal(snapshot.partial,true);assert.equal(JSON.stringify(source),before);assert(!JSON.stringify(snapshot).includes('1353600'));for(const row of snapshot.rows)assert.deepEqual(Object.keys(row).sort(),['member','order']);
});

test('antiguidade preserva os números dos militares da unidade',()=>{
 const source=data();source.sortBySeniority=true;source.rows.sort((a,b)=>(a.ord??Infinity)-(b.ord??Infinity));const snapshot=image.project(source,'Novembro/2026',[],personnel);assert.deepEqual(plain(snapshot.rows.map(row=>row.order)),['3','16']);assert.equal(snapshot.rows[0].member,'ASP OF CARVALHO');
});

test('cadastro validado fornece apenas graduação/patente e nome de guerra; RG e nome completo ficam fora da imagem',()=>{
 const references=[{name:'ASP OF CARVALHO',grade:'ASP OF QOC',war:'CARVALHO',rg:'999991',full:'CARVALHO NOME COMPLETO DE TESTE'},{name:'2º SGT LUIZ ANTONIO',grade:'2º SGT QP/COMBATENTE',war:'LUIZ ANTONIO',rg:'999992',full:'LUIZ ANTONIO NOME COMPLETO DE TESTE'}],before=JSON.stringify(references),snapshot=image.project(data(),'Novembro/2026',references,personnel),text=JSON.stringify(snapshot);assert(snapshot.rows.some(row=>row.member==='ASP OF CARVALHO'));assert(snapshot.rows.some(row=>row.member==='2º SGT LUIZ ANTONIO'));for(const secret of ['999991','999992','NOME COMPLETO','QOC','QP/COMBATENTE'])assert(!text.includes(secret));assert.equal(JSON.stringify(references),before);
 assert.equal(image.shortName('CAP FRANCISCO LINS',[{name:'CAP FRANCISCO LINS',grade:'CAP RG 999993 QOC',war:'FRANCISCO LINS'}]),'CAP FRANCISCO LINS');
});

test('nome de guerra composto, correção de Francisco Lins e lista vazia permanecem válidos',()=>{
 assert.equal(image.shortName('CAP LINS'),'CAP FRANCISCO LINS');assert.equal(image.shortName('CAP FRANCISCO LINS',[{siteName:'CAP FRANCISCO LINS',grade:'CAP QOC',war:'FRANCISCO LINS'}]),'CAP FRANCISCO LINS');const source=data();source.rows=[];source.historyMonths=0;source.missingHistoryPeople=0;const snapshot=image.project(source,'Novembro/2026',[],personnel);assert.deepEqual(plain(snapshot.rows),[]);assert.equal(snapshot.partial,false);assert.equal(snapshot.historyMonths,0);
});

test('imagem exclui externos mesmo com antiguidade e cadastro local, e renumera somente a classificação compartilhada',()=>{
 const source=data();source.rows.unshift({member:'SD EXTERNO',ord:2,totalCents:9000000});source.rows[3].ord=9;source.rows[0].missingHistoryPeriods=['2026-08'];source.rows[1].missingHistoryPeriods=[];const before=JSON.stringify(source),references=[{name:'SD EXTERNO',grade:'SD QP/COMBATENTE',war:'EXTERNO',rg:'999999',full:'EXTERNO NOME COMPLETO DE TESTE'}];
 const snapshot=image.project(source,'Novembro/2026',references,personnel);assert.deepEqual(plain(snapshot.rows),[{order:'1',member:'2º SGT LUIZ ANTONIO'},{order:'2',member:'ASP OF CARVALHO'}]);assert.equal(JSON.stringify(source),before);assert(!JSON.stringify(snapshot).includes('EXTERNO'));assert(!JSON.stringify(snapshot).includes('FERREIRA'));assert.equal(snapshot.partial,false);
 assert.deepEqual(plain(image.project(source,'Novembro/2026',references).rows),[]);
});

test('relação pública da unidade aceita acentos/capitalização e o nome anterior de FRANCISCO LINS',()=>{
 const source=data();source.rows=[{member:'2º sgt cesar vieira',ord:18},{member:'CAP LINS',ord:1},{member:'SD EXTERNO',ord:1}];source.sortBySeniority=true;
 const snapshot=image.project(source,'Novembro/2026',[],personnel);assert.deepEqual(plain(snapshot.rows.map(row=>row.order)),['18','1']);assert.equal(snapshot.rows[1].member,'CAP FRANCISCO LINS');assert.equal(personnel.length,30);
});
