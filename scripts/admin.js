import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDb } from '../server/db.js';

const email = process.argv[2]?.trim().toLowerCase();
const filename = resolve(process.env.DATA_DIR || './data', 'shop.sqlite');
if (!email || process.argv.length !== 3) {
  console.error('Usage: npm run admin -- registered-email@example.com');
  process.exitCode = 1;
} else if (!existsSync(filename)) {
  console.error('Database not found. Check DATA_DIR and run database setup first.');
  process.exitCode = 1;
} else {
  const db = openDb(filename);
  try {
    const result = db.prepare("UPDATE users SET role='owner' WHERE email=?").run(email);
    if (!result.changes) throw new Error('Register this email before granting owner access.');
    console.log('Owner access granted.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
