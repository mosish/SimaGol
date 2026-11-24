import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const resource = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const defaults = {
  delivery: {standard:{fee:500000,enabled:true}, express:{fee:900000,enabled:true}, scheduled:{fee:650000,enabled:true}},
  wrapFee:300000, hero:'images/hero.jpg', logo:'', showHero:true,
  mascot:{hero:'',empty:'',loading:'','404':''}, copy:{}
};

export function transaction(db, operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function openDb(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), {recursive:true});
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
    transaction(db, () => {
      db.exec(resource('./schema.sql'));
      if (db.prepare("SELECT 1 FROM options WHERE key='delivery'").get()) return;
      const seed=JSON.parse(resource('./catalog.json'));
      for (const c of seed.categories) {
        db.prepare('INSERT INTO categories(id,name) VALUES (?,?)').run(c.id,JSON.stringify(c.name));
      }
      for (const p of seed.products) {
        db.prepare('INSERT INTO products(id,category,name,description,image,priceIrr,stock) VALUES (?,?,?,?,?,?,?)')
          .run(p.id,p.category,JSON.stringify(p.name),JSON.stringify(p.description),p.image,p.priceIrr,p.stock);
      }
      for (const [key,value] of Object.entries(defaults)) {
        db.prepare('INSERT INTO options(key,value) VALUES (?,?)').run(key,JSON.stringify(value));
      }
      // The initial slot is dated and expires. Staff create subsequent delivery windows.
      const date = new Date(Date.now() + 86400000);
      date.setUTCHours(14,30,0,0);
      const options = {weekday:'short',month:'short',day:'numeric',timeZone:'Asia/Tehran'};
      const label = {
        fa: new Intl.DateTimeFormat('fa-IR',options).format(date)+'، ساعت ۱۶ تا ۱۸',
        en: new Intl.DateTimeFormat('en',options).format(date)+', 16:00–18:00 Tehran'
      };
      db.prepare('INSERT INTO slots(id,label,ends,capacity) VALUES (?,?,?,?)')
        .run('first-window',JSON.stringify(label),date.toISOString(),5);
    });
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function catalog(db, staff=false) {
  const products = db.prepare('SELECT * FROM products WHERE hidden=0 OR ?=1 ORDER BY rowid').all(staff?1:0)
    .map(p => ({...p,name:JSON.parse(p.name),description:JSON.parse(p.description),hidden:Boolean(p.hidden)}));
  const categories = db.prepare('SELECT * FROM categories ORDER BY rowid').all()
    .map(c => ({...c,name:JSON.parse(c.name)}));
  return {categories,products};
}

export function settings(db) {
  const values = Object.fromEntries(db.prepare('SELECT key,value FROM options').all().map(row => [row.key,JSON.parse(row.value)]));
  const slots = db.prepare(`SELECT s.*, (SELECT count(*) FROM orders o WHERE o.slot=s.id AND o.status!='cancelled') booked
    FROM slots s ORDER BY ends,id`).all().map(s => ({...s,label:JSON.parse(s.label)}));
  return {...values,slots};
}
