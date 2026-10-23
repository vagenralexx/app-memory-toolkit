import { readFile, realpath } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { hash } from './store.js';
import { safeFile, readBounded } from './safety.js';

export async function codeReferences(store, projectId, topic, limit = 6) {
  const project = store.project(projectId);
  const symbols=store.db.prepare(`SELECT s.*,r.source_path FROM code_symbols s JOIN records r ON r.id=s.record_id
    WHERE s.project_id=? AND s.name=? AND r.status!='removed' ORDER BY s.name LIMIT ?`).all(projectId,topic,limit);
  const exact=symbols.map(symbol=>store.get(projectId,symbol.record_id));
  const seen=new Set();
  const rows = [...exact,...store.search(projectId, topic, limit, 'code')].filter(row => row.source_path&&!seen.has(row.id)&&seen.add(row.id)).slice(0,limit);
  const results = [];
  for (const row of rows) {
    try {
      const {path}=await safeFile(project.root,join(project.root,row.source_path),{maxBytes:100000});
      const content = await readBounded(path,100000);
      if (hash(content) !== row.source_hash) {
        results.push({ id: row.id, source_path: row.source_path, state: 'STALE', note: 'Arquivo mudou; execute project_index antes de usar as linhas do índice.' });
        continue;
      }
      const terms = topic.toLocaleLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
      const lines = content.split('\n');
      const match=symbols.find(symbol=>symbol.record_id===row.id);
      const hit = match ? match.line-1 : Math.max(0, lines.findIndex(line => terms.some(term => line.toLocaleLowerCase().includes(term))));
      const start = Math.max(0, hit - 2);
      results.push({ id: row.id, source_path: row.source_path, source_hash: row.source_hash, revision: row.revision,
        state: 'SOURCE_CURRENT', start_line: start + 1, end_line: Math.min(lines.length, hit + 6),
        excerpt: lines.slice(start, hit + 6).join('\n').slice(0, 1800),
        symbols:store.db.prepare('SELECT name,kind,line,end_line,signature FROM code_symbols WHERE record_id=? LIMIT 30').all(row.id),
        references:store.db.prepare(`SELECT r.source_path,c.line,c.name FROM code_references c JOIN records r ON r.id=c.record_id
          WHERE c.project_id=? AND c.name=? LIMIT 20`).all(projectId,topic).map(ref=>({...ref,state:'INDEXED_NOT_LIVE_VERIFIED'})),
        note: 'Hash atual confirmado. Referências sintáticas por nome não resolvem aliases/tipos entre módulos e não comprovam execução.' });
    } catch { results.push({ id: row.id, source_path: row.source_path, state: 'SOURCE_UNAVAILABLE', note: 'Fonte ausente, fora da raiz ou não legível.' }); }
  }
  return { results, structural_index_available: store.db.prepare('SELECT count(*) AS n FROM code_symbols WHERE project_id=?').get(projectId).n>0, execution_verified: false,
    supported_structural_languages:['JavaScript','TypeScript','JSX','TSX','Python (partial line parser)'] };
}
