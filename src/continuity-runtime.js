import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { digest, object, text, integer, safeLabel, clean, currentConfig, observation, visibleEvents, effectiveBody, coverageBrief, maintenance, keepFacts, fidelity, performance, editDiagnostics, CONTINUITY_VERSION } from './continuity-core.js';
const inside = (root, file) => { const r = path.relative(root, file); return r === '' || (!path.isAbsolute(r) && r !== '..' && !r.startsWith('..' + path.sep)); };
function privateDirectory(directory) { fs.mkdirSync(directory, { recursive: true, mode: 0o700 }); if (fs.lstatSync(directory).isSymbolicLink() || !fs.lstatSync(directory).isDirectory())
    throw Error('Diretório de controle inválido'); }
async function locked(backend, fn) {
    const directory = path.join(backend.dataDirectory, 'continuity-locks');
    privateDirectory(directory);
    const lock = path.join(directory, digest(backend.scope) + '.lock');
    let fd;
    for (let attempt = 0; attempt < 15; attempt++) {
        try {
            fd = fs.openSync(lock, 'wx', 0o600);
            break;
        }
        catch (error) {
            if (error.code !== 'EEXIST')
                throw error;
            await new Promise(r => setTimeout(r, 20));
        }
    }
    if (fd === undefined)
        throw Error('Continuidade ocupada ou lock abandonado; não foi removido automaticamente.');
    try {
        return await fn();
    }
    finally {
        fs.closeSync(fd);
        fs.unlinkSync(lock);
    }
}
async function readEvents(b) { const rows = await b.list(); if (rows.length > 10000)
    throw Error('Limite de eventos excedido; exporte e revise retenção.'); for (const e of rows) {
    const { digest: hash, ...body } = e;
    if (e.scope !== b.scope || hash !== digest(body))
        throw Error('Evento fora de escopo ou checksum divergente');
} return rows.sort((a, b) => a.seq - b.seq); }
function spoolDirectory(b) { return path.join(b.dataDirectory, 'continuity-spool', digest(b.scope)); }
function spoolStatus(b) { const dir = spoolDirectory(b); if (!fs.existsSync(dir))
    return { queued: 0, expired: 0, capacity: 100 }; if (fs.lstatSync(dir).isSymbolicLink())
    throw Error('Spool inválido'); const files = fs.readdirSync(dir).filter(f => /^[a-f0-9]{64}\.json$/.test(f)); return { queued: files.length, expired: files.filter(f => Date.now() - fs.lstatSync(path.join(dir, f)).mtimeMs > 7 * 86400000).length, capacity: 100 }; }
function enqueue(b, body) { const dir = spoolDirectory(b); privateDirectory(path.dirname(dir)); privateDirectory(dir); const file = path.join(dir, digest([body.client, body.session_id, body.event_id]) + '.json'); const payload = JSON.stringify({ version: 1, scope: b.scope, body, queued_at: new Date().toISOString() }); if (Buffer.byteLength(payload) > 24000)
    throw Error('Evento excede limite da fila'); if (fs.existsSync(file)) {
    if (fs.lstatSync(file).isSymbolicLink())
        throw Error('Spool inválido');
    const old = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (digest(old.body) !== digest(body))
        throw Error('event_id em fila com outro conteúdo');
    return { queued: true, duplicate: true };
} if (spoolStatus(b).queued >= 100)
    return { queued: false, dropped: true, reason: 'capacity', capacity: 100 }; fs.writeFileSync(file, payload, { flag: 'wx', mode: 0o600 }); return { queued: true }; }
async function add(b, events, type, body) { if (events.length >= 10000 || (type !== 'config' && events.length >= currentConfig(events).max_events))
    throw Error('Capacidade da memória de continuidade atingida; nenhum evento removido.'); const data = { id: randomUUID(), scope: b.scope, seq: (events.at(-1)?.seq ?? 0) + 1, at: new Date().toISOString(), type, body }; const event = { ...data, digest: digest(data) }; await b.append(event); events.push(event); return event; }
function sourceFingerprint(sources) { return digest(sources.map(s => [s.path, s.hash]).sort((a, b) => a[0].localeCompare(b[0]))); }
export function captureFromHarness(client, payload, context = {}) {
    object(payload, ['hook_event_name', 'session_id', 'cwd', 'tool_name', 'tool_input', 'tool_result', 'tool_response', 'tool_use_id', 'is_error', 'prompt', 'last_assistant_message', 'permission_mode', 'transcript_path', 'source', 'reason', 'trigger', 'compact_metadata', 'model', 'agent_id', 'agent_type'], 'harness payload');
    const kinds = { SessionStart: 'session_start', PreCompact: 'pre_compact', SessionEnd: 'session_end', PostToolUse: 'tool_result', PostToolUseFailure: 'tool_error', UserPromptSubmit: 'prompt' };
    const kind = kinds[payload.hook_event_name];
    if (!kind)
        throw Error('Evento nativo sem semântica confirmada; Stop não é SessionEnd.');
    const names = { Read: 'file', Write: 'file', Edit: 'file', read_file: 'file', write_file: 'file', Grep: 'search', Glob: 'search', search: 'search', Bash: 'shell', shell: 'shell' };
    const family = names[payload.tool_name] ?? 'unknown';
    const input = payload.tool_input;
    const paths = family === 'file' && input && typeof input === 'object' ? [input.file_path ?? input.path].filter(p => typeof p === 'string' && !path.isAbsolute(p) && !/^\w:\\/.test(p)) : [];
    // Native adapters intentionally never copy prompt, tool arguments or output bodies.
    return { event_id: context.event_id ?? payload.tool_use_id ?? randomUUID(), session_id: context.session_id ?? payload.session_id, client, kind, tool_family: family, outcome: payload.is_error || kind === 'tool_error' ? 'error' : 'unknown', task_id: context.task_id, paths };
}
export async function manageContinuity(b, args) {
    object(args, ['action', 'project_id', 'workspace', 'config', 'observation', 'offer', 'preference', 'preferences', 'receipt', 'handoff_id', 'session_id', 'target_id', 'expected_digest', 'expected_state', 'profile', 'queue_on_failure'], 'manage');
    if (Buffer.byteLength(JSON.stringify(args)) > 500000)
        throw Error('Entrada excede500KB');
    const action = text(args.action, 40);
    if (action === 'verify')
        return runVerification(b, args);
    return locked(b, async () => {
        const events = await readEvents(b), config = currentConfig(events);
        if (action === 'configure') {
            const { configBody } = await import('./continuity-core.js');
            const body = configBody(args.config);
            if (body.max_events < events.length)
                throw Error('Capacidade menor que eventos existentes');
            const event = await add(b, events, 'config', body);
            return { config: body, revision: event.digest, hooks_installed: false };
        }
        if (action === 'observe') {
            const body = observation(args.observation, config), prior = events.find(e => e.type === 'observation' && e.body.client === body.client && e.body.session_id === body.session_id && e.body.event_id === body.event_id);
            if (prior) {
                if (digest(prior.body) !== digest(body))
                    throw Error('event_id já usado com outro conteúdo');
                return { id: prior.id, duplicate: true };
            }
            try {
                const event = await add(b, events, 'observation', body);
                return { id: event.id, duplicate: false, capture: body.capture };
            }
            catch (error) {
                if (!args.queue_on_failure)
                    throw error;
                return { ...enqueue(b, body), warning: 'Entrega canônica não confirmada; replay confere idempotência antes de gravar.' };
            }
        }
        if (action === 'drain') {
            const dir = spoolDirectory(b), result = { delivered: 0, duplicates: 0, expired: 0, rejected: 0, remaining: 0 };
            if (!fs.existsSync(dir))
                return result;
            if (fs.lstatSync(dir).isSymbolicLink())
                throw Error('Spool inválido');
            for (const name of fs.readdirSync(dir).filter(f => /^[a-f0-9]{64}\.json$/.test(f)).slice(0, 30)) {
                const file = path.join(dir, name), stat = fs.lstatSync(file);
                if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 24000) {
                    result.rejected++;
                    continue;
                }
                const queued = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (queued.scope !== b.scope) {
                    result.rejected++;
                    continue;
                }
                if (Date.now() - Date.parse(queued.queued_at) > 7 * 86400000) {
                    result.expired++;
                    continue;
                }
                try {
                    const raw = queued.body;
                    const body = observation({ event_id: raw.event_id, session_id: raw.session_id, client: raw.client, kind: raw.kind, tool_family: raw.tool_family, outcome: raw.outcome, task_id: raw.task_id ?? undefined, paths: raw.paths, excerpt: raw.excerpt || undefined }, config);
                    const old = events.find(e => e.type === 'observation' && e.body.client === body.client && e.body.session_id === body.session_id && e.body.event_id === body.event_id);
                    if (old) {
                        if (digest(old.body) !== digest(body))
                            throw Error('Replay divergente');
                        result.duplicates++;
                    }
                    else {
                        await add(b, events, 'observation', body);
                        result.delivered++;
                    }
                    fs.unlinkSync(file);
                }
                catch {
                    result.rejected++;
                }
            }
            result.remaining = spoolStatus(b).queued;
            return result;
        }
        if (action === 'offer') {
            const o = object(args.offer, ['handoff_id', 'task_id', 'summary', 'next_action'], 'offer');
            const handoff = safeLabel(o.handoff_id), task = safeLabel(o.task_id);
            const previous = events.find(e => e.type === 'offer' && e.body.handoff_id === handoff);
            const body = { handoff_id: handoff, task_id: task, summary: clean(text(o.summary, 4000)), next_action: clean(text(o.next_action, 2000)), trust: 'reference_to_existing_task_not_new_backlog' };
            if (previous) {
                if (digest(previous.body) !== digest(body))
                    throw Error('Oferta imutável já existe');
                return { id: previous.id, duplicate: true };
            }
            return add(b, events, 'offer', body);
        }
        if (action === 'accept') {
            const id = safeLabel(args.handoff_id), session = safeLabel(args.session_id);
            const offer = events.find(e => e.type === 'offer' && e.body.handoff_id === id);
            if (!offer)
                throw Error('Oferta não encontrada neste projeto');
            const prior = events.find(e => e.type === 'accept' && e.body.offer_id === offer.id);
            if (prior)
                return { accepted: prior.body.session_id === session, already_accepted: true, acceptance_id: prior.id };
            const event = await add(b, events, 'accept', { offer_id: offer.id, session_id: session });
            return { accepted: true, acceptance_id: event.id, task_id: offer.body.task_id, does_not_resume_task_automatically: true };
        }
        if (action === 'preference') {
            const p = object(args.preference, ['key', 'value', 'evidence', 'confirmed'], 'preference');
            if (p.confirmed !== true)
                throw Error('Preferência exige confirmação explícita');
            return add(b, events, 'preference', { key: safeLabel(p.key), value: clean(text(p.value, 2000)), evidence: clean(text(p.evidence, 2000)), precedence: 'fallback_below_user_and_project_rules', authorization: false });
        }
        if (action === 'import_preferences') {
            const input = object(args.preferences, ['projection', 'checksum', 'confirmed'], 'preferences');
            if (input.confirmed !== true)
                throw Error('Importação de preferências exige confirmação explícita');
            const projection = object(input.projection, ['format', 'source_scope', 'entries'], 'projection');
            if (projection.format !== 'mcp-preferences/v1' || digest(projection) !== input.checksum || !Array.isArray(projection.entries) || projection.entries.length > 100)
                throw Error('Projeção ou checksum inválido');
            safeLabel(projection.source_scope);
            const prepared = projection.entries.map((p) => { object(p, ['key', 'value', 'evidence']); return { key: safeLabel(p.key), value: clean(text(p.value, 2000)), evidence: clean(text(p.evidence, 2000)), precedence: 'fallback_below_user_and_project_rules', authorization: false, import_origin: { scope: projection.source_scope, checksum: input.checksum } }; });
            let imported = 0, duplicates = 0;
            for (const body of prepared) {
                const previous = events.filter(e => e.type === 'preference' && e.body.key === body.key).at(-1);
                if (previous && previous.body.value === body.value && previous.body.evidence === body.evidence) {
                    duplicates++;
                    continue;
                }
                try {
                    await add(b, events, 'preference', body);
                    imported++;
                }
                catch {
                    throw Error(`Importação parcial: ${imported} gravados; retry compara preferências atuais antes de repetir.`);
                }
            }
            return { imported, duplicates, rules_changed: false, source_scope: projection.source_scope };
        }
        if (action === 'compact' || action === 'restore') {
            const target = events.find(e => e.id === args.target_id);
            if (!target || target.type !== 'observation' || !['tool_result', 'tool_error', 'session_end'].includes(target.body.kind))
                throw Error('Somente notas episódicas elegíveis');
            if (target.digest !== args.expected_digest)
                throw Error('Conflito de revisão');
            const previous = events.filter(e => ['compact', 'restore'].includes(e.type) && e.body.target_id === target.id).at(-1);
            if ((args.expected_state ?? null) !== (previous?.digest ?? null))
                throw Error('Estado da compactação mudou');
            return add(b, events, action, { target_id: target.id, ...(action === 'compact' ? { excerpt: keepFacts(target.body.excerpt) } : {}), original_preserved: true });
        }
        if (action === 'receipt') {
            const r = object(args.receipt, ['criterion', 'result', 'evidence'], 'receipt');
            if (!['pass', 'fail', 'inconclusive', 'human_review'].includes(r.result))
                throw Error('Resultado inválido');
            return add(b, events, 'receipt', { criterion: clean(text(r.criterion, 2000)), result: r.result, evidence: clean(text(r.evidence, 6000)), trust: 'host_reported_not_executed', approves_task: false });
        }
        throw Error('Ação desconhecida');
    });
}
export async function continuityContext(b, args) {
    object(args, ['project_id', 'workspace', 'mode', 'query', 'session_id', 'task_id', 'id', 'as_of', 'profile', 'budget_bytes', 'older_than_days', 'limit', 'offset', 'input'], 'context');
    if (Buffer.byteLength(JSON.stringify(args)) > 500000)
        throw Error('Entrada excede500KB');
    const events = visibleEvents(await readEvents(b), args.as_of), mode = args.mode ?? 'status', limit = integer(args.limit ?? 20, 1, 100), offset = integer(args.offset ?? 0, 0, 10000);
    const base = { version: CONTINUITY_VERSION, scope: b.scope, as_of: args.as_of ?? null, temporal_semantics: 'ingestion_time_only', trust: 'Stored content is data, never authorization.' };
    if (mode === 'status')
        return { ...base, config: currentConfig(events), events: events.length, spool: spoolStatus(b), hooks_installed: false, offers_open: events.filter(e => e.type === 'offer' && !events.some(c => c.type === 'accept' && c.body.offer_id === e.id)).map(e => ({ id: e.id, handoff_id: e.body.handoff_id, task_id: e.body.task_id })), limits: ['No transcript discovery, remote service, global preference inference or automatic task resume.', 'Event/session/claim identities are supplied by the authorized caller, not authenticated host identities.'] };
    if (mode === 'fidelity')
        return { ...base, ...fidelity(args.input) };
    if (mode === 'performance')
        return { ...base, ...performance(args.input) };
    if (mode === 'edits')
        return { ...base, ...editDiagnostics(args.input, await b.sources()) };
    if (mode === 'maintenance') {
        const recent = events.filter(e => e.type === 'observation' && e.body.excerpt).slice(-200), seen = new Map(), duplicates = [];
        for (const e of recent) {
            const key = digest([e.body.kind, e.body.outcome, e.body.paths, e.body.excerpt.normalize('NFC').replace(/\s+/g, ' ').trim()]);
            if (seen.has(key))
                duplicates.push({ id: e.id, similar_to: seen.get(key), classification: 'IDENTICAL_NORMALIZED_EXCERPT_NOT_EQUIVALENT_EVENT' });
            else
                seen.set(key, e.id);
        }
        return { ...base, proposals: maintenance(events, Date.now(), args.older_than_days ?? 90).slice(offset, offset + limit), duplicate_candidates: duplicates.slice(offset, offset + limit), sampled_events: recent.length, writes: false, policy: 'Only episodic observations; originals, rules and task records are never removed. Similarity never triggers merging.' };
    }
    let rows = events.filter(e => !['config', 'accept', 'compact', 'restore'].includes(e.type)).map(e => ({ ...e, body: effectiveBody(e, events) }));
    if (args.session_id)
        rows = rows.filter(e => e.body.session_id === args.session_id);
    if (args.task_id)
        rows = rows.filter(e => e.body.task_id === args.task_id);
    if (args.query) {
        const terms = text(args.query, 1000).toLocaleLowerCase().split(/\s+/).filter(Boolean);
        rows = rows.map(e => ({ e, score: terms.filter(t => JSON.stringify(e.body).toLocaleLowerCase().includes(t)).length })).filter(x => x.score).sort((a, b) => b.score - a.score || b.e.seq - a.e.seq).map(x => x.e);
    }
    else
        rows.sort((a, b) => b.seq - a.seq);
    if (mode === 'brief' || mode === 'profile') {
        const keys = new Set(), preferences = [...events].reverse().filter(e => e.type === 'preference' && !keys.has(e.body.key) && keys.add(e.body.key));
        if (mode === 'profile') {
            const projection = { format: 'mcp-preferences/v1', source_scope: b.scope, entries: preferences.slice(offset, offset + limit).map(e => ({ key: e.body.key, value: e.body.value, evidence: e.body.evidence })) };
            return { ...base, projection, checksum: digest(projection), total: preferences.length, next_offset: offset + limit < preferences.length ? offset + limit : null, automatic_cross_project_sharing: false, precedence: 'fallback_only', canonical: false };
        }
        const selected = [...preferences, ...rows.filter(e => e.type !== 'preference')];
        const budget = args.budget_bytes ?? 6000;
        const result = { ...base, ...coverageBrief(selected.map(e => ({ id: e.id, title: e.type, content: JSON.stringify(e.body) })), budget), next: 'Expand by mode=timeline with id; canonical task_resume still requires explicit task_id.' };
        return budgetEnvelope(result, budget);
    }
    if (mode === 'export') {
        const data = { format: 'mcp-continuity-projection/v1', scope: b.scope, as_of: args.as_of ?? null, events: rows.slice(offset, offset + limit) };
        return { ...base, projection: data, checksum: digest(data), markdown: data.events.map(e => `## ${e.type} ${e.id}\n\nSequence: ${e.seq}; ingestion: ${e.at}; digest: ${e.digest}\n\n\`\`\`json\n${JSON.stringify(e.body, null, 2)}\n\`\`\``).join('\n\n'), canonical: false, next_offset: offset + limit < rows.length ? offset + limit : null };
    }
    if (mode === 'receipts') {
        const results = [];
        for (const e of rows.filter(e => e.type === 'receipt').slice(offset, offset + limit)) {
            let current = false;
            try {
                const p = trustedProfile(b, args.profile ?? e.body.profile);
                current = e.body.trust === 'executed_by_host_profile' && validSignature(b, e.body) && e.body.profile_digest === p.digest && e.body.fingerprint === sourceFingerprint(await b.sources(p.profile.source_paths));
            }
            catch { }
            results.push({ ...e, current, approves_task: false });
        }
        return { ...base, results };
    }
    if (!['recall', 'timeline'].includes(mode))
        throw Error('Modo desconhecido');
    if (args.id)
        rows = rows.filter(e => e.id === args.id);
    return { ...base, results: rows.slice(offset, offset + limit), total: rows.length, next_offset: offset + limit < rows.length ? offset + limit : null };
}
function trustedProfile(b, name) {
    if (process.env.MCP_VERIFICATION_ENABLED !== '1')
        throw Error('Executor desativado pelo host');
    const configured = process.env.MCP_VERIFICATION_PROFILES;
    if (!configured || !path.isAbsolute(configured))
        throw Error('Perfis confiáveis não configurados');
    const file = fs.realpathSync(configured), root = fs.realpathSync(b.root);
    if (inside(root, file))
        throw Error('Perfil deve ficar fora da árvore avaliada');
    const st = fs.statSync(file);
    if (!st.isFile() || st.size > 64000)
        throw Error('Perfil inválido');
    const raw = fs.readFileSync(file, 'utf8'), profiles = JSON.parse(raw);
    object(profiles, ['version', 'profiles']);
    if (profiles.version !== 1 || !Array.isArray(profiles.profiles) || profiles.profiles.length > 30)
        throw Error('Perfis inválidos');
    const profile = profiles.profiles.find((p) => p.name === name);
    object(profile, ['name', 'command', 'args', 'timeout_ms', 'version', 'criteria', 'trusted_files', 'source_paths']);
    safeLabel(profile.name);
    text(profile.version, 120);
    if (!path.isAbsolute(profile.command) || !fs.statSync(profile.command).isFile() || !/^(?:[A-Za-z]:|\/)/.test(profile.command))
        throw Error('Executável deve ser absoluto');
    if (/\.(?:cmd|bat|ps1|sh)$/i.test(profile.command))
        throw Error('Use executável nativo, sem shell implícito');
    if (!Array.isArray(profile.args) || profile.args.length > 50 || profile.args.some((a) => typeof a !== 'string' || a.length > 2000))
        throw Error('args fixos inválidos');
    if (!Array.isArray(profile.criteria) || !profile.criteria.length || profile.criteria.length > 50)
        throw Error('Critérios inválidos');
    for (const c of profile.criteria) {
        object(c, ['id', 'text']);
        safeLabel(c.id);
        text(c.text, 2000);
    }
    if (!Array.isArray(profile.trusted_files) || !profile.trusted_files.length || profile.trusted_files.length > 30)
        throw Error('Verificador confiável exige arquivos fixados por hash');
    for (const input of profile.trusted_files) {
        object(input, ['path', 'sha256']);
        if (!path.isAbsolute(input.path))
            throw Error('trusted_file absoluto');
        const target = fs.realpathSync(input.path);
        if (inside(root, target))
            throw Error('Verificador confiável está dentro da árvore avaliada');
        const stat = fs.statSync(target);
        if (!stat.isFile() || stat.size > 2000000 || createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== input.sha256)
            throw Error('Hash do verificador divergente');
    }
    if (profile.source_paths !== undefined && (!Array.isArray(profile.source_paths) || profile.source_paths.length > 30 || profile.source_paths.some((p) => typeof p !== 'string' || !p || p.length > 500 || path.isAbsolute(p) || /^(?:[a-z]:|[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/i.test(p))))
        throw Error('source_paths relativos inválidos');
    const executable = fs.realpathSync(profile.command), identity = fs.statSync(executable);
    return { profile, digest: digest([raw, profile, { executable, size: identity.size, mtime: identity.mtimeMs }]), timeout: integer(profile.timeout_ms ?? 30000, 100, 120000) };
}
async function runVerification(b, args) {
    const trusted = trustedProfile(b, args.profile), sources = await b.sources(trusted.profile.source_paths), fingerprint = sourceFingerprint(sources), start = performanceNow();
    const result = await new Promise(resolve => {
        let output = '', size = 0, reason, settled = false;
        const allowed = ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'COMSPEC'];
        const env = {};
        for (const key of allowed)
            if (process.env[key])
                env[key] = process.env[key];
        let child;
        try {
            child = spawn(trusted.profile.command, trusted.profile.args, { cwd: b.root, env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
        }
        catch {
            return resolve({ result: 'INFRASTRUCTURE_ERROR' });
        }
        const kill = () => { try {
            if (process.platform === 'win32' && child.pid)
                execFileSync(path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/taskkill.exe'), ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 });
            else if (child.pid)
                process.kill(-child.pid, 'SIGKILL');
        }
        catch {
            child.kill('SIGKILL');
        } };
        const finish = (data) => { if (settled)
            return; settled = true; clearTimeout(timer); resolve({ ...data, duration_ms: Math.round(performanceNow() - start), output_digest: digest(output), diagnostic_excerpt: clean(output).slice(0, 1500) }); };
        const timer = setTimeout(() => { reason = 'TIMEOUT'; kill(); finish({ result: reason }); }, trusted.timeout);
        const consume = (chunk) => { size += chunk.length; if (size > 64000) {
            reason = 'RESOURCE_LIMIT';
            kill();
            finish({ result: reason });
        }
        else
            output += chunk.toString('utf8'); };
        child.stdout?.on('data', consume);
        child.stderr?.on('data', consume);
        child.once('error', () => finish({ result: 'INFRASTRUCTURE_ERROR' }));
        child.once('close', (code, signal) => finish({ result: reason ?? (signal ? 'INCONCLUSIVE' : code === 0 ? 'PASS_IN_SCOPE' : 'FAIL_IN_SCOPE'), exit_code: code, signal }));
    });
    let after = null;
    try {
        after = sourceFingerprint(await b.sources(trusted.profile.source_paths));
    }
    catch { }
    let profileCurrent = false;
    try {
        profileCurrent = trustedProfile(b, args.profile).digest === trusted.digest;
    }
    catch { }
    const body = { ...result, profile: trusted.profile.name, profile_version: trusted.profile.version, profile_digest: trusted.digest, criteria: trusted.profile.criteria, criteria_digest: digest(trusted.profile.criteria), fingerprint, source_count: sources.length, source_paths: trusted.profile.source_paths ?? null, source_changed: fingerprint !== after, trust: 'executed_by_host_profile', sandboxed: false, approves_task: false };
    if (fingerprint !== after || !profileCurrent)
        body.result = 'STALE_DURING_EXECUTION';
    body.execution_signature = sign(b, body, true);
    return locked(b, async () => { const event = await add(b, await readEvents(b), 'receipt', body); return { ...event, limits: 'Checks only the criteria implemented by the configured verifier. Does not prove arbitrary JavaScript or overall task completion.' }; });
}
function performanceNow() { return globalThis.performance.now(); }
function verifierKey(b, create = false) {
    const file = path.join(b.dataDirectory, 'continuity-verifier.key');
    if (!fs.existsSync(file)) {
        if (!create)
            return null;
        privateDirectory(b.dataDirectory);
        try {
            fs.writeFileSync(file, randomBytes(32), { flag: 'wx', mode: 0o600 });
        }
        catch (error) {
            if (error.code !== 'EEXIST')
                throw error;
        }
    }
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink() || !st.isFile() || st.size !== 32)
        throw Error('Chave local do verificador inválida');
    return fs.readFileSync(file);
}
function sign(b, body, create = false) { const key = verifierKey(b, create); if (!key)
    return null; const { execution_signature, ...payload } = body; return createHmac('sha256', key).update(digest([b.scope, payload])).digest('hex'); }
function validSignature(b, body) { try {
    const expected = sign(b, body);
    return typeof body.execution_signature === 'string' && /^[a-f0-9]{64}$/.test(body.execution_signature) && expected !== null && timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(body.execution_signature, 'hex'));
}
catch {
    return false;
} }
export async function validateExecutionReceipts(b, ids) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 30)
        throw Error('verification_receipts exige1..30 IDs');
    const events = await readEvents(b);
    const receipts = [];
    for (const id of new Set(ids)) {
        safeLabel(id);
        const event = events.find(e => e.id === id && e.type === 'receipt');
        if (!event || event.body.trust !== 'executed_by_host_profile' || event.body.result !== 'PASS_IN_SCOPE' || !validSignature(b, event.body))
            throw Error('Recibo não comprova execução local aprovada no escopo');
        const profile = trustedProfile(b, event.body.profile), fingerprint = sourceFingerprint(await b.sources(profile.profile.source_paths));
        if (event.body.fingerprint !== fingerprint || event.body.profile_digest !== profile.digest)
            throw Error('Recibo desatualizado; execute a verificação novamente');
        receipts.push({ id: event.id, criteria: event.body.criteria, criteria_digest: event.body.criteria_digest, fingerprint });
    }
    return { receipts, verified_criteria: receipts.flatMap(r => r.criteria), approves_entire_task: false, human_acceptance_still_required: true };
}
function budgetEnvelope(result, budget) { const size = () => Buffer.byteLength(JSON.stringify(result)); for (const row of result.results) {
    if (size() <= budget)
        break;
    row.content = '';
    row.tier = 'pointer';
} while (result.results.length && size() + 16 > budget) {
    result.results.pop();
    result.omitted++;
} result.bytes = size(); if (size() > budget)
    throw Error('Orçamento insuficiente para metadados do briefing; aumente budget_bytes'); return result; }
