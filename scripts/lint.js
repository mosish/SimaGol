import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';

function walk(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const path=join(dir,entry.name);
    return entry.isDirectory()?walk(path):[path];
  });
}
const files=['public','server','scripts','tests'].flatMap(walk);
const dict=JSON.parse(readFileSync('public/labels.json','utf8'));
const errors=[];
for(const [key,pair] of Object.entries(dict)) {
  if(!pair.fa?.trim()||!pair.en?.trim())errors.push('Missing translation: '+key);
}
for(const file of files) {
  if(/\.m?js$/.test(file)){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(result.status!==0)errors.push(result.stderr);
  }
  if(file.endsWith('.json'))JSON.parse(readFileSync(file,'utf8'));
  if(file.endsWith('.html')){
    for(const match of readFileSync(file,'utf8').matchAll(/data-t="([^"]+)"/g)){
      if(!Object.hasOwn(dict,match[1]))errors.push('Unknown label: '+match[1]);
    }
  }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log('JavaScript syntax, JSON and bilingual page labels passed.');
