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
  assert.equal(await page.locator('#region').count(),0);
  assert.ok(await page.locator('#calendar-system [value=persian]').isChecked());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),'mobile reflow');
  await page.locator('#language [value=en]').check();
  assert.equal(await page.locator('html').getAttribute('dir'),'ltr');

  // The browser must install the real shell before the network is removed.
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const manifest = await page.evaluate(async()=>{
    const manifestURL = document.querySelector('link[rel="manifest"]').href;
    return (await fetch(manifestURL)).json();
  });
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'/');
  assert.equal(manifest.scope,'/');
  assert.ok(manifest.icons.some(i=>i.sizes==='512x512'));

  const editor=page.locator('#event-form');
  const input=key=>editor.locator('[name="'+key+'"]');
  await page.locator('#jump-year').selectOption('1405');
  await page.locator('#jump-month').selectOption('1');
  await page.locator('[data-day="2026-03-21"]').click();
  const choose=page.locator('#sheet-events [data-choose]').first();
  const chosen=await choose.getAttribute('data-choose');
  await choose.click();
  await page.waitForURL('**/#account/planner-login');
  await page.locator('summary').filter({hasText:'Register'}).click();
  const registration=page.locator('[data-form="Register"]');
  await registration.locator('[name=name]').fill('Planner member');
  await registration.locator('[name=email]').fill('planner@example.test');
  await registration.locator('[name=password]').fill('test-only-flower-planner');
  await registration.locator('[type=submit]').click();
  await page.waitForURL('**/planner/');
  await page.locator('#editor[open]').waitFor();
  assert.equal(await editor.getAttribute('data-holiday'),chosen.split('@')[0]);
  await page.locator('#cancel').click();
  await page.locator('#calendar-system [value=gregory]').check();
  assert.equal(await page.locator('.days [aria-pressed=true]').getAttribute('data-day'),'2026-03-21');
  await page.locator('[data-tab=plus]').click();
  for(const type of ['anniversary','custom','birthday']){
    await page.locator('[data-quick="'+type+'"]').click();
    assert.equal(await editor.locator('[name=type]:checked').inputValue(),type);
    assert.ok(await page.locator('#editor').isVisible());
    if(type!=='birthday'){
      await page.locator('#cancel').click();
      await page.locator('[data-tab=plus]').click();
    }
  }
  await input('name').fill('Birthday smoke');
  await input('date').fill('2028-06-11');
  assert.ok(!await input('notes').isVisible());
  await editor.locator('[value=occasion]').check();
  assert.ok(await page.locator('#holiday-lead').isVisible());
  await editor.locator('[value=birthday]').check();
  assert.ok(await input('daysBefore').isEnabled());
  await editor.locator('#event-more summary').click();
  await input('recipient').fill('Gift recipient');
  await input('daysBefore').fill('5');
  await input('annual').check();
  await input('notes').fill('Choose tulips');
  await input('link').fill('https://example.test/flowers');
  await editor.locator('#event-more summary').click();
  await editor.locator('[type=submit]').click();
  const entries=page.locator('#entries');
  const birthday=entries.locator('.event-row').filter({hasText:'Birthday smoke'});
  await birthday.waitFor();
  await birthday.locator('[data-edit]').click();
  assert.ok(!await input('notes').isVisible());
  await editor.locator('#event-more summary').click();
  assert.equal(await input('notes').inputValue(),'Choose tulips');
  assert.equal(await input('link').inputValue(),'https://example.test/flowers');
  await input('notes').fill('Choose roses');
  await editor.locator('[type=submit]').click();
  await birthday.getByText('Choose roses',{exact:true}).waitFor();

  await page.locator('.planner-views [href="#calendar"]').click();
  await page.locator('#jump-year').selectOption('2026');
  await page.locator('#jump-month').selectOption('12');
  await page.locator('[data-day="2026-12-23"]').click();
  await page.locator('#day-sheet[open]').waitFor();
  const addFather=page.locator('#sheet-events [data-choose^="ir-wv38c9@"]');
  assert.equal(await addFather.textContent(),'+');
  await addFather.click();
  assert.ok(await editor.locator('[value=occasion]').isChecked());
  assert.ok(await editor.locator('[value=birthday]').isDisabled());
  assert.ok(await input('annual').isDisabled());
  assert.ok(await page.locator('#holiday-lead').isVisible());
  await editor.locator('[type=submit]').click();
  await page.locator('.planner-views [href="#reminders"]').click();
  await page.locator('#inbox').waitFor();
  assert.ok(!await entries.isVisible());
  await page.locator('.planner-views [href="#occasions"]').click();
  await entries.getByRole('heading',{name:"Father's Day"}).waitFor();

  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await birthday.getByText('Choose roses',{exact:true}).waitFor();
  assert.ok(await page.locator('#calendar-system [value=gregory]').isChecked());
  await page.locator('.planner-views [href="#calendar"]').click();
  const nextDate=await page.locator('#month-title').textContent();
  await page.locator('#next').click();
  assert.notEqual(await page.locator('#month-title').textContent(),nextDate);
  await page.locator('.planner-views [href="#occasions"]').click();
  await birthday.locator('[data-delete]').click();
  await page.locator('#remove').click();
  await birthday.waitFor({state:'detached'});
  await page.reload({waitUntil:'domcontentloaded'});
  await entries.getByRole('heading',{name:"Father's Day"}).waitFor();
  assert.equal(await birthday.count(),0);
  await page.locator('[data-tab="home"]').click();
  await page.locator('[data-tab="home"][aria-current="page"]').waitFor();
  await page.locator('[data-tab="bouquet"]').click();
  await page.locator('.bouquet-teaser').waitFor();
  await page.locator('.header-cart').click();
  await page.locator('#tab-page h2').waitFor();
  await page.locator('[data-tab="bell"]').click();
  await page.locator('.planner-views [href="#occasions"]').click();
  await entries.getByRole('heading',{name:"Father's Day"}).waitFor();
  await context.setOffline(false);
  await page.reload();
  await page.waitForFunction(async()=>(await (await fetch('/api/planner')).json()).entries.every(e=>e.name!=='Birthday smoke'));
  await page.locator('[data-tab=home]').click();
  await page.locator('[data-tab=plus]').click();
  await page.locator('[data-quick=custom]').click();
  await page.locator('#editor[open]').waitFor();
  assert.equal(await editor.locator('[name=type]:checked').inputValue(),'custom');
  assert.equal(await editor.getAttribute('data-holiday'),'');
  const guest=await browser.newPage();
  await guest.goto(origin);
  await guest.locator('[data-tab=plus]').click();
  await guest.locator('[data-quick=anniversary]').click();
  await guest.waitForURL('**/#account/planner-login');
  const login=guest.locator('[data-form="Login"]');
  await login.locator('[name=email]').fill('planner@example.test');
  await login.locator('[name=password]').fill('test-only-flower-planner');
  await login.locator('[type=submit]').click();
  await guest.locator('#editor[open]').waitFor();
  assert.equal(await guest.locator('#event-form [name=type]:checked').inputValue(),'anniversary');
  await guest.close();
  assert.deepEqual(pageErrors,[]);
  console.log('Mobile Chromium verified planner CRUD, Solar/Gregorian selection and authenticated saves, standalone manifest, offline reload and offline edits.');
} finally {
  await browser?.close();
  if(server.listening) {
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
  db.close();
  rmSync(dir,{recursive:true,force:true});
}
