import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_STYLES: Record<ToastType, { bg: string; borderColor: string; Icon: React.ElementType; iconColor: string }> = {
  success: { bg: '#f0faf4', borderColor: 'var(--color-success)',     Icon: CheckCircle,  iconColor: 'var(--color-success)' },
  error:   { bg: 'rgba(201,64,64,0.08)', borderColor: 'var(--color-destructive)', Icon: AlertCircle,  iconColor: 'var(--color-destructive)' },
  warning: { bg: '#fff8f0', borderColor: 'var(--color-warning)',     Icon: AlertTriangle,iconColor: 'var(--color-warning)' },
  info:    { bg: '#f0f4ff', borderColor: '#4a7fcc',                  Icon: Info,         iconColor: '#4a7fcc' },
};

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed z-[100] flex flex-col gap-2 bottom-20 left-4 right-4 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[360px]">
      {toasts.map(t => {
        const { bg, borderColor, Icon, iconColor } = TOAST_STYLES[t.type];
        return (
          <div
            key={t.id}
            className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ background: bg, border: `1px solid ${borderColor}`, boxShadow: 'var(--shadow-dropdown)' }}
          >
            <Icon size={18} style={{ color: iconColor, flexShrink: 0, marginTop: 1 }} />
            <p className="text-sm flex-1 leading-snug" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}>
              {t.message}
            </p>
            <button onClick={() => dismiss(t.id)} style={{ color: 'var(--color-slate)', flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
