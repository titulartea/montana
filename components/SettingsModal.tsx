import React from 'react';
import { X, Cloud, Monitor, Type, Palette, LogIn, LogOut, Upload, Download, RefreshCw, HardDrive, Unplug, Loader2 } from 'lucide-react';
import { AppSettings, Theme, StorageMode, SyncUser } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  // Cloud sync
  syncUser: SyncUser | null;
  onCloudSignIn: (email: string, password: string) => Promise<string | null>;
  onCloudSignUp: (email: string, password: string) => Promise<string | null>;
  onCloudSignOut: () => void;
  onCloudPush: () => void;
  onCloudPull: () => void;
  // Local sync
  localSyncFolder: string | null;
  onDisconnectLocal: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onUpdateSettings,
  syncUser,
  onCloudSignIn,
  onCloudSignUp,
  onCloudSignOut,
  onCloudPush,
  onCloudPull,
  localSyncFolder,
  onDisconnectLocal,
}) => {
  const [activeTab, setActiveTab] = React.useState<'general' | 'theme' | 'sync'>('general');
  const [authEmail, setAuthEmail] = React.useState('');
  const [authPassword, setAuthPassword] = React.useState('');
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<'login' | 'signup'>('login');
  const [showSupabaseConfig, setShowSupabaseConfig] = React.useState(false);

  if (!isOpen) return null;

  const handleAuth = async () => {
    if (!authEmail || !authPassword) {
      setAuthError('이메일과 비밀번호를 입력하세요.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    const err = authMode === 'login'
      ? await onCloudSignIn(authEmail, authPassword)
      : await onCloudSignUp(authEmail, authPassword);
    setAuthLoading(false);
    if (err) setAuthError(err);
    else {
      setAuthEmail('');
      setAuthPassword('');
    }
  };

  const hasSupabaseConfig = !!(settings.supabaseUrl && settings.supabaseAnonKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-obsidian-sidebar w-full max-w-2xl rounded-2xl shadow-2xl border border-obsidian-border flex flex-col max-h-[80vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-obsidian-border">
          <h2 className="text-xl font-bold text-obsidian-text">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-obsidian-hover rounded-full text-obsidian-muted hover:text-obsidian-text transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-1/3 border-r border-obsidian-border p-2 bg-obsidian-bg/50 space-y-1">
            <TabButton 
              active={activeTab === 'general'} 
              onClick={() => setActiveTab('general')} 
              icon={<Type size={18} />} 
              label="Editor" 
            />
            <TabButton 
              active={activeTab === 'theme'} 
              onClick={() => setActiveTab('theme')} 
              icon={<Palette size={18} />} 
              label="Appearance" 
            />
            <TabButton 
              active={activeTab === 'sync'} 
              onClick={() => setActiveTab('sync')} 
              icon={<Cloud size={18} />} 
              label="Data & Sync" 
            />
          </div>

          {/* Main Content */}
          <div className="w-2/3 p-6 overflow-y-auto bg-obsidian-bg">
            
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-obsidian-muted mb-2">Font Size ({settings.fontSize}px)</label>
                  <input 
                    type="range" 
                    min="12" 
                    max="24" 
                    value={settings.fontSize}
                    onChange={(e) => onUpdateSettings({...settings, fontSize: parseInt(e.target.value)})}
                    className="w-full h-2 bg-obsidian-border rounded-lg appearance-none cursor-pointer accent-obsidian-accent"
                  />
                  <div className="mt-4 p-4 border border-obsidian-border rounded-lg bg-obsidian-sidebar">
                    <p className="text-obsidian-text leading-relaxed" style={{ fontSize: settings.fontSize }}>
                      This is a preview of your text. <br/>
                      <b>Bold text</b> and <i>Italic text</i>.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* Theme Tab */}
            {activeTab === 'theme' && (
              <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                <p className="text-xs text-obsidian-muted uppercase tracking-wide font-semibold mb-1">Dark</p>
                <ThemeOption id="montana" name="Montana Dark" active={settings.theme === 'montana'} onClick={() => onUpdateSettings({...settings, theme: 'montana'})} color="#1e1e1e" accent="#7c3aed" />
                <ThemeOption id="dracula" name="Dracula" active={settings.theme === 'dracula'} onClick={() => onUpdateSettings({...settings, theme: 'dracula'})} color="#282a36" accent="#ff79c6" />
                <ThemeOption id="nord" name="Nord" active={settings.theme === 'nord'} onClick={() => onUpdateSettings({...settings, theme: 'nord'})} color="#2e3440" accent="#88c0d0" />
                <ThemeOption id="monokai" name="Monokai" active={settings.theme === 'monokai'} onClick={() => onUpdateSettings({...settings, theme: 'monokai'})} color="#272822" accent="#f92672" />
                <ThemeOption id="gruvbox" name="Gruvbox" active={settings.theme === 'gruvbox'} onClick={() => onUpdateSettings({...settings, theme: 'gruvbox'})} color="#282828" accent="#fe8019" />
                <ThemeOption id="catppuccin" name="Catppuccin" active={settings.theme === 'catppuccin'} onClick={() => onUpdateSettings({...settings, theme: 'catppuccin'})} color="#1e1e2e" accent="#cba6f7" />
                <ThemeOption id="tokyonight" name="Tokyo Night" active={settings.theme === 'tokyonight'} onClick={() => onUpdateSettings({...settings, theme: 'tokyonight'})} color="#1a1b26" accent="#7aa2f7" />
                <ThemeOption id="rosepine" name="Rosé Pine" active={settings.theme === 'rosepine'} onClick={() => onUpdateSettings({...settings, theme: 'rosepine'})} color="#191724" accent="#ebbcba" />
                <ThemeOption id="kanagawa" name="Kanagawa" active={settings.theme === 'kanagawa'} onClick={() => onUpdateSettings({...settings, theme: 'kanagawa'})} color="#1f1f28" accent="#957fb8" />
                <ThemeOption id="onedark" name="One Dark" active={settings.theme === 'onedark'} onClick={() => onUpdateSettings({...settings, theme: 'onedark'})} color="#282c34" accent="#61afef" />
                <ThemeOption id="palenight" name="Palenight" active={settings.theme === 'palenight'} onClick={() => onUpdateSettings({...settings, theme: 'palenight'})} color="#292d3e" accent="#c792ea" />
                <ThemeOption id="forest" name="Forest" active={settings.theme === 'forest'} onClick={() => onUpdateSettings({...settings, theme: 'forest'})} color="#1b262c" accent="#22c55e" />
                <ThemeOption id="everforest" name="Everforest" active={settings.theme === 'everforest'} onClick={() => onUpdateSettings({...settings, theme: 'everforest'})} color="#2d353b" accent="#a7c080" />
                <ThemeOption id="ayu" name="Ayu Dark" active={settings.theme === 'ayu'} onClick={() => onUpdateSettings({...settings, theme: 'ayu'})} color="#0b0e14" accent="#e6b450" />
                <ThemeOption id="iceberg" name="Iceberg" active={settings.theme === 'iceberg'} onClick={() => onUpdateSettings({...settings, theme: 'iceberg'})} color="#161821" accent="#84a0c6" />
                <ThemeOption id="horizon" name="Horizon" active={settings.theme === 'horizon'} onClick={() => onUpdateSettings({...settings, theme: 'horizon'})} color="#1c1e26" accent="#e95678" />
                <ThemeOption id="synthwave" name="Synthwave '84" active={settings.theme === 'synthwave'} onClick={() => onUpdateSettings({...settings, theme: 'synthwave'})} color="#2b213a" accent="#ff7edb" />
                <ThemeOption id="cyberpunk" name="Cyberpunk" active={settings.theme === 'cyberpunk'} onClick={() => onUpdateSettings({...settings, theme: 'cyberpunk'})} color="#050505" accent="#00ff9f" />

                <p className="text-xs text-obsidian-muted uppercase tracking-wide font-semibold mt-3 mb-1">Light</p>
                <ThemeOption id="light" name="Light" active={settings.theme === 'light'} onClick={() => onUpdateSettings({...settings, theme: 'light'})} color="#ffffff" accent="#3b82f6" />
                <ThemeOption id="solarized" name="Solarized Light" active={settings.theme === 'solarized'} onClick={() => onUpdateSettings({...settings, theme: 'solarized'})} color="#fdf6e3" accent="#d33682" />
              </div>
            )}

            {/* Sync Tab */}
            {activeTab === 'sync' && (
              <div className="space-y-6">

                {/* ── Local Folder Sync Status ── */}
                <div>
                  <h3 className="text-sm font-semibold text-obsidian-text uppercase tracking-wide mb-3">Local Folder Sync</h3>
                  {localSyncFolder ? (
                    <div className="p-4 border border-green-600/40 bg-green-900/10 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <HardDrive size={18} className="text-green-400" />
                        <div>
                          <p className="text-sm font-medium text-obsidian-text">{localSyncFolder}</p>
                          <p className="text-xs text-green-400">양방향 동기화 활성</p>
                        </div>
                      </div>
                      <button
                        onClick={onDisconnectLocal}
                        className="p-2 hover:bg-red-900/30 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                        title="연결 해제"
                      >
                        <Unplug size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 border border-obsidian-border rounded-xl">
                      <p className="text-xs text-obsidian-muted">
                        사이드바의 "Open Local Folder"를 통해 로컬 폴더를 열면 양방향 동기화가 활성화됩니다.
                        편집 내용이 자동으로 로컬 파일에 반영됩니다.
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Storage Mode ── */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-obsidian-text uppercase tracking-wide">Storage Mode</h3>
                   
                  <div 
                    onClick={() => onUpdateSettings({...settings, storageMode: 'local'})}
                    className={`p-4 border rounded-xl cursor-pointer transition-all flex items-start gap-4 ${settings.storageMode === 'local' ? 'border-obsidian-accent bg-obsidian-accent/10' : 'border-obsidian-border hover:bg-obsidian-hover'}`}
                  >
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                      <Monitor size={24} />
                    </div>
                    <div>
                      <div className="font-semibold text-obsidian-text">Local (Browser)</div>
                      <p className="text-xs text-obsidian-muted mt-1">localStorage에 저장. 오프라인 사용 가능. 로컬 폴더 동기화와 함께 사용 가능.</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => onUpdateSettings({...settings, storageMode: 'cloud'})}
                    className={`p-4 border rounded-xl cursor-pointer transition-all flex items-start gap-4 ${settings.storageMode === 'cloud' ? 'border-obsidian-accent bg-obsidian-accent/10' : 'border-obsidian-border hover:bg-obsidian-hover'}`}
                  >
                    <div className="p-2 bg-green-500/20 text-green-400 rounded-lg">
                      <Cloud size={24} />
                    </div>
                    <div>
                      <div className="font-semibold text-obsidian-text">Cloud Sync (Supabase)</div>
                      <p className="text-xs text-obsidian-muted mt-1">Supabase를 통해 여러 기기 간 실시간 동기화. 무료 플랜 500MB.</p>
                    </div>
                  </div>
                </div>

                {/* ── Supabase Configuration ── */}
                {settings.storageMode === 'cloud' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-obsidian-text uppercase tracking-wide">Supabase 설정</h3>
                    
                    {/* If URL/key are already saved, show compact status instead of inputs */}
                    {hasSupabaseConfig && !showSupabaseConfig ? (
                      <div className="p-3 border border-green-600/30 bg-green-900/10 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-xs text-green-400 font-medium">✓ Supabase 연결 설정 완료</p>
                          <p className="text-xs text-obsidian-muted mt-0.5 truncate max-w-[260px]">{settings.supabaseUrl}</p>
                        </div>
                        <button
                          onClick={() => setShowSupabaseConfig(true)}
                          className="text-xs text-obsidian-muted hover:text-obsidian-text px-2 py-1 hover:bg-obsidian-hover rounded transition-colors"
                        >
                          변경
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-obsidian-muted mb-1">Project URL</label>
                          <input 
                            type="url"
                            value={settings.supabaseUrl || ''}
                            onChange={(e) => onUpdateSettings({...settings, supabaseUrl: e.target.value})}
                            placeholder="https://xxxxx.supabase.co"
                            className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-3 py-2 text-sm text-obsidian-text outline-none focus:border-obsidian-accent transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-obsidian-muted mb-1">Anon Key</label>
                          <input 
                            type="password"
                            value={settings.supabaseAnonKey || ''}
                            onChange={(e) => onUpdateSettings({...settings, supabaseAnonKey: e.target.value})}
                            placeholder="eyJhbGciOiJIUzI1NiIs…"
                            className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-3 py-2 text-sm text-obsidian-text outline-none focus:border-obsidian-accent transition-colors"
                          />
                        </div>
                        <p className="text-xs text-obsidian-muted">
                          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-obsidian-accent hover:underline">Supabase Dashboard</a>
                          {' → Project Settings → API에서 확인할 수 있습니다.'}
                        </p>
                        {hasSupabaseConfig && (
                          <button
                            onClick={() => setShowSupabaseConfig(false)}
                            className="text-xs text-obsidian-accent hover:underline"
                          >
                            설정 접기
                          </button>
                        )}
                      </>
                    )}

                    {/* Auth UI */}
                    {hasSupabaseConfig && (
                      <div className="p-4 bg-obsidian-sidebar rounded-xl border border-obsidian-border space-y-3">
                        {syncUser ? (
                          <>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-obsidian-text">{syncUser.email}</p>
                                <p className="text-xs text-green-400">로그인 됨</p>
                              </div>
                              <button
                                onClick={onCloudSignOut}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg transition-colors"
                              >
                                <LogOut size={14} /> 로그아웃
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={onCloudPush}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-obsidian-accent text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                              >
                                <Upload size={14} /> Push (로컬 → 클라우드)
                              </button>
                              <button
                                onClick={onCloudPull}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-obsidian-hover text-obsidian-text rounded-lg text-xs font-medium hover:bg-obsidian-border transition-colors"
                              >
                                <Download size={14} /> Pull (클라우드 → 로컬)
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex gap-2 mb-2">
                              <button
                                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${authMode === 'login' ? 'bg-obsidian-accent text-white' : 'bg-obsidian-hover text-obsidian-muted'}`}
                              >
                                로그인
                              </button>
                              <button
                                onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${authMode === 'signup' ? 'bg-obsidian-accent text-white' : 'bg-obsidian-hover text-obsidian-muted'}`}
                              >
                                회원가입
                              </button>
                            </div>
                            <input
                              type="email"
                              value={authEmail}
                              onChange={(e) => setAuthEmail(e.target.value)}
                              placeholder="이메일"
                              className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-3 py-2 text-sm text-obsidian-text outline-none focus:border-obsidian-accent"
                            />
                            <input
                              type="password"
                              value={authPassword}
                              onChange={(e) => setAuthPassword(e.target.value)}
                              placeholder="비밀번호 (6자 이상)"
                              className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-3 py-2 text-sm text-obsidian-text outline-none focus:border-obsidian-accent"
                              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                            />
                            {authError && (
                              <p className="text-xs text-red-400">{authError}</p>
                            )}
                            <button
                              onClick={handleAuth}
                              disabled={authLoading}
                              className="w-full flex items-center justify-center gap-2 py-2 bg-obsidian-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                              {authLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                              {authMode === 'login' ? '로그인' : '회원가입'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-obsidian-accent text-white' : 'text-obsidian-muted hover:text-obsidian-text hover:bg-obsidian-hover'}`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const ThemeOption = ({ id, name, active, onClick, color, accent }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${active ? 'border-obsidian-accent bg-obsidian-accent/10 ring-1 ring-obsidian-accent' : 'border-obsidian-border hover:bg-obsidian-hover'}`}
  >
    <div className="w-8 h-8 rounded-full border border-white/10 shadow-sm relative overflow-hidden" style={{ backgroundColor: color }}>
      {accent && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-tl-full" style={{ backgroundColor: accent }} />}
    </div>
    <span className={`text-sm ${active ? 'text-obsidian-text font-semibold' : 'text-obsidian-muted'}`}>{name}</span>
  </button>
);
