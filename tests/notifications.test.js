import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { openDb, catalog, settings } from '../server/db.js';
import { placeOrder, transition } from '../server/commerce.js';
import { notifications, markNotificationsRead } from '../server/notifications.js';

test('only committed order events appear once, and reading respects user and screen boundaries', t => {
  const db = openDb(':memory:');
  t.after(() => db.close());
  for (const id of ['first','second']) {
    db.prepare('INSERT INTO users(id,name,email,password) VALUES (?,?,?,?)')
      .run(id,id,id+'@example.test','hash');
  }
  const product = catalog(db).products[0];
  const payload = {
    key: randomUUID(), items: [{id:product.id,qty:1}], recipient: 'Gift recipient',
    phone: '09120000000', address: 'Test address', method: 'standard',
    expectedTotal: product.priceIrr + settings(db).delivery.standard.fee
  };
  const first = placeOrder(db,'first',payload);
  placeOrder(db,'first',payload);
  placeOrder(db,'second',{...payload,key:randomUUID()});
  assert.throws(() => transition(db,first.id,'delivered'), /transition/i);
  const initial = notifications(db,'first');
  assert.equal(initial.length,1);
  assert.equal(initial[0].status,'placed');
  transition(db,first.id,'preparing');
  markNotificationsRead(db,'first',initial[0].id);
  markNotificationsRead(db,'first',initial[0].id);
  assert.deepEqual(notifications(db,'first').map(n => [n.status,n.seen]),
    [['preparing',false],['placed',true]]);
  assert.equal(notifications(db,'second')[0].seen,false);
  assert.throws(() => markNotificationsRead(db,'first',-1), /Invalid input/);
  db.exec("CREATE TRIGGER reject_notice BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT,'unavailable'); END");
  assert.throws(() => transition(db,first.id,'shipped'), /unavailable/);
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(first.id).status,'preparing');
});
