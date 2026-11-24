// CI supplies Playwright and Chromium. This test uses its own origin, database and browser profile.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { openDb } from '../server/db.js';
import { createHandler } from '../server/http.js';

const dir = mkdtempSync(join(tmpdir(),'simagol-planner-smoke-'));
const db = openDb(':memory:');
const server = createServer();
let browser;
try {
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const origin = 'http://127.0.0.1:'+server.address().port;
  server.on('request',createHandler({db,dir,origin,ordersEnabled:false,production:false}));
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2,
    timezoneId:'Asia/Tehran'
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto(origin+'/planner/');
  await page.locator('[data-day]').first().waitFor();
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert.equal(await page.locator('#region').inputValue(),'IR');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),'mobile reflow');
  await page.locator('#language').click();
  assert.equal(await page.locator('html').getAttribute('dir'),'ltr');

  // The browser must install the real shell before the network is removed.
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const manifest = await page.evaluate(async()=>{
    const manifestURL = document.querySelector('link[rel="manifest"]').href;
    return (await fetch(manifestURL)).json();
  });
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'/planner/');
  assert.ok(manifest.icons.some(i=>i.sizes==='512x512'));

  const editor=page.locator('#event-form');
  const input=key=>editor.locator('[name="'+key+'"]');
  await page.locator('#new').click();
  await input('type').selectOption('birthday');
  await input('name').fill('Birthday smoke');
  await input('date').fill('2028-06-11');
  await input('recipient').fill('Gift recipient');
  await input('daysBefore').fill('5');
  await input('annual').check();
  await input('notes').fill('Choose tulips');
  await editor.locator('[type=submit]').click();
  const entries=page.locator('#entries');
  const birthday=entries.locator('.event-row').filter({hasText:'Birthday smoke'});
  await birthday.waitFor();
  await birthday.locator('[data-edit]').click();
  await input('notes').fill('Choose roses');
  await editor.locator('[type=submit]').click();
  await birthday.getByText('Choose roses',{exact:true}).waitFor();

  await page.locator('#region').selectOption('IN');
  await page.locator('.regional-list summary').click();
  await page.locator('[data-choose="in-doctors"]').click();
  assert.ok(await input('annual').isDisabled());
  assert.ok(await page.locator('#holiday-lead').isVisible());
  await editor.locator('[type=submit]').click();
  await entries.getByRole('heading',{name:"National Doctors' Day"}).waitFor();

  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await birthday.getByText('Choose roses',{exact:true}).waitFor();
  assert.equal(await page.locator('#region').inputValue(),'IN');
  const nextDate=await page.locator('#month-title').textContent();
  await page.locator('#next').click();
  assert.notEqual(await page.locator('#month-title').textContent(),nextDate);
  await birthday.locator('[data-delete]').click();
  await page.locator('#remove').click();
  await birthday.waitFor({state:'detached'});
  await page.reload({waitUntil:'domcontentloaded'});
  await entries.getByRole('heading',{name:"National Doctors' Day"}).waitFor();
  assert.equal(await birthday.count(),0);
  assert.deepEqual(pageErrors,[]);
  console.log('Mobile Chromium verified planner CRUD, Iran/India selection, standalone manifest, offline reload and offline edits.');
} finally {
  await browser?.close();
  if(server.listening) {
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
  db.close();
  rmSync(dir,{recursive:true,force:true});
}
