const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 require('node:fs').mkdirSync(process.env.EVIDENCE_DIR||path.resolve(__dirname,'../..','deputat-evidence'),{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.TEST_URL || 'http://127.0.0.1:4193/';const go=async route=>{await page.goto(base+'#'+route);await page.waitForFunction(r=>document.querySelector('#navigation [aria-current="page"]')?.getAttribute('href')==='#'+r,route);await page.locator('h1').waitFor();};await go('agendas');
 const button=page.locator('[data-material-read="budget-may-2"]');await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');
 await page.reload();assert.equal(await button.getAttribute('aria-pressed'),'true');
 const other=await context.newPage();await other.goto(base+'#agendas');await other.locator('[data-material-read="budget-may-2"]').click();await page.waitForFunction(()=>document.querySelector('[data-material-read="budget-may-2"]').getAttribute('aria-pressed')==='false');
 await page.locator('#item-budget-may-2 summary').click();await button.focus();await page.keyboard.press('Enter');assert(await page.locator('#item-budget-may-2 details').getAttribute('open')!==null);assert.equal(await button.evaluate(el=>el===document.activeElement),true);
 await go('budget');const term=(await page.locator('#budget-results tbody tr td').first().textContent()).trim();await page.locator('#budget-query').fill(term);assert(await page.locator('#budget-results tbody tr').count()>0);
 await page.locator('#navigation a[href="#territory"]').click();await page.goBack();assert(page.url().endsWith('#budget'));await page.goForward();assert(page.url().endsWith('#territory'));
 for(const width of [390,320,1280]){
  await page.setViewportSize({width,height:844});
  for(const route of ['materials','budget','agendas','situation','territory','initiatives','preparation']){
   await go(route);
   const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert(dims.scroll<=dims.width,`${route} width ${width} overflow ${dims.scroll}`);
  }
 }
 await page.setViewportSize({width:390,height:844});await go('agendas');await page.locator('[data-material-read="budget-may-2"]').scrollIntoViewIfNeeded();await page.evaluate(()=>document.getAnimations().forEach(a=>a.finish()));await page.screenshot({path:path.resolve(process.env.EVIDENCE_DIR||path.resolve(__dirname,'../..','deputat-evidence'),'qa-mobile-agendas.png'),fullPage:false});
 await page.setViewportSize({width:1280,height:900});await go('budget');await page.evaluate(()=>document.getAnimations().forEach(a=>a.finish()));await page.screenshot({path:path.resolve(process.env.EVIDENCE_DIR||path.resolve(__dirname,'../..','deputat-evidence'),'qa-desktop-budget.png'),fullPage:false});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: Chromium explicit read/reload, real cross-tab storage, disclosure/focus/keyboard, budget search, back/forward, 7 routes at 320/390/1280 px without horizontal overflow; no page errors.');
})().catch(e=>{console.error(e);process.exit(1)});
