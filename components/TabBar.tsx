import React from 'react';
import { X, FileText } from 'lucide-react';
import { FileSystemNode } from '../types';

interface TabBarProps {
  openTabs: string[];
  activeTabId: string | null;
  nodes: FileSystemNode[];
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ openTabs, activeTabId, nodes, onSelectTab, onCloseTab }) => {
  if (openTabs.length === 0) return null;
  return (
    <div className="h-9 flex items-end overflow-x-auto scrollbar-hide shrink-0" style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
      {openTabs.map(tabId => {
        const node = nodes.find(n => n.id === tabId);
        if (!node) return null;
        const isActive = tabId === activeTabId;
        return (
          <div key={tabId}
            className="group flex items-center gap-1.5 px-3 h-8 text-[12px] cursor-pointer shrink-0 max-w-[160px] transition-all duration-150"
            style={{
              background: isActive ? 'var(--bg-main)' : 'transparent',
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              borderBottom: isActive ? '2px solid var(--bg-accent)' : '2px solid transparent',
              fontWeight: isActive ? 500 : 400,
            }}
            onClick={() => onSelectTab(tabId)}
          >
            <FileText size={12} style={{ color: isActive ? 'var(--bg-accent)' : 'var(--text-muted)', opacity: 0.7 }} />
            <span className="truncate flex-1">{node.name}</span>
            <button
              onClick={e => { e.stopPropagation(); onCloseTab(tabId); }}
              className="p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-hover)]"
              aria-label={'닫기 ' + node.name}
            ><X size={10} /></button>
          </div>
        );
      })}
    </div>
  );
};
