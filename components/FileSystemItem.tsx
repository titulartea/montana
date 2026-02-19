import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, MoreHorizontal, Edit2, Trash2, Plus } from 'lucide-react';
import { FileSystemNode, NodeType } from '../types';

interface FileSystemItemProps {
  node: FileSystemNode;
  allNodes: FileSystemNode[];
  activeNodeId: string | null;
  level: number;
  onToggleFolder: (id: string) => void;
  onSelectNode: (id: string) => void;
  onCreateNode: (parentId: string, type: NodeType) => void;
  onDeleteNode: (id: string) => void;
  onRenameNode: (id: string, newName: string) => void;
  onMoveNode: (nodeId: string, newParentId: string | null) => void;
}

export const FileSystemItem: React.FC<FileSystemItemProps> = ({
  node, allNodes, activeNodeId, level,
  onToggleFolder, onSelectNode, onCreateNode, onDeleteNode, onRenameNode, onMoveNode,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [showMenu, setShowMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = activeNodeId === node.id;
  const childNodes = allNodes.filter(n => n.parentId === node.id).sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === NodeType.FOLDER ? -1 : 1;
  });

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { if (isRenaming && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isRenaming]);

  const handleRenameSubmit = () => {
    if (renameValue.trim()) onRenameNode(node.id, renameValue.trim());
    else setRenameValue(node.name);
    setIsRenaming(false);
  };

  return (
    <div className="select-none text-[13px]">
      <div
        role="treeitem" aria-selected={isActive}
        aria-expanded={node.type === NodeType.FOLDER ? node.isOpen : undefined}
        draggable
        onDragStart={e => { e.dataTransfer.setData('text/plain', node.id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragOver={e => { e.preventDefault(); if (node.type === NodeType.FOLDER) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault(); e.stopPropagation(); setDragOver(false);
          const did = e.dataTransfer.getData('text/plain');
          if (did && did !== node.id) { node.type === NodeType.FOLDER ? (onMoveNode(did, node.id), !node.isOpen && onToggleFolder(node.id)) : onMoveNode(did, node.parentId); }
        }}
        className="group flex items-center py-[5px] px-2 cursor-pointer rounded-lg mx-1 my-[1px] transition-all duration-150"
        style={{
          paddingLeft: level * 14 + 8 + 'px',
          background: isActive ? 'var(--bg-accent)' : dragOver ? 'var(--bg-accent)' : 'transparent',
          color: isActive ? '#fff' : 'var(--text-main)',
          opacity: dragOver && !isActive ? 0.7 : 1,
          boxShadow: isActive ? 'var(--shadow-subtle)' : 'none',
        }}
        onClick={() => node.type === NodeType.FOLDER ? onToggleFolder(node.id) : onSelectNode(node.id)}
      >
        <span className="mr-1" style={{ opacity: 0.5 }}>
          {node.type === NodeType.FOLDER ? (node.isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span className="w-[13px] inline-block" />}
        </span>
        <span className="mr-2" style={{ opacity: 0.7 }}>
          {node.type === NodeType.FOLDER ? (node.isOpen ? <FolderOpen size={15} /> : <Folder size={15} />) : <FileText size={15} style={{ color: isActive ? '#fff' : 'var(--bg-accent)' }} />}
        </span>
        <div className="flex-1 truncate">
          {isRenaming ? (
            <input ref={inputRef} type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') { setRenameValue(node.name); setIsRenaming(false); } }}
              className="w-full px-1.5 py-0.5 rounded text-[13px] outline-none"
              style={{ background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--bg-accent)' }}
              onClick={e => e.stopPropagation()} />
          ) : <span className="leading-snug">{node.name}</span>}
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center relative transition-opacity" onClick={e => e.stopPropagation()}>
          <button className="p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10" onClick={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={13} />
          </button>
          {showMenu && (
            <div ref={menuRef} className="absolute right-0 top-6 w-36 rounded-xl overflow-hidden z-50 text-xs py-1" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-elevated)' }}>
              <button className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-hover)]" style={{color:'var(--text-main)'}} onClick={() => { setIsRenaming(true); setShowMenu(false); }}><Edit2 size={12} /> 이름 변경</button>
              {node.type === NodeType.FOLDER && (<>
                <button className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-hover)]" style={{color:'var(--text-main)'}} onClick={() => { onCreateNode(node.id, NodeType.FILE); setShowMenu(false); if (!node.isOpen) onToggleFolder(node.id); }}><Plus size={12} /> 새 노트</button>
                <button className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-hover)]" style={{color:'var(--text-main)'}} onClick={() => { onCreateNode(node.id, NodeType.FOLDER); setShowMenu(false); if (!node.isOpen) onToggleFolder(node.id); }}><Folder size={12} /> 새 폴더</button>
              </>)}
              <div className="h-px mx-2 my-1" style={{ background: 'var(--border-color)' }} />
              <button className="w-full text-left px-3 py-2 flex items-center gap-2 text-red-500 hover:bg-red-500/10" onClick={() => { if (window.confirm('"' + node.name + '" 을(를) 삭제할까요?')) onDeleteNode(node.id); setShowMenu(false); }}><Trash2 size={12} /> 삭제</button>
            </div>
          )}
        </div>
      </div>
      {node.type === NodeType.FOLDER && node.isOpen && (
        <div>
          {childNodes.map(child => (
            <FileSystemItem key={child.id} node={child} allNodes={allNodes} activeNodeId={activeNodeId} level={level + 1}
              onToggleFolder={onToggleFolder} onSelectNode={onSelectNode} onCreateNode={onCreateNode}
              onDeleteNode={onDeleteNode} onRenameNode={onRenameNode} onMoveNode={onMoveNode} />
          ))}
          {childNodes.length === 0 && <div className="text-xs italic py-1" style={{ paddingLeft: (level + 1) * 14 + 24 + 'px', color: 'var(--text-muted)', opacity: 0.4 }}>비어있음</div>}
        </div>
      )}
    </div>
  );
};
