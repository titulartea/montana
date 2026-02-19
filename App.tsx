import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FileSystemNode, NodeType, AppSettings, SyncUser, SortOrder } from './types';
import { FileSystemItem } from './components/FileSystemItem';
import { MarkdownEditor } from './components/MarkdownEditor';
import { SettingsModal } from './components/SettingsModal';
import { SearchPalette } from './components/SearchPalette';
import { ToastContainer, ToastMessage } from './components/Toast';
import { TabBar } from './components/TabBar';
import { VersionHistoryPanel } from './components/VersionHistoryPanel';
import { saveVersion } from './services/versionHistory';
import { exportAsZip } from './services/exportService';
import * as localSync from './services/localSyncService';
import * as supabaseSync from './services/supabaseService';
import { decryptNoteContent, encryptNoteContent, isEncryptedContent } from './services/encryptionService';
import { Plus, Mountain, FolderInput, Settings, X, Search, RefreshCw, Download as DownloadIcon } from 'lucide-react';

const generateId = () => crypto.randomUUID();

const initialNodes: FileSystemNode[] = [
  { id: '1', parentId: null, name: 'Welcome', type: NodeType.FOLDER, isOpen: true, createdAt: Date.now() },
  { id: '2', parentId: '1', name: 'Start Here', type: NodeType.FILE, content: '# Montana에 오신 것을 환영합니다\n\n깔끔하고 가벼운 마크다운 노트 앱입니다.\n\n## 특징\n- **보이지 않는 문법**  마크다운 기호가 자동으로 숨겨집니다\n- **클라우드 동기화**  Supabase로 여러 기기 간 동기화\n- **로컬 폴더 동기화**  파일을 직접 관리하세요\n- **==하이라이트==**  이중 등호로 강조할 수 있어요\n\n새 노트를 만들어 보세요!', createdAt: Date.now() },
  { id: '3', parentId: null, name: 'Personal', type: NodeType.FOLDER, isOpen: false, createdAt: Date.now() },
];

const defaultSettings: AppSettings = { fontSize: 16, theme: 'system', storageMode: 'local', showLineNumbers: false, sortOrder: 'folders-first' };
const validThemes = new Set(['light', 'dark', 'system', 'dracula', 'one-dark', 'nord', 'solarized-dark', 'github-dark', 'tokyo-night', 'sepia', 'mint']);

const App: React.FC = () => {
  const [nodes, setNodes] = useState<FileSystemNode[]>(() => { const s = localStorage.getItem('montana-nodes'); return s ? JSON.parse(s) : initialNodes; });
  const [activeNodeId, setActiveNodeId] = useState<string | null>(() => localStorage.getItem('montana-active') || '2');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = localStorage.getItem('montana-settings');
    if (!s) return defaultSettings;
    const parsed = { ...defaultSettings, ...JSON.parse(s) };
    if (!validThemes.has(parsed.theme)) parsed.theme = 'system';
    return parsed;
  });
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>(() => { const s = localStorage.getItem('montana-tabs'); return s ? JSON.parse(s) : ['2']; });
  const [isVersionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [syncUser, setSyncUser] = useState<SyncUser | null>(null);
  const [localSyncFolder, setLocalSyncFolder] = useState<string | null>(localSync.syncedFolderName());
  const localSyncNodeIds = useRef<Set<string>>(new Set());
  const decryptedNotesRef = useRef<Map<string, string>>(new Map());
  const decryptedNotePasswordsRef = useRef<Map<string, string>>(new Map());
  const encryptedContentVersionRef = useRef<Map<string, number>>(new Map());
  const cloudHydratedRef = useRef(false);
  const cloudHydrationKeyRef = useRef<string | null>(null);
  const [encryptionUiVersion, setEncryptionUiVersion] = useState(0);
  const isCloudMutatingRef = useRef(false);
  const cloudMutationUnlockTimerRef = useRef<number | null>(null);
  const [importProgress, setImportProgress] = useState<{ scanned: number; currentPath: string } | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  // Responsive
  useEffect(() => {
    const h = () => setSidebarOpen(window.innerWidth >= 768);
    window.addEventListener('resize', h); return () => window.removeEventListener('resize', h);
  }, []);

  // Persistence
  useEffect(() => { localStorage.setItem('montana-nodes', JSON.stringify(nodes)); }, [nodes]);
  useEffect(() => { if (activeNodeId) localStorage.setItem('montana-active', activeNodeId); }, [activeNodeId]);
  useEffect(() => { localStorage.setItem('montana-settings', JSON.stringify(settings)); document.body.className = 'theme-' + settings.theme; }, [settings]);
  useEffect(() => { localStorage.setItem('montana-tabs', JSON.stringify(openTabs)); }, [openTabs]);

  // Version history
  useEffect(() => {
    if (!activeNodeId) return;
    const node = nodes.find(n => n.id === activeNodeId);
    if (!node || node.type !== NodeType.FILE || !node.content) return;
    if (isEncryptedContent(node.content)) return;
    const t = setTimeout(() => saveVersion(node.id, node.name, node.content || ''), 5000);
    return () => clearTimeout(t);
  }, [nodes, activeNodeId]);

  useEffect(() => {
    const nodeIds = new Set(nodes.map(n => n.id));
    Array.from(decryptedNotesRef.current.keys()).forEach((id) => {
      if (!nodeIds.has(id)) {
        decryptedNotesRef.current.delete(id);
        decryptedNotePasswordsRef.current.delete(id);
        encryptedContentVersionRef.current.delete(id);
      }
    });
  }, [nodes]);

  // PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const h = (e: Event) => { e.preventDefault(); setDeferredInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  // Supabase session restore
  useEffect(() => {
    if (settings.storageMode !== 'cloud' || !settings.supabaseUrl || !settings.supabaseAnonKey) return;
    supabaseSync.getSession(settings.supabaseUrl, settings.supabaseAnonKey).then(u => { if (u) setSyncUser(u); });
  }, []);

  // Supabase realtime
  useEffect(() => {
    if (settings.storageMode !== 'cloud' || !settings.supabaseUrl || !settings.supabaseAnonKey || !syncUser) return;
    supabaseSync.subscribeToChanges(settings.supabaseUrl, settings.supabaseAnonKey, () => {
      if (isCloudMutatingRef.current) return;
      supabaseSync.pullAll(settings.supabaseUrl!, settings.supabaseAnonKey!).then(cn => {
        setNodes(cn);
      }).catch(() => {});
    });
    return () => { supabaseSync.unsubscribe(settings.supabaseUrl!, settings.supabaseAnonKey!); };
  }, [settings.storageMode, settings.supabaseUrl, settings.supabaseAnonKey, syncUser]);

  const withCloudMutationGuard = useCallback(async (task: () => Promise<void>) => {
    isCloudMutatingRef.current = true;
    if (cloudMutationUnlockTimerRef.current) {
      window.clearTimeout(cloudMutationUnlockTimerRef.current);
      cloudMutationUnlockTimerRef.current = null;
    }

    try {
      await task();
    } finally {
      cloudMutationUnlockTimerRef.current = window.setTimeout(() => {
        isCloudMutatingRef.current = false;
        cloudMutationUnlockTimerRef.current = null;
      }, 1200);
    }
  }, []);

  useEffect(() => {
    if (settings.storageMode !== 'cloud' || !settings.supabaseUrl || !settings.supabaseAnonKey || !syncUser) {
      cloudHydratedRef.current = false;
      cloudHydrationKeyRef.current = null;
      return;
    }

    const key = `${syncUser.id}|${settings.supabaseUrl}|${settings.supabaseAnonKey}`;
    if (cloudHydrationKeyRef.current === key && cloudHydratedRef.current) return;

    cloudHydrationKeyRef.current = key;
    withCloudMutationGuard(async () => {
      const cloudNodes = await supabaseSync.pullAll(settings.supabaseUrl!, settings.supabaseAnonKey!);
      setNodes(cloudNodes);

      const firstFile = cloudNodes.find(n => n.type === NodeType.FILE);
      if (firstFile) {
        setActiveNodeId(firstFile.id);
        setOpenTabs([firstFile.id]);
      } else {
        setActiveNodeId(null);
        setOpenTabs([]);
      }

      cloudHydratedRef.current = true;
      addToast('success', `클라우드 노트 ${cloudNodes.length}개를 불러왔습니다.`);
    }).catch(() => {
      cloudHydrationKeyRef.current = null;
      cloudHydratedRef.current = false;
      addToast('error', '클라우드 노트 자동 불러오기에 실패했습니다.');
    });
  }, [settings.storageMode, settings.supabaseUrl, settings.supabaseAnonKey, syncUser, withCloudMutationGuard, addToast]);

  // Keyboard shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(p => !p); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const activeNode = useMemo(() => nodes.find(n => n.id === activeNodeId), [nodes, activeNodeId]);
  const activeNodeForEditor = useMemo(() => {
    if (!activeNode) return undefined;
    if (!isEncryptedContent(activeNode.content)) return activeNode;
    const decrypted = decryptedNotesRef.current.get(activeNode.id);
    return { ...activeNode, content: decrypted ?? '' };
  }, [activeNode, encryptionUiVersion]);
  const activeNodeIsEncrypted = !!activeNode && isEncryptedContent(activeNode.content);
  const activeNodeIsUnlocked = !!activeNode && decryptedNotesRef.current.has(activeNode.id);
  const compareNodes = useCallback((a: FileSystemNode, b: FileSystemNode, order: SortOrder) => {
    const byName = a.name.localeCompare(b.name, 'ko', { sensitivity: 'base' });
    if (order === 'name-asc') return byName;
    if (order === 'name-desc') return -byName;
    if (a.type === b.type) return byName;
    if (order === 'files-first') return a.type === NodeType.FILE ? -1 : 1;
    return a.type === NodeType.FOLDER ? -1 : 1;
  }, []);

  const rootNodes = useMemo(() => {
    return nodes
      .filter(n => n.parentId === null)
      .sort((a, b) => compareNodes(a, b, settings.sortOrder));
  }, [nodes, settings.sortOrder, compareNodes]);

  const addToast = useCallback((type: ToastMessage['type'], text: string) => {
    setToasts(prev => [...prev, { id: crypto.randomUUID(), type, text }]);
  }, []);
  const removeToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const handleToggleFolder = useCallback((id: string) => setNodes(prev => prev.map(n => n.id === id ? { ...n, isOpen: !n.isOpen } : n)), []);
  const handleSelectNode = useCallback((id: string) => {
    setActiveNodeId(id);
    setNodes(prev => { const n = prev.find(x => x.id === id); if (n && n.type === NodeType.FILE) setOpenTabs(tabs => tabs.includes(id) ? tabs : [...tabs, id]); return prev; });
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);
  const handleCreateNode = useCallback((parentId: string | null, type: NodeType) => {
    const n: FileSystemNode = { id: generateId(), parentId, name: type === NodeType.FOLDER ? '새 폴더' : '새 노트', type, content: type === NodeType.FILE ? '' : undefined, isOpen: true, createdAt: Date.now() };
    setNodes(prev => [...prev, n]);
    if (type === NodeType.FILE) { setActiveNodeId(n.id); setOpenTabs(tabs => [...tabs, n.id]); }
  }, []);
  const handleResolveWikilink = useCallback((rawName: string) => {
    const name = rawName.trim();
    if (!name) return;

    const normalized = name.toLowerCase();
    const existing = nodes.find(n => n.type === NodeType.FILE && (
      n.name.toLowerCase() === normalized ||
      n.name.toLowerCase().replace(/\.md$/i, '') === normalized
    ));

    if (existing) {
      handleSelectNode(existing.id);
      return;
    }

    const newNode: FileSystemNode = {
      id: generateId(),
      parentId: null,
      name,
      type: NodeType.FILE,
      content: `# ${name}\n`,
      createdAt: Date.now(),
    };

    setNodes(prev => [...prev, newNode]);
    setActiveNodeId(newNode.id);
    setOpenTabs(tabs => tabs.includes(newNode.id) ? tabs : [...tabs, newNode.id]);
    addToast('info', '위키링크 노트를 새로 만들었습니다.');
  }, [nodes, handleSelectNode, addToast]);
  const handleDeleteNode = useCallback((id: string) => {
    const del = (tid: string, ns: FileSystemNode[]): FileSystemNode[] => { const ch = ns.filter(n => n.parentId === tid); let r = ns.filter(n => n.id !== tid); ch.forEach(c => { r = del(c.id, r); }); return r; };
    setNodes(prev => del(id, prev)); setActiveNodeId(prev => prev === id ? null : prev); setOpenTabs(tabs => tabs.filter(t => t !== id));
  }, []);
  const handleMoveNode = useCallback((nodeId: string, newParentId: string | null) => {
    setNodes(prev => {
      const isDesc = (pid: string | null, tid: string): boolean => { if (!pid) return false; if (pid === tid) return true; const p = prev.find(n => n.id === pid); return p ? isDesc(p.parentId, tid) : false; };
      if (isDesc(newParentId, nodeId)) return prev;
      return prev.map(n => n.id === nodeId ? { ...n, parentId: newParentId } : n);
    });
  }, []);
  const handleRenameNode = useCallback((id: string, name: string) => setNodes(prev => prev.map(n => n.id === id ? { ...n, name } : n)), []);
  const handleUpdateContent = useCallback((id: string, content: string) => {
    const target = nodes.find(n => n.id === id);
    if (!target || target.type !== NodeType.FILE) return;

    if (!isEncryptedContent(target.content)) {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
      if (localSync.isSynced() && localSyncNodeIds.current.has(id)) localSync.writeBack(id, content).catch(() => {});
      return;
    }

    const password = decryptedNotePasswordsRef.current.get(id);
    if (!password) return;

    decryptedNotesRef.current.set(id, content);
    setEncryptionUiVersion(v => v + 1);

    const version = (encryptedContentVersionRef.current.get(id) ?? 0) + 1;
    encryptedContentVersionRef.current.set(id, version);

    encryptNoteContent(content, password).then((encryptedContent) => {
      if (encryptedContentVersionRef.current.get(id) !== version) return;
      setNodes(prev => prev.map(n => n.id === id ? { ...n, content: encryptedContent } : n));
      if (localSync.isSynced() && localSyncNodeIds.current.has(id)) localSync.writeBack(id, encryptedContent).catch(() => {});
    }).catch(() => {
      addToast('error', '노트 암호화 저장 중 오류가 발생했습니다.');
    });
  }, [nodes, addToast]);

  const handleEncryptNote = useCallback(async (noteId: string, password: string) => {
    const target = nodes.find(n => n.id === noteId);
    if (!target || target.type !== NodeType.FILE) return;
    if (isEncryptedContent(target.content)) return;
    if (!password.trim()) {
      addToast('error', '비밀번호를 입력하세요.');
      return;
    }

    const encryptedContent = await encryptNoteContent(target.content || '', password);
    setNodes(prev => prev.map(n => n.id === noteId ? { ...n, content: encryptedContent } : n));
    decryptedNotesRef.current.set(noteId, target.content || '');
    decryptedNotePasswordsRef.current.set(noteId, password);
    setEncryptionUiVersion(v => v + 1);
    if (localSync.isSynced() && localSyncNodeIds.current.has(noteId)) localSync.writeBack(noteId, encryptedContent).catch(() => {});
    addToast('success', '노트 암호화가 활성화되었습니다.');
  }, [nodes, addToast]);

  const handleDecryptNote = useCallback(async (noteId: string, password: string) => {
    const target = nodes.find(n => n.id === noteId);
    if (!target || target.type !== NodeType.FILE || !target.content) return;
    try {
      const plain = await decryptNoteContent(target.content, password);
      decryptedNotesRef.current.set(noteId, plain);
      decryptedNotePasswordsRef.current.set(noteId, password);
      setEncryptionUiVersion(v => v + 1);
      addToast('success', '노트 잠금이 해제되었습니다.');
    } catch (error: any) {
      addToast('error', error?.message || '잠금 해제 실패');
    }
  }, [nodes, addToast]);

  const handleLockNote = useCallback(async (noteId: string) => {
    const decrypted = decryptedNotesRef.current.get(noteId);
    const password = decryptedNotePasswordsRef.current.get(noteId);
    if (decrypted !== undefined && password) {
      const encryptedContent = await encryptNoteContent(decrypted, password);
      setNodes(prev => prev.map(n => n.id === noteId ? { ...n, content: encryptedContent } : n));
      if (localSync.isSynced() && localSyncNodeIds.current.has(noteId)) localSync.writeBack(noteId, encryptedContent).catch(() => {});
    }

    decryptedNotesRef.current.delete(noteId);
    decryptedNotePasswordsRef.current.delete(noteId);
    encryptedContentVersionRef.current.delete(noteId);
    setEncryptionUiVersion(v => v + 1);
    addToast('info', '노트가 다시 잠겼습니다.');
  }, [addToast]);
  const handleCloseTab = useCallback((id: string) => {
    setOpenTabs(tabs => { const nt = tabs.filter(t => t !== id); setActiveNodeId(prev => prev === id ? (nt.length > 0 ? nt[nt.length - 1] : null) : prev); return nt; });
  }, []);
  const handleRestoreVersion = useCallback((content: string) => {
    if (!activeNodeId) return;
    const target = nodes.find(n => n.id === activeNodeId);
    if (!target || target.type !== NodeType.FILE) return;

    if (!isEncryptedContent(target.content)) {
      setNodes(prev => prev.map(n => n.id === activeNodeId ? { ...n, content } : n));
      addToast('success', '버전이 복원되었습니다.');
      return;
    }

    const password = decryptedNotePasswordsRef.current.get(activeNodeId);
    if (!password) {
      addToast('error', '잠금 해제 후 복원할 수 있습니다.');
      return;
    }

    decryptedNotesRef.current.set(activeNodeId, content);
    setEncryptionUiVersion(v => v + 1);
    encryptNoteContent(content, password).then((encryptedContent) => {
      setNodes(prev => prev.map(n => n.id === activeNodeId ? { ...n, content: encryptedContent } : n));
      if (localSync.isSynced() && localSyncNodeIds.current.has(activeNodeId)) localSync.writeBack(activeNodeId, encryptedContent).catch(() => {});
      addToast('success', '암호화된 노트 버전이 복원되었습니다.');
    }).catch(() => addToast('error', '복원 중 암호화 실패'));
  }, [activeNodeId, addToast, nodes]);
  const handleExportZip = useCallback(async () => { await exportAsZip(nodes); addToast('success', 'ZIP 파일 다운로드 완료'); }, [nodes, addToast]);

  const handleOpenLocalFolder = async () => {
    try {
      setImportProgress({ scanned: 0, currentPath: '' });
      const { rootId, nodes: nn } = await localSync.openAndSync(p => setImportProgress({ scanned: p.scanned, currentPath: p.currentPath }));
      nn.forEach(n => localSyncNodeIds.current.add(n.id));
      setLocalSyncFolder(localSync.syncedFolderName());
      setNodes(prev => [...prev, ...nn]);
      addToast('success', nn.length - 1 + '개 파일 로드 완료');
    } catch (err: any) { if (err?.name !== 'AbortError') addToast('error', '폴더를 열 수 없습니다.'); }
    finally { setImportProgress(null); }
  };

  const handleDisconnectLocal = useCallback(async () => { await localSync.disconnect(); localSyncNodeIds.current.clear(); setLocalSyncFolder(null); addToast('info', '로컬 동기화 해제됨'); }, [addToast]);

  // Cloud sync handlers
  const handleCloudSignIn = useCallback(async (email: string, pw: string): Promise<string | null> => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return 'Supabase 설정을 먼저 입력하세요.';
    const { user, error } = await supabaseSync.signIn(settings.supabaseUrl, settings.supabaseAnonKey, email, pw);
    if (error) return error; if (user) { setSyncUser(user); addToast('success', '로그인 완료'); } return null;
  }, [settings.supabaseUrl, settings.supabaseAnonKey, addToast]);
  const handleCloudSignUp = useCallback(async (email: string, pw: string): Promise<string | null> => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return 'Supabase 설정을 먼저 입력하세요.';
    const { user, error } = await supabaseSync.signUp(settings.supabaseUrl, settings.supabaseAnonKey, email, pw);
    if (error) return error; if (user) { setSyncUser(user); addToast('success', '회원가입 완료'); } return null;
  }, [settings.supabaseUrl, settings.supabaseAnonKey, addToast]);
  const handleCloudSignOut = useCallback(async () => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return;
    await supabaseSync.signOut(settings.supabaseUrl, settings.supabaseAnonKey);
    cloudHydratedRef.current = false;
    cloudHydrationKeyRef.current = null;
    supabaseSync.resetClient(); setSyncUser(null); addToast('info', '로그아웃됨');
  }, [settings.supabaseUrl, settings.supabaseAnonKey, addToast]);
  const handleCloudPush = useCallback(async () => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey || !syncUser) return;
    try {
      await withCloudMutationGuard(async () => {
        await supabaseSync.pushAll(settings.supabaseUrl!, settings.supabaseAnonKey!, nodes, syncUser.id);
      });
      addToast('success', 'Push 완료');
    } catch (e: any) {
      addToast('error', 'Push 실패');
    }
  }, [settings.supabaseUrl, settings.supabaseAnonKey, syncUser, nodes, addToast, withCloudMutationGuard]);
  const handleCloudPull = useCallback(async () => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return;
    try {
      await withCloudMutationGuard(async () => {
        const cn = await supabaseSync.pullAll(settings.supabaseUrl!, settings.supabaseAnonKey!);
        setNodes(cn);
        setOpenTabs([]);
        setActiveNodeId(null);
        cloudHydratedRef.current = true;
        addToast('success', 'Pull 완료 (' + cn.length + '개)');
      });
    } catch (e: any) {
      addToast('error', 'Pull 실패');
    }
  }, [settings.supabaseUrl, settings.supabaseAnonKey, addToast, withCloudMutationGuard]);

  // Auto-push
  useEffect(() => {
    if (settings.storageMode !== 'cloud' || !settings.supabaseUrl || !settings.supabaseAnonKey || !syncUser) return;
    if (!cloudHydratedRef.current) return;
    if (isCloudMutatingRef.current) return;
    const t = setTimeout(() => {
      withCloudMutationGuard(async () => {
        await supabaseSync.pushAll(settings.supabaseUrl!, settings.supabaseAnonKey!, nodes, syncUser.id);
      }).catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, [nodes, settings.storageMode, settings.supabaseUrl, settings.supabaseAnonKey, syncUser, withCloudMutationGuard]);

  return (
    <div className="flex h-[100dvh] overflow-hidden font-sans transition-colors duration-200 relative" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>

      {/* Mobile backdrop */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <div className={`fixed md:relative z-40 h-full w-[260px] md:w-60 flex flex-col transition-transform duration-300 ease-out shadow-lg md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${window.innerWidth >= 768 && !isSidebarOpen ? 'md:hidden' : ''}`} style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)' }}>

        {/* Sidebar header */}
        <div className="h-11 px-3 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2 font-semibold text-sm tracking-tight" style={{ color: 'var(--text-main)' }}>
            <Mountain size={16} style={{ color: 'var(--bg-accent)' }} />
            Montana
          </div>
          <div className="flex gap-0.5">
            <button onClick={() => setSearchOpen(true)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--text-muted)' }} title="검색 (Ctrl+K)"><Search size={15} /></button>
            <button onClick={() => handleCreateNode(null, NodeType.FILE)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--text-muted)' }} title="새 노트"><Plus size={15} /></button>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
          </div>
        </div>

        {/* File tree */}
        <div className="flex-1 overflow-y-auto p-1.5 scrollbar-hide">
          {rootNodes.map(node => (
            <FileSystemItem key={node.id} node={node} allNodes={nodes} activeNodeId={activeNodeId} level={0}
              onToggleFolder={handleToggleFolder} onSelectNode={handleSelectNode}
              onCreateNode={(p, t) => handleCreateNode(p, t)} onDeleteNode={handleDeleteNode}
              onRenameNode={handleRenameNode} onMoveNode={handleMoveNode} sortOrder={settings.sortOrder} />
          ))}
          <button onClick={() => handleCreateNode(null, NodeType.FOLDER)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 mt-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}>
            <Plus size={12} /> 새 폴더
          </button>
        </div>

        {/* Sidebar footer */}
        <div className="p-2 border-t flex flex-col gap-1 shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          {localSyncFolder && (
            <div className="px-2.5 py-1 text-[10px] text-green-500 bg-green-500/8 rounded-lg flex items-center gap-1.5"><RefreshCw size={10} /> {localSyncFolder}</div>
          )}
          <button onClick={handleOpenLocalFolder} className="w-full text-left px-2.5 py-2 text-xs flex items-center gap-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}>
            <FolderInput size={14} /> 로컬 폴더 열기
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="w-full text-left px-2.5 py-2 text-xs flex items-center gap-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}>
            <Settings size={14} /> 설정
          </button>
          {deferredInstallPrompt && (
            <button onClick={async () => { deferredInstallPrompt.prompt(); const r = await deferredInstallPrompt.userChoice; if (r.outcome === 'accepted') { setDeferredInstallPrompt(null); addToast('success', '앱 설치 완료!'); }}} className="w-full text-left px-2.5 py-2 text-xs flex items-center gap-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors font-medium" style={{ color: 'var(--bg-accent)' }}>
              <DownloadIcon size={14} /> 앱 설치
            </button>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative transition-colors duration-200" style={{ background: 'var(--bg-main)' }}>
        <TabBar openTabs={openTabs} activeTabId={activeNodeId} nodes={nodes} onSelectTab={handleSelectNode} onCloseTab={handleCloseTab} />
        <MarkdownEditor
          activeNode={activeNodeForEditor}
          onUpdateContent={handleUpdateContent}
          onRenameNode={handleRenameNode}
          onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
          fontSize={settings.fontSize}
          allNodes={nodes}
          onNavigateToNote={handleSelectNode}
          onResolveWikilink={handleResolveWikilink}
          onOpenVersionHistory={() => setVersionHistoryOpen(true)}
          onExportZip={handleExportZip}
          isEncrypted={activeNodeIsEncrypted}
          isUnlocked={activeNodeIsUnlocked}
          onEncryptNote={async (password) => {
            if (!activeNodeForEditor) return;
            await handleEncryptNote(activeNodeForEditor.id, password);
          }}
          onUnlockNote={async (password) => {
            if (!activeNodeForEditor) return;
            await handleDecryptNote(activeNodeForEditor.id, password);
          }}
          onLockNote={async () => {
            if (!activeNodeForEditor) return;
            await handleLockNote(activeNodeForEditor.id);
          }}
        />
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdateSettings={setSettings} syncUser={syncUser} onCloudSignIn={handleCloudSignIn} onCloudSignUp={handleCloudSignUp} onCloudSignOut={handleCloudSignOut} onCloudPush={handleCloudPush} onCloudPull={handleCloudPull} localSyncFolder={localSyncFolder} onDisconnectLocal={handleDisconnectLocal} />
      <SearchPalette isOpen={isSearchOpen} onClose={() => setSearchOpen(false)} nodes={nodes} onSelectNode={handleSelectNode} />
      {activeNode && <VersionHistoryPanel isOpen={isVersionHistoryOpen} onClose={() => setVersionHistoryOpen(false)} nodeId={activeNode.id} nodeName={activeNode.name} onRestore={handleRestoreVersion} />}

      {importProgress && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl p-6 w-72 shadow-[var(--shadow-elevated)] space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 border-2 border-[var(--bg-accent)] border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-medium" style={{color:'var(--text-main)'}}>스캔 중</p>
                <p className="text-xs" style={{color:'var(--text-muted)'}}>{importProgress.scanned}개 발견</p>
              </div>
            </div>
            <p className="text-[10px] truncate" style={{color:'var(--text-muted)'}}>{importProgress.currentPath || '준비 중'}</p>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default App;
