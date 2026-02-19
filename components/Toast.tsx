import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastMessage { id: string; type: ToastType; text: string; }

interface ToastContainerProps { toasts: ToastMessage[]; onRemove: (id: string) => void; }

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />)}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [visible, setVisible] = useState(false);
  const handleRemove = useCallback(() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }, [toast.id, onRemove]);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); const t = setTimeout(handleRemove, 3500); return () => clearTimeout(t); }, [handleRemove]);

  const icons = { success: <CheckCircle size={16} className="text-green-500 shrink-0" />, error: <AlertCircle size={16} className="text-red-500 shrink-0" />, info: <Info size={16} className="shrink-0" style={{color:'var(--bg-accent)'}} /> };
  const accents = { success: 'rgba(34,197,94,0.15)', error: 'rgba(239,68,68,0.15)', info: 'var(--bg-hover)' };

  return (
    <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl text-sm min-w-[280px] max-w-[420px] transition-all duration-300"
      style={{
        background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-elevated)', color: 'var(--text-main)',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)',
      }} role="alert">
      {icons[toast.type]}
      <span className="flex-1 leading-snug">{toast.text}</span>
      <button onClick={handleRemove} className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
    </div>
  );
};
