import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, FileText, X } from 'lucide-react';
import { FileSystemNode, NodeType } from '../types';

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: FileSystemNode[];
  onSelectNode: (id: string) => void;
}

export const SearchPalette: React.FC<SearchPaletteProps> = ({
  isOpen,
  onClose,
  nodes,
  onSelectNode,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const files = nodes.filter(n => n.type === NodeType.FILE);
    if (!query.trim()) return files.slice(0, 12);
    const q = query.toLowerCase();
    return files
      .filter(n =>
        n.name.toLowerCase().includes(q) ||
        (n.content && n.content.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [query, nodes]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      onSelectNode(results[selectedIndex].id);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quick search"
    >
      <div
        className="w-full max-w-lg bg-obsidian-sidebar border border-obsidian-border rounded-xl shadow-2xl overflow-hidden mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-obsidian-border">
          <Search size={18} className="text-obsidian-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes by name or content…"
            className="flex-1 bg-transparent text-obsidian-text outline-none text-sm placeholder:text-obsidian-muted/50"
            aria-label="Search notes"
          />
          <kbd className="hidden sm:inline-block text-[10px] text-obsidian-muted bg-obsidian-bg border border-obsidian-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
          <button onClick={onClose} className="sm:hidden p-1 text-obsidian-muted hover:text-obsidian-text">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1" role="listbox">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-obsidian-muted text-sm">
              No results found
            </div>
          ) : (
            results.map((node, i) => {
              const parentNode = nodes.find(n => n.id === node.parentId);
              return (
                <button
                  key={node.id}
                  role="option"
                  aria-selected={i === selectedIndex}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                    i === selectedIndex
                      ? 'bg-obsidian-accent text-white'
                      : 'text-obsidian-text hover:bg-obsidian-hover'
                  }`}
                  onClick={() => {
                    onSelectNode(node.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <FileText size={14} className={i === selectedIndex ? 'text-white' : 'text-blue-400'} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{node.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {parentNode && (
                        <span className={`text-[10px] truncate ${i === selectedIndex ? 'text-white/70' : 'text-obsidian-muted'}`}>
                          {parentNode.name}
                        </span>
                      )}
                      {node.content && query.trim() && (
                        <span className={`text-xs truncate ${i === selectedIndex ? 'text-white/60' : 'text-obsidian-muted/60'}`}>
                          {getContentSnippet(node.content, query)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-obsidian-border text-[10px] text-obsidian-muted flex gap-4">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
};

function getContentSnippet(content: string, query: string): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return content.substring(0, 60);
  const start = Math.max(0, idx - 20);
  const end = Math.min(content.length, idx + query.length + 30);
  return (start > 0 ? '…' : '') + content.substring(start, end) + (end < content.length ? '…' : '');
}
