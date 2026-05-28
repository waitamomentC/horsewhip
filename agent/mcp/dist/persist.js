import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const GIT_META_DIR = path.join('.git', 'horsewhip');
const ALLOWLIST_NAME = 'allowlist.json';
const MCP_SIGNAL_NAME = 'mcp-signal.json';
export function allowlistFilePath(workspaceRoot) {
    return path.join(workspaceRoot, GIT_META_DIR, ALLOWLIST_NAME);
}
export function mcpSignalFilePath(workspaceRoot) {
    return path.join(workspaceRoot, GIT_META_DIR, MCP_SIGNAL_NAME);
}
export function editBlockedFilePath(workspaceRoot) {
    return path.join(workspaceRoot, GIT_META_DIR, 'edit-blocked.json');
}
export async function readAllowlistRecord(workspaceRoot) {
    try {
        const raw = await fs.readFile(allowlistFilePath(workspaceRoot), 'utf8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data.allowed))
            return null;
        return data;
    }
    catch {
        return null;
    }
}
export async function persistAllowlist(workspaceRoot, allowed, locked, guardActive = true) {
    const file = allowlistFilePath(workspaceRoot);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const sortedAllowed = [...new Set(allowed.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const isLocked = locked && sortedAllowed.length > 0;
    const payload = {
        version: 2,
        updatedAt: new Date().toISOString(),
        allowed: sortedAllowed,
        locked: isLocked ? true : undefined,
        guardActive: guardActive ? true : undefined,
        lockSource: isLocked ? 'mcp' : undefined,
    };
    await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return payload;
}
export async function writeMcpSignal(workspaceRoot, payload) {
    const file = mcpSignalFilePath(workspaceRoot);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const body = {
        version: 1,
        at: new Date().toISOString(),
        ...payload,
    };
    await fs.writeFile(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}
export async function readEditBlocked(workspaceRoot) {
    try {
        const raw = await fs.readFile(editBlockedFilePath(workspaceRoot), 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
