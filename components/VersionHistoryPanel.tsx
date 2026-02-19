import React, { useState, useMemo } from 'react';
import { X, Clock, RotateCcw, Trash2 } from 'lucide-react';
import { VersionSnapshot, getVersions, clearVersions } from '../services/versionHistory';

interface VersionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeName: string;
  onRestore: (content: string) => void;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  isOpen,
  onClose,
  nodeId,
  nodeName,
  onRestore,
}) => {
  const [previewId, setPreviewId] = useState<string | null>(null);

  const versions = useMemo(
    () => getVersions(nodeId).reverse(), // newest first
    [nodeId, isOpen]
  );

  const previewVersion = useMemo(
    () => versions.find(v => v.id === previewId),
    [versions, previewId]
  );

  if (!isOpen) return null;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `오늘 ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `어제 ${time}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="ml-auto w-full max-w-2xl bg-obsidian-sidebar border-l border-obsidian-border flex flex-col h-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-12 border-b border-obsidian-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 text-obsidian-text text-sm font-semibold">
            <Clock size={16} className="text-obsidian-accent" />
            Version History — {nodeName}
          </div>
          <div className="flex items-center gap-2">
            {versions.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('이 노트의 모든 버전 기록을 삭제할까요?')) {
                    clearVersions(nodeId);
                    onClose();
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/30 transition-colors"
              >
                <Trash2 size={12} className="inline mr-1" />
                Clear All
              </button>
            )}
            <button onClick={onClose} className="p-1 text-obsidian-muted hover:text-obsidian-text">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Version List */}
          <div className="w-52 border-r border-obsidian-border overflow-y-auto shrink-0">
            {versions.length === 0 ? (
              <div className="p-4 text-center text-obsidian-muted text-sm">
                <Clock size={24} className="mx-auto mb-2 opacity-30" />
                <p>버전 기록이 없습니다.</p>
                <p className="text-xs mt-1 opacity-60">편집하면 자동으로 저장됩니다.</p>
              </div>
            ) : (
              versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setPreviewId(v.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-obsidian-border text-xs transition-colors ${
                    previewId === v.id
                      ? 'bg-obsidian-accent/20 text-obsidian-accent'
                      : 'text-obsidian-muted hover:bg-obsidian-hover hover:text-obsidian-text'
                  }`}
                >
                  <div className="font-medium">{formatTime(v.timestamp)}</div>
                  <div className="truncate opacity-60 mt-0.5">
                    {v.content.substring(0, 60) || '(empty)'}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Preview Pane */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {previewVersion ? (
              <>
                <div className="p-4 flex-1 overflow-y-auto">
                  <pre className="text-sm text-obsidian-text whitespace-pre-wrap font-sans leading-relaxed">
                    {previewVersion.content}
                  </pre>
                </div>
                <div className="p-3 border-t border-obsidian-border shrink-0">
                  <button
                    onClick={() => {
                      onRestore(previewVersion.content);
                      onClose();
                    }}
                    className="w-full py-2 bg-obsidian-accent text-white rounded-lg text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2 transition-colors"
                  >
                    <RotateCcw size={14} />
                    이 버전으로 복원
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-obsidian-muted text-sm">
                왼쪽에서 버전을 선택하세요
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
