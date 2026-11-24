import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, relative} from 'node:path';

const releaseRoot='build';
mkdirSync(releaseRoot,{recursive:true});
const staging=mkdtempSync(join(releaseRoot,'stage-'));
const inputs=['public','server','scripts','docs','package.json','package-lock.json','.env.example','Dockerfile','compose.yaml','.dockerignore','README.md','LICENSE','CREDITS.md'];
for(const name of inputs) cpSync(name,join(staging,name),{recursive:true});
function files(folder) {
  return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
    const path=join(folder,entry.name);
    return entry.isDirectory()?files(path):[path];
  }).sort();
}
const digest=createHash('sha256');
for(const path of files(staging)){
  digest.update(relative(staging,path).replaceAll('\\','/')+'\0');
  digest.update(readFileSync(path));
}
const version=digest.digest('hex').slice(0,16);
const worker=join(staging,'public','planner','sw.js');
writeFileSync(worker,readFileSync(worker,'utf8').replace('simagol-planner-shell-v6','simagol-planner-'+version));
const release=join(releaseRoot,'simagol-'+version);
if(!existsSync(release)) renameSync(staging,release);
else {
  // This directory was created by mkdtempSync above for this build.
  const {rmSync}=await import('node:fs');
  rmSync(staging,{recursive:true,force:true});
}
console.log('Release directory: '+release);
