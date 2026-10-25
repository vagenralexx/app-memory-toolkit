// Generated from graph-extractors.ts; engine first validated in original MCP.
import { spawn } from 'node:child_process';
/** Optional local parsers. No grammar/model download or project execution at query time. */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { extname, posix } from 'node:path';
const require = createRequire(import.meta.url), sha = (s) => createHash('sha256').update(s).digest('hex');
export const GRAMMARS = { '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java', '.cs': 'c_sharp', '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp', '.kt': 'kotlin', '.kts': 'kotlin', '.swift': 'swift', '.dart': 'dart', '.php': 'php', '.rb': 'ruby', '.lua': 'lua', '.ex': 'elixir', '.exs': 'elixir', '.elm': 'elm', '.ml': 'ocaml', '.mli': 'ocaml', '.scala': 'scala', '.sc': 'scala', '.sol': 'solidity', '.zig': 'zig', '.sh': 'bash', '.bash': 'bash', '.m': 'objc', '.mm': 'objc', '.res': 'rescript', '.resi': 'rescript', '.ql': 'ql', '.tla': 'tlaplus', '.el': 'elisp', '.vue': 'vue', '.css': 'css', '.html': 'html', '.json': 'json', '.toml': 'toml', '.yaml': 'yaml', '.yml': 'yaml' };
const cache = new Map();
const definitionTypes = new Set(['function_definition', 'function_declaration', 'method_definition', 'method_declaration', 'class_definition', 'class_declaration', 'interface_declaration', 'struct_item', 'enum_item', 'trait_item', 'function_item', 'type_declaration', 'struct_specifier', 'enum_specifier', 'namespace_definition', 'module', 'singleton_method', 'method', 'class', 'module_definition', 'function_declarator', 'protocol_declaration', 'property_declaration', 'class_specifier', 'interface_definition', 'namespace_declaration', 'module_declaration', 'contract_declaration', 'event_definition', 'struct_declaration', 'enum_declaration', 'type_definition', 'function_signature_item']);
// A failed/incompatible WASM grammar cannot terminate the MCP process. The child executes only this fixed parser code.
const PARSER_SCRIPT = String.raw `
const fs=require('node:fs'),x=JSON.parse(fs.readFileSync(0,'utf8')),{Parser,Language}=require(x.runtime);
(async()=>{let parser,tree;try{await Parser.init();const grammar=await Language.load(x.wasm);parser=new Parser();parser.setLanguage(grammar);const started=Date.now();tree=parser.parse(x.source.content,undefined,{progressCallback:()=>Date.now()-started>150});if(!tree)throw Error('AST_TIMEOUT');const defs=[],calls=[],imports=[],stack=[tree.rootNode],types=new Set(x.types);let visited=0;
while(stack.length&&visited++<50000){const node=stack.pop();if(types.has(node.type)){let name=node.childForFieldName('name')||node.childForFieldName('declarator')||node.namedChildren.find(n=>['identifier','type_identifier','simple_identifier','constant','word','symbol'].includes(n.type));if(name?.type==='function_declarator')name=name.childForFieldName('declarator');if(name&&name.text.length<=200&&!/[\r\n]/.test(name.text)&&!defs.some(d=>d.name===name.text&&d.line===node.startPosition.row+1))defs.push({key:'ast:'+x.source.path+':'+node.startPosition.row+':'+node.startPosition.column+':'+name.text,path:x.source.path,name:name.text,line:node.startPosition.row+1,end_line:node.endPosition.row+1,kind:x.language+':'+node.type});}
if(x.language==='python'&&node.type==='import_from_statement'){const spec=node.childForFieldName('module_name');if(spec)imports.push({kind:'python',specifier:spec.text,line:node.startPosition.row+1});}
if(x.language==='python'&&node.type==='import_statement')for(const child of node.namedChildren){const spec=child.type==='aliased_import'?child.childForFieldName('name'):child;if(spec&&['dotted_name','identifier'].includes(spec.type))imports.push({kind:'python',specifier:spec.text,line:node.startPosition.row+1});}
if(['c','cpp'].includes(x.language)&&node.type==='preproc_include'){const spec=node.childForFieldName('path');if(spec&&spec.text.startsWith('"')&&spec.text.endsWith('"'))imports.push({kind:'relative',specifier:spec.text.slice(1,-1),line:node.startPosition.row+1});}
if(x.language==='java'&&node.type==='import_declaration'){const spec=node.namedChildren.find(n=>['scoped_identifier','identifier'].includes(n.type));if(spec&&!node.text.includes('*'))imports.push({kind:'java',specifier:spec.text,line:node.startPosition.row+1});}
if(x.language==='rust'&&node.type==='use_declaration'){const spec=node.childForFieldName('argument');if(spec&&spec.text.startsWith('crate::')&&!/[{}*]/.test(spec.text))imports.push({kind:'rust',specifier:spec.text,line:node.startPosition.row+1});}
if(['call','call_expression','method_invocation','function_call_expression'].includes(node.type)){const fn=node.childForFieldName('function')||node.childForFieldName('name');if(fn&&/^[\p{L}_][\p{L}\p{N}_]*$/u.test(fn.text))calls.push({name:fn.text,line:node.startPosition.row+1});}const children=node.namedChildren;for(let i=children.length-1;i>=0;i--)stack.push(children[i]);}
const connections=[];for(const c of calls){const ds=defs.filter(d=>d.name===c.name);if(ds.length===1)connections.push({from:'file:'+x.source.path,to:ds[0].key,relation:'calls',path:x.source.path,line:c.line,confidence:'INFERRED',mechanism:'tree_sitter_'+x.language+'; same_file_unique_name; not_type_identity_or_runtime'});}
const error=typeof tree.rootNode.hasError==='function'?tree.rootNode.hasError():tree.rootNode.hasError;
process.stdout.write(JSON.stringify({definitions:defs,connections,imports,warnings:[...(error?[{path:x.source.path,state:'AST_PARSE_ERRORS',language:x.language}]:[]),...(visited>=50000?[{path:x.source.path,state:'AST_NODE_LIMIT'}]:[])],engine:'web-tree-sitter@0.25.10:'+x.language}));
}finally{tree?.delete();parser?.delete();}})().catch(()=>{process.exitCode=1;});`;
async function treeParse(source) {
    const language = GRAMMARS[extname(source.path).toLowerCase()];
    const runtime = require.resolve('web-tree-sitter'), wasm = require.resolve('tree-sitter-wasms/out/tree-sitter-' + language + '.wasm');
    return new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--max-old-space-size=128', '-e', PARSER_SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }); const chunks = []; let size = 0, done = false; const fail = () => { if (done)
        return; done = true; clearTimeout(timer); child.kill(); reject(Error('ISOLATED_AST_PARSER_FAILED')); }; const timer = setTimeout(fail, 5000); child.stdout.on('data', data => { size += data.length; if (size > 1500000)
        fail();
    else
        chunks.push(data); }); child.stderr.on('data', () => { }); child.on('error', fail); child.stdin.on('error', fail); child.on('close', code => { if (done)
        return; done = true; clearTimeout(timer); if (code !== 0) {
        reject(Error('ISOLATED_AST_PARSER_FAILED'));
        return;
    } try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    }
    catch {
        reject(Error('ISOLATED_AST_PARSER_FAILED'));
    } }); child.stdin.end(JSON.stringify({ runtime, wasm, source, language, types: [...definitionTypes] })); });
}
const value = (v) => typeof v === 'string' ? v : typeof v?.value === 'string' ? v.value : typeof v?.expr?.value === 'string' ? v.expr.value : '';
function sqlParse(s, dialect) {
    const { Parser } = require('node-sql-parser'), parser = new Parser(), parsed = parser.astify(s.content, { database: dialect }), statements = Array.isArray(parsed) ? parsed : [parsed], definitions = [], connections = [], changes = [], warnings = [];
    const name = (t) => [value(t?.db), value(t?.table ?? t?.view)].filter(Boolean).join('.'), key = (kind, n) => 'sql:' + s.path + ':' + kind + ':' + n;
    const add = (kind, n) => { const k = key(kind, n); if (!definitions.some(d => d.key === k))
        definitions.push({ key: k, path: s.path, name: n, line: 1, evidence_scope: 'file', kind: 'sql_' + kind }); return k; };
    const edge = (from, to, relation) => connections.push({ from, to, relation, path: s.path, confidence: 'EXTRACTED', mechanism: 'node-sql-parser@5.4.0:' + dialect + '; file-level AST evidence; no migration execution' });
    const declarations = new Map();
    for (const st of statements)
        if (st.type === 'create' && st.keyword === 'table')
            for (const t of st.table ?? [])
                declarations.set(name(t), add('table', name(t)));
    for (let i = 0; i < statements.length; i++) {
        const st = statements[i], table = name(st.table?.[0]);
        if (st.type === 'create' && st.keyword === 'table') {
            const tableKey = declarations.get(table);
            for (const col of st.create_definitions ?? [])
                if (col.resource === 'column') {
                    const n = value(col.column?.column), columnKey = add('column', table + '.' + n);
                    const definition = definitions.find(d => d.key === columnKey);
                    definition.metadata = { data_type: col.definition?.dataType ?? 'unknown', length: col.definition?.length ?? null, primary_key: !!col.primary_key, nullable: col.nullable?.value ?? null, default_present: col.default_val !== undefined };
                    edge(tableKey, columnKey, 'has_column');
                    if (col.reference_definition)
                        for (const target of col.reference_definition.table ?? []) {
                            const targetName = name(target);
                            edge(columnKey, 'sql-target:' + targetName, 'references_table');
                        }
                }
        }
        if (st.type === 'create' && st.keyword === 'view') {
            const view = add('view', name(st.view));
            const visit = (node, depth = 0) => { if (!node || typeof node !== 'object' || depth > 40)
                return; if (Array.isArray(node)) {
                for (const n of node)
                    visit(n, depth + 1);
                return;
            } if (node.type === 'select')
                for (const t of node.from ?? [])
                    if (t.table)
                        edge(view, 'sql-target:' + name(t), 'reads_table'); for (const [k, v] of Object.entries(node))
                if (k !== 'from')
                    visit(v, depth + 1); };
            visit(st.select);
        }
        if (['alter', 'drop', 'rename', 'truncate'].includes(st.type)) {
            const migrationKey = add('migration', String(i + 1) + ':' + st.type + ':' + table);
            changes.push({ path: s.path, statement: i + 1, operation: st.type, table, actions: (st.expr ?? []).map((e) => ({ action: e.action, resource: e.resource, column: value(e.column?.column) })), applied: false, ordering: 'file statement order only; cross-file migration order not assumed' });
            if (table)
                edge(migrationKey, 'sql-target:' + table, 'schema_change');
            for (const action of st.expr ?? [])
                if (action.action === 'add' && action.resource === 'column') {
                    const col = add('column', table + '.' + value(action.column?.column));
                    edge(migrationKey, col, 'declares_column');
                }
        }
    }
    return { definitions, connections, warnings, changes, engine: 'node-sql-parser@5.4.0:' + dialect };
}
export async function augmentGraph(input, { enabled = true, dialect = 'Postgresql' } = {}) {
    if (!enabled)
        return input;
    if (!['Postgresql', 'MySQL', 'TransactSQL', 'Sqlite', 'MariaDB', 'DB2', 'BigQuery'].includes(dialect))
        throw Error('sql_dialect inválido.');
    const definitions = [...input.definitions], connections = [...input.connections], warnings = [], engines = new Set(), changes = [], live = new Set();
    let hits = 0, misses = 0, processed = 0;
    const selected = input.sources.filter(s => (GRAMMARS[extname(s.path).toLowerCase()] && !/\.(?:json|toml|ya?ml|css|html)$/i.test(s.path)) || /\.sql$/i.test(s.path));
    for (const s of selected.slice(0, 250)) {
        const key = input.scope + '\0' + s.path + '\0' + sha(s.content) + '\0' + dialect;
        live.add(key);
        let parsed = cache.get(key);
        if (parsed)
            hits++;
        else {
            misses++;
            try {
                parsed = /\.sql$/i.test(s.path) ? sqlParse(s, dialect) : await treeParse(s);
                cache.set(key, parsed);
            }
            catch (error) {
                warnings.push({ path: s.path, state: error.code === 'MODULE_NOT_FOUND' ? 'OPTIONAL_PARSER_NOT_INSTALLED' : 'OPTIONAL_PARSE_FAILED', language: GRAMMARS[extname(s.path)] ?? dialect });
                continue;
            }
        }
        processed++;
        engines.add(parsed.engine);
        warnings.push(...parsed.warnings);
        changes.push(...(parsed.changes ?? []));
        const remap = new Map();
        for (const d of parsed.definitions) {
            const existing = definitions.find(x => x.path === d.path && x.name === d.name && (x.line === d.line || d.kind.startsWith('sql_')));
            if (existing)
                remap.set(d.key, existing.key);
            else
                definitions.push({ ...d });
        }
        for (const e of parsed.connections)
            connections.push({ ...e, from: remap.get(e.from) ?? e.from, to: remap.get(e.to) ?? e.to });
        for (const imp of parsed.imports ?? []) {
            let candidates = [];
            const spec = String(imp.specifier);
            if (imp.kind === 'relative') {
                const local = posix.normalize(posix.join(posix.dirname(s.path), spec));
                candidates = input.sources.filter(t => t.path === local).map(t => t.path);
            }
            if (imp.kind === 'python') {
                const dots = spec.match(/^\.+/)?.[0].length ?? 0, module = spec.slice(dots).replaceAll('.', '/');
                let base = '';
                if (dots) {
                    base = posix.dirname(s.path);
                    for (let n = 1; n < dots; n++)
                        base = posix.dirname(base);
                }
                const target = posix.normalize(posix.join(base, module));
                candidates = input.sources.filter(t => t.path === target + '.py' || t.path === target + '/__init__.py').map(t => t.path);
            }
            if (imp.kind === 'java') {
                const suffix = spec.replaceAll('.', '/') + '.java';
                candidates = input.sources.filter(t => t.path === suffix || t.path.endsWith('/' + suffix)).map(t => t.path);
            }
            if (imp.kind === 'rust') {
                const parts = spec.slice(7).split('::');
                for (let n = parts.length; n > 0 && !candidates.length; n--) {
                    const module = parts.slice(0, n).join('/');
                    candidates = input.sources.filter(t => t.path === 'src/' + module + '.rs' || t.path === 'src/' + module + '/mod.rs').map(t => t.path);
                }
            }
            if (candidates.length === 1)
                connections.push({ from: 'file:' + s.path, to: 'file:' + candidates[0], relation: 'imports', path: s.path, line: imp.line, confidence: imp.kind === 'relative' ? 'EXTRACTED' : 'INFERRED', mechanism: 'tree_sitter_explicit_import; ' + imp.kind + ' manifest resolution; no runtime load path proof' });
            else
                warnings.push({ path: s.path, state: candidates.length ? 'AST_IMPORT_TARGET_AMBIGUOUS' : 'AST_IMPORT_TARGET_NOT_OBSERVED', language: GRAMMARS[extname(s.path)], line: imp.line });
        }
    }
    for (const key of cache.keys())
        if (key.startsWith(input.scope + '\0') && !live.has(key))
            cache.delete(key);
    while (cache.size > 500)
        cache.delete(cache.keys().next().value);
    const tables = definitions.filter(d => d.kind === 'sql_table');
    const resolved = [];
    for (const e of connections) {
        if (!e.to.startsWith('sql-target:')) {
            resolved.push(e);
            continue;
        }
        const n = e.to.slice(11), matches = tables.filter(d => d.name === n || (!n.includes('.') && d.name.split('.').pop() === n));
        if (matches.length === 1)
            resolved.push({ ...e, to: matches[0].key });
        else
            warnings.push({ path: e.path, state: matches.length ? 'SQL_AST_TARGET_AMBIGUOUS' : 'SQL_AST_TARGET_UNAVAILABLE', target: n });
    }
    if (selected.length > 250)
        warnings.push({ state: 'OPTIONAL_PARSE_FILE_LIMIT', remaining: selected.length - 250 });
    return { ...input, definitions, connections: resolved, coverage: { ...input.coverage, complete: input.coverage.complete && warnings.length === 0, warnings: [...(input.coverage.warnings ?? []), ...warnings], structural_parsers: { processed, engines: [...engines], dialect, cache: { hits, misses, entries: cache.size, max_entries: 500, storage: 'bounded_process_memory; current content hashes' }, schema_changes: changes.slice(0, 100), not_executed: true } } };
}
export function parserCapabilities() { const installed = (name) => { try {
    require.resolve(name);
    return true;
}
catch {
    return false;
} }; return { grammars: GRAMMARS, tree_sitter: { installed: installed('web-tree-sitter') && installed('tree-sitter-wasms/out/tree-sitter-python.wasm'), version: '0.25.10/0.1.13' }, sql: { installed: installed('node-sql-parser'), version: '5.4.0', dialects: ['Postgresql', 'MySQL', 'TransactSQL', 'Sqlite', 'MariaDB', 'DB2', 'BigQuery'] }, limits: { files: 250, source_bytes: 128000, node_visits: 50000, tree_timeout_microseconds: 150000 }, network: false }; }
