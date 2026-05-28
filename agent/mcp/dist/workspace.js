import * as fs from 'node:fs';
import * as path from 'node:path';
function isUnexpandedTemplate(value) {
    return value.includes('${');
}
/** Cursor: HORSEWHIP_WORKSPACE / ${workspaceFolder}. Claude Code: ${CLAUDE_PROJECT_DIR} or CLAUDE_PROJECT_DIR. */
export function resolveWorkspaceRoot() {
    const hw = process.env.HORSEWHIP_WORKSPACE?.trim();
    if (hw && !isUnexpandedTemplate(hw))
        return path.resolve(hw);
    const claudeDir = process.env.CLAUDE_PROJECT_DIR?.trim();
    if (claudeDir && !isUnexpandedTemplate(claudeDir))
        return path.resolve(claudeDir);
    return path.resolve(process.cwd());
}
export function assertGitWorkspace(workspaceRoot) {
    const head = path.join(workspaceRoot, '.git', 'HEAD');
    if (!fs.existsSync(head)) {
        throw new Error(`Not a git workspace: ${workspaceRoot}. Open a repo root or set HORSEWHIP_WORKSPACE.`);
    }
}
export function normalizeRelPaths(workspaceRoot, paths) {
    const root = path.resolve(workspaceRoot);
    const out = [];
    for (const raw of paths) {
        if (!raw || typeof raw !== 'string')
            continue;
        const cleaned = raw.replace(/\\/g, '/').replace(/^\.\/+/, '');
        if (path.isAbsolute(cleaned)) {
            const rel = path.relative(root, cleaned);
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
                throw new Error(`Path escapes workspace: ${raw}`);
            }
            out.push(rel.split(path.sep).join('/'));
        }
        else {
            const segments = cleaned.split('/').filter((s) => s && s !== '..');
            if (segments.some((s) => s === '..')) {
                throw new Error(`Invalid path: ${raw}`);
            }
            out.push(segments.join('/'));
        }
    }
    return [...new Set(out.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
