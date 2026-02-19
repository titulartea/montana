/**
 * Local Folder Bidirectional Sync Service
 * ----------------------------------------
 * Uses the File System Access API to read AND write files
 * back to a user-selected local folder.
 *
 * Handles are stored in IndexedDB so they survive page reloads
 * (the browser will re-prompt for permission on next visit).
 */

import { FileSystemNode, NodeType } from '../types';

// ── In-memory handle maps ──────────────────────────────────────────────

/** Root directory handle for the synced folder */
let rootDirHandle: FileSystemDirectoryHandle | null = null;

/** Map from nodeId → FileSystemFileHandle for quick write-back */
const fileHandleMap = new Map<string, FileSystemFileHandle>();

/** Map from nodeId → relative path segments for re-building handles */
const nodePathMap = new Map<string, string[]>();

// ── IndexedDB helpers (persist root handle across reloads) ─────────────

const IDB_NAME = 'montana-local-sync';
const IDB_STORE = 'handles';
const IDB_KEY = 'rootDir';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistHandle(handle: FileSystemDirectoryHandle) {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readonly');
  const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function clearHandle() {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).delete(IDB_KEY);
}

// ── Public API ────────────────────────────────────────────────────────

/** True when we have an active synced-folder connection */
export function isSynced(): boolean {
  return rootDirHandle !== null;
}

/** Name of the currently synced folder, if any */
export function syncedFolderName(): string | null {
  return rootDirHandle?.name ?? null;
}

/**
 * Open a local folder for bidirectional sync.
 * Returns the imported FileSystemNode[] tree.
 */
export interface ScanProgress {
  scanned: number;
  currentPath: string;
}

export async function openAndSync(
  onProgress?: (progress: ScanProgress) => void
): Promise<{
  rootId: string;
  nodes: FileSystemNode[];
}> {
  // @ts-ignore – File System Access API types
  const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
    mode: 'readwrite',
  });

  rootDirHandle = handle;
  fileHandleMap.clear();
  nodePathMap.clear();

  await persistHandle(handle);

  const nodes: FileSystemNode[] = [];
  const rootId = crypto.randomUUID();
  const counter = { value: 0 };

  nodes.push({
    id: rootId,
    parentId: null,
    name: handle.name,
    type: NodeType.FOLDER,
    isOpen: true,
    createdAt: Date.now(),
  });
  nodePathMap.set(rootId, []);

  await scanDirectory(handle, rootId, nodes, [], onProgress, counter);

  return { rootId, nodes };
}

/**
 * Try to restore a previously persisted folder handle.
 * The browser will show a permission prompt.
 * Returns null if no previous handle or permission denied.
 */
export async function restorePreviousSync(): Promise<{
  rootId: string;
  nodes: FileSystemNode[];
} | null> {
  const handle = await loadHandle();
  if (!handle) return null;

  // Re-request permission
  // @ts-ignore
  const permission = await handle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') return null;

  rootDirHandle = handle;
  fileHandleMap.clear();
  nodePathMap.clear();

  const nodes: FileSystemNode[] = [];
  const rootId = crypto.randomUUID();

  nodes.push({
    id: rootId,
    parentId: null,
    name: handle.name,
    type: NodeType.FOLDER,
    isOpen: true,
    createdAt: Date.now(),
  });
  nodePathMap.set(rootId, []);

  await scanDirectory(handle, rootId, nodes, []);

  return { rootId, nodes };
}

/**
 * Write file content back to the local filesystem.
 */
export async function writeBack(nodeId: string, content: string): Promise<void> {
  const fileHandle = fileHandleMap.get(nodeId);
  if (!fileHandle) {
    console.warn('[localSync] No file handle found for node', nodeId);
    return;
  }

  try {
    // @ts-ignore – createWritable is part of File System Access API
    const writable: FileSystemWritableFileStream = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (err) {
    console.error('[localSync] Write-back failed:', err);
    throw err;
  }
}

/**
 * Create a new file in the synced folder.
 * @param parentPath path segments from root to the parent folder
 */
export async function createFileOnDisk(
  nodeId: string,
  fileName: string,
  parentNodeId: string,
  content: string = ''
): Promise<void> {
  if (!rootDirHandle) return;

  const parentPath = nodePathMap.get(parentNodeId);
  if (!parentPath && parentNodeId) {
    console.warn('[localSync] Parent path unknown for', parentNodeId);
    return;
  }

  try {
    let dirHandle = rootDirHandle;
    for (const seg of parentPath ?? []) {
      dirHandle = await dirHandle.getDirectoryHandle(seg);
    }

    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    fileHandleMap.set(nodeId, fileHandle);
    nodePathMap.set(nodeId, [...(parentPath ?? []), fileName]);

    // @ts-ignore
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (err) {
    console.error('[localSync] createFileOnDisk failed:', err);
  }
}

/**
 * Create a new folder on disk.
 */
export async function createFolderOnDisk(
  nodeId: string,
  folderName: string,
  parentNodeId: string | null
): Promise<void> {
  if (!rootDirHandle) return;

  const parentPath = parentNodeId ? nodePathMap.get(parentNodeId) : [];
  if (parentPath === undefined) return;

  try {
    let dirHandle = rootDirHandle;
    for (const seg of parentPath) {
      dirHandle = await dirHandle.getDirectoryHandle(seg);
    }
    await dirHandle.getDirectoryHandle(folderName, { create: true });
    nodePathMap.set(nodeId, [...parentPath, folderName]);
  } catch (err) {
    console.error('[localSync] createFolderOnDisk failed:', err);
  }
}

/**
 * Delete a file or folder from disk.
 */
export async function deleteFromDisk(nodeId: string, isFolder: boolean): Promise<void> {
  if (!rootDirHandle) return;

  const pathSegments = nodePathMap.get(nodeId);
  if (!pathSegments || pathSegments.length === 0) return;

  try {
    let dirHandle = rootDirHandle;
    // Navigate to parent
    for (let i = 0; i < pathSegments.length - 1; i++) {
      dirHandle = await dirHandle.getDirectoryHandle(pathSegments[i]);
    }
    const entryName = pathSegments[pathSegments.length - 1];
    await dirHandle.removeEntry(entryName, { recursive: isFolder });
    fileHandleMap.delete(nodeId);
    nodePathMap.delete(nodeId);
  } catch (err) {
    console.error('[localSync] deleteFromDisk failed:', err);
  }
}

/**
 * Disconnect from the synced folder.
 */
export async function disconnect(): Promise<void> {
  rootDirHandle = null;
  fileHandleMap.clear();
  nodePathMap.clear();
  await clearHandle();
}

// ── Internal helpers ──────────────────────────────────────────────────

async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  parentId: string,
  nodes: FileSystemNode[],
  pathSegments: string[],
  onProgress?: (progress: ScanProgress) => void,
  counter?: { value: number }
) {
  // @ts-ignore
  for await (const entry of dirHandle.values()) {
    const id = crypto.randomUUID();
    const entryPath = [...pathSegments, entry.name];

    if (counter) counter.value++;
    onProgress?.({
      scanned: counter?.value ?? 0,
      currentPath: entryPath.join('/'),
    });

    if (entry.kind === 'file') {
      // Only import text-based files
      if (
        entry.name.endsWith('.md') ||
        entry.name.endsWith('.txt') ||
        entry.name.endsWith('.markdown')
      ) {
        const file = await (entry as FileSystemFileHandle).getFile();
        const text = await file.text();

        nodes.push({
          id,
          parentId,
          name: entry.name,
          type: NodeType.FILE,
          content: text,
          createdAt: file.lastModified || Date.now(),
        });

        fileHandleMap.set(id, entry as FileSystemFileHandle);
        nodePathMap.set(id, entryPath);
      }
    } else if (entry.kind === 'directory') {
      nodes.push({
        id,
        parentId,
        name: entry.name,
        type: NodeType.FOLDER,
        isOpen: false,
        createdAt: Date.now(),
      });
      nodePathMap.set(id, entryPath);

      await scanDirectory(
        entry as FileSystemDirectoryHandle,
        id,
        nodes,
        entryPath,
        onProgress,
        counter
      );
    }
  }
}
