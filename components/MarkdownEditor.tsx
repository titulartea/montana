import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileSystemNode, NodeType } from '../types';
import {
  Eye, EyeOff, Download, Menu,
  Bold, Italic, List, CheckSquare, Link as LinkIcon, Heading, Quote, Strikethrough,
  Clock, FileDown, FileArchive, FileText, Lock, Unlock
} from 'lucide-react';
import { exportAsHTML } from '../services/exportService';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown.js';

if (Prism.languages.markdown) {
  Prism.languages.insertBefore('markdown', 'bold', {
    'highlight-marker': {
      pattern: /==(?!\s)[^=]*?(?!\s)==/,
      inside: { content: /[^=]+/, punctuation: /==/ },
    },
  });
}

interface MarkdownEditorProps {
  activeNode: FileSystemNode | undefined;
  onUpdateContent: (id: string, content: string) => void;
  onRenameNode: (id: string, name: string) => void;
  onToggleSidebar: () => void;
  fontSize: number;
  allNodes: FileSystemNode[];
  onNavigateToNote: (noteId: string) => void;
  onOpenVersionHistory: () => void;
  onExportZip: () => void;
  isEncrypted: boolean;
  isUnlocked: boolean;
  onEncryptNote: (password: string) => Promise<void>;
  onUnlockNote: (password: string) => Promise<void>;
  onLockNote: () => Promise<void>;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  activeNode, onUpdateContent, onRenameNode, onToggleSidebar, fontSize,
  allNodes, onNavigateToNote, onOpenVersionHistory, onExportZip,
  isEncrypted, isUnlocked, onEncryptNote, onUnlockNote, onLockNote,
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const [cursorOffset, setCursorOffset] = useState(0);

  const getTokenLength = (token: Prism.Token | string): number => {
    if (typeof token === 'string') return token.length;
    if (Array.isArray(token.content)) return token.content.reduce((a, t) => a + getTokenLength(t), 0);
    return getTokenLength(token.content);
  };

  const highlightWithCursor = useCallback((code: string) => {
    const tokens = Prism.tokenize(code, Prism.languages.markdown);
    let pos = 0;
    const process = (token: Prism.Token | string, forceVis = false): string => {
      if (typeof token === 'string') { pos += token.length; return Prism.util.encode(token); }
      const len = getTokenLength(token);
      const start = pos, end = pos + len;
      const cursorIn = cursorOffset >= start && cursorOffset <= end;
      const fmtTypes = ['bold','italic','strike','url','blockquote','title','code-snippet','list','highlight-marker'];
      const isFmt = fmtTypes.includes(token.type);
      const show = forceVis || (isFmt && cursorIn);
      let inner = '';
      if (Array.isArray(token.content)) inner = token.content.map(c => process(c, show)).join('');
      else inner = process(token.content as any, show);
      return `<span class="token ${token.type} ${token.alias || ''} ${show ? 'syntax-visible' : ''}">${inner}</span>`;
    };
    return tokens.map(t => process(t)).join('');
  }, [cursorOffset]);

  const processHighlights = useCallback((children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, child => {
      if (typeof child !== 'string') {
        if (React.isValidElement(child) && (child.props as any)?.children)
          return React.cloneElement(child as React.ReactElement<any>, {}, processHighlights((child.props as any).children));
        return child;
      }
      if (!child.includes('==')) return child;
      const parts = child.split(/(==[^=]+==)/);
      if (parts.length === 1) return child;
      return parts.map((p: string, i: number) => { const m = p.match(/^==([^=]+)==$/); return m ? <mark key={i}>{m[1]}</mark> : p; });
    });
  }, []);

  const renderWikilinks = useCallback((content: string) => {
    return content.replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
      const t = allNodes.filter(n => n.type === NodeType.FILE).find(n => n.name.toLowerCase() === name.trim().toLowerCase());
      return t ? `[${name}](#wikilink:${t.id})` : `[${name}](#wikilink:missing)`;
    });
  }, [allNodes]);

  const applyMarkdown = (prefix: string, suffix = '') => {
    const ta = document.querySelector('.custom-editor-wrapper textarea') as HTMLTextAreaElement;
    if (!ta || !activeNode) return;
    const s = ta.selectionStart, e = ta.selectionEnd, text = activeNode.content || '';
    const sel = text.substring(s, e);
    onUpdateContent(activeNode.id, text.substring(0, s) + prefix + sel + suffix + text.substring(e));
    setTimeout(() => { ta.focus(); const p = s + prefix.length + sel.length + suffix.length; ta.setSelectionRange(s === e ? s + prefix.length : p, s === e ? s + prefix.length : p); setCursorOffset(s + prefix.length); }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); applyMarkdown('**', '**'); break;
        case 'i': e.preventDefault(); applyMarkdown('*', '*'); break;
        case 'k': e.preventDefault(); applyMarkdown('[', '](url)'); break;
        case 'x': if (e.shiftKey) { e.preventDefault(); applyMarkdown('~~', '~~'); } break;
        case 'h': if (e.shiftKey) { e.preventDefault(); applyMarkdown('==', '=='); } break;
      }
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !activeNode) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile(); if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const b64 = ev.target?.result as string; if (!b64) return;
          const ta = document.querySelector('.custom-editor-wrapper textarea') as HTMLTextAreaElement;
          const p = ta?.selectionStart || (activeNode.content?.length || 0);
          const t = activeNode.content || '';
          onUpdateContent(activeNode.id, t.substring(0, p) + `![image](${b64})` + t.substring(p));
        };
        reader.readAsDataURL(file); break;
      }
    }
  }, [activeNode, onUpdateContent]);

  if (!activeNode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-8 text-center" style={{ color: 'var(--text-muted)' }}>
        <button onClick={onToggleSidebar} className="md:hidden absolute top-4 left-4 p-2" style={{ color: 'var(--text-main)' }}><Menu /></button>
        <FileText size={40} className="mb-3 opacity-15" />
        <p className="text-base font-medium" style={{ color: 'var(--text-main)' }}>노트를 선택하세요</p>
        <p className="text-sm mt-1 opacity-50">사이드바에서 노트를 선택하거나 새로 만드세요.</p>
      </div>
    );
  }

  const requestEncrypt = async () => {
    const password = window.prompt('노트 암호화 비밀번호를 설정하세요.');
    if (!password) return;
    await onEncryptNote(password);
  };

  const requestUnlock = async () => {
    const password = window.prompt('비밀번호를 입력해 노트를 잠금 해제하세요.');
    if (!password) return;
    await onUnlockNote(password);
  };

  if (isEncrypted && !isUnlocked) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden relative" style={{ background: 'var(--bg-main)' }}>
        <div className="h-11 border-b flex items-center px-3 justify-between shrink-0 gap-2" style={{ borderColor: 'var(--border-color)', background: 'var(--vibrancy)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <button onClick={onToggleSidebar} className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><Menu size={18} /></button>
          <input
            type="text" value={activeNode.name}
            onChange={e => onRenameNode(activeNode.id, e.target.value)}
            className="bg-transparent text-sm font-semibold outline-none flex-1 min-w-0 truncate"
            style={{ color: 'var(--text-main)', fontFamily: 'inherit' }}
            placeholder="제목 없음"
          />
          <button onClick={requestUnlock} title="잠금 해제" className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--bg-accent)' }}>
            <Unlock size={15} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-sm w-full rounded-2xl border p-6 text-center" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-sidebar)', boxShadow: 'var(--shadow-subtle)' }}>
            <Lock size={28} className="mx-auto mb-3" style={{ color: 'var(--bg-accent)' }} />
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-main)' }}>암호화된 노트</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>이 노트는 암호화되어 있습니다. 비밀번호를 입력해 열어주세요.</p>
            <button onClick={requestUnlock} className="w-full py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--bg-accent)' }}>
              잠금 해제
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative" style={{ background: 'var(--bg-main)' }}>
      {/* Toolbar */}
      <div className="h-11 border-b flex items-center px-3 justify-between shrink-0 gap-2" style={{ borderColor: 'var(--border-color)', background: 'var(--vibrancy)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <button onClick={onToggleSidebar} className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><Menu size={18} /></button>
        <input
          type="text" value={activeNode.name}
          onChange={e => onRenameNode(activeNode.id, e.target.value)}
          className="bg-transparent text-sm font-semibold outline-none flex-1 min-w-0 truncate"
          style={{ color: 'var(--text-main)', fontFamily: 'inherit' }}
          placeholder="제목 없음"
        />
        <div className="flex items-center gap-0.5">
          {[
            { icon: <Clock size={15}/>, fn: onOpenVersionHistory, tip: '버전 기록', hide: 'sm' },
            { icon: <Download size={15}/>, fn: () => { const b = new Blob([activeNode.content||''],{type:'text/markdown'}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download=activeNode.name+'.md'; a.click(); URL.revokeObjectURL(u); }, tip: 'MD 다운로드', hide: 'sm' },
            { icon: <FileDown size={15}/>, fn: () => exportAsHTML(activeNode), tip: 'HTML 내보내기', hide: 'sm' },
            { icon: <FileArchive size={15}/>, fn: onExportZip, tip: 'ZIP 내보내기', hide: 'sm' },
            { icon: isPreview ? <EyeOff size={15}/> : <Eye size={15}/>, fn: () => setIsPreview(!isPreview), tip: isPreview ? '편집' : '미리보기' },
            isEncrypted
              ? { icon: <Lock size={15}/>, fn: onLockNote, tip: '다시 잠금' }
              : { icon: <Unlock size={15}/>, fn: requestEncrypt, tip: '노트 암호화' },
          ].map((b, i) => (
            <button key={i} onClick={b.fn} title={b.tip} className={`p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors ${b.hide ? `hidden ${b.hide}:block` : ''}`} style={{ color: 'var(--text-muted)' }}>{b.icon}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isPreview ? (
          <div
            className="flex-1 overflow-y-auto p-6 md:p-10 prose prose-slate dark:prose-invert max-w-none pb-20"
            style={{ fontFamily: 'inherit', fontSize: fontSize + 'px', color: 'var(--text-main)' }}
            onClick={e => { const t = e.target as HTMLAnchorElement; if (t.tagName === 'A' && t.getAttribute('href')?.startsWith('#wikilink:')) { e.preventDefault(); const id = t.getAttribute('href')!.replace('#wikilink:',''); if (id !== 'missing') onNavigateToNote(id); }}}
          >
            <ReactMarkdown components={{
              p: ({children,...p}: any) => <p {...p}>{processHighlights(children)}</p>,
              li: ({children,...p}: any) => <li {...p}>{processHighlights(children)}</li>,
              h1: ({children,...p}: any) => <h1 {...p}>{processHighlights(children)}</h1>,
              h2: ({children,...p}: any) => <h2 {...p}>{processHighlights(children)}</h2>,
              h3: ({children,...p}: any) => <h3 {...p}>{processHighlights(children)}</h3>,
              blockquote: ({children,...p}: any) => <blockquote {...p}>{processHighlights(children)}</blockquote>,
            }}>{renderWikilinks(activeNode.content || '')}</ReactMarkdown>
          </div>
        ) : (
          <>
            {/* Format bar */}
            <div className="h-9 border-b flex items-center px-3 gap-0.5 overflow-x-auto scrollbar-hide shrink-0" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-sidebar)' }}>
              {[
                { icon: <Bold size={13}/>, fn: () => applyMarkdown('**','**'), tip: 'Bold' },
                { icon: <Italic size={13}/>, fn: () => applyMarkdown('*','*'), tip: 'Italic' },
                { icon: <Strikethrough size={13}/>, fn: () => applyMarkdown('~~','~~'), tip: 'Strikethrough' },
                { icon: <span className="text-[10px] font-bold px-0.5" style={{background:'rgba(255,214,10,0.25)',borderRadius:2}}>H</span>, fn: () => applyMarkdown('==','=='), tip: 'Highlight' },
                'sep',
                { icon: <Heading size={13}/>, fn: () => applyMarkdown('### '), tip: 'Heading' },
                { icon: <Quote size={13}/>, fn: () => applyMarkdown('> '), tip: 'Quote' },
                'sep',
                { icon: <List size={13}/>, fn: () => applyMarkdown('- '), tip: 'List' },
                { icon: <CheckSquare size={13}/>, fn: () => applyMarkdown('- [ ] '), tip: 'Checkbox' },
                { icon: <LinkIcon size={13}/>, fn: () => applyMarkdown('[','](url)'), tip: 'Link' },
              ].map((b, i) => b === 'sep' ?
                <div key={i} className="w-px h-4 mx-1" style={{background:'var(--border-color)'}} /> :
                <button key={i} onClick={(e) => { e.preventDefault(); (b as any).fn(); }} title={(b as any).tip} className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors" style={{color:'var(--text-muted)'}}>{(b as any).icon}</button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-editor-wrapper pb-20 prose prose-slate dark:prose-invert max-w-none" onClick={() => document.querySelector('textarea')?.focus()}>
              <div onKeyDown={handleKeyDown} onPaste={handlePaste} className="h-full">
                <Editor
                  value={activeNode.content || ''}
                  onValueChange={code => onUpdateContent(activeNode.id, code)}
                  highlight={highlightWithCursor}
                  padding={10}
                  style={{ fontFamily: "'Pretendard', -apple-system, system-ui, sans-serif", fontSize, lineHeight: 1.75 }}
                  textareaClassName="focus:outline-none"
                  onClick={e => setCursorOffset(e.currentTarget.selectionStart)}
                  onKeyUp={e => setCursorOffset(e.currentTarget.selectionStart)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
