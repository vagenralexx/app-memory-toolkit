import { parseArgs } from 'node:util';
import { StringDecoder } from 'node:string_decoder';
import { clean } from './continuity-core.js';
import { captureFromHarness, manageContinuity } from './continuity-runtime.js';
export async function runContinuityHook(backend, client, normalized = false, stream = process.stdin) {
    let bytes = 0, body = '';
    const decoder = new StringDecoder('utf8');
    for await (const chunk of stream) {
        const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        bytes += part.length;
        if (bytes > 64000)
            throw Error('Hook excede64KB');
        body += decoder.write(part);
    }
    body += decoder.end();
    const payload = JSON.parse(body);
    const observation = normalized ? payload : captureFromHarness(client, payload);
    if (observation.client !== client)
        throw Error('Cliente do envelope diverge da configuração');
    const result = await manageContinuity(backend, { action: 'observe', observation, queue_on_failure: true });
    return { captured: !result.dropped, ...result };
}
export function hookArguments() { const { values } = parseArgs({ options: { client: { type: 'string' }, normalized: { type: 'boolean', default: false }, workspace: { type: 'string', default: 'app' }, data: { type: 'string' }, project: { type: 'string' } } }); if (!values.client)
    throw Error('--client obrigatório'); return values; }
export function hookFailure(error) { return { captured: false, error: clean(error instanceof Error ? error.message : 'Falha de captura').slice(0, 500), blocks_agent: false }; }
