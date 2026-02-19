import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2 } from 'lucide-react';
import { generateAIResponse } from '../services/geminiService';
import { ChatMessage, FileSystemNode } from '../types';
import ReactMarkdown from 'react-markdown';

interface AIPanelProps {
  isVisible: boolean;
  onClose: () => void;
  activeNode: FileSystemNode | undefined;
  apiKey: string;
}

export const AIPanel: React.FC<AIPanelProps> = ({ isVisible, onClose, activeNode, apiKey }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello! I can help you summarize this note, expand on ideas, or answer questions about your writing.',
      timestamp: Date.now()
    }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isVisible]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const responseText = await generateAIResponse(
        userMsg.text,
        activeNode?.content || "No active note content.",
        apiKey
      );

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'model',
        text: 'An error occurred. Please check your API key in Settings.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Visibility logic handled by CSS classes for responsiveness
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 md:static md:z-auto w-full md:w-96 md:border-l border-obsidian-border bg-obsidian-sidebar flex flex-col shadow-2xl md:shadow-none transition-all duration-300">
      {/* Header */}
      <div className="h-14 md:h-12 border-b border-obsidian-border flex items-center justify-between px-4 bg-obsidian-sidebar shrink-0">
        <div className="flex items-center gap-2 text-obsidian-accent font-medium">
          <Bot size={20} />
          <span className="font-semibold">Montana AI</span>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 -mr-2 text-obsidian-muted hover:text-obsidian-text rounded-full hover:bg-obsidian-hover active:bg-obsidian-hover transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-obsidian-bg/50">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`
              max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
              ${msg.role === 'user' 
                ? 'bg-obsidian-accent text-white rounded-br-sm' 
                : 'bg-obsidian-hover text-obsidian-text rounded-bl-sm border border-obsidian-border'}
            `}>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
            <span className="text-[10px] text-obsidian-muted mt-1 px-1 opacity-70">
              {msg.role === 'user' ? 'You' : 'Gemini'}
            </span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-obsidian-muted text-xs ml-2 animate-pulse">
            <Loader2 size={12} className="animate-spin" />
            Generating response...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-obsidian-border bg-obsidian-sidebar shrink-0 pb-safe">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything about your note..."
            className="flex-1 bg-obsidian-bg border border-obsidian-border rounded-xl px-4 py-3 text-sm text-obsidian-text resize-none h-14 max-h-32 outline-none focus:border-obsidian-accent focus:ring-1 focus:ring-obsidian-accent transition-all placeholder:text-obsidian-muted/50"
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-3 bg-obsidian-accent hover:bg-opacity-90 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
          >
            <Send size={20} />
          </button>
        </div>
        <div className="text-[10px] text-center text-obsidian-muted mt-3 opacity-60">
          Powered by Gemini 3 Flash
        </div>
        {!apiKey && (
          <div className="text-[10px] text-center text-yellow-500 mt-1">
            ⚠️ Settings → Editor 에서 API 키를 설정해주세요.
          </div>
        )}
      </div>
    </div>
  );
};