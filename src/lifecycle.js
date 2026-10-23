import {validateEngineeringObservation} from './ponytail-workflow.js';
import { feedbackScore } from './memory-quality.js';
import { present } from './store.js';
import { queryTerms } from './text.js';

export function requireTask(store, projectId, taskId) {
  const task = store.get(projectId, taskId);
  if(task.parent_id)throw new Error('Use o ID canônico da tarefa (parent_id), não o ID de um chunk.');
  if (task.kind !== 'task') throw new Error('task_id deve apontar para uma tarefa deste projeto.');
  return task;
}

export function checkTaskDependencies(store,projectId,taskId,dependencies) {
  const seen=new Set(),pending=[...dependencies];
  while(pending.length){
    const id=pending.pop();
    if(id===taskId)throw new Error('Dependências formam um ciclo.');
    if(seen.has(id))continue;
    seen.add(id);
    if(seen.size>10000)throw new Error('Grafo de dependências excede o limite de análise.');
    const task=requireTask(store,projectId,id);
    const details=JSON.parse(task.content);
    pending.push(...(details.depends_on??[]));
  }
}

export function checkpoint(store, args) {
  if(args.engineering!==undefined)validateEngineeringObservation(args.engineering);
  requireTask(store, args.project_id, args.task_id);
  return store.transaction(() => {
    const old = store.db.prepare('SELECT record_id FROM task_checkpoints WHERE project_id=? AND task_id=?').get(args.project_id, args.task_id);
    if (!old && args.expected_revision !== undefined) throw new Error('Primeiro checkpoint não possui revisão anterior.');
    const { expected_revision, ...state } = args;
    const row = store.write({ projectId: args.project_id, id: old?.record_id, expectedRevision: expected_revision,
      kind: 'checkpoint', title: `Checkpoint: ${args.task_id}`, content: JSON.stringify(state), status: 'recorded' });
    if (!old) store.db.prepare('INSERT INTO task_checkpoints VALUES(?,?,?)').run(args.project_id, args.task_id, row.id);
    return { id: row.id, task_id: args.task_id, revision: row.revision, next_action: args.next_action };
  });
}

export function resume(store, projectId, taskId) {
  const task = requireTask(store, projectId, taskId);
  const cp = store.db.prepare('SELECT record_id FROM task_checkpoints WHERE project_id=? AND task_id=?').get(projectId, taskId);
  const h = store.db.prepare(`SELECT r.id FROM task_handoffs h JOIN records r ON r.id=h.record_id
    WHERE h.project_id=? AND h.task_id=? ORDER BY r.updated_at DESC,r.rowid DESC LIMIT 1`).get(projectId, taskId);
  const checkpoint = cp ? store.get(projectId, cp.record_id) : null;
  const handoff = h ? store.get(projectId, h.id) : null;
  const latest = store.db.prepare('SELECT record_id FROM history WHERE project_id=? AND record_id IN (?,?) ORDER BY sequence DESC LIMIT 1')
    .get(projectId, checkpoint?.id ?? '', handoff?.id ?? '');
  return { task: present(task, 'detail'), checkpoint: checkpoint ? present(checkpoint) : null,
    latest_handoff: handoff ? present(handoff) : null, current_state_id: latest?.record_id ?? task.id,
    expand: 'Use resolve_reference para recuperar o registro completo pelo ID.',
    continuity: 'IDs explícitos. Nenhuma task de outra conversa foi herdada; chamadas não são reatribuídas retroativamente.' };
}

export function handoff(store, args) {
  const task = requireTask(store, args.project_id, args.task_id);
  if (args.status !== task.status) throw new Error('O estado do handoff deve corresponder ao da tarefa; atualize task_update primeiro.');
  if (args.status === 'blocked' && !args.blocked_reason) throw new Error('Informe blocked_reason.');
  if (args.status !== 'done' && !args.next_action) throw new Error('Informe next_action para retomada.');
  return store.transaction(() => {
    const row = store.write({ projectId: args.project_id, kind: 'handoff', title: `Handoff: ${task.title}`, content: JSON.stringify(args), status: 'recorded' });
    store.db.prepare('INSERT INTO task_handoffs VALUES(?,?,?)').run(args.project_id, args.task_id, row.id);
    return { id: row.id, revision: row.revision, immutable: true, task_id: args.task_id,
      resume_prompt: `No MCP app-memory, consulte get_operating_rules(project_id="${args.project_id}") e task_resume(project_id="${args.project_id}", task_id="${args.task_id}"). Expanda ${row.id} se precisar dos detalhes.` };
  });
}

export function memoryStore(store, args) {
  return store.transaction(() => {
    const old = store.db.prepare('SELECT record_id FROM memory_keys WHERE project_id=? AND namespace=? AND key=?').get(args.project_id, args.namespace, args.key);
    if (!old && args.expected_revision !== undefined) throw new Error('Chave nova não possui revisão anterior.');
    if (args.status === 'evidence_reported' && !args.evidence.length) throw new Error('Aprendizado exige evidências; sem elas, use hypothesis.');
    const row = store.write({ projectId: args.project_id, id: old?.record_id, expectedRevision: args.expected_revision,
      kind: args.namespace === 'patterns' ? 'learning' : 'research', title: args.key,
      content: JSON.stringify({ value: args.value, evidence: args.evidence, applicability: args.applicability }), status: args.status });
    if (!old) store.db.prepare('INSERT INTO memory_keys VALUES(?,?,?,?)').run(args.project_id, args.namespace, args.key, row.id);
    return { id: row.id, revision: row.revision, namespace: args.namespace, key: args.key, status: row.status };
  });
}

export function memoryRetrieve(store, projectId, namespace, key, {includeInactive=false}={}) {
  store.project(projectId);
  const row = store.db.prepare('SELECT record_id FROM memory_keys WHERE project_id=? AND namespace=? AND key=?').get(projectId, namespace, key);
  if (!row) return [];
  const record=store.get(projectId, row.record_id);
  return !includeInactive&&['retired','removed'].includes(record.status)?[]:[{...record,feedback:feedbackScore(store,projectId,record.id)}];
}

export function memorySearch(store, projectId, query, namespace) {
  store.project(projectId);
  const terms = queryTerms(query,16);
  if (!terms.length) return [];
  return store.db.prepare(`SELECT r.*,bm25(search,4.0,1.0) AS lexical_score FROM search JOIN records r ON r.rowid=search.rowid
    JOIN memory_keys k ON k.record_id=r.id AND k.project_id=r.project_id
    WHERE search MATCH ? AND r.project_id=? AND r.status NOT IN ('removed','retired','superseded','deprecated') AND (? IS NULL OR k.namespace=?)
    ORDER BY bm25(search,4.0,1.0),r.id LIMIT 30`)
    .all(terms.map(term => `"${term}"`).join(' OR '), projectId, namespace ?? null, namespace ?? null).map(row=>{const feedback=feedbackScore(store,projectId,row.id);return {...row,feedback,feedback_rank:row.lexical_score*(1+(feedback.support_score-.5)*.4)};}).sort((a,b)=>a.feedback_rank-b.feedback_rank||a.id.localeCompare(b.id));
}
