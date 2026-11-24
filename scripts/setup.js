import {mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {openDb} from '../server/db.js';
const dir=resolve(process.env.DATA_DIR||'data');
mkdirSync(dir,{recursive:true});
openDb(join(dir,'shop.sqlite')).close();
console.log('SimaGol database initialized.');
