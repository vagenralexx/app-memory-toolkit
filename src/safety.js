import { relative, isAbsolute, sep } from 'node:path';
import { realpath, lstat, open } from 'node:fs/promises';

export function containsSecret(text) {
  if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/.test(text)) return true;
  const expressions=text.matchAll(/["']?(?:api[_-]?key|password|secret|access[_-]?token)["']?\s*[:=]\s*["']([^"'\s]{8,})["']/gi);
  for(const match of expressions) if(!/^(?:<|\$\{|\{env:|your[_-]|example|test[_-]|dummy|placeholder)/i.test(match[1])) return true;
  return false;
}
export function assertSafeMemory(text) {
  if(containsSecret(text)) throw new Error('Possível segredo detectado. Remova credenciais antes de gravar memória.');
}
export function isWithin(root,path) {
  const rel=relative(root,path);
  return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith(`..${sep}`);
}
export async function safeFile(root,path,{maxBytes=128000}={}) {
  const canonicalRoot=await realpath(root),canonicalPath=await realpath(path);
  if(!isWithin(canonicalRoot,canonicalPath)) throw new Error('Caminho fora da pasta do projeto.');
  const stat=await lstat(canonicalPath);
  if(!stat.isFile()||stat.size>maxBytes) throw new Error('Arquivo não regular ou maior que o limite.');
  return {path:canonicalPath,root:canonicalRoot,stat};
}
export async function readBounded(path,maxBytes=128000) {
  const handle=await open(path,'r');
  try {
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size>maxBytes) throw new Error('Arquivo maior que o limite permitido.');
    const buffer=Buffer.alloc(Math.min(stat.size+1,maxBytes+1));
    const {bytesRead}=await handle.read(buffer,0,buffer.length,0);
    if(bytesRead>maxBytes) throw new Error('Arquivo maior que o limite permitido.');
    return buffer.subarray(0,bytesRead).toString('utf8');
  } finally {await handle.close();}
}
