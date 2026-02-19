import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Folder, 
  FolderOpen, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Plus,
  GripVertical
} from 'lucide-react';
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
  node,
  allNodes,
  activeNodeId,
  level,
  onToggleFolder,
  onSelectNode,
  onCreateNode,
  onDeleteNode,
  onRenameNode,
  onMoveNode
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [showMenu, setShowMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = activeNodeId === node.id;
  const childNodes = allNodes.filter(n => n.parentId === node.id);
  // Sort: Folders first, then files, alphabetically
  childNodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === NodeType.FOLDER ? -1 : 1;
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    if (renameValue.trim()) {
      onRenameNode(node.id, renameValue.trim());
    } else {
      setRenameValue(node.name); // Revert if empty
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') {
      setRenameValue(node.name);
      setIsRenaming(false);
    }
  };

  return (
    <div className="select-none text-sm">
      <div 
        role="treeitem"
        aria-selected={isActive}
        aria-expanded={node.type === NodeType.FOLDER ? node.isOpen : undefined}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', node.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (node.type === NodeType.FOLDER) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const draggedId = e.dataTransfer.getData('text/plain');
          if (draggedId && draggedId !== node.id) {
            // Drop into folder or alongside file
            if (node.type === NodeType.FOLDER) {
              onMoveNode(draggedId, node.id);
              if (!node.isOpen) onToggleFolder(node.id);
            } else {
              onMoveNode(draggedId, node.parentId);
            }
          }
        }}
        className={`
          group flex items-center py-1 px-2 cursor-pointer transition-colors
          ${isActive ? 'bg-obsidian-accent text-white' : 'text-obsidian-text hover:bg-obsidian-hover'}
          ${dragOver ? 'ring-2 ring-obsidian-accent ring-inset bg-obsidian-accent/10' : ''}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (node.type === NodeType.FOLDER) {
            onToggleFolder(node.id);
          } else {
            onSelectNode(node.id);
          }
        }}
      >
        <span className="mr-1 opacity-70">
          {node.type === NodeType.FOLDER ? (
            node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="w-[14px] inline-block" /> 
          )}
        </span>

        <span className="mr-2 opacity-80">
          {node.type === NodeType.FOLDER ? (
            node.isOpen ? <FolderOpen size={16} className="text-yellow-500"/> : <Folder size={16} className="text-yellow-500"/>
          ) : (
            <FileText size={16} className="text-blue-400" />
          )}
        </span>

        <div className="flex-1 truncate relative">
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              className="w-full bg-obsidian-bg text-white px-1 border border-obsidian-accent outline-none rounded"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span>{node.name}</span>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center relative" onClick={e => e.stopPropagation()}>
          <button 
            className="p-1 hover:bg-black/20 rounded"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical size={14} />
          </button>
          
          {showMenu && (
            <div 
              ref={menuRef}
              className="absolute right-0 top-6 w-32 bg-obsidian-sidebar border border-obsidian-border shadow-xl rounded z-50 text-xs py-1"
            >
              <button 
                className="w-full text-left px-3 py-2 hover:bg-obsidian-hover flex items-center gap-2"
                onClick={() => {
                  setIsRenaming(true);
                  setShowMenu(false);
                }}
              >
                <Edit2 size={12} /> Rename
              </button>
              {node.type === NodeType.FOLDER && (
                <>
                  <button 
                    className="w-full text-left px-3 py-2 hover:bg-obsidian-hover flex items-center gap-2"
                    onClick={() => {
                      onCreateNode(node.id, NodeType.FILE);
                      setShowMenu(false);
                      if (!node.isOpen) onToggleFolder(node.id);
                    }}
                  >
                    <Plus size={12} /> New File
                  </button>
                  <button 
                    className="w-full text-left px-3 py-2 hover:bg-obsidian-hover flex items-center gap-2"
                    onClick={() => {
                      onCreateNode(node.id, NodeType.FOLDER);
                      setShowMenu(false);
                      if (!node.isOpen) onToggleFolder(node.id);
                    }}
                  >
                    <Folder size={12} /> New Folder
                  </button>
                </>
              )}
              <div className="h-px bg-obsidian-border my-1" />
              <button 
                className="w-full text-left px-3 py-2 hover:bg-red-900/50 text-red-400 flex items-center gap-2"
                onClick={() => {
                  if (window.confirm(`"${node.name}" 을(를) 삭제하시겠습니까?`)) {
                    onDeleteNode(node.id);
                  }
                  setShowMenu(false);
                }}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {node.type === NodeType.FOLDER && node.isOpen && (
        <div>
          {childNodes.map(child => (
            <FileSystemItem
              key={child.id}
              node={child}
              allNodes={allNodes}
              activeNodeId={activeNodeId}
              level={level + 1}
              onToggleFolder={onToggleFolder}
              onSelectNode={onSelectNode}
              onCreateNode={onCreateNode}
              onDeleteNode={onDeleteNode}
              onRenameNode={onRenameNode}
              onMoveNode={onMoveNode}
            />
          ))}
          {childNodes.length === 0 && (
            <div 
              className="text-obsidian-muted italic pl-4 py-1 text-xs opacity-50"
              style={{ paddingLeft: `${(level + 1) * 12 + 24}px` }}
            >
              Empty
            </div>
          )}
        </div>
      )}
    </div>
  );
};