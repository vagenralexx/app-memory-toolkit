// Generated from graph-core.ts; engine first validated in original MCP.
import { validateMedia } from './graph-media.js';
import { importGraphExtraction } from './graph-import.js';
/** Own bounded graph algorithms inspired by Graphify. Existing extractors/indexes supply the evidence. */
import { topology, graphExport } from './graph-analysis.js';
import { enrichGraph } from './graph-enrichment.js';
import { createHash } from 'node:crypto';
export const GRAPH_VERSION = '3.0.0';
export const GRAPH_MODES = ['overview', 'path', 'impact', 'snapshot', 'diff', 'query', 'explain', 'communities', 'audit', 'export', 'help'];
export const GRAPH_WORKFLOW = 'Extensões: consultar mode help/status para parsers/provedores disponíveis. Entidades externas em extraction exigem âncoras atuais e permanecem inferidas. Mídia é local, explícita e sem download de pesos. manage_graph_context controla o indexador/watcher existente e réplica externa somente em perfil habilitado; não criar segunda fila/base. O próprio agente sintetiza query/explain com citações e limites; não transformar instruções em fontes em regras. Grafo: get_graph_context consulta índices/relações existentes para caminhos, impacto estático, concentração, snapshots/diff, query, explain, communities, audit e export. Query aceita pergunta e expande sementes da busca; export produz artefatos sem gravar. Enrichment externo exige hash/linha/trecho atuais e opt-in para percorrer inferências. Escolher IDs exatos quando há ambiguidade; direção e classificação de cada ligação são explícitas. Inferências são opt-in. Conferir cobertura/hash e fontes atuais; caminho estático não prova fluxo executado. Snapshot é derivado e não uma nova fonte canônica; guardar no memory_store existente somente se couber e mantiver scope/filtro. Sem relação encontrada não significa ausência de risco. Usar as ferramentas de referências/revisão/arquitetura existentes, sem outro índice, banco, hook ou serviço.';
const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : v;
const sha = (v) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const id = (kind, key) => sha([kind, key]).slice(0, 32);
const safePath = (s) => !!s && !s.startsWith('/') && !s.includes('\\') && !s.split('/').includes('..') && !/^[A-Za-z]:/.test(s) && s.length <= 1000;
const clean = (s, max = 300) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
export function validateGraphArgs(raw) {
    if (Object.keys(raw).some(k => !['mode', 'focus', 'to', 'direction', 'max_depth', 'limit', 'offset', 'paths', 'relations', 'include_inferred', 'previous', 'diagram', 'query', 'format', 'max_nodes', 'resolution', 'enrichment', 'semantic', 'extraction', 'parsers', 'sql_dialect', 'media'].includes(k)))
        throw Error('Argumento de grafo desconhecido.');
    if (raw.mode !== undefined && !GRAPH_MODES.includes(raw.mode))
        throw Error('mode inválido.');
    validateMedia(raw.media);
    if (raw.sql_dialect !== undefined && !['Postgresql', 'MySQL', 'TransactSQL', 'Sqlite', 'MariaDB', 'DB2', 'BigQuery'].includes(String(raw.sql_dialect)))
        throw Error('sql_dialect inválido.');
    if (raw.query !== undefined && (typeof raw.query !== 'string' || !raw.query.trim() || raw.query.length > 1000))
        throw Error('query inválida.');
    if (raw.format !== undefined && !['json', 'graphml', 'cypher', 'svg', 'markdown', 'wiki', 'obsidian', 'html'].includes(String(raw.format)))
        throw Error('format inválido.');
    if (raw.max_nodes !== undefined && (!Number.isInteger(raw.max_nodes) || Number(raw.max_nodes) < 1 || Number(raw.max_nodes) > 500))
        throw Error('max_nodes fora dos limites.');
    if (raw.resolution !== undefined && (typeof raw.resolution !== 'number' || !Number.isFinite(raw.resolution) || raw.resolution < 0.1 || raw.resolution > 4))
        throw Error('resolution fora dos limites.');
    for (const key of ['focus', 'to'])
        if (raw[key] !== undefined && (typeof raw[key] !== 'string' || !String(raw[key]).trim() || String(raw[key]).length > 1000))
            throw Error(key + ' inválido.');
    if (raw.direction !== undefined && !['incoming', 'outgoing', 'both'].includes(String(raw.direction)))
        throw Error('direction inválido.');
    for (const [key, min, max] of [['max_depth', 1, 8], ['limit', 1, 50], ['offset', 0, 1000000]])
        if (raw[key] !== undefined && (!Number.isSafeInteger(raw[key]) || Number(raw[key]) < min || Number(raw[key]) > max))
            throw Error(key + ' fora dos limites.');
    for (const key of ['include_inferred', 'diagram', 'semantic', 'parsers'])
        if (raw[key] !== undefined && typeof raw[key] !== 'boolean')
            throw Error(key + ' deve ser boolean.');
    if (raw.paths !== undefined && (!Array.isArray(raw.paths) || raw.paths.length > 30 || raw.paths.some(p => typeof p !== 'string' || !safePath(p))))
        throw Error('paths devem ser relativos, sem traversal.');
    if (raw.relations !== undefined && (!Array.isArray(raw.relations) || raw.relations.length > 20 || raw.relations.some(r => typeof r !== 'string' || !/^[a-z][a-z_]{0,39}$/.test(r))))
        throw Error('relations inválidas.');
    if (raw.previous !== undefined && (!raw.previous || typeof raw.previous !== 'object' || Array.isArray(raw.previous) || JSON.stringify(raw.previous).length > 1500000))
        throw Error('previous inválido ou maior que1.5MB.');
    return raw;
}
export function graphHelp() { return { engine: GRAPH_VERSION, modes: GRAPH_MODES, selectors: 'focus/to aceitam ID, key, caminho exato ou label único. Ambiguidade retorna candidatos sem escolher.', directions: 'A importa/chama B significa A→B; impacto incoming acha consumidores. Both é conexão, não causalidade.', confidence: { EXTRACTED: 'Relação explícita ou registro canônico', INFERRED: 'Alvo resolvido por análise estática; habilitar include_inferred para percorrer', AMBIGUOUS: 'Candidato incerto; nunca percorrido automaticamente' }, snapshot: 'mode snapshot retorna pares compactos/escopo/filtro/digest. Usar previous em diff, mesmo escopo/filtro. Memória existente aceita só snapshots com fits_memory=true; restringir paths para reduzir.', limits: { max_nodes: 3000, max_edges: 10000, max_depth: 8, visited_nodes: 2000, snapshot_max_bytes: 1500000 }, boundaries: { read_only: true, writes_project: false, writes_backlog: false, network: false, launches_agents: false, executes_project: false }, note: 'Algoritmos próprios; não instala Graphify nem substitui busca híbrida/TypeChecker. Comunidades usam melhoria local de modularidade com partições conexas, não Leiden. Query usa sementes da busca existente quando disponíveis. Export não grava arquivos. Enrichment aceita até200 links ancorados (schema mcp-graph-enrichment/v1; from,to,relation,path,line,quote,source_hash,provider), sempre INFERRED; não executa extratores nem envia fontes.' }; }
export function queryGraph(original, raw) {
    const args = validateGraphArgs(raw), mode = args.mode ?? 'overview';
    if (mode === 'help')
        return graphHelp();
    const scoped = { ...original, sources: original.sources.filter(s => !args.paths?.length || args.paths.some(p => s.path === p || s.path.startsWith(p.endsWith('/') ? p : p + '/'))) };
    const input = enrichGraph(importGraphExtraction(scoped, args.extraction), args.enrichment).input;
    if (!input.scope || input.scope.length > 200)
        throw Error('Scope de grafo obrigatório.');
    const paths = [...(args.paths ?? [])].sort(), inScope = (p) => !paths.length || !!p && paths.some(path => p === path || p.startsWith(path.endsWith('/') ? path : path + '/'));
    const nodes = new Map(), keys = new Map(), edges = new Map();
    let truncated = false;
    const sources = new Map(input.sources.filter(s => safePath(s.path) && inScope(s.path)).map(s => [s.path, s]));
    function addNode(key, label, kind, hash, path, line, module, metadata) { if (nodes.size >= 3000 && !keys.has(key)) {
        truncated = true;
        return;
    } if (keys.has(key))
        return keys.get(key); const nid = id(kind, key); nodes.set(nid, { id: nid, key, label: clean(label), kind, path, line, module: module ?? (path?.split('/').slice(0, 2).join('/') || 'canonical'), hash, ...(metadata ? { metadata } : {}) }); keys.set(key, nid); return nid; }
    for (const s of [...sources.values()].sort((a, b) => a.path.localeCompare(b.path)))
        addNode('file:' + s.path, s.path, s.kind === 'media' ? 'media' : /\.(md|txt)$/i.test(s.path) ? 'document' : 'file', s.kind === 'media' ? sha([s.hash, sha(s.content)]) : s.hash, s.path, undefined, s.module, s.kind === 'media' ? { binary_hash: s.hash, derived_text_hash: sha(s.content), trust: 'DERIVED_TEXT_NOT_SEMANTIC_FACT' } : undefined);
    for (const r of [...(input.records ?? [])].sort((a, b) => a.key.localeCompare(b.key)))
        if (inScope(r.path))
            addNode(r.key, r.label, r.kind, r.hash, r.path, undefined, r.module);
    function edge(c) { const source = keys.get(c.from), target = keys.get(c.to); if (!source || !target)
        return; if (!['EXTRACTED', 'INFERRED', 'AMBIGUOUS'].includes(c.confidence) || !/^[a-z][a-z_]{0,39}$/.test(c.relation))
        return; const sid = id('edge', JSON.stringify([source, target, c.relation, c.confidence, c.path ?? '', c.line ?? 0])); if (edges.size >= 10000 && !edges.has(sid)) {
        truncated = true;
        return;
    } edges.set(sid, { id: sid, source, target, relation: c.relation, confidence: c.confidence, evidence: { path: c.path, line: c.line, source_hash: c.path ? sources.get(c.path)?.hash : undefined, mechanism: clean(c.mechanism, 200), state: c.path ? 'SOURCE_CURRENT' : 'CANONICAL_RECORD' } }); }
    if (input.definitions.length > 12000)
        truncated = true;
    for (const d of [...input.definitions].slice(0, 12000).sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.key.localeCompare(b.key))) {
        const s = sources.get(d.path);
        if (!s)
            continue;
        addNode(d.key, d.name, 'symbol', sha([s.hash, d.name, d.kind, d.line, d.end_line ?? null]), d.path, d.evidence_scope === 'file' ? undefined : d.line, s.module, d.metadata);
        edge({ from: 'file:' + d.path, to: d.key, relation: 'contains', confidence: 'EXTRACTED', path: d.path, line: d.evidence_scope === 'file' ? undefined : d.line, mechanism: d.evidence_scope === 'file' ? 'file_level_structural_AST; exact line not supplied' : 'existing_structural_index' });
    }
    // Anchored comments are rationale candidates, not instructions or accepted design decisions.
    for (const s of sources.values())
        if (s.kind !== 'media' && !/\.(md|txt)$/i.test(s.path))
            for (const [i, line] of s.content.split('\n').entries()) {
                const m = line.match(/^\s*(?:\/\/|#|\/\*|\*)\s*(?:NOTE|WHY):\s*(.+?)(?:\*\/)?\s*$/);
                if (!m)
                    continue;
                const key = 'rationale:' + s.path + ':' + (i + 1);
                addNode(key, m[1], 'rationale', sha([s.hash, i + 1, m[1]]), s.path, i + 1, s.module);
                edge({ from: 'file:' + s.path, to: key, relation: 'rationale', confidence: 'EXTRACTED', path: s.path, line: i + 1, mechanism: 'anchored_note_why_comment_not_accepted_adr' });
            }
    if (input.connections.length > 20000)
        truncated = true;
    for (const c of [...input.connections].slice(0, 20000).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.relation.localeCompare(b.relation) || ((a.line ?? 0) - (b.line ?? 0))))
        if (!c.path || sources.has(c.path))
            edge(c);
    const selection = { paths, relations: [...(args.relations ?? [])].sort(), include_inferred: args.include_inferred ?? false };
    const filter = sha(selection);
    const allowed = [...edges.values()].filter(e => e.confidence !== 'AMBIGUOUS' && (e.confidence === 'EXTRACTED' || args.include_inferred) && (!args.relations?.length || args.relations.includes(e.relation)));
    const eligible = allowed.sort((a, b) => a.id.localeCompare(b.id)), allNodes = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
    const complete = input.coverage.complete && !truncated;
    const pairs = allNodes.map(n => [n.id, sha(n).slice(0, 32), n.key, n.kind]), links = eligible.map(e => [e.id, sha(e).slice(0, 32), e.source, e.target, e.relation, e.confidence]);
    const body = { schema: 'mcp-graph/v1', scope: input.scope, filter, complete, nodes: pairs, edges: links };
    const snapshot = { ...body, digest: sha(body) };
    const adj = new Map();
    function add(from, next, e, traversal) { const a = adj.get(from) ?? []; a.push({ next, edge: e, traversal }); adj.set(from, a); }
    const direction = args.direction ?? (mode === 'impact' ? 'incoming' : 'outgoing');
    for (const e of eligible) {
        if (direction !== 'incoming')
            add(e.source, e.target, e, 'outgoing');
        if (direction !== 'outgoing')
            add(e.target, e.source, e, 'incoming');
    }
    const resolve = (s) => { if (!s)
        return []; const exact = allNodes.filter(n => n.id === s || n.key === s || n.key === 'file:' + s); if (exact.length)
        return exact; return allNodes.filter(n => n.path === s || n.label === s); };
    let results = [], status = 'OK', extra = {};
    const maxDepth = args.max_depth ?? 4;
    if (mode === 'path' || mode === 'impact') {
        if (!args.focus || (mode === 'path' && !args.to))
            throw Error('focus e, para path, to são obrigatórios.');
        const from = resolve(args.focus), to = mode === 'path' ? resolve(args.to) : [];
        if (from.length !== 1 || (mode === 'path' && to.length !== 1)) {
            status = 'SELECTOR_NOT_UNIQUE_OR_MISSING';
            extra = { focus_candidates: from.slice(0, 20), to_candidates: to.slice(0, 20), focus_total: from.length, to_total: to.length };
        }
        else {
            const start = from[0].id, target = to[0]?.id, visited = new Map([[start, { depth: 0 }]]), queue = [start];
            let capped = false, depthLimited = false;
            for (let i = 0; i < queue.length; i++) {
                const current = queue[i], state = visited.get(current);
                if (current === target)
                    break;
                for (const link of adj.get(current) ?? []) {
                    if (visited.has(link.next))
                        continue;
                    if (state.depth >= maxDepth) {
                        depthLimited = true;
                        continue;
                    }
                    if (visited.size >= 2000) {
                        capped = true;
                        break;
                    }
                    visited.set(link.next, { depth: state.depth + 1, prev: current, via: link.edge, traversal: link.traversal });
                    queue.push(link.next);
                }
                if (capped)
                    break;
            }
            if (mode === 'path') {
                status = target && visited.has(target) ? 'PATH_FOUND' : 'NO_PATH_WITHIN_SCOPE_AND_LIMITS';
                if (target && visited.has(target)) {
                    let at = target;
                    const chain = [];
                    while (at !== start) {
                        const state = visited.get(at);
                        chain.push({ from: nodes.get(state.prev), to: nodes.get(at), edge: state.via, traversal: state.traversal });
                        at = state.prev;
                    }
                    results = chain.reverse();
                }
            }
            else
                results = [...visited.entries()].filter(([key]) => key !== start).map(([key, v]) => ({ node: nodes.get(key), depth: v.depth, via: v.via, traversal: v.traversal, classification: 'STATIC_REACHABILITY_NOT_RUNTIME_IMPACT' })).sort((a, b) => a.depth - b.depth || a.node.key.localeCompare(b.node.key));
            extra = { start: from[0], target: to[0] ?? null, visited_nodes: visited.size, visit_limit_reached: capped, depth_limit_reached: depthLimited, direction, scope_complete: complete && !capped && !depthLimited };
        }
    }
    else if (mode === 'snapshot') {
        const bytes = Buffer.byteLength(JSON.stringify(snapshot));
        if (bytes > 1500000)
            status = 'SNAPSHOT_SCOPE_TOO_LARGE';
        extra = { snapshot: bytes > 1500000 ? null : snapshot, snapshot_bytes: bytes, snapshot_available: bytes <= 1500000, fits_memory: bytes <= 28000, storage: 'memory_store existente, sem escrita automática. Se fits_memory=false, restringir paths; não truncar snapshot manualmente.' };
    }
    else if (mode === 'diff') {
        const previous = validateSnapshot(args.previous);
        if (previous.scope !== snapshot.scope || previous.filter !== snapshot.filter)
            throw Error('Snapshot pertence a outro escopo/filtro.');
        const changes = (a, b, kind) => { const old = new Map(a.map(p => [p[0], p[1]])), now = new Map(b.map(p => [p[0], p[1]])); return [...b.filter(p => !old.has(p[0])).map(p => ({ kind, id: p[0], change: 'ADDED' })), ...a.filter(p => !now.has(p[0])).map(p => ({ kind, id: p[0], change: 'REMOVED_IN_OBSERVED_GRAPH' })), ...b.filter(p => old.has(p[0]) && old.get(p[0]) !== p[1]).map(p => ({ kind, id: p[0], change: 'CHANGED' }))]; };
        results = [...changes(previous.nodes, snapshot.nodes, 'node'), ...changes(previous.edges, snapshot.edges, 'edge')].map(r => ({ ...r, node: r.kind === 'node' ? nodes.get(r.id) ?? { id: r.id, key: previous.nodes.find(n => n[0] === r.id)?.[2], kind: previous.nodes.find(n => n[0] === r.id)?.[3], state: 'PREVIOUS_SNAPSHOT_ONLY' } : undefined, edge: r.kind === 'edge' ? edges.get(r.id) ?? { id: r.id, source: previous.edges.find(e => e[0] === r.id)?.[2], target: previous.edges.find(e => e[0] === r.id)?.[3], relation: previous.edges.find(e => e[0] === r.id)?.[4], confidence: previous.edges.find(e => e[0] === r.id)?.[5], state: 'PREVIOUS_SNAPSHOT_ONLY' } : undefined }));
        extra = { previous_digest: previous.digest, current_digest: snapshot.digest, comparison_complete: previous.complete && complete, note: 'Remoção do grafo observado não prova remoção do código: reindexação, exclusões e cobertura devem ser conferidas. Movimento/rename não são inferidos.' };
    }
    else if (mode === 'communities' || mode === 'audit') {
        const report = topology(allNodes, eligible, args.resolution ?? 1);
        extra = { topology: { ...report, communities: report.communities.slice(0, 50), communities_truncated: report.communities.length > 50 } };
        results = mode === 'communities' ? report.communities : report.suggested_questions;
    }
    else if (mode === 'export') {
        extra = { export: graphExport(allNodes, eligible, args.format ?? 'json', { scope: input.scope, coverage: input.coverage, digest: snapshot.digest }, args.max_nodes ?? 200) };
    }
    else if (mode === 'explain') {
        const found = resolve(args.focus);
        if (found.length !== 1) {
            status = 'SELECTOR_NOT_UNIQUE_OR_MISSING';
            extra = { focus_candidates: found.slice(0, 20), focus_total: found.length };
        }
        else {
            const n = found[0];
            results = eligible.filter(e => e.source === n.id || e.target === n.id).map(e => ({ edge: e, node: nodes.get(e.source === n.id ? e.target : e.source), direction: e.source === n.id ? 'outgoing' : 'incoming' }));
            extra = { node: n, explanation: 'Relações observadas e respectivas fontes; não é uma conclusão gerada por modelo.' };
        }
    }
    else if (mode === 'query') {
        if (!args.query)
            throw Error('query obrigatória.');
        const terms = args.query.toLocaleLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) ?? [];
        const seeded = (input.retrieval?.keys ?? []).flatMap(key => resolve(key)).filter((n, i, a) => a.findIndex(x => x.id === n.id) === i).slice(0, 10);
        const fallback = allNodes.map(n => ({ node: n, score: terms.reduce((sum, t) => sum + ((n.label + ' ' + n.key + ' ' + (['media', 'document'].includes(n.kind) ? sources.get(n.path ?? '')?.content.slice(0, 50000) ?? '' : '')).toLocaleLowerCase().includes(t) ? 1 : 0), 0) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.node.key.localeCompare(b.node.key)).slice(0, 10).map(x => x.node);
        const seeds = seeded.length ? seeded : fallback, seen = new Set(seeds.map(n => n.id)), queue = seeds.map(n => ({ id: n.id, depth: 0 }));
        results = seeds.map(n => ({ node: n, depth: 0, seed: true, source_excerpt: ['media', 'document'].includes(n.kind) ? sources.get(n.path ?? '')?.content.slice(0, 1000) : undefined }));
        let capped = false;
        for (let i = 0; i < queue.length; i++) {
            const at = queue[i];
            if (at.depth >= maxDepth)
                continue;
            for (const step of adj.get(at.id) ?? []) {
                if (seen.has(step.next))
                    continue;
                if (seen.size >= 200) {
                    capped = true;
                    break;
                }
                seen.add(step.next);
                queue.push({ id: step.next, depth: at.depth + 1 });
                results.push({ node: nodes.get(step.next), depth: at.depth + 1, edge: step.edge, traversal: step.traversal });
            }
        }
        extra = { retrieval: { provider: seeded.length ? input.retrieval.provider : 'graph_label_lexical_fallback', warnings: input.retrieval?.warnings ?? [], seeds: seeds.map(n => n.id) }, visited_nodes: seen.size, traversal_capped: capped, answer_generated: false };
        if (!seeds.length)
            status = 'NO_SEEDS_WITHIN_CURRENT_SCOPE';
    }
    else {
        const degree = new Map();
        for (const e of eligible.filter(e => !['contains', 'rationale'].includes(e.relation))) {
            const from = degree.get(e.source) ?? { incoming: 0, outgoing: 0 }, to = degree.get(e.target) ?? { incoming: 0, outgoing: 0 };
            from.outgoing++;
            to.incoming++;
            degree.set(e.source, from);
            degree.set(e.target, to);
        }
        results = allNodes.filter(n => n.kind !== 'rationale').map(n => ({ node: n, ...(degree.get(n.id) ?? { incoming: 0, outgoing: 0 }) })).sort((a, b) => (b.incoming + b.outgoing) - (a.incoming + a.outgoing) || a.node.key.localeCompare(b.node.key));
        const undirected = new Map();
        for (const e of eligible) {
            for (const [a, b] of [[e.source, e.target], [e.target, e.source]]) {
                const set = undirected.get(a) ?? new Set();
                set.add(b);
                undirected.set(a, set);
            }
        }
        const seen = new Set(), components = [];
        for (const n of allNodes) {
            if (seen.has(n.id))
                continue;
            const q = [n.id];
            seen.add(n.id);
            for (let i = 0; i < q.length; i++)
                for (const next of undirected.get(q[i]) ?? []) {
                    if (!seen.has(next)) {
                        seen.add(next);
                        q.push(next);
                    }
                }
            components.push(q);
        }
        const groups = new Map();
        for (const n of allNodes)
            groups.set(n.module, (groups.get(n.module) ?? 0) + 1);
        const imports = eligible.filter(e => e.relation === 'imports');
        extra = { weak_components: components.sort((a, b) => b.length - a.length).slice(0, 20).map(c => ({ size: c.length, sample: c.slice(0, 8).map(id => nodes.get(id)) })), component_count: components.length, modules: [...groups].map(([module, nodes]) => ({ module, nodes })).slice(0, 50), cross_module_connections: eligible.filter(e => nodes.get(e.source)?.module !== nodes.get(e.target)?.module).slice(0, 20), import_cycles: strongComponents(allNodes.map(n => n.id), imports).filter(c => c.length > 1 || imports.some(e => e.source === c[0] && e.target === c[0])).slice(0, 20).map(c => ({ size: c.length, members: c.slice(0, 20).map(id => nodes.get(id)), members_truncated: c.length > 20 })), grouping_method: 'WEAK_COMPONENTS_AND_EXISTING_MODULES_NOT_LEIDEN', ranking_note: 'Grau estático de relações, exclui contains/rationale; concentração não é defeito por si só.' };
    }
    const offset = args.offset ?? 0, limit = args.limit ?? 15;
    let diagram;
    if (args.diagram) {
        const selected = allNodes.slice(0, 30), ids = new Set(selected.map(n => n.id));
        diagram = 'flowchart LR\n' + selected.map(n => ' n' + n.id + '["' + n.label.replace(/["<>\[\]{}|`&]/g, ' ') + '"]').join('\n') + '\n' + eligible.filter(e => ids.has(e.source) && ids.has(e.target)).slice(0, 60).map(e => ' n' + e.source + ' -->|' + e.relation + ' ' + e.confidence + '| n' + e.target).join('\n');
    }
    return { engine: GRAPH_VERSION, mode, status, scope: input.scope, selection, direction, graph_digest: snapshot.digest, counts: { nodes: nodes.size, edges_observed: edges.size, edges_traversable: eligible.length, ambiguous_excluded: [...edges.values()].filter(e => e.confidence === 'AMBIGUOUS').length }, results: results.slice(offset, offset + limit), total: results.length, next_offset: offset + limit < results.length ? offset + limit : null, ...extra, diagram,
        coverage: { ...input.coverage, complete, truncated }, validation: { execution_verified: false, architecture_approved: false, working_tree_modified: false }, limits: ['Conexão estática não demonstra fluxo em runtime, ausência de risco ou impacto completo.', 'Inferências exigem opt-in; candidatos ambíguos não são percorridos.', 'Snapshot é derivado do índice/fontes e tem limites; não substitui memória/tarefas canônicas.'], provenance: { inspired_by: 'https://github.com/Graphify-Labs/graphify', implementation: 'Own graph algorithms; existing adapters/extractors; no upstream runtime or Cloud.' }, boundaries: { ...graphHelp().boundaries, network: args.semantic ? 'EXISTING_SEMANTIC_PROVIDER_CONFIGURATION' : false } };
}
function validateSnapshot(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw Error('diff exige previous snapshot.');
    const p = raw;
    if (Object.keys(p).sort().join(',') !== 'complete,digest,edges,filter,nodes,schema,scope' || p.schema !== 'mcp-graph/v1' || typeof p.scope !== 'string' || typeof p.complete !== 'boolean' || !/^[a-f0-9]{64}$/.test(String(p.filter)) || !/^[a-f0-9]{64}$/.test(String(p.digest)))
        throw Error('Snapshot incompatível.');
    for (const k of ['nodes', 'edges']) {
        const a = p[k];
        if (!Array.isArray(a) || a.length > (k === 'nodes' ? 3000 : 10000) || a.some(v => !Array.isArray(v) || v.length !== (k === 'nodes' ? 4 : 6) || v.some(s => typeof s !== 'string' || s.length > 1500) || v.slice(0, k === 'nodes' ? 2 : 4).some(s => !/^[a-f0-9]{32}$/.test(s)) || (k === 'edges' && (!/^[a-z][a-z_]{0,39}$/.test(v[4]) || !['EXTRACTED', 'INFERRED'].includes(v[5])))) || new Set(a.map(v => v[0])).size !== a.length)
            throw Error('Pares de snapshot inválidos.');
    }
    const { digest, ...body } = p;
    if (sha(body) !== digest)
        throw Error('Digest do snapshot inválido.');
    return p;
}
function strongComponents(ids, edges) {
    const out = new Map(), rev = new Map();
    for (const e of edges) {
        out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
        rev.set(e.target, [...(rev.get(e.target) ?? []), e.source]);
    }
    const seen = new Set(), order = [];
    for (const start of ids) {
        if (seen.has(start))
            continue;
        const stack = [[start, false]];
        while (stack.length) {
            const [at, done] = stack.pop();
            if (done) {
                order.push(at);
                continue;
            }
            if (seen.has(at))
                continue;
            seen.add(at);
            stack.push([at, true]);
            for (const n of out.get(at) ?? [])
                if (!seen.has(n))
                    stack.push([n, false]);
        }
    }
    const done = new Set(), groups = [];
    for (const start of order.reverse()) {
        if (done.has(start))
            continue;
        const q = [start];
        done.add(start);
        for (let i = 0; i < q.length; i++)
            for (const n of rev.get(q[i]) ?? [])
                if (!done.has(n)) {
                    done.add(n);
                    q.push(n);
                }
        groups.push(q);
    }
    return groups;
}
