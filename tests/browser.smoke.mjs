// Run in CI with a pinned Playwright installation. All writes target a disposable loopback shop.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDb } from '../server/db.js';
import { createHandler } from '../server/http.js';
import { register } from '../server/auth.js';

const dir=mkdtempSync(join(tmpdir(),'simagol-browser-'));
const db=openDb(':memory:');
const server=createServer();
let browser;
try {
  const staffPassword='test-only-flower-shop-owner';
  const staff=await register(db,{name:'Test Owner',email:'owner@example.test',password:staffPassword});
  db.prepare("UPDATE users SET role='owner' WHERE id=?").run(staff.id);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  server.on('request',createHandler({db,dir,origin,production:false,ordersEnabled:true}));
  browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('response',res=>{
    if (res.status()>=400 && !res.url().endsWith('/favicon.ico')) errors.push(res.status()+' '+new URL(res.url()).pathname);
  });
  await page.goto(origin);
  await page.locator('.product').first().waitFor();
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert.equal(await page.locator('.product').count(),4);
  assert.equal(await page.locator('.app-tabs a').count(),4);
  assert.equal(await page.locator('.product .pic').first().getAttribute('href'),'#product/lily');
  assert.equal(await page.locator('.brand small').textContent(),'SIMAGOL');
  await page.locator('#language').click();
  await page.waitForFunction(()=>document.documentElement.lang==='en' && document.documentElement.dir==='ltr');
  await page.locator('#theme').click();
  await page.reload();
  await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
  assert.equal(await page.locator('html').getAttribute('lang'),'en');

  await page.locator('#search').fill('Velvet');
  await page.locator('[data-fav="blush"]').click();
  await page.locator('#favorites').click();
  assert.equal(await page.locator('.product').count(),1);
  await page.locator('.product h3 a').click();
  await page.locator('#panel .detail-actions [data-add]').click();
  await page.locator('#tab-page a[href="#checkout"]').click();
  await page.locator('summary').filter({hasText:'Register'}).click();
  const registration=page.locator('[data-form="Register"]');
  await registration.locator('[name=name]').fill('Test Buyer');
  await registration.locator('[name=email]').fill('buyer@example.test');
  await registration.locator('[name=password]').fill('test-only-buyer-passphrase');
  await registration.locator('[type=submit]').click();
  const checkout=page.locator('[data-form="checkout"]');
  await checkout.locator('[name=address]').fill('Sample address, Tehran');
  assert.equal(await page.locator('.brand small').textContent(),'Hello, Test Buyer');
  const planner=await page.context().newPage();
  await planner.goto(origin+'/planner/');
  await planner.waitForFunction(()=>document.querySelector('.brand small').textContent==='Hello, Test Buyer');
  await planner.locator('#language').click();
  assert.equal(await planner.locator('.brand small').textContent(),'سلام Test Buyer جان');
  await planner.close();
  await checkout.locator('[name=phone]').fill('09123456789');
  await checkout.locator('[name=method]').selectOption('scheduled');
  await checkout.locator('[name=slot] option').first().waitFor({state:'attached'});
  await checkout.locator('[name=wrap]').check();
  await checkout.locator('[name=message]').fill('Test gift');
  await checkout.locator('[type=submit]').click();
  await page.locator('.invoice').waitFor();
  assert.match(await page.locator('.invoice').textContent(),/Test gift/);
  await page.locator('.close').click();
  await page.locator('[data-tab="profile"]').click();
  await page.locator('[href="#account/orders"]').click();
  await page.locator('#history .order').waitFor();
  await page.locator('[data-logout]').click();
  const login=page.locator('[data-form="Login"]');
  await login.locator('[name=email]').fill('owner@example.test');
  assert.equal(await page.locator('.brand small').textContent(),'SIMAGOL');
  await login.locator('[name=password]').fill(staffPassword);
  await login.locator('[type=submit]').click();
  await page.locator('[data-logout]').waitFor();
  await page.locator('#staff-link').click();
  const status=page.locator('[data-form="status"]').first();
  await status.locator('[name=status]').selectOption('preparing');
  await status.locator('[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('[data-form="status"] select')?.value==='shipped');
  await page.locator('.close').click();
  for (const width of [375,768,1440]) {
    await page.setViewportSize({width,height:850});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'horizontal overflow at '+width+'px');
  }
  assert.deepEqual(errors,[]);
  console.log('Chromium passed locale/theme, favorite, cart, scheduled gift order, invoice, history, staff fulfilment and viewport checks.');
} finally {
  await browser?.close();
  if (server.listening) {
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
  db.close();
  rmSync(dir,{recursive:true,force:true});
}
