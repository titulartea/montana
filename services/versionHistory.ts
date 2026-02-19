/**
 * Version History Service
 * Stores snapshots of note content in localStorage.
 * Each note keeps up to MAX_VERSIONS snapshots.
 */

const MAX_VERSIONS = 30;
const STORAGE_KEY = 'montana-history';

export interface VersionSnapshot {
  id: string;
  nodeId: string;
  content: string;
  timestamp: number;
  name: string;
}

function getAll(): VersionSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(snapshots: VersionSnapshot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
}

/** Save a snapshot for a specific node */
export function saveVersion(nodeId: string, name: string, content: string): void {
  const all = getAll();
  const nodeVersions = all.filter(s => s.nodeId === nodeId);

  // Don't save duplicate of last snapshot
  if (nodeVersions.length > 0) {
    const last = nodeVersions[nodeVersions.length - 1];
    if (last.content === content) return;
  }

  const snapshot: VersionSnapshot = {
    id: crypto.randomUUID(),
    nodeId,
    content,
    timestamp: Date.now(),
    name,
  };

  // Keep only MAX_VERSIONS per node
  const otherVersions = all.filter(s => s.nodeId !== nodeId);
  const trimmed = [...nodeVersions, snapshot].slice(-MAX_VERSIONS);
  saveAll([...otherVersions, ...trimmed]);
}

/** Get all versions for a node, newest last */
export function getVersions(nodeId: string): VersionSnapshot[] {
  return getAll()
    .filter(s => s.nodeId === nodeId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Get a specific version by ID */
export function getVersion(versionId: string): VersionSnapshot | undefined {
  return getAll().find(s => s.id === versionId);
}

/** Delete all history for a node */
export function clearVersions(nodeId: string): void {
  saveAll(getAll().filter(s => s.nodeId !== nodeId));
}
