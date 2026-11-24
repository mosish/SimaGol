import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const dir=resolve(process.env.DATA_DIR || 'data');
mkdirSync(dir,{recursive:true});
const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
writeFileSync(join(dir,'vapid-private.pem'),privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});
console.log('Created the VAPID signing key in the private data directory.');
