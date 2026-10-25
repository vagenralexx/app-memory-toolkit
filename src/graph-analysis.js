// Generated from graph-analysis.ts; engine first validated in original MCP.
export function topology(nodes, edges, resolution = 1) {
    const ids = nodes.map(n => n.id).sort(), nodeMap = new Map(nodes.map(n => [n.id, n]));
    const useful = edges.filter(e => !['contains', 'rationale'].includes(e.relation) && e.source !== e.target), adj = new Map(ids.map(id => [id, new Set()]));
    for (const e of useful) {
        adj.get(e.source)?.add(e.target);
        adj.get(e.target)?.add(e.source);
    }
    const degree = new Map(ids.map(id => [id, adj.get(id).size])), m2 = [...degree.values()].reduce((a, b) => a + b, 0), groups = new Map(ids.map(id => [id, id])), totals = new Map(ids.map(id => [id, degree.get(id)]));
    let iterations = 0, moves = 0;
    for (; iterations < 20; iterations++) {
        let changes = 0;
        for (const id of ids) {
            const k = degree.get(id);
            if (!k)
                continue;
            const old = groups.get(id);
            totals.set(old, (totals.get(old) ?? 0) - k);
            const weights = new Map();
            for (const other of adj.get(id)) {
                const c = groups.get(other);
                weights.set(c, (weights.get(c) ?? 0) + 1);
            }
            const score = (c) => (weights.get(c) ?? 0) - resolution * k * (totals.get(c) ?? 0) / (m2 || 1);
            let best = old, bestScore = score(old);
            for (const c of [...weights.keys()].sort()) {
                const s = score(c);
                if (s > bestScore + 1e-10) {
                    best = c;
                    bestScore = s;
                }
            }
            groups.set(id, best);
            totals.set(best, (totals.get(best) ?? 0) + k);
            if (best !== old) {
                changes++;
                moves++;
            }
        }
        if (!changes)
            break;
    }
    // Split disconnected partitions: labels must not make two disconnected systems look like one.
    const visited = new Set(), partitions = [];
    for (const start of ids) {
        if (visited.has(start))
            continue;
        const label = groups.get(start), q = [start];
        visited.add(start);
        for (let i = 0; i < q.length; i++)
            for (const next of adj.get(q[i]))
                if (!visited.has(next) && groups.get(next) === label) {
                    visited.add(next);
                    q.push(next);
                }
        partitions.push(q.sort());
    }
    const memberships = new Map();
    partitions.forEach((p, i) => p.forEach(id => memberships.set(id, i)));
    const communities = partitions.map((p, i) => { const set = new Set(p); let internal = 0, external = 0; for (const id of p)
        for (const other of adj.get(id)) {
            if (set.has(other))
                internal++;
            else
                external++;
        } const labels = [...new Set(p.map(id => nodeMap.get(id).module))].sort(); return { id: i, label: labels.slice(0, 3).join(' + '), size: p.length, internal_edges: internal / 2, boundary_edges: external, cohesion: internal + external ? internal / (internal + external) : null, members: p.slice(0, 40).map(id => nodeMap.get(id)), members_truncated: p.length > 40 }; }).sort((a, b) => b.size - a.size || a.id - b.id);
    const bridges = [], articulations = new Set(), disc = new Map(), low = new Map(), parent = new Map(), children = new Map();
    let clock = 0;
    for (const root of ids) {
        if (disc.has(root))
            continue;
        disc.set(root, ++clock);
        low.set(root, clock);
        const stack = [{ id: root, neighbours: [...adj.get(root)].sort(), at: 0 }];
        while (stack.length) {
            const frame = stack[stack.length - 1], id = frame.id;
            if (frame.at < frame.neighbours.length) {
                const next = frame.neighbours[frame.at++];
                if (!disc.has(next)) {
                    parent.set(next, id);
                    children.set(id, (children.get(id) ?? 0) + 1);
                    disc.set(next, ++clock);
                    low.set(next, clock);
                    stack.push({ id: next, neighbours: [...adj.get(next)].sort(), at: 0 });
                }
                else if (next !== parent.get(id))
                    low.set(id, Math.min(low.get(id), disc.get(next)));
            }
            else {
                stack.pop();
                const p = parent.get(id);
                if (p) {
                    low.set(p, Math.min(low.get(p), low.get(id)));
                    if (low.get(id) > disc.get(p))
                        bridges.push({ source: p, target: id });
                    if (parent.has(p) && low.get(id) >= disc.get(p))
                        articulations.add(p);
                }
                else if ((children.get(id) ?? 0) > 1)
                    articulations.add(id);
            }
        }
    }
    let rank = new Map(ids.map(id => [id, ids.length ? 1 / ids.length : 0]));
    const outgoing = new Map(ids.map(id => [id, []]));
    for (const e of useful)
        outgoing.get(e.source)?.push(e.target);
    for (let i = 0; i < 30; i++) {
        const dangling = ids.filter(id => !outgoing.get(id).length).reduce((s, id) => s + rank.get(id), 0), next = new Map(ids.map(id => [id, ids.length ? (.15 + .85 * dangling) / ids.length : 0]));
        for (const from of ids) {
            const targets = outgoing.get(from);
            for (const to of targets)
                next.set(to, (next.get(to) ?? 0) + .85 * rank.get(from) / targets.length);
        }
        rank = next;
    }
    const questions = [...bridges.slice(0, 10).map(e => ({ type: 'bridge', question: 'Qual contrato e teste protege a ligação entre ' + nodeMap.get(e.source).label + ' e ' + nodeMap.get(e.target).label + '?', nodes: [e.source, e.target] })), ...ids.filter(id => !degree.get(id)).slice(0, 10).map(id => ({ type: 'isolated', question: 'A ausência de relações de ' + nodeMap.get(id).label + ' vem do projeto ou da cobertura do extrator?', nodes: [id] })), ...useful.filter(e => e.confidence === 'INFERRED').slice(0, 10).map(e => ({ type: 'inference', question: 'Qual evidência adicional confirma a relação ' + e.relation + '?', nodes: [e.source, e.target] }))];
    const interleaved = [];
    for (let i = 0; i < 10; i++)
        for (const type of ['bridge', 'isolated', 'inference']) {
            const q = questions.filter(q => q.type === type)[i];
            if (q)
                interleaved.push(q);
        }
    const communityTotal = new Map(), internal = new Map();
    for (const id of ids)
        communityTotal.set(memberships.get(id), (communityTotal.get(memberships.get(id)) ?? 0) + degree.get(id));
    for (const id of ids)
        for (const to of adj.get(id))
            if (memberships.get(id) === memberships.get(to))
                internal.set(memberships.get(id), (internal.get(memberships.get(id)) ?? 0) + 1);
    const modularity = m2 ? [...communityTotal].reduce((sum, [c, k]) => sum + (internal.get(c) ?? 0) / m2 - resolution * (k / m2) ** 2, 0) : null;
    return { algorithm: 'DETERMINISTIC_MODULARITY_LOCAL_MOVE_CONNECTED_REFINEMENT', is_leiden: false, resolution, iterations: Math.min(iterations + 1, 20), moves, modularity, community_count: communities.length, communities, bridges: bridges.slice(0, 100).map(e => ({ ...e, from: nodeMap.get(e.source), to: nodeMap.get(e.target), interpretation: 'UNDIRECTED_STRUCTURAL_BRIDGE_NOT_RUNTIME_FAILURE' })), bridge_count: bridges.length, articulation_nodes: [...articulations].slice(0, 100).map(id => nodeMap.get(id)), hotspots: ids.map(id => ({ node: nodeMap.get(id), degree: degree.get(id), pagerank: rank.get(id) })).sort((a, b) => b.pagerank - a.pagerank).slice(0, 50), suggested_questions: interleaved.slice(0, 15), note: 'Comunidades são hipótese estrutural. Arestas têm direção no grafo; a projeção não direcionada serve apenas ao agrupamento/topologia.' };
}
const xml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export function graphExport(nodes, edges, format, metadata, maxNodes = 200) {
    const selected = nodes.slice(0, maxNodes), ids = new Set(selected.map(n => n.id)), links = edges.filter(e => ids.has(e.source) && ids.has(e.target)).slice(0, 1000), truncated = selected.length < nodes.length || links.length < edges.length;
    const payload = { schema: 'mcp-graph-export/v1', directed: true, multigraph: true, ...metadata, nodes: selected, edges: links, truncated };
    if (format === 'json')
        return { mime: 'application/json', filename: 'graph.json', content: JSON.stringify(payload, null, 2), truncated };
    if (format === 'graphml')
        return { mime: 'application/graphml+xml', filename: 'graph.graphml', content: '<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="label" for="node" attr.name="label" attr.type="string"/><key id="relation" for="edge" attr.name="relation" attr.type="string"/><key id="confidence" for="edge" attr.name="confidence" attr.type="string"/><graph id="G" edgedefault="directed">' + selected.map(n => '<node id="n' + n.id + '"><data key="label">' + xml(n.label) + '</data></node>').join('') + links.map(e => '<edge id="e' + e.id + '" source="n' + e.source + '" target="n' + e.target + '"><data key="relation">' + xml(e.relation) + '</data><data key="confidence">' + xml(e.confidence) + '</data></edge>').join('') + '</graph></graphml>', truncated };
    if (format === 'cypher')
        return { mime: 'text/plain', filename: 'graph.cypher', content: 'UNWIND $nodes AS n MERGE (x:ProjectGraphNode {scope:$scope,id:n.id}) SET x.label=n.label,x.kind=n.kind;\nUNWIND $edges AS e MATCH (a:ProjectGraphNode {scope:$scope,id:e.source}),(b:ProjectGraphNode {scope:$scope,id:e.target}) MERGE (a)-[r:PROJECT_GRAPH_LINK {id:e.id}]->(b) SET r.relation=e.relation,r.confidence=e.confidence;', parameters: { scope: metadata.scope, nodes: selected.map(n => ({ id: n.id, label: n.label, kind: n.kind })), edges: links.map(e => ({ id: e.id, source: e.source, target: e.target, relation: e.relation, confidence: e.confidence })) }, executed: false, truncated };
    const positions = new Map(selected.map((n, i) => { const angle = 2 * Math.PI * i / Math.max(1, selected.length); return [n.id, { x: 450 + 350 * Math.cos(angle), y: 420 + 350 * Math.sin(angle) }]; }));
    if (format === 'svg')
        return { mime: 'image/svg+xml', filename: 'graph.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 850" role="img" aria-label="Grafo estático limitado"><rect width="900" height="850" fill="#101828"/>' + links.map(e => { const a = positions.get(e.source), b = positions.get(e.target); return '<path d="M' + a.x + ' ' + a.y + ' L' + b.x + ' ' + b.y + '" stroke="#667085" fill="none"><title>' + xml(e.relation + ' ' + e.confidence) + '</title></path>'; }).join('') + selected.map(n => { const p = positions.get(n.id); return '<g><circle cx="' + p.x + '" cy="' + p.y + '" r="6" fill="#67e8f9"/><text x="' + (p.x + 9) + '" y="' + p.y + '" fill="#f2f4f7" font-size="10">' + xml(n.label.slice(0, 45)) + '</text></g>'; }).join('') + '</svg>', truncated };
    const markdown = '# Grafo do projeto\n\nEscopo: ' + String(metadata.scope) + '\n\nAnálise estática. Cobertura e recorte: ' + JSON.stringify(metadata.coverage) + '\n\n' + selected.map(n => '## ' + n.label.replace(/[\r\n]/g, ' ') + '\n\n- ID: `' + n.id + '`\n- Tipo: ' + n.kind + '\n- Fonte: ' + (n.path ?? 'registro canônico') + '\n' + links.filter(e => e.source === n.id || e.target === n.id).map(e => '- ' + e.source + ' → ' + e.target + ' [' + e.relation + '; ' + e.confidence + ']').join('\n')).join('\n\n');
    if (format === 'markdown')
        return { mime: 'text/markdown', filename: 'GRAPH_REPORT.md', content: markdown, truncated };
    if (format === 'wiki' || format === 'obsidian')
        return { mime: 'application/json', filename: 'graph-notes.json', files: [{ path: 'index.md', content: '# Grafo derivado\n\n' + selected.map(n => '- [' + n.label.replace(/[\[\]\n]/g, ' ') + '](' + n.id + '.md)').join('\n') }, ...selected.map(n => ({ path: n.id + '.md', content: '# ' + n.label + '\n\nID: ' + n.id + '\nFonte: ' + (n.path ?? 'registro canônico') + '\n\n' + links.filter(e => e.source === n.id).map(e => '- ' + e.relation + ' [' + e.confidence + '] ' + (format === 'obsidian' ? '[[' + e.target + ']]' : '[' + e.target + '](' + e.target + '.md)')).join('\n') }))], writes_files: false, truncated };
    if (format !== 'html')
        throw Error('Formato de exportação inválido.');
    const data = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const content = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:"><title>Grafo do projeto</title><style>body{margin:0;background:#101828;color:#f2f4f7;font:15px system-ui}header{padding:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}input,select,button{font:inherit;padding:8px}main{display:grid;grid-template-columns:1fr 320px;height:80vh}canvas{width:100%;height:100%;touch-action:none}aside{padding:16px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;border-left:1px solid #475467}@media(max-width:700px){main{grid-template-columns:1fr;height:auto}canvas{height:60vh}aside{min-height:20vh}}</style><header><strong>Grafo local</strong><label>Buscar <input id="search" placeholder="Nome ou caminho"></label><label>Relação <select id="relation"><option value="">Todas</option></select></label><button id="reset">Redefinir</button><span id="status"></span></header><main><canvas id="canvas" aria-label="Grafo; use a busca e lista textual para explorar"></canvas><aside id="detail" tabindex="0"></aside></main><script type="application/json" id="graph-data">${data}</script><script>
const g=JSON.parse(document.getElementById('graph-data').textContent),canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d'),search=document.getElementById('search'),relation=document.getElementById('relation'),detail=document.getElementById('detail');let zoom=1,ox=0,oy=0,drag=null,points=new Map();
for(const r of [...new Set(g.edges.map(e=>e.relation))].sort()){const o=document.createElement('option');o.value=r;o.textContent=r;relation.appendChild(o);}document.getElementById('status').textContent=g.nodes.length+' nós, '+g.edges.length+' ligações'+(g.truncated?' — recorte limitado':'');
function visible(n){const term=search.value.toLowerCase();return !term||(n.label+' '+(n.path||'')).toLowerCase().includes(term);}function draw(){const box=canvas.getBoundingClientRect();canvas.width=Math.max(1,box.width);canvas.height=Math.max(1,box.height);ctx.clearRect(0,0,canvas.width,canvas.height);points=new Map();g.nodes.forEach((n,i)=>{const a=2*Math.PI*i/Math.max(1,g.nodes.length);points.set(n.id,{x:canvas.width/2+ox+Math.cos(a)*Math.min(canvas.width,canvas.height)*.36*zoom,y:canvas.height/2+oy+Math.sin(a)*Math.min(canvas.width,canvas.height)*.36*zoom});});for(const e of g.edges){if(relation.value&&e.relation!==relation.value)continue;const a=points.get(e.source),b=points.get(e.target);ctx.strokeStyle=e.confidence==='INFERRED'?'#a78bfa':'#475467';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();const angle=Math.atan2(b.y-a.y,b.x-a.x),x=b.x-8*Math.cos(angle),y=b.y-8*Math.sin(angle);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8*Math.cos(angle-.4),y-8*Math.sin(angle-.4));ctx.moveTo(x,y);ctx.lineTo(x-8*Math.cos(angle+.4),y-8*Math.sin(angle+.4));ctx.stroke();}for(const n of g.nodes){const p=points.get(n.id);ctx.fillStyle=visible(n)?'#67e8f9':'#344054';ctx.beginPath();ctx.arc(p.x,p.y,visible(n)?6:3,0,Math.PI*2);ctx.fill();if(visible(n)&&g.nodes.length<80){ctx.fillStyle='#f2f4f7';ctx.fillText(n.label.slice(0,35),p.x+9,p.y);}}}function list(){detail.textContent='Grafo estático; não prova execução.\\n\\n'+g.nodes.filter(visible).map(n=>n.label+' — '+(n.path||n.kind)+' ['+n.id+']').join('\\n');draw();}search.oninput=list;relation.onchange=draw;canvas.onwheel=e=>{e.preventDefault();zoom=Math.max(.2,Math.min(5,zoom*(e.deltaY<0?1.1:.9)));draw();};canvas.onpointerdown=e=>{drag={x:e.offsetX,y:e.offsetY,moved:false};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;ox+=e.offsetX-drag.x;oy+=e.offsetY-drag.y;drag.moved=true;drag.x=e.offsetX;drag.y=e.offsetY;draw();};canvas.onpointerup=e=>{if(drag&&!drag.moved){const n=g.nodes.find(n=>{const p=points.get(n.id);return Math.hypot(p.x-e.offsetX,p.y-e.offsetY)<12;});if(n)detail.textContent=JSON.stringify({node:n,edges:g.edges.filter(e=>e.source===n.id||e.target===n.id)},null,2);}drag=null;};document.getElementById('reset').onclick=()=>{zoom=1;ox=oy=0;search.value='';relation.value='';list();};window.onresize=draw;list();
</script></html>`;
    return { mime: 'text/html', filename: 'graph.html', content, truncated, network_requests: false, executes_project: false };
}
