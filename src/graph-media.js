// Generated from graph-media.ts; engine first validated in original MCP.
/** Local optional media extraction; no uploads or model downloads. Paths must pass the adapter's existing ignore policy first. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url), hash = (b) => createHash('sha256').update(b).digest('hex');
export function validateMedia(raw) { if (raw === undefined)
    return []; if (!Array.isArray(raw) || raw.length > 8)
    throw Error('media aceita até8 arquivos.'); for (const item of raw) {
    if (!item || typeof item !== 'object' || Object.keys(item).some(k => !['path', 'method', 'language', 'text', 'source_hash', 'text_offset', 'text_limit'].includes(k)) || typeof item.path !== 'string' || !item.path || item.path.length > 1000 || item.path.includes('\\') || path.posix.isAbsolute(item.path) || item.path.split('/').some((x) => x === '..' || x === '') || /^[A-Za-z]:/.test(item.path) || !['pdf', 'ocr', 'transcribe', 'video_audio', 'video_frame', 'provided', undefined].includes(item.method) || item.text !== undefined && (typeof item.text !== 'string' || item.text.length > 50000) || item.text_offset !== undefined && (!Number.isInteger(item.text_offset) || item.text_offset < 0 || item.text_offset > 50000) || item.text_limit !== undefined && (!Number.isInteger(item.text_limit) || item.text_limit < 100 || item.text_limit > 10000) || item.language !== undefined && !/^[a-z]{3}$/.test(item.language))
        throw Error('Pedido de mídia inválido.');
} return raw; }
function read(root, rel) { const canonical = fs.realpathSync(root); let file = canonical; for (const part of rel.split('/')) {
    file = path.join(file, part);
    if (fs.lstatSync(file).isSymbolicLink())
        throw Error('MEDIA_SYMLINK');
} const resolved = fs.realpathSync(file), r = path.relative(canonical, resolved); if (r.startsWith('..') || path.isAbsolute(r))
    throw Error('MEDIA_OUTSIDE_ROOT'); const fd = fs.openSync(resolved, 'r'); try {
    const st = fs.fstatSync(fd);
    if (!st.isFile() || st.size > 20000000)
        throw Error('MEDIA_SIZE_LIMIT');
    const b = Buffer.alloc(st.size + 1), n = fs.readSync(fd, b, 0, b.length, 0);
    if (n > 20000000)
        throw Error('MEDIA_SIZE_LIMIT');
    return b.subarray(0, n);
}
finally {
    fs.closeSync(fd);
} }
export function decodeWav(b) {
    if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE')
        throw Error('WAV_PCM_REQUIRED');
    let format = 0, channels = 0, rate = 0, bits = 0, data;
    for (let at = 12; at + 8 <= b.length;) {
        const kind = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4), start = at + 8, end = Math.min(b.length, start + size);
        if (kind === 'fmt ' && end - start >= 16) {
            format = b.readUInt16LE(start);
            channels = b.readUInt16LE(start + 2);
            rate = b.readUInt32LE(start + 4);
            bits = b.readUInt16LE(start + 14);
        }
        if (kind === 'data')
            data = b.subarray(start, end);
        if (size > 20000000)
            break;
        at = start + size + (size % 2);
    }
    if (!data || format !== 1 || ![1, 2].includes(channels) || rate < 8000 || rate > 48000 || bits !== 16)
        throw Error('WAV_PCM16_MONO_OR_STEREO_8K_48K_REQUIRED');
    const count = Math.floor(data.length / (2 * channels));
    if (count / rate > 60)
        throw Error('AUDIO_60_SECONDS_LIMIT');
    const output = new Float32Array(Math.floor(count * 16000 / rate));
    for (let i = 0; i < output.length; i++) {
        const at = Math.min(count - 1, Math.floor(i * rate / 16000));
        let sum = 0;
        for (let c = 0; c < channels; c++)
            sum += data.readInt16LE((at * channels + c) * 2) / 32768;
        output[i] = sum / channels;
    }
    return output;
}
async function ocr(bytes, language = 'por') { const dir = process.env.MCP_GRAPH_OCR_DATA_DIR; if (!dir || !path.isAbsolute(dir) || !fs.statSync(path.join(dir, language + '.traineddata')).isFile())
    throw Error('LOCAL_OCR_TRAINEDDATA_NOT_CONFIGURED'); const { createWorker } = require('tesseract.js'); const worker = await createWorker(language, 1, { langPath: dir, gzip: false, cacheMethod: 'none', logger: () => { } }); try {
    return (await worker.recognize(bytes)).data.text;
}
finally {
    await worker.terminate();
} }
async function transcribe(bytes) { const model = process.env.MCP_GRAPH_ASR_MODEL; if (!model || !path.isAbsolute(model) || !fs.statSync(model).isDirectory())
    throw Error('LOCAL_ASR_MODEL_NOT_CONFIGURED'); const audio = decodeWav(bytes), transformers = await import(pathToFileURL(require.resolve('@huggingface/transformers')).href); const pipe = await transformers.pipeline('automatic-speech-recognition', model, { local_files_only: true, dtype: 'q8' }); try {
    const result = await pipe(audio, { chunk_length_s: 20, return_timestamps: true });
    return { text: result.text, chunks: result.chunks };
}
finally {
    await pipe.dispose?.();
} }
function video(bytes, frame) { const executable = process.env.MCP_GRAPH_FFMPEG; if (!executable || !path.isAbsolute(executable) || !fs.statSync(executable).isFile())
    throw Error('LOCAL_FFMPEG_NOT_CONFIGURED'); const args = ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'pipe', '-format_whitelist', 'mov,matroska,webm,avi,ogg,wav,mp3,flac,aac', '-i', 'pipe:0', ...(frame ? ['-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'] : ['-t', '60', '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', 'pipe:1'])]; return execFileSync(executable, args, { input: bytes, maxBuffer: 10000000, timeout: 20000, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
export async function extractMedia(root, raw, allowed, safeText) {
    const requests = validateMedia(raw), sources = [], receipts = [], warnings = [];
    let total = 0;
    for (const request of requests) {
        if (!allowed.has(request.path)) {
            warnings.push({ path: request.path, state: 'MEDIA_NOT_ALLOWED_BY_EXISTING_SCAN_POLICY' });
            continue;
        }
        try {
            let bytes = read(root, request.path);
            total += bytes.length;
            if (total > 30000000)
                throw Error('MEDIA_TOTAL_30MB_LIMIT');
            const sourceHash = hash(bytes), method = request.method ?? (/\.pdf$/i.test(request.path) ? 'pdf' : /\.(png|jpe?g|bmp|webp|tiff?)$/i.test(request.path) ? 'ocr' : 'transcribe');
            let text = '', provider = method, extra = {};
            if (method === 'provided') {
                if (request.source_hash !== sourceHash || !request.text?.trim())
                    throw Error('PROVIDED_TEXT_REQUIRES_CURRENT_BINARY_HASH');
                text = request.text;
                provider = 'host_reported_text_not_independently_verified';
            }
            else if (method === 'pdf') {
                const pdf = await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
                const task = pdf.getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, maxImageSize: 0, stopAtErrors: true });
                let doc;
                try {
                    doc = await task.promise;
                    const pages = [];
                    for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
                        const content = await (await doc.getPage(p)).getTextContent();
                        pages.push('[page ' + p + '] ' + content.items.filter((x) => typeof x.str === 'string').map((x) => x.str).join(' '));
                    }
                    text = pages.join('\n');
                    extra = { pages_read: pages.length, pages_total: doc.numPages, truncated: doc.numPages > 20 };
                }
                finally {
                    await task.destroy();
                }
            }
            else if (method === 'ocr' || method === 'video_frame') {
                if (method === 'video_frame')
                    bytes = video(bytes, true);
                text = await ocr(bytes, request.language);
            }
            else {
                if (method === 'video_audio')
                    bytes = video(bytes, false);
                const result = await transcribe(bytes);
                text = result.text;
                extra = { timestamps: result.chunks };
            }
            if (!safeText(text))
                throw Error('EXTRACTED_TEXT_POSSIBLE_SECRET');
            const bounded = text.slice(0, 50000);
            sources.push({ path: request.path, content: bounded, hash: sourceHash, kind: 'media' });
            receipts.push({ path: request.path, source_hash: sourceHash, text_hash: hash(Buffer.from(bounded)), method, provider, confidence: method === 'pdf' ? 'TEXT_EXTRACTED_NOT_SEMANTIC_FACT' : 'INFERRED', text: bounded.slice(request.text_offset ?? 0, (request.text_offset ?? 0) + (request.text_limit ?? 2000)), text_offset: request.text_offset ?? 0, next_text_offset: (request.text_offset ?? 0) + (request.text_limit ?? 2000) < bounded.length ? (request.text_offset ?? 0) + (request.text_limit ?? 2000) : null, text_total_chars: bounded.length, text_truncated: text.length > 50000, ...extra });
        }
        catch (error) {
            const msg = String(error.message);
            warnings.push({ path: request.path, state: /^[A-Z][A-Z0-9_]+$/.test(msg) ? msg : 'OPTIONAL_MEDIA_EXTRACTION_FAILED' });
        }
    }
    return { sources, receipts, warnings, network: false, downloads_models: false, writes_sources: false };
}
