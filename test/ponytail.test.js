import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import ts from 'typescript';
import { Store } from '../src/store.js';
import { registerProject } from '../src/projects.js';
import { ponytailGuidance } from '../src/ponytail-guidance.js';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

async function fixture(t){const root=await mkdtemp(join(process.env.APP_MEMORY_TEST_TMP??tmpdir(),'app-memory-ponytail-'));const app=join(root,'app');await mkdir(join(app,'src'),{recursive:true});const store=new Store(join(root,'data'));t.after(()=>store.close());const project=await registerProject(store,{name:'Ponytail',root:app,mode:'existing'});await writeFile(join(app,'src','retry.js'),'export function retry() {return true;}\n// shortcut: only local, revisit when remote jobs are enabled');await writeFile(join(app,'src','caller.js'),'import {retry} from "./retry.js"; retry();\n// shortcut: fixed capacity');await writeFile(join(app,'.gitignore'),'ignored/\n');await mkdir(join(app,'ignored'));await writeFile(join(app,'ignored','x.js'),'// shortcut: ignored');return {root,app,store,project};}

test('núcleo portado mantém hash de origem e JavaScript gerado reproduzível',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../docs/ponytail-port.json',import.meta.url),'utf8'));
 const source=await readFile(new URL('../src/ponytail-core.ts',import.meta.url),'utf8');assert.equal(createHash('sha256').update(source).digest('hex'),manifest.source_sha256);assert.equal(manifest.first_implementation,'original_mcp');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const actual=await readFile(new URL('../src/ponytail-core.js',import.meta.url),'utf8');assert.equal(actual.split('\n').slice(1).join('\n'),compiled);
});
test('adaptação reutiliza scanner, respeita escopo, pagina dívida e não altera fontes/base',async t=>{
 const {app,store,project}=await fixture(t),p=project.id;const revision=store.revision(p);
 const call=args=>ponytailGuidance(store,p,{task:'retry',...args});
 const first=await call({mode:'plan',limit:1});assert.equal(first.total,2);assert.equal(first.next_offset,1);assert.ok(first.results[0].source_hash);
 const debt=await call({mode:'debt',limit:30});assert.equal(debt.total,2);assert.ok(debt.results.some(r=>r.trigger_status==='NO_TRIGGER'));assert.ok(debt.results.some(r=>r.trigger_status==='DECLARED_TRIGGER_CANDIDATE'));
 assert.equal((await call({mode:'review',paths:['src/retry.js']})).selection.files_in_scope,1);assert.equal(store.revision(p),revision);assert.match(await readFile(join(app,'src','retry.js'),'utf8'),/shortcut/);
 await assert.rejects(call({paths:['../outside']}),/relativos/);assert.equal(first.validation.review_completed,false);assert.equal(debt.boundaries.writes_backlog,false);
 await writeFile(join(app,'src','retry.js'),'export function retry(){return true;}');assert.equal((await call({mode:'debt'})).total,1);
});
test('MCP publica ferramenta read-only e não cacheia uma edição ainda não indexada', {timeout:30000},async t=>{
 const {app,root}=await fixture(t);const c=new Client({name:'ponytail-port',version:'1'});await c.connect(new StdioClientTransport({command:process.execPath,args:[resolve('src/cli.js'),'serve','--data',join(root,'mcp-memory')],stderr:'pipe'}));t.after(()=>c.close());
 const tool=(await c.listTools()).tools.find(t=>t.name==='get_ponytail_guidance');assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool.inputSchema.properties.cache_mode,undefined);
 const call=async(name,args)=>{const r=await c.callTool({name,arguments:args});assert.ok(!r.isError,JSON.stringify(r));return JSON.parse(r.content[0].text);};
 const p=await call('project_register',{name:'Existing',root:app,mode:'existing'});const args={project_id:p.id,task:'retry',mode:'debt'};assert.equal((await call('get_ponytail_guidance',args)).total,2);await writeFile(join(app,'src','retry.js'),'export function retry(){}');assert.equal((await call('get_ponytail_guidance',args)).total,1);
});
