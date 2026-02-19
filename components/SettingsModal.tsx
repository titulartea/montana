import React from 'react';
import { X, Cloud, Monitor, LogIn, LogOut, Upload, Download, HardDrive, Unplug, Loader2, Sun, Moon, Laptop, Stars, Leaf, BookOpen } from 'lucide-react';
import { AppSettings, Theme, SyncUser } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  syncUser: SyncUser | null;
  onCloudSignIn: (email: string, password: string) => Promise<string | null>;
  onCloudSignUp: (email: string, password: string) => Promise<string | null>;
  onCloudSignOut: () => void;
  onCloudPush: () => void;
  onCloudPull: () => void;
  localSyncFolder: string | null;
  onDisconnectLocal: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, settings, onUpdateSettings,
  syncUser, onCloudSignIn, onCloudSignUp, onCloudSignOut, onCloudPush, onCloudPull,
  localSyncFolder, onDisconnectLocal,
}) => {
  const [authEmail, setAuthEmail] = React.useState('');
  const [authPassword, setAuthPassword] = React.useState('');
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<'login' | 'signup'>('login');
  const [showSupabaseConfig, setShowSupabaseConfig] = React.useState(false);

  if (!isOpen) return null;

  const handleAuth = async () => {
    if (!authEmail || !authPassword) { setAuthError('이메일과 비밀번호를 입력하세요.'); return; }
    setAuthLoading(true); setAuthError(null);
    const err = authMode === 'login' ? await onCloudSignIn(authEmail, authPassword) : await onCloudSignUp(authEmail, authPassword);
    setAuthLoading(false);
    if (err) setAuthError(err); else { setAuthEmail(''); setAuthPassword(''); }
  };

  const hasSupabaseConfig = !!(settings.supabaseUrl && settings.supabaseAnonKey);
  const set = (partial: Partial<AppSettings>) => onUpdateSettings({ ...settings, ...partial });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-sidebar)] w-full max-w-md rounded-2xl shadow-[var(--shadow-elevated)] border border-[var(--border-color)] flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-main)]">설정</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-8">

          {/*  Appearance  */}
          <Section title="모양">
            <div className="grid grid-cols-3 gap-2">
              <ThemeBtn icon={<Sun size={18}/>} label="라이트" active={settings.theme === 'light'} onClick={() => set({ theme: 'light' })} />
              <ThemeBtn icon={<Moon size={18}/>} label="다크" active={settings.theme === 'dark'} onClick={() => set({ theme: 'dark' })} />
              <ThemeBtn icon={<Laptop size={18}/>} label="시스템" active={settings.theme === 'system'} onClick={() => set({ theme: 'system' })} />
              <ThemeBtn icon={<Stars size={18}/>} label="미드나잇" active={settings.theme === 'midnight'} onClick={() => set({ theme: 'midnight' })} />
              <ThemeBtn icon={<BookOpen size={18}/>} label="세피아" active={settings.theme === 'sepia'} onClick={() => set({ theme: 'sepia' })} />
              <ThemeBtn icon={<Leaf size={18}/>} label="민트" active={settings.theme === 'mint'} onClick={() => set({ theme: 'mint' })} />
            </div>
          </Section>

          {/*  Font Size  */}
          <Section title={`글꼴 크기 (${settings.fontSize}px)`}>
            <input
              type="range" min="13" max="22" value={settings.fontSize}
              onChange={e => set({ fontSize: parseInt(e.target.value) })}
              className="w-full h-1 bg-[var(--border-color)] rounded-full appearance-none cursor-pointer accent-[var(--bg-accent)]"
            />
          </Section>

          {/*  Local Sync  */}
          {localSyncFolder && (
            <Section title="로컬 동기화">
              <div className="flex items-center justify-between p-3 bg-green-500/8 border border-green-500/20 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <HardDrive size={16} className="text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-main)]">{localSyncFolder}</p>
                    <p className="text-xs text-green-500">동기화 활성</p>
                  </div>
                </div>
                <button onClick={onDisconnectLocal} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Unplug size={14} />
                </button>
              </div>
            </Section>
          )}

          {/*  Cloud Sync  */}
          <Section title="클라우드 동기화">
            {/* Storage mode toggle */}
            <div className="flex gap-2 mb-4">
              <ModeBtn icon={<Monitor size={16}/>} label="로컬" active={settings.storageMode === 'local'} onClick={() => set({ storageMode: 'local' })} />
              <ModeBtn icon={<Cloud size={16}/>} label="클라우드" active={settings.storageMode === 'cloud'} onClick={() => set({ storageMode: 'cloud' })} />
            </div>

            {settings.storageMode === 'cloud' && (
              <div className="space-y-3">
                {/* Supabase config */}
                {hasSupabaseConfig && !showSupabaseConfig ? (
                  <div className="flex items-center justify-between p-3 bg-green-500/8 border border-green-500/20 rounded-xl">
                    <p className="text-xs text-green-500 font-medium"> Supabase 연결됨</p>
                    <button onClick={() => setShowSupabaseConfig(true)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">변경</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input value={settings.supabaseUrl || ''} onChange={v => set({ supabaseUrl: v })} placeholder="https://xxxxx.supabase.co" label="Project URL" />
                    <Input value={settings.supabaseAnonKey || ''} onChange={v => set({ supabaseAnonKey: v })} placeholder="anon key" label="Anon Key" type="password" />
                    {hasSupabaseConfig && <button onClick={() => setShowSupabaseConfig(false)} className="text-xs text-[var(--bg-accent)]">접기</button>}
                  </div>
                )}

                {/* Auth */}
                {hasSupabaseConfig && (
                  <div className="p-4 bg-[var(--bg-main)] rounded-xl border border-[var(--border-color)] space-y-3">
                    {syncUser ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[var(--text-main)]">{syncUser.email}</p>
                            <p className="text-xs text-green-500">로그인 됨</p>
                          </div>
                          <button onClick={onCloudSignOut} className="text-xs text-red-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors flex items-center gap-1">
                            <LogOut size={12}/> 로그아웃
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={onCloudPush} className="flex-1 py-2 bg-[var(--bg-accent)] text-white rounded-lg text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1.5">
                            <Upload size={13}/> Push
                          </button>
                          <button onClick={onCloudPull} className="flex-1 py-2 bg-[var(--bg-hover)] text-[var(--text-main)] rounded-lg text-xs font-medium hover:bg-[var(--border-color)] flex items-center justify-center gap-1.5 transition-colors">
                            <Download size={13}/> Pull
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex bg-[var(--bg-hover)] rounded-lg p-0.5">
                          <button onClick={() => { setAuthMode('login'); setAuthError(null); }} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${authMode === 'login' ? 'bg-[var(--bg-main)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)]'}`}>로그인</button>
                          <button onClick={() => { setAuthMode('signup'); setAuthError(null); }} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${authMode === 'signup' ? 'bg-[var(--bg-main)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)]'}`}>회원가입</button>
                        </div>
                        <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="이메일" className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--bg-accent)] transition-colors" />
                        <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="비밀번호" className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--bg-accent)] transition-colors" onKeyDown={e => e.key === 'Enter' && handleAuth()} />
                        {authError && <p className="text-xs text-red-400">{authError}</p>}
                        <button onClick={handleAuth} disabled={authLoading} className="w-full py-2.5 bg-[var(--bg-accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity">
                          {authLoading ? <Loader2 size={14} className="animate-spin"/> : <LogIn size={14}/>}
                          {authMode === 'login' ? '로그인' : '회원가입'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </Section>

        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">{title}</h3>
    {children}
  </div>
);

const ThemeBtn = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${active ? 'border-[var(--bg-accent)] bg-[var(--bg-accent)]/8 text-[var(--bg-accent)]' : 'border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}
  >
    {icon}
    {label}
  </button>
);

const ModeBtn = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-medium transition-all ${active ? 'border-[var(--bg-accent)] bg-[var(--bg-accent)]/8 text-[var(--bg-accent)]' : 'border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}
  >
    {icon} {label}
  </button>
);

const Input = ({ value, onChange, placeholder, label, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; type?: string }) => (
  <div>
    <label className="block text-[11px] text-[var(--text-muted)] mb-1">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--bg-accent)] transition-colors" />
  </div>
);
