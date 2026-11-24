import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { transaction } from './db.js';

const derive = promisify(scrypt);
const scryptOptions = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const sessionLifetime = 7 * 24 * 60 * 60 * 1000;
const roles = new Set(['customer', 'florist', 'editor', 'owner']);
const publicFields = 'id,name,email,role,addresses,prefs';
const dummySalt = randomBytes(16);
const dummyKey = randomBytes(32);
let hashing = 0;

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function trimmed(value, max, message) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, message);
  return value.trim();
}

function emailKey(value) {
  const email = trimmed(value, 254, 'Invalid email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) fail(400, 'Invalid email');
  return email;
}

async function stretch(password, salt) {
  if (hashing >= 2) fail(429, 'Please try again shortly');
  hashing++;
  try {
    return await derive(password, salt, 32, scryptOptions);
  } finally {
    hashing--;
  }
}

function user(row) {
  if (!row) return null;
  return {
    id: row.id, email: row.email, name: row.name, role: row.role,
    addresses: JSON.parse(row.addresses), prefs: JSON.parse(row.prefs)
  };
}

function userById(db, id) {
  const account = user(db.prepare(`SELECT ${publicFields} FROM users WHERE id=?`).get(id));
  if (!account) fail(404, 'Account not found');
  return account;
}

export async function register(db, body) {
  const email = emailKey(body?.email);
  const name = trimmed(body?.name, 120, 'Invalid name');
  const password = body?.password;
  if (typeof password !== 'string' || [...password].length < 12 || Buffer.byteLength(password) > 1024) {
    fail(400, 'Invalid password');
  }
  const salt = randomBytes(16);
  const key = await stretch(password, salt);
  const encoded = `scrypt-v1$${salt.toString('hex')}$${key.toString('hex')}`;
  const id = randomUUID();
  const inserted = db.prepare(`INSERT INTO users (id,email,name,password,role)
    VALUES (?,?,?,?,'customer') ON CONFLICT(email) DO NOTHING`).run(id, email, name, encoded);
  if (!inserted.changes) fail(409, 'Email already registered');
  return userById(db, id);
}

export async function login(db, body) {
  const email = emailKey(body?.email);
  const password = body?.password;
  if (typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024) {
    fail(401, 'Invalid email or password');
  }
  const row = db.prepare(`SELECT ${publicFields},password FROM users WHERE email=?`).get(email);
  const parts = /^scrypt-v1\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(row?.password || '');
  const salt = parts ? Buffer.from(parts[1], 'hex') : dummySalt;
  const expected = parts ? Buffer.from(parts[2], 'hex') : dummyKey;
  const actual = await stretch(password, salt);
  if (!timingSafeEqual(actual, expected) || !parts) fail(401, 'Invalid email or password');
  return user(row);
}

function tokenHash(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHash('sha256').update(token).digest('hex');
}

export function newSession(db, userId) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
  db.prepare('INSERT INTO sessions (token,userId,expires) VALUES (?,?,?)')
    .run(tokenHash(token), userId, now + sessionLifetime);
  return token;
}

export function getUser(db, token) {
  const digest = tokenHash(token);
  if (!digest) return null;
  return user(db.prepare(`SELECT ${publicFields} FROM users WHERE id=(
    SELECT userId FROM sessions WHERE token=? AND expires>?
  )`).get(digest, Date.now()));
}

export function logout(db, token) {
  const digest = tokenHash(token);
  if (digest) db.prepare('DELETE FROM sessions WHERE token=?').run(digest);
}

export function profile(db, id, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid profile');
  return transaction(db, () => {
    const account = userById(db, id);
    if ('name' in body) account.name = trimmed(body.name, 120, 'Invalid name');
    if ('addresses' in body) {
      if (!Array.isArray(body.addresses) || body.addresses.length > 20) fail(400, 'Invalid addresses');
      account.addresses = body.addresses.map((address) => trimmed(address, 500, 'Invalid addresses'));
    }
    if ('prefs' in body) {
      const prefs = body.prefs;
      if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) fail(400, 'Invalid preferences');
      if ('lang' in prefs) {
        if (!['fa', 'en'].includes(prefs.lang)) fail(400, 'Invalid preferences');
        account.prefs.lang = prefs.lang;
      }
      if ('favorites' in prefs) {
        if (!Array.isArray(prefs.favorites) || prefs.favorites.length > 500 ||
            prefs.favorites.some(id => typeof id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(id))) fail(400,'Invalid preferences');
        account.prefs.favorites = [...new Set(prefs.favorites)];
      }
      if ('dark' in prefs) {
        if (typeof prefs.dark !== 'boolean') fail(400, 'Invalid preferences');
        account.prefs.dark = prefs.dark;
      }
    }
    db.prepare('UPDATE users SET name=?,addresses=?,prefs=? WHERE id=?')
      .run(account.name, JSON.stringify(account.addresses), JSON.stringify(account.prefs), id);
    return account;
  });
}

export function setRole(db, currentId, id, role) {
  return transaction(db, () => {
    if (userById(db, currentId).role !== 'owner') fail(403, 'Access denied');
    if (!roles.has(role)) fail(400, 'Invalid role');
    const target = userById(db, id);
    if (target.role === 'owner' && role !== 'owner') {
      const another = db.prepare("SELECT 1 FROM users WHERE role='owner' AND id<>? LIMIT 1").get(id);
      if (!another) fail(409, 'Keep at least one owner');
    }
    db.prepare('UPDATE users SET role=? WHERE id=?').run(role, id);
    return { ...target, role };
  });
}
