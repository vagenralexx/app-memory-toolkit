import { createHash } from 'node:crypto';
import { posix } from 'node:path';

export function stableId(value) {
  const bytes = createHash('sha256').update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const s = bytes.toString('hex');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export function splitRecord(record, maxChars = 1800) {
  const source = record.source_path ?? record.title;
  const lines = record.content.split('\n');
  const module = record.source_path ? posix.dirname(record.source_path).split('/').filter(p => !['src', 'lib', 'app', 'docs', '.'].includes(p)).slice(0, 2).join('/') || 'root' : 'memory';
  const declared = record.content.match(/^---\r?\n[\s\S]*?\bstatus:\s*([\w-]+)[\s\S]*?\r?\n---/i)?.[1];
  const documentStatus = ['superseded', 'deprecated', 'historical', 'planned', 'draft'].includes(declared) ? declared : 'observed';
  const chunks = [];
  let at = 0, section = '';
  while (at < lines.length) {
    const start = at;
    let content = '';
    while (at < lines.length) {
      const line = lines[at];
      const heading = line.match(/^(#{1,6})\s+(.+)/);
      if (heading && content.length > 300) break;
      if (heading) section = heading[2].slice(0, 200);
      if (content && content.length + line.length > maxChars) break;
      // Long minified lines are split without discarding their remainder.
      if (!content && line.length > maxChars) {
        for (let offset = 0; offset < line.length; offset += maxChars) chunks.push(make(line.slice(offset, offset + maxChars), at + 1, at + 1, offset));
        at++; break;
      }
      content += (content ? '\n' : '') + line;
      at++;
      if (content.length >= maxChars) break;
    }
    if (content.trim()) chunks.push(make(content, start + 1, at, 0));
    if (at === start) at++;
  }
  function make(content, startLine, endLine, offset) {
    const digest = createHash('sha256').update(content).digest('hex');
    return { id: stableId(`${record.id}:${startLine}:${offset}:${digest}`), record_id: record.id, project_id: record.project_id,
      title: `${source}${section ? ` — ${section}` : ''}`, module, section, start_line: startLine, end_line: endLine,
      content, digest, document_status: documentStatus };
  }
  return chunks;
}
