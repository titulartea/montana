import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, FileText, X } from 'lucide-react';
import { FileSystemNode, NodeType } from '../types';

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: FileSystemNode[];
  onSelectNode: (id: string) => void;
}

export const SearchPalette: React.FC<SearchPaletteProps> = ({ isOpen, onClose, nodes, onSelectNode }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isOpen) { setQuery(''); setSelectedIndex(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [isOpen]);

  const results = useMemo(() => {
    const files = nodes.filter(n => n.type === NodeType.FILE);
    if (!query.trim()) return files.slice(0, 12);
    const q = query.toLowerCase();
    return files.filter(n => n.name.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q))).slice(0, 20);
  }, [query, nodes]);

  useEffect(() => { setSelectedIndex(0); }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[selectedIndex]) { onSelectNode(results[selectedIndex].id); onClose(); }
    else if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-md" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-elevated)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <Search size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="노트 검색" className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--text-main)' }} />
          <kbd className="hidden sm:inline-block text-[10px] rounded px-1.5 py-0.5" style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)', border: '1px solid var(--border-color)' }}>ESC</kbd>
          <button onClick={onClose} className="sm:hidden p-1" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div className="max-h-72 overflow-y-auto py-1" role="listbox">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>결과 없음</div>
          ) : results.map((node, i) => {
            const parent = nodes.find(n => n.id === node.parentId);
            return (
              <button key={node.id} role="option" aria-selected={i === selectedIndex}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors duration-100"
                style={{ background: i === selectedIndex ? 'var(--bg-accent)' : 'transparent', color: i === selectedIndex ? '#fff' : 'var(--text-main)' }}
                onClick={() => { onSelectNode(node.id); onClose(); }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <FileText size={14} style={{ color: i === selectedIndex ? '#fff' : 'var(--bg-accent)', opacity: 0.8 }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{node.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {parent && <span className="text-[10px] truncate" style={{ opacity: i === selectedIndex ? 0.7 : 0.5 }}>{parent.name}</span>}
                    {node.content && query.trim() && <span className="text-xs truncate" style={{ opacity: 0.4 }}>{getSnippet(node.content, query)}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 text-[10px] flex gap-4" style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
          <span> 이동</span><span> 열기</span><span>Esc 닫기</span>
        </div>
      </div>
    </div>
  );
};

function getSnippet(content: string, query: string): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return content.substring(0, 60);
  const s = Math.max(0, idx - 20), e = Math.min(content.length, idx + query.length + 30);
  return (s > 0 ? '' : '') + content.substring(s, e) + (e < content.length ? '' : '');
}
