// Generated from ponytail-git.ts; portable engine first validated in the original MCP.
/** Bounded local Git selection. Never fetches, checks out, runs hooks or external diff/textconv. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const digest = (s) => createHash('sha256').update(s).digest('hex');
const relativePath = (s) => !!s && !s.startsWith('/') && !s.includes('\\') && !s.split('/').includes('..') && !/^[A-Za-z]:/.test(s) && s.length < 1000;
export function selectEngineeringChanges(root, args) {
    const empty = { target: args.target ?? 'auto', available: false, head: null, base: null, files: [], diff_hash: null, complete: false };
    if (args.target === 'patch') {
        const patch = args.patch ?? '', files = [];
        let current, oldPath;
        for (const line of patch.split('\n')) {
            if (line.startsWith('--- a/'))
                oldPath = line.slice(6).replace(/\r$/, '');
            if (line.startsWith('+++ ')) {
                const raw = line.slice(4).replace(/\r$/, '');
                const name = raw.startsWith('b/') ? raw.slice(2) : raw;
                if (name === '/dev/null') {
                    if (oldPath && relativePath(oldPath))
                        files.push({ path: oldPath, status: 'D', lines: [] });
                    current = undefined;
                    continue;
                }
                if (!relativePath(name))
                    throw new Error('Patch contém caminho não relativo ou quoted; use patch com paths simples.');
                current = { path: name, status: 'PATCH', lines: [] };
                files.push(current);
            }
            const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
            if (h && current)
                current.lines.push({ start: Number(h[1]), count: Number(h[2] ?? 1) });
        }
        if (!files.length)
            throw new Error('Patch sem arquivos reconhecidos; obtenha patch unificado via conector do host.');
        return { ...empty, target: 'patch', available: true, files: files.slice(0, 100), complete: files.length <= 100, diff_hash: digest(patch), reason: 'Patch fornecido pelo host; autoria, revisão remota e base precisam ser verificadas pelo host.' };
    }
    const git = (cmd) => execFileSync('git', ['--no-optional-locks', '-c', `safe.directory=${root}`, '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...cmd], { cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 2_000_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
        const head = git(['rev-parse', '--verify', 'HEAD']).trim();
        let target = args.target ?? 'auto', base = null, range = [];
        const flags = ['--no-ext-diff', '--no-textconv', '--no-renames', '--no-color'];
        if (target === 'branch') {
            const ref = git(['rev-parse', '--verify', '--end-of-options', `${args.base}^{commit}`]).trim();
            base = git(['merge-base', ref, head]).trim();
            range = [base, head];
        }
        else if (target === 'last_commit') {
            try {
                base = git(['rev-parse', '--verify', 'HEAD^']).trim();
                range = [base, head];
            }
            catch {
                base = null;
            }
        }
        else if (target === 'staged')
            range = ['--cached'];
        else
            range = [head];
        let diff = target === 'last_commit' && !base ? git(['show', '--format=', '--unified=0', ...flags, head]) : git(['diff', '--unified=0', ...flags, ...range, '--']);
        let names = target === 'last_commit' && !base ? git(['diff-tree', '--root', '--no-commit-id', '--name-status', '--no-renames', '-r', '-z', head]) : git(['diff', '--name-status', '-z', ...flags, ...range, '--']);
        const untracked = (target === 'auto' || target === 'uncommitted') ? git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean) : [];
        if (target === 'auto' && !names && !untracked.length)
            return selectEngineeringChanges(root, { ...args, target: 'last_commit' });
        if (target === 'auto')
            target = 'uncommitted';
        const tokens = names.split('\0').filter(Boolean), files = [];
        for (let i = 0; i < tokens.length; i += 2)
            if (relativePath(tokens[i + 1] ?? ''))
                files.push({ path: tokens[i + 1], status: tokens[i], lines: [] });
        for (const name of untracked)
            if (relativePath(name))
                files.push({ path: name, status: 'UNTRACKED', lines: [] });
        // Hunk paths are used only as lookup keys, never as commands or arbitrary filesystem reads.
        let current;
        for (const line of diff.split('\n')) {
            if (line.startsWith('+++ b/'))
                current = files.find(f => f.path === line.slice(6));
            else if (line === '+++ /dev/null')
                current = undefined;
            const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
            if (match && current)
                current.lines.push({ start: Number(match[1]), count: Number(match[2] ?? 1) });
        }
        const alignment = target === 'staged' ? (!git(['diff', '--name-only', '-z', ...flags, '--']).trim() ? 'index_matches_working_tree' : 'mismatch') : (target === 'branch' || target === 'last_commit') ? (!git(['diff', head, '--name-only', '-z', ...flags, '--']).trim() ? 'head_matches_working_tree' : 'mismatch') : 'working_tree';
        return { target, source_alignment: alignment, available: true, head, base, files: files.slice(0, 100), diff_hash: digest(diff + '\0' + names + '\0' + untracked.join('\0')), complete: files.length <= 100, reason: 'Diff selecionado e fontes atuais são evidências distintas. Para commit/branch/staged, confira divergência em relação ao working tree; arquivos apagados/excluídos exigem inspeção histórica pelo host.' };
    }
    catch {
        return { ...empty, reason: 'Git indisponível, repo sem HEAD, ref inválida ou limite excedido; nenhuma seleção completa foi afirmada.' };
    }
}
