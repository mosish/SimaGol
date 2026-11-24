import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { openDb } from '../server/db.js';
import { register, login, newSession, getUser, logout, profile, setRole } from '../server/auth.js';

function database(t) {
  const db = openDb(':memory:');
  t.after(() => db.close());
  return db;
}

const account = { name: 'سیما', email: 'Sima@example.test', password: 'long enough for testing' };
const status = (code) => (error) => error.status === code;

test('registration, login and duplicate accounts', async (t) => {
  const db = database(t);
  const user = await register(db, { ...account, role: 'owner' });
  assert.deepEqual(user, {
    id: user.id, name: account.name, email: 'sima@example.test', role: 'customer', addresses: [], prefs: {}
  });
  const other = await register(db, { ...account, email: 'other@example.test' });
  const hashes = db.prepare('SELECT password FROM users ORDER BY email').all();
  assert.ok(hashes.every((r) => r.password !== account.password));
  assert.notEqual(hashes[0].password, hashes[1].password);
  assert.notEqual(user.id, other.id);
  assert.deepEqual(await login(db, account), user);
  await assert.rejects(register(db, { ...account, email: ' SIMA@example.test ' }), status(409));
  await assert.rejects(login(db, { ...account, password: 'wrong' }), status(401));
  await assert.rejects(login(db, { ...account, email: 'missing@example.test' }), status(401));
  await assert.rejects(register(db, { ...account, password: '123' }), status(400));
});

test('sessions store a digest, expire, reflect role changes, and can be revoked', async (t) => {
  const db = database(t);
  const user = await register(db, account);
  const token = newSession(db, user.id);
  const row = db.prepare('SELECT token, expires FROM sessions').get();
  assert.equal(row.token, createHash('sha256').update(token).digest('hex'));
  assert.ok(row.expires > Date.now());
  assert.deepEqual(getUser(db, token), user);
  assert.equal(getUser(db, 'invalid'), null);
  assert.equal(getUser(db, undefined), null);
  db.prepare("UPDATE users SET role='editor' WHERE id=?").run(user.id);
  assert.equal(getUser(db, token).role, 'editor');
  logout(db, token);
  assert.equal(getUser(db, token), null);
  const expired = newSession(db, user.id);
  db.exec('UPDATE sessions SET expires=0');
  assert.equal(getUser(db, expired), null);
});

test('partial profile updates preserve other fields and reject invalid values', async (t) => {
  const db = database(t);
  const { id } = await register(db, account);
  profile(db, id, { addresses: ['  نارمک  '], prefs: { lang: 'fa', dark: true } });
  const updated = profile(db, id, { prefs: { lang: 'en' } });
  assert.deepEqual(updated.addresses, ['نارمک']);
  assert.deepEqual(updated.prefs, { lang: 'en', dark: true });
  assert.throws(() => profile(db, id, { prefs: { dark: 'false' } }), status(400));
  assert.throws(() => profile(db, id, { addresses: [''] }), status(400));
});

test('role updates are restricted to owners and preserve one owner', async (t) => {
  const db = database(t);
  const owner = await register(db, account);
  const member = await register(db, { ...account, email: 'member@example.test' });
  db.prepare("UPDATE users SET role='owner' WHERE id=?").run(owner.id);
  assert.throws(() => setRole(db, member.id, member.id, 'owner'), status(403));
  assert.throws(() => setRole(db, owner.id, owner.id, 'florist'), status(409));
  assert.equal(setRole(db, owner.id, member.id, 'owner').role, 'owner');
  assert.equal(setRole(db, member.id, owner.id, 'florist').role, 'florist');
  assert.throws(() => setRole(db, member.id, owner.id, 'administrator'), status(400));
});
