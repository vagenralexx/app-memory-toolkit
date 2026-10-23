import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
for(const directory of ['src','scripts','test']){
  const files=await readdir(directory,{withFileTypes:true});
  for(const file of files.filter(entry=>entry.isFile()&&/\.(?:mjs|js)$/.test(entry.name)))execFileSync(process.execPath,['--check',join(directory,file.name)],{stdio:'inherit'});
}
console.log('Sintaxe conferida: src, scripts e test.');
