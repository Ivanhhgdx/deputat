const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM}=require(process.env.JSDOM_PATH || 'jsdom');
const root=require('node:path').resolve(__dirname,'..');
const scripts=['materials-data.js','material-baselines.js','public-news.js','material-status.js','materials.js','app.js'];
const news={id:'news:test-publication',version:1,addedAt:'2026-10-02',publishedAt:'2026-09-30',updatedAt:'2026-09-30',title:'Test public publication',summary:'Public summary',source:{name:'Test municipal source',url:'https://example.org/public'}};
function boot(storage={},modify=()=>{},blocked=false){
 const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'https://ivanhhgdx.github.io/deputat/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 for(const [key,value] of Object.entries(storage))w.localStorage.setItem(key,value);
 if(blocked)w.Storage.prototype.setItem=function(){throw new Error('Storage denied')};
 for(const name of scripts){require('node:vm').runInContext(fs.readFileSync(root+'/'+name,'utf8'),dom.getInternalVMContext());if(name==='public-news.js')modify(w);}
 const route=name=>{w.location.hash=name;w.dispatchEvent(new w.HashChangeEvent('hashchange'))};
 return {dom,w,route,q:s=>w.document.querySelector(s),snapshot:()=>Object.fromEntries(Object.keys(w.localStorage).map(key=>[key,w.localStorage.getItem(key)]))};
}
const legacy={read:['budget-may-1'],saved:['budget-may-1'],notes:{'budget-may-1':'KEEP <note>',plan:'KEEP PLAN'},controls:{teachers:'working'}};
let a=boot({'deputat-materials-v1':JSON.stringify(legacy)});a.route('agendas');
assert.equal(a.q('[data-material-read="budget-may-1"]').getAttribute('aria-pressed'),'true');
assert.equal(a.q('[data-question-note="budget-may-1"]').value,'KEEP <note>');
assert.equal(a.w.localStorage.getItem('deputat-materials-v1'),JSON.stringify(legacy));
const second='budget-may-2';assert.equal(a.q(`[data-material-read="${second}"]`).getAttribute('aria-pressed'),'false');
const detail=a.q('#item-'+second+' details');detail.open=true;const textarea=a.q(`[data-question-note="${second}"]`);textarea.value='draft';
a.q(`[data-material-read="${second}"]`).click();assert(detail.open);assert.equal(textarea.value,'draft');
let saved=a.snapshot();a.dom.window.close();a=boot(saved);a.route('agendas');assert.equal(a.q(`[data-material-read="${second}"]`).getAttribute('aria-pressed'),'true');
a.q(`[data-material-read="${second}"]`).click();saved=a.snapshot();a.dom.window.close();a=boot(saved);a.route('agendas');assert.equal(a.q(`[data-material-read="${second}"]`).getAttribute('aria-pressed'),'false');
const study=boot();study.route('agendas');study.q('[data-read="budget-may-3"]').click();const studyReload=boot(study.snapshot());studyReload.route('agendas');assert.equal(studyReload.q('[data-material-read="budget-may-3"]').getAttribute('aria-pressed'),'false');study.dom.window.close();studyReload.dom.window.close();
const revised=boot(saved,w=>{w.DEPUTY_MATERIALS.agendas[0].items[0].title+=' updated'});revised.route('agendas');assert.equal(revised.q('[data-material-status="budget-may-1"] [role="status"]').textContent,'Обновлено');assert.equal(revised.q('[data-read="budget-may-1"]').getAttribute('aria-pressed'),'true');
a.w.dispatchEvent(new a.w.StorageEvent('storage',{key:'deputat-material-read-v1:'+second,newValue:JSON.stringify({version:a.w.MaterialStatus.catalog.get(second).version})}));assert.equal(a.q(`[data-material-read="${second}"]`).getAttribute('aria-pressed'),'true');
for(const name of ['overview','sessions','materials','budget','agendas','situation','territory','initiatives','preparation','opportunities','council','documents']){a.route(name);assert(a.q('h1'));assert(a.q('[aria-current="page"]').getAttribute('href')==='#'+name);}
const fresh=boot({},w=>w.PUBLIC_MUNICIPAL_NEWS.push(news));fresh.route('materials');assert(fresh.q('[data-material-status="news:test-publication"]').textContent.includes('Новое'));assert.equal(fresh.w.localStorage.getItem('deputat-material-read-v1:news:test-publication'),null);fresh.q('[data-material-read="news:test-publication"]').click();const ns=fresh.snapshot();const reloaded=boot(ns,w=>w.PUBLIC_MUNICIPAL_NEWS.push(news));reloaded.route('materials');assert.equal(reloaded.q('[data-material-read="news:test-publication"]').getAttribute('aria-pressed'),'true');
const updated=boot(ns,w=>w.PUBLIC_MUNICIPAL_NEWS.push({...news,version:2,summary:'Changed public summary'}));updated.route('materials');assert(updated.q('[data-material-status="news:test-publication"]').textContent.includes('Обновлено'));
const corrupt=boot({'deputat-materials-v1':'bad','deputat-material-read-v1:budget-may-1':'{broken'});corrupt.route('agendas');assert.equal(corrupt.q('[data-material-read="budget-may-1"]').getAttribute('aria-pressed'),'false');
const denied=boot({},()=>{},true);denied.route('budget');denied.q('[data-material-read="collection:budget"]').click();assert.equal(denied.q('[data-material-read="collection:budget"]').getAttribute('aria-pressed'),'true');assert(denied.q('#toast').textContent.includes('Хранилище недоступно'));
assert.throws(()=>boot({},w=>w.PUBLIC_MUNICIPAL_NEWS.push({...news,source:{name:'Bad',url:'javascript:alert(1)'}})),/Invalid public news/);
assert.throws(()=>boot({},w=>w.PUBLIC_MUNICIPAL_NEWS.push({...news,publishedAt:'2026-02-31'})),/Invalid news date/);
assert.equal(a.w.MaterialStatus.catalog.size,119);
const actualId='news:kansk-chp-heat-tariff-2026-10-01';
const actual=boot({'deputat-materials-v1':JSON.stringify(legacy)});actual.route('materials');
assert.equal(actual.w.PUBLIC_MUNICIPAL_NEWS.length,1);
const actualItem=actual.w.PUBLIC_MUNICIPAL_NEWS[0];assert.equal(actualItem.id,actualId);assert.equal(actualItem.publishedAt,null);assert.equal(actualItem.eventAt,'2026-10-01');assert.equal(actualItem.addedAt,'2026-10-02');
assert.match(actual.q('.material-news').textContent,/3 482,97 ₽\/Гкал с НДС/);assert.match(actual.q('.material-news').textContent,/не распространяются на все котельные/);assert.match(actual.q('.material-news').textContent,/Дата публикации источника: не указана в источнике/);assert.match(actual.q('.material-news').textContent,/поставщика конкретного дома/);assert(!actual.q('.material-news').textContent.includes('Invalid Date'));
assert.equal(actual.q(`[data-material-read="${actualId}"]`).getAttribute('aria-pressed'),'false');actual.q(`[data-material-read="${actualId}"]`).click();
const actualReload=boot(actual.snapshot());actualReload.route('materials');assert.equal(actualReload.q(`[data-material-read="${actualId}"]`).getAttribute('aria-pressed'),'true');actualReload.route('agendas');assert.equal(actualReload.q('[data-material-read="budget-may-1"]').getAttribute('aria-pressed'),'true');assert.equal(actualReload.w.localStorage.getItem('deputat-materials-v1'),JSON.stringify(legacy));
assert.throws(()=>boot({},w=>w.PUBLIC_MUNICIPAL_NEWS.push({...w.PUBLIC_MUNICIPAL_NEWS[0]})),/Duplicate material ID/);
assert.throws(()=>boot({},w=>{delete w.PUBLIC_MUNICIPAL_NEWS[0].publishedAt}),/Invalid public news metadata/);
actual.dom.window.close();actualReload.dom.window.close();
for(const x of [a,revised,fresh,reloaded,updated,corrupt,denied])x.dom.window.close();
console.log('PASS: legacy state unchanged, notes/selected retained, explicit read/unread, reload, content revisions, separate studied state, storage events, 12 routes, new public news, verified tariff with unknown publication date, duplicate rejection, other read marks retained, corrupt/denied storage, source/date validation.');
