import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileSystemNode, NodeType } from '../types';
import { 
  Eye, EyeOff, Save, Sparkles, Download, Menu, 
  Bold, Italic, List, CheckSquare, Link as LinkIcon, Heading, Quote, Strikethrough,
  Clock, FileDown, FileArchive, Image as ImageIcon
} from 'lucide-react';
import { suggestTitle } from '../services/geminiService';
import { exportAsHTML } from '../services/exportService';

// Import Editor and Prism for highlighting
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown.js';

interface MarkdownEditorProps {
  activeNode: FileSystemNode | undefined;
  onUpdateContent: (id: string, content: string) => void;
  onRenameNode: (id: string, name: string) => void;
  onRequestAI: () => void;
  onToggleSidebar: () => void;
  fontSize: number;
  apiKey: string;
  allNodes: FileSystemNode[];
  onNavigateToNote: (noteId: string) => void;
  onOpenVersionHistory: () => void;
  onExportZip: () => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ 
  activeNode, 
  onUpdateContent,
  onRenameNode,
  onRequestAI,
  onToggleSidebar,
  fontSize,
  apiKey,
  allNodes,
  onNavigateToNote,
  onOpenVersionHistory,
  onExportZip,
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cursorOffset, setCursorOffset] = useState(0);

  // Auto-save simulation effect
  useEffect(() => {
    if (activeNode) {
      setIsSaving(true);
      const timer = setTimeout(() => setIsSaving(false), 800);
      return () => clearTimeout(timer);
    }
  }, [activeNode?.content]);

  // Helper to calculate text length of a Prism Token tree
  const getTokenLength = (token: Prism.Token | string): number => {
    if (typeof token === 'string') {
      return token.length;
    } else if (Array.isArray(token.content)) {
      return token.content.reduce((acc, t) => acc + getTokenLength(t), 0);
    } else {
      return getTokenLength(token.content);
    }
  };

  // Custom Highlighter that is aware of cursor position
  const highlightWithCursor = useCallback((code: string) => {
    // 1. Tokenize the code
    const tokens = Prism.tokenize(code, Prism.languages.markdown);
    
    let currentPos = 0;

    // 2. Recursive function to render tokens to HTML string
    //    It checks if the current cursor position falls within the range of a token.
    const processToken = (token: Prism.Token | string, forceVisible: boolean = false): string => {
      if (typeof token === 'string') {
        const len = token.length;
        currentPos += len;
        // Escape HTML entities in the string content
        return Prism.util.encode(token);
      }

      const type = token.type;
      const content = token.content;
      const alias = token.alias || '';
      
      const tokenLen = getTokenLength(token);
      const start = currentPos;
      const end = currentPos + tokenLen;

      // 3. Check if cursor is inside this block (inclusive of edges)
      const isCursorInside = (cursorOffset >= start && cursorOffset <= end);
      
      // 4. Define formatting blocks that we care about hiding/showing
      const formattingTypes = ['bold', 'italic', 'strike', 'url', 'blockquote', 'title', 'code-snippet', 'list'];
      const isFormattingBlock = formattingTypes.includes(type);

      // 5. Determine if we should reveal syntax
      //    Reveal if: We are forced by parent, OR this is a formatting block and cursor is inside.
      const shouldReveal = forceVisible || (isFormattingBlock && isCursorInside);

      // Recurse into children
      let encodedContent = '';
      if (Array.isArray(content)) {
        encodedContent = content.map(child => processToken(child, shouldReveal)).join('');
      } else {
        encodedContent = processToken(content as any, shouldReveal);
      }

      // 6. Apply classes. 'syntax-visible' will trigger CSS to show hidden punctuation.
      const classes = `token ${type} ${alias} ${shouldReveal ? 'syntax-visible' : ''}`;
      
      return `<span class="${classes}">${encodedContent}</span>`;
    };

    return tokens.map(t => processToken(t)).join('');
  }, [cursorOffset]);

  if (!activeNode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-obsidian-muted bg-obsidian-bg h-full p-4 text-center">
        <button onClick={onToggleSidebar} className="md:hidden absolute top-4 left-4 p-2 text-obsidian-text">
            <Menu />
        </button>
        <Sparkles size={48} className="mb-4 opacity-20" />
        <p className="text-lg font-medium">No File Selected</p>
        <p className="text-sm opacity-60 mt-2">Open the sidebar to select or create a note.</p>
      </div>
    );
  }

  const handleMagicTitle = async () => {
    if (!activeNode.content) return;
    const newTitle = await suggestTitle(activeNode.content, apiKey);
    onRenameNode(activeNode.id, newTitle);
  };

  const handleDownload = () => {
    if (!activeNode.content) return;
    const blob = new Blob([activeNode.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNode.name}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportHTML = () => {
    if (!activeNode) return;
    exportAsHTML(activeNode);
  };

  // Image paste handler
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !activeNode) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          if (!base64) return;

          const textarea = document.querySelector('.custom-editor-wrapper textarea') as HTMLTextAreaElement;
          const pos = textarea?.selectionStart || (activeNode.content?.length || 0);
          const text = activeNode.content || '';
          const imgMd = `![image](${base64})`;
          const newText = text.substring(0, pos) + imgMd + text.substring(pos);
          onUpdateContent(activeNode.id, newText);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, [activeNode, onUpdateContent]);

  // Wikilink click handler for preview mode
  const renderWikilinks = useCallback((content: string) => {
    // Replace [[note name]] with clickable links
    return content.replace(/\[\[([^\]]+)\]\]/g, (match, noteName) => {
      const fileNodes = allNodes.filter(n => n.type === NodeType.FILE);
      const target = fileNodes.find(n => n.name.toLowerCase() === noteName.trim().toLowerCase());
      if (target) {
        return `[${noteName}](#wikilink:${target.id})`;
      }
      return `[${noteName}](#wikilink:missing)`;
    });
  }, [allNodes]);

  const applyMarkdown = (prefix: string, suffix: string = '') => {
    if (!activeNode.content && activeNode.content !== '') return;
    const textarea = document.querySelector('.custom-editor-wrapper textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = activeNode.content || '';
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    const newText = `${before}${prefix}${selected}${suffix}${after}`;
    
    onUpdateContent(activeNode.id, newText);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selected.length + suffix.length;
      const targetPos = (start === end) ? start + prefix.length : newCursorPos;
      textarea.setSelectionRange(targetPos, targetPos);
      setCursorOffset(targetPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey)) {
      switch(e.key.toLowerCase()) {
        case 'b': e.preventDefault(); applyMarkdown('**', '**'); break;
        case 'i': e.preventDefault(); applyMarkdown('*', '*'); break;
        case 'k': e.preventDefault(); applyMarkdown('[', '](url)'); break;
        case 'x': if (e.shiftKey) { e.preventDefault(); applyMarkdown('~~', '~~'); } break;
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-bg overflow-hidden transition-colors duration-300 relative group">
      {/* Top Toolbar */}
      <div className="h-14 md:h-12 border-b border-obsidian-border flex items-center px-2 md:px-4 justify-between bg-obsidian-bg/90 backdrop-blur-md z-20 sticky top-0 shrink-0 gap-2">
        <button 
          onClick={onToggleSidebar} 
          className="md:hidden p-2 -ml-2 text-obsidian-muted hover:text-obsidian-text"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input 
            type="text" 
            value={activeNode.name}
            onChange={(e) => onRenameNode(activeNode.id, e.target.value)}
            className="bg-transparent text-base md:text-lg font-semibold text-obsidian-text outline-none w-full truncate placeholder-obsidian-muted/50 font-sans"
            placeholder="Untitled Note"
            style={{ fontFamily: 'Pretendard, sans-serif' }}
          />
        </div>
        
        <div className="flex items-center gap-1">
          <span className={`hidden md:inline-flex text-[10px] uppercase tracking-wider items-center mr-2 transition-opacity duration-500 ${isSaving ? 'opacity-100 text-obsidian-accent' : 'opacity-0'}`}>
            <Save size={10} className="inline mr-1" />
            Saved
          </span>
          <button 
            onClick={onOpenVersionHistory}
            className="p-2 hover:bg-obsidian-hover rounded-lg text-obsidian-muted hover:text-obsidian-text transition-colors hidden sm:block"
            title="Version History"
          >
            <Clock size={18} />
          </button>
          <button 
            onClick={handleDownload}
            className="p-2 hover:bg-obsidian-hover rounded-lg text-obsidian-muted hover:text-obsidian-text transition-colors hidden sm:block"
            title="Download MD"
          >
            <Download size={18} />
          </button>
          <button 
            onClick={handleExportHTML}
            className="p-2 hover:bg-obsidian-hover rounded-lg text-obsidian-muted hover:text-obsidian-text transition-colors hidden sm:block"
            title="Export HTML"
          >
            <FileDown size={18} />
          </button>
          <button 
            onClick={onExportZip}
            className="p-2 hover:bg-obsidian-hover rounded-lg text-obsidian-muted hover:text-obsidian-text transition-colors hidden sm:block"
            title="Export All as ZIP"
          >
            <FileArchive size={18} />
          </button>
          <button 
            onClick={handleMagicTitle}
            className="p-2 hover:bg-obsidian-hover rounded-lg text-obsidian-muted hover:text-yellow-400 transition-colors"
            title="AI Title"
          >
            <Sparkles size={18} />
          </button>
          <button 
            onClick={() => setIsPreview(!isPreview)}
            className="p-2 hover:bg-obsidian-hover rounded-lg text-obsidian-muted hover:text-obsidian-text transition-colors"
            title={isPreview ? "Edit Mode" : "Preview Mode"}
          >
            {isPreview ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Editor/Preview Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {isPreview ? (
          <div 
            className="flex-1 overflow-y-auto p-4 md:p-8 prose prose-invert prose-slate max-w-none text-obsidian-text pb-20 md:pb-8" 
            style={{ fontFamily: 'Pretendard, sans-serif', fontSize: `${fontSize}px` }}
            onClick={(e) => {
              // Handle wikilink clicks
              const target = e.target as HTMLAnchorElement;
              if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('#wikilink:')) {
                e.preventDefault();
                const id = target.getAttribute('href')!.replace('#wikilink:', '');
                if (id !== 'missing') onNavigateToNote(id);
              }
            }}
          >
            <ReactMarkdown>{renderWikilinks(activeNode.content || '')}</ReactMarkdown>
          </div>
        ) : (
          <>
            {/* Formatting Toolbar */}
            <div className="h-10 border-b border-obsidian-border bg-obsidian-hover/30 flex items-center px-4 gap-1 overflow-x-auto scrollbar-hide shrink-0">
               <FormatButton icon={<Bold size={14}/>} onClick={() => applyMarkdown('**', '**')} tooltip="Bold (Ctrl+B)" />
               <FormatButton icon={<Italic size={14}/>} onClick={() => applyMarkdown('*', '*')} tooltip="Italic (Ctrl+I)" />
               <FormatButton icon={<Strikethrough size={14}/>} onClick={() => applyMarkdown('~~', '~~')} tooltip="Strikethrough" />
               <div className="w-px h-4 bg-obsidian-border mx-1" />
               <FormatButton icon={<Heading size={14}/>} onClick={() => applyMarkdown('### ')} tooltip="Heading" />
               <FormatButton icon={<Quote size={14}/>} onClick={() => applyMarkdown('> ')} tooltip="Quote" />
               <div className="w-px h-4 bg-obsidian-border mx-1" />
               <FormatButton icon={<List size={14}/>} onClick={() => applyMarkdown('- ')} tooltip="Bullet List" />
               <FormatButton icon={<CheckSquare size={14}/>} onClick={() => applyMarkdown('- [ ] ')} tooltip="Checkbox" />
               <FormatButton icon={<LinkIcon size={14}/>} onClick={() => applyMarkdown('[', '](url)')} tooltip="Link" />
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-editor-wrapper pb-20 md:pb-8" onClick={() => {
                document.querySelector('textarea')?.focus();
            }}>
              <div onKeyDown={handleKeyDown} onPaste={handlePaste} className="h-full">
                <Editor
                    value={activeNode.content || ''}
                    onValueChange={code => onUpdateContent(activeNode.id, code)}
                    highlight={highlightWithCursor}
                    padding={10}
                    className="text-base"
                    style={{
                      fontFamily: '"Pretendard", "Inter", sans-serif',
                      fontSize: fontSize,
                      lineHeight: 1.6,
                    }}
                    textareaClassName="focus:outline-none"
                    // Important: Capture cursor position on every possible event
                    onClick={(e) => setCursorOffset(e.currentTarget.selectionStart)}
                    onKeyUp={(e) => setCursorOffset(e.currentTarget.selectionStart)}
                    onBlur={() => {}} // Optional: Clear cursor offset to hide syntax when focus lost?
                  />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const FormatButton = ({ icon, onClick, tooltip }: { icon: React.ReactNode, onClick: () => void, tooltip: string }) => (
  <button 
    onClick={(e) => { e.preventDefault(); onClick(); }}
    className="p-1.5 text-obsidian-muted hover:text-obsidian-accent hover:bg-obsidian-hover rounded transition-colors"
    title={tooltip}
  >
    {icon}
  </button>
)
