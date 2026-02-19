import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FileSystemNode, NodeType, Theme, AppSettings, SyncUser } from './types';
import { FileSystemItem } from './components/FileSystemItem';
import { MarkdownEditor } from './components/MarkdownEditor';
import { AIPanel } from './components/AIPanel';
import { SettingsModal } from './components/SettingsModal';
import { SearchPalette } from './components/SearchPalette';
import { ToastContainer, ToastMessage } from './components/Toast';
import { TabBar } from './components/TabBar';
import { VersionHistoryPanel } from './components/VersionHistoryPanel';
import { saveVersion } from './services/versionHistory';
import { exportAsZip } from './services/exportService';
import * as localSync from './services/localSyncService';
import * as supabaseSync from './services/supabaseService';
import { Plus, Bot, Mountain, FolderInput, Settings, X, Search, RefreshCw } from 'lucide-react';

// Helper for ID generation
const generateId = () => crypto.randomUUID();

// Initial Data
const initialNodes: FileSystemNode[] = [
  { id: '1', parentId: null, name: 'Welcome', type: NodeType.FOLDER, isOpen: true, createdAt: Date.now() },
  { id: '2', parentId: '1', name: 'Start Here', type: NodeType.FILE, content: '# Welcome to Montana\n\nThis is a production-ready Markdown note-taking app.\n\n## 🔮 Invisible Syntax\nNotice how the markdown syntax (like **bold** or *italic*) is hidden while you write?\n- Place your cursor inside the text to edit formatting.\n\n## ⚙️ Settings\nClick the gear icon in the sidebar to:\n- Change **Font Size**.\n- Switch **Themes**.\n- Toggle between **Local** and **Cloud** storage.\n\n## Features\n- **Syntax Highlighting**: Write with style.\n- **Gemini AI**: Click the robot icon to chat with your notes.\n- **Local Access**: Open folders from your computer.\n\nTry creating a new file!', createdAt: Date.now() },
  { id: '3', parentId: null, name: 'Personal', type: NodeType.FOLDER, isOpen: false, createdAt: Date.now() },
];

const defaultSettings: AppSettings = {
  fontSize: 16,
  theme: 'montana',
  storageMode: 'local',
  showLineNumbers: false,
  apiKey: ''
};

const App: React.FC = () => {
  // State
  const [nodes, setNodes] = useState<FileSystemNode[]>(() => {
    const saved = localStorage.getItem('montana-nodes');
    return saved ? JSON.parse(saved) : initialNodes;
  });
  
  const [activeNodeId, setActiveNodeId] = useState<string | null>(() => {
    return localStorage.getItem('montana-active') || '2';
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('montana-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  
  // Responsive State defaults
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isAIPanelOpen, setAIPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    const saved = localStorage.getItem('montana-tabs');
    return saved ? JSON.parse(saved) : ['2'];
  });
  const [isVersionHistoryOpen, setVersionHistoryOpen] = useState(false);

  // Sync state
  const [syncUser, setSyncUser] = useState<SyncUser | null>(null);
  const [localSyncFolder, setLocalSyncFolder] = useState<string | null>(localSync.syncedFolderName());
  /** IDs of nodes that came from a synced local folder */
  const localSyncNodeIds = useRef<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState<{ scanned: number; currentPath: string } | null>(null);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem('montana-nodes', JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    if (activeNodeId) localStorage.setItem('montana-active', activeNodeId);
  }, [activeNodeId]);

  useEffect(() => {
    localStorage.setItem('montana-settings', JSON.stringify(settings));
    document.body.className = `theme-${settings.theme}`;
  }, [settings]);

  // Tabs persistence
  useEffect(() => {
    localStorage.setItem('montana-tabs', JSON.stringify(openTabs));
  }, [openTabs]);

  // Version history: auto-save snapshots on content change (debounced)
  useEffect(() => {
    if (!activeNodeId) return;
    const node = nodes.find(n => n.id === activeNodeId);
    if (!node || node.type !== NodeType.FILE || !node.content) return;
    const timer = setTimeout(() => {
      saveVersion(node.id, node.name, node.content || '');
    }, 5000); // Save snapshot 5s after last edit
    return () => clearTimeout(timer);
  }, [nodes, activeNodeId]);

  // Register Service Worker (PWA)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Restore Supabase session on mount
  useEffect(() => {
    if (settings.storageMode !== 'cloud' || !settings.supabaseUrl || !settings.supabaseAnonKey) return;
    supabaseSync.getSession(settings.supabaseUrl, settings.supabaseAnonKey).then(user => {
      if (user) setSyncUser(user);
    });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase realtime subscription
  useEffect(() => {
    if (settings.storageMode !== 'cloud' || !settings.supabaseUrl || !settings.supabaseAnonKey || !syncUser) return;
    supabaseSync.subscribeToChanges(settings.supabaseUrl, settings.supabaseAnonKey, () => {
      // When a remote change is detected, pull latest
      supabaseSync.pullAll(settings.supabaseUrl!, settings.supabaseAnonKey!).then(cloudNodes => {
        if (cloudNodes.length > 0) {
          setNodes(cloudNodes);
        }
      }).catch(() => {});
    });
    return () => {
      supabaseSync.unsubscribe(settings.supabaseUrl!, settings.supabaseAnonKey!);
    };
  }, [settings.storageMode, settings.supabaseUrl, settings.supabaseAnonKey, syncUser]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Derived State
  const activeNode = useMemo(() => nodes.find(n => n.id === activeNodeId), [nodes, activeNodeId]);
  const rootNodes = useMemo(() => nodes.filter(n => n.parentId === null).sort((a,b) => a.type === NodeType.FOLDER ? -1 : 1), [nodes]);

  // Toast helpers
  const addToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, text }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Actions
  const handleToggleFolder = useCallback((id: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, isOpen: !n.isOpen } : n));
  }, []);

  const handleSelectNode = useCallback((id: string) => {
    setActiveNodeId(id);
    // Auto-add to tabs if it's a file
    setNodes(prev => {
      const node = prev.find(n => n.id === id);
      if (node && node.type === NodeType.FILE) {
        setOpenTabs(tabs => tabs.includes(id) ? tabs : [...tabs, id]);
      }
      return prev;
    });
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const handleCreateNode = useCallback((parentId: string | null, type: NodeType) => {
    const newNode: FileSystemNode = {
      id: generateId(),
      parentId,
      name: type === NodeType.FOLDER ? 'New Folder' : 'New Note',
      type,
      content: type === NodeType.FILE ? '' : undefined,
      isOpen: true,
      createdAt: Date.now()
    };
    setNodes(prev => [...prev, newNode]);
    if (type === NodeType.FILE) {
      setActiveNodeId(newNode.id);
      setOpenTabs(tabs => [...tabs, newNode.id]);
    }
  }, []);

  const handleDeleteNode = useCallback((id: string) => {
    const deleteRecursive = (targetId: string, currentNodes: FileSystemNode[]): FileSystemNode[] => {
      const children = currentNodes.filter(n => n.parentId === targetId);
      let remaining = currentNodes.filter(n => n.id !== targetId);
      children.forEach(child => {
        remaining = deleteRecursive(child.id, remaining);
      });
      return remaining;
    };
    setNodes(prev => deleteRecursive(id, prev));
    setActiveNodeId(prev => prev === id ? null : prev);
    setOpenTabs(tabs => tabs.filter(t => t !== id));
  }, []);

  const handleMoveNode = useCallback((nodeId: string, newParentId: string | null) => {
    setNodes(prev => {
      // Prevent moving a folder into its own descendant
      const isDescendant = (parentId: string | null, targetId: string): boolean => {
        if (!parentId) return false;
        if (parentId === targetId) return true;
        const parent = prev.find(n => n.id === parentId);
        return parent ? isDescendant(parent.parentId, targetId) : false;
      };
      if (isDescendant(newParentId, nodeId)) return prev;
      return prev.map(n => n.id === nodeId ? { ...n, parentId: newParentId } : n);
    });
  }, []);

  const handleRenameNode = useCallback((id: string, newName: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, name: newName } : n));
  }, []);

  const handleUpdateContent = useCallback((id: string, content: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
    // Write back to local filesystem if this node is synced
    if (localSync.isSynced() && localSyncNodeIds.current.has(id)) {
      localSync.writeBack(id, content).catch(err => {
        console.error('[localSync] write-back failed:', err);
      });
    }
  }, []);

  // Tab handlers
  const handleCloseTab = useCallback((id: string) => {
    setOpenTabs(tabs => {
      const newTabs = tabs.filter(t => t !== id);
      // If closing the active tab, switch to the last remaining tab
      setActiveNodeId(prev => {
        if (prev === id) {
          return newTabs.length > 0 ? newTabs[newTabs.length - 1] : null;
        }
        return prev;
      });
      return newTabs;
    });
  }, []);

  const handleRestoreVersion = useCallback((content: string) => {
    if (!activeNodeId) return;
    setNodes(prev => prev.map(n => n.id === activeNodeId ? { ...n, content } : n));
    addToast('success', '버전이 복원되었습니다.');
  }, [activeNodeId]);

  const handleExportZip = useCallback(async () => {
    await exportAsZip(nodes);
    addToast('success', 'ZIP 파일이 다운로드되었습니다.');
  }, [nodes]);

  const handleOpenLocalFolder = async () => {
    try {
      setImportProgress({ scanned: 0, currentPath: '' });

      const { rootId, nodes: newNodes } = await localSync.openAndSync((progress) => {
        setImportProgress({ scanned: progress.scanned, currentPath: progress.currentPath });
      });
      
      // Track which IDs belong to the synced folder
      newNodes.forEach(n => localSyncNodeIds.current.add(n.id));
      setLocalSyncFolder(localSync.syncedFolderName());

      setNodes(prev => [...prev, ...newNodes]);
      addToast('success', `${newNodes.length - 1}개 파일 로드 · 양방향 동기화 활성화 (${localSync.syncedFolderName()})`);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error(err);
        addToast('error', '폴더를 열 수 없습니다.');
      }
    } finally {
      setImportProgress(null);
    }
  };

  const handleDisconnectLocal = useCallback(async () => {
    await localSync.disconnect();
    localSyncNodeIds.current.clear();
    setLocalSyncFolder(null);
    addToast('info', '로컬 폴더 동기화가 해제되었습니다.');
  }, [addToast]);

  // ── Cloud sync handlers ─────────────────────────────────────────────

  const handleCloudSignIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return 'Supabase URL과 Anon Key를 입력하세요.';
    const { user, error } = await supabaseSync.signIn(settings.supabaseUrl, settings.supabaseAnonKey, email, password);
    if (error) return error;
    if (user) {
      setSyncUser(user);
      addToast('success', `${user.email}으로 로그인되었습니다.`);
    }
    return null;
  }, [settings.supabaseUrl, settings.supabaseAnonKey, addToast]);

  const handleCloudSignUp = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return 'Supabase URL과 Anon Key를 입력하세요.';
    const { user, error } = await supabaseSync.signUp(settings.supabaseUrl, settings.supabaseAnonKey, email, password);
    if (error) return error;
    if (user) {
      setSyncUser(user);
      addToast('success', '회원가입 완료! 이메일 확인이 필요할 수 있습니다.');
    }
    return null;
  }, [settings.supabaseUrl, settings.supabaseAnonKey, addToast]);

  const handleCloudSignOut = useCallback(async () => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return;
    await supabaseSync.signOut(settings.supabaseUrl, settings.supabaseAnonKey);
    supabaseSync.resetClient();
    setSyncUser(null);
    addToast('info', '로그아웃되었습니다.');
  }, [settings.supabaseUrl, settings.supabaseAnonKey, addToast]);

  const handleCloudPush = useCallback(async () => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey || !syncUser) return;
    try {
      await supabaseSync.pushAll(settings.supabaseUrl, settings.supabaseAnonKey, nodes, syncUser.id);
      addToast('success', `${nodes.length}개 노트를 클라우드에 업로드했습니다.`);
    } catch (err: any) {
      addToast('error', `Push 실패: ${err.message}`);
    }
  }, [settings.supabaseUrl, settings.supabaseAnonKey, syncUser, nodes, addToast]);

  const handleCloudPull = useCallback(async () => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return;
    try {
      const cloudNodes = await supabaseSync.pullAll(settings.supabaseUrl, settings.supabaseAnonKey);
      setNodes(cloudNodes);
      setOpenTabs([]);
      setActiveNodeId(null);
      addToast('success', `클라우드에서 ${cloudNodes.length}개 노트를 가져왔습니다.`);
    } catch (err: any) {
      addToast('error', `Pull 실패: ${err.message}`);
    }
  }, [settings.supabaseUrl, settings.supabaseAnonKey, addToast]);

  // Auto-push to cloud on content changes (debounced)
  useEffect(() => {
    if (settings.storageMode !== 'cloud' || !settings.supabaseUrl || !settings.supabaseAnonKey || !syncUser) return;
    const timer = setTimeout(() => {
      supabaseSync.pushAll(settings.supabaseUrl!, settings.supabaseAnonKey!, nodes, syncUser.id).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [nodes, settings.storageMode, settings.supabaseUrl, settings.supabaseAnonKey, syncUser]);

  return (
    <div className="flex h-[100dvh] bg-obsidian-bg text-obsidian-text overflow-hidden font-sans transition-colors duration-300 relative" role="application" aria-label="Montana Notes">
      
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        role="navigation"
        aria-label="File explorer"
        className={`
          fixed md:relative z-40 h-full w-[280px] md:w-64 bg-obsidian-sidebar border-r border-obsidian-border flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${window.innerWidth >= 768 && !isSidebarOpen ? 'md:hidden' : ''} 
        `}
      >
        <div className="h-14 md:h-12 px-4 border-b border-obsidian-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-bold text-obsidian-text text-lg tracking-tight">
            <Mountain size={20} className="text-obsidian-accent"/>
            <span>Montana</span>
            {settings.storageMode === 'cloud' && syncUser && <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded ml-1">Cloud</span>}
          </div>
          <div className="flex gap-1">
             <button 
              onClick={() => setSearchOpen(true)}
              className="p-1.5 hover:bg-obsidian-hover rounded-md text-obsidian-muted hover:text-obsidian-text transition-colors"
              title="Search Notes (Ctrl+K)"
              aria-label="Search notes"
            >
              <Search size={18} />
            </button>
             <button 
              onClick={() => handleCreateNode(null, NodeType.FILE)}
              className="p-1.5 hover:bg-obsidian-hover rounded-md text-obsidian-muted hover:text-obsidian-text transition-colors"
              title="New Root Note"
            >
              <Plus size={18} />
            </button>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="md:hidden p-1.5 text-obsidian-muted hover:text-obsidian-text"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          {rootNodes.map(node => (
            <FileSystemItem
              key={node.id}
              node={node}
              allNodes={nodes}
              activeNodeId={activeNodeId}
              level={0}
              onToggleFolder={handleToggleFolder}
              onSelectNode={handleSelectNode}
              onCreateNode={(parentId, type) => handleCreateNode(parentId, type)}
              onDeleteNode={handleDeleteNode}
              onRenameNode={handleRenameNode}
              onMoveNode={handleMoveNode}
            />
          ))}
          
          <button 
            onClick={() => handleCreateNode(null, NodeType.FOLDER)}
            className="w-full text-left px-4 py-3 text-sm text-obsidian-muted hover:text-obsidian-text flex items-center gap-2 mt-2 hover:bg-obsidian-hover rounded-lg transition-colors"
          >
            <Plus size={14} /> New Root Folder
          </button>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-3 border-t border-obsidian-border flex flex-col gap-2 shrink-0 bg-obsidian-sidebar">
          {/* Local Sync Status */}
          {localSyncFolder && (
            <div className="px-3 py-1.5 text-[11px] text-green-400 bg-green-900/15 rounded-lg flex items-center gap-2">
              <RefreshCw size={12} /> 동기화: {localSyncFolder}
            </div>
          )}
          {/* Local Import / Sync Button */}
          <button 
            onClick={handleOpenLocalFolder}
            className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-lg transition-colors text-obsidian-muted hover:text-obsidian-text hover:bg-obsidian-hover"
            title="Open Local Folder (양방향 동기화)"
          >
            <FolderInput size={16} /> Open Local Folder
          </button>

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-full text-left px-3 py-2.5 text-sm text-obsidian-muted hover:text-obsidian-text flex items-center gap-3 hover:bg-obsidian-hover rounded-lg transition-colors"
          >
            <Settings size={16} /> Settings
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-obsidian-bg h-full relative transition-colors duration-300" role="main" aria-label="Editor">
        {/* Tab Bar */}
        <TabBar
          openTabs={openTabs}
          activeTabId={activeNodeId}
          nodes={nodes}
          onSelectTab={handleSelectNode}
          onCloseTab={handleCloseTab}
        />

        <MarkdownEditor 
          activeNode={activeNode}
          onUpdateContent={handleUpdateContent}
          onRenameNode={handleRenameNode}
          onRequestAI={() => setAIPanelOpen(!isAIPanelOpen)}
          onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
          fontSize={settings.fontSize}
          apiKey={settings.apiKey}
          allNodes={nodes}
          onNavigateToNote={handleSelectNode}
          onOpenVersionHistory={() => setVersionHistoryOpen(true)}
          onExportZip={handleExportZip}
        />
        
        {/* Floating AI Toggle (Only visible when panel is closed and activeNode exists) */}
        {!isAIPanelOpen && activeNode && (
          <button
            onClick={() => setAIPanelOpen(true)}
            className="absolute bottom-6 right-6 p-4 bg-obsidian-accent rounded-full shadow-lg shadow-obsidian-accent/20 text-white hover:brightness-110 active:scale-95 transition-all z-20 flex items-center justify-center"
            title="Open AI Assistant"
          >
            <Bot size={24} />
          </button>
        )}
      </div>

      {/* AI Panel */}
      <AIPanel 
        isVisible={isAIPanelOpen} 
        onClose={() => setAIPanelOpen(false)}
        activeNode={activeNode}
        apiKey={settings.apiKey}
      />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        syncUser={syncUser}
        onCloudSignIn={handleCloudSignIn}
        onCloudSignUp={handleCloudSignUp}
        onCloudSignOut={handleCloudSignOut}
        onCloudPush={handleCloudPush}
        onCloudPull={handleCloudPull}
        localSyncFolder={localSyncFolder}
        onDisconnectLocal={handleDisconnectLocal}
      />

      {/* Search Palette */}
      <SearchPalette
        isOpen={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        nodes={nodes}
        onSelectNode={handleSelectNode}
      />

      {/* Version History */}
      {activeNode && (
        <VersionHistoryPanel
          isOpen={isVersionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          nodeId={activeNode.id}
          nodeName={activeNode.name}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Import Progress Overlay */}
      {importProgress && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-obsidian-sidebar border border-obsidian-border rounded-2xl p-6 w-80 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 border-2 border-obsidian-accent border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-semibold text-obsidian-text">폴더 스캔 중…</p>
                <p className="text-xs text-obsidian-muted">{importProgress.scanned}개 항목 발견</p>
              </div>
            </div>
            <div className="w-full bg-obsidian-border rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-obsidian-accent rounded-full animate-pulse" style={{ width: '100%' }} />
            </div>
            <p className="text-[11px] text-obsidian-muted truncate" title={importProgress.currentPath}>
              {importProgress.currentPath || '준비 중…'}
            </p>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

    </div>
  );
};

export default App;