import React, { useState, useMemo } from 'react';
import { X, Clock, RotateCcw, Trash2 } from 'lucide-react';
import { VersionSnapshot, getVersions, clearVersions } from '../services/versionHistory';

interface VersionHistoryPanelProps {
  isOpen: boolean; onClose: () => void; nodeId: string; nodeName: string; onRestore: (content: string) => void;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({ isOpen, onClose, nodeId, nodeName, onRestore }) => {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const versions = useMemo(() => getVersions(nodeId).reverse(), [nodeId, isOpen]);
  const previewVersion = useMemo(() => versions.find(v => v.id === previewId), [versions, previewId]);

  if (!isOpen) return null;

  const fmt = (ts: number) => {
    const d = new Date(ts), now = new Date();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return '오늘 ' + time;
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return '어제 ' + time;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + time;
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="ml-auto w-full max-w-2xl flex flex-col h-full" style={{ background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-color)', boxShadow: 'var(--shadow-elevated)' }} onClick={e => e.stopPropagation()}>
        <div className="h-11 flex items-center justify-between px-4 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
            <Clock size={15} style={{ color: 'var(--bg-accent)' }} /> 버전 기록  {nodeName}
          </div>
          <div className="flex items-center gap-2">
            {versions.length > 0 && (
              <button onClick={() => { if (window.confirm('모든 버전 기록을 삭제할까요?')) { clearVersions(nodeId); onClose(); } }}
                className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors">
                <Trash2 size={11} className="inline mr-1" /> 전체 삭제
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}><X size={17} /></button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 overflow-y-auto shrink-0" style={{ borderRight: '1px solid var(--border-color)' }}>
            {versions.length === 0 ? (
              <div className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                <Clock size={22} className="mx-auto mb-2" style={{ opacity: 0.25 }} />
                <p>기록이 없습니다</p>
                <p className="text-xs mt-1" style={{ opacity: 0.5 }}>편집 시 자동 저장됩니다</p>
              </div>
            ) : versions.map(v => (
              <button key={v.id} onClick={() => setPreviewId(v.id)}
                className="w-full text-left px-3 py-2.5 text-xs transition-colors duration-100"
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  background: previewId === v.id ? 'var(--bg-hover)' : 'transparent',
                  color: previewId === v.id ? 'var(--bg-accent)' : 'var(--text-muted)',
                  fontWeight: previewId === v.id ? 500 : 400,
                }}>
                <div>{fmt(v.timestamp)}</div>
                <div className="truncate mt-0.5" style={{ opacity: 0.5 }}>{v.content.substring(0, 50) || '(빈 문서)'}</div>
              </button>
            ))}
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            {previewVersion ? (<>
              <div className="p-4 flex-1 overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-main)' }}>{previewVersion.content}</pre>
              </div>
              <div className="p-3 shrink-0" style={{ borderTop: '1px solid var(--border-color)' }}>
                <button onClick={() => { onRestore(previewVersion.content); onClose(); }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                  style={{ background: 'var(--bg-accent)', color: '#fff' }}>
                  <RotateCcw size={14} /> 이 버전으로 복원
                </button>
              </div>
            </>) : (
              <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>왼쪽에서 버전을 선택하세요</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
