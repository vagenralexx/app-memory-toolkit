// Generated from graph-import.ts; engine first validated in original MCP.
/** Import external extraction as anchored, explicitly inferred records. Never accept external instructions as rules. */
import { createHash } from 'node:crypto';
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function importGraphExtraction(input, raw) {
    if (raw === undefined)
        return input;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || JSON.stringify(raw).length > 500000)
        throw Error('extraction inválida ou maior que500KB.');
    const p = raw;
    if (Object.keys(p).some(k => !['schema', 'provider', 'nodes', 'edges'].includes(k)) || p.schema !== 'mcp-graph-extraction/v1' || typeof p.provider !== 'string' || !p.provider.trim() || p.provider.length > 100 || !Array.isArray(p.nodes) || p.nodes.length > 200 || !Array.isArray(p.edges) || p.edges.length > 500)
        throw Error('Contrato extraction inválido.');
    const sources = new Map(input.sources.map(s => [s.path, s])), known = new Set([...input.sources.map(s => 'file:' + s.path), ...input.definitions.filter(d => sources.has(d.path)).map(d => d.key), ...(input.records ?? []).map(r => r.key)]), ids = new Map(), records = [], connections = [];
    let rejected = 0;
    const anchor = (x) => { if (!x || typeof x !== 'object')
        return false; const s = sources.get(x.path); return !!s && x.source_hash === s.hash && Number.isSafeInteger(x.line) && x.line >= 1 && typeof x.quote === 'string' && x.quote.trim().length > 0 && x.quote.length <= 1000 && (s.content.split('\n')[x.line - 1] ?? '').includes(x.quote); };
    const inputIds = new Set();
    for (const n of p.nodes) {
        if (typeof n?.id !== 'string' || !n.id || n.id.length > 200 || inputIds.has(n.id))
            throw Error('IDs externos inválidos ou duplicados.');
        inputIds.add(n.id);
    }
    for (const n of p.nodes) {
        if (Object.keys(n).some(k => !['id', 'label', 'kind', 'path', 'line', 'quote', 'source_hash'].includes(k)) || !anchor(n) || typeof n.label !== 'string' || !n.label.trim() || n.label.length > 300 || typeof n.kind !== 'string' || !['concept', 'service', 'endpoint', 'entity', 'topic', 'symbol', 'person'].includes(n.kind)) {
            rejected++;
            continue;
        }
        const key = 'external:' + hash([p.provider, n.id]);
        ids.set(n.id, key);
        known.add(key);
        records.push({ key, label: n.label, kind: 'external_' + n.kind, path: n.path, hash: hash([n.source_hash, n.label, n.kind, n.quote]), module: 'external:' + p.provider });
        connections.push({ from: 'file:' + n.path, to: key, relation: 'describes', confidence: 'INFERRED', path: n.path, line: n.line, mechanism: 'external_entity; current_anchor_checked; provider:' + p.provider });
    }
    for (const e of p.edges) {
        if (!e || typeof e !== 'object' || Object.keys(e).some(k => !['source', 'target', 'relation', 'path', 'line', 'quote', 'source_hash'].includes(k)) || !anchor(e) || typeof e.source !== 'string' || typeof e.target !== 'string' || typeof e.relation !== 'string' || !/^[a-z][a-z_]{0,39}$/.test(e.relation)) {
            rejected++;
            continue;
        }
        const from = ids.get(e.source) ?? e.source, to = ids.get(e.target) ?? e.target;
        if (!known.has(from) || !known.has(to)) {
            rejected++;
            continue;
        }
        connections.push({ from, to, relation: e.relation, confidence: 'INFERRED', path: e.path, line: e.line, mechanism: 'external_graph_relation; current_anchor_checked; provider:' + p.provider });
    }
    return { ...input, records: [...(input.records ?? []), ...records], connections: [...input.connections, ...connections], coverage: { ...input.coverage, complete: input.coverage.complete && rejected === 0, warnings: [...(input.coverage.warnings ?? []), ...(rejected ? [{ state: 'EXTERNAL_EXTRACTION_REJECTED', count: rejected }] : [])], external_extraction: { provider: p.provider, nodes: records.length, edges: connections.length - records.length, rejected, persisted: false, confidence: 'INFERRED', trust: 'anchor proves provenance only; not semantic truth' } } };
}
