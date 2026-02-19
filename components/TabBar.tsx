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

export const TabBar: React.FC<TabBarProps> = ({
  openTabs,
  activeTabId,
  nodes,
  onSelectTab,
  onCloseTab,
}) => {
  if (openTabs.length === 0) return null;

  return (
    <div className="h-9 bg-obsidian-sidebar border-b border-obsidian-border flex items-end overflow-x-auto scrollbar-hide shrink-0">
      {openTabs.map((tabId) => {
        const node = nodes.find(n => n.id === tabId);
        if (!node) return null;
        const isActive = tabId === activeTabId;
        return (
          <div
            key={tabId}
            className={`group flex items-center gap-1.5 px-3 h-8 text-xs cursor-pointer border-r border-obsidian-border shrink-0 max-w-[160px] transition-colors ${
              isActive
                ? 'bg-obsidian-bg text-obsidian-text border-t-2 border-t-obsidian-accent'
                : 'bg-obsidian-sidebar text-obsidian-muted hover:bg-obsidian-hover border-t-2 border-t-transparent'
            }`}
            onClick={() => onSelectTab(tabId)}
          >
            <FileText size={12} className={isActive ? 'text-blue-400' : 'text-obsidian-muted'} />
            <span className="truncate flex-1">{node.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tabId);
              }}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-obsidian-hover transition-all"
              aria-label={`Close ${node.name}`}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
