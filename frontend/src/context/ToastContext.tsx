import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const recentMessagesRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', duration = 3500) => {
      if (!message || !message.trim()) return;
      const cleanMsg = message.trim();

      // Deduplicate identical messages shown within the last 1.5 seconds
      const now = Date.now();
      const lastShown = recentMessagesRef.current.get(cleanMsg);
      if (lastShown && now - lastShown < 1500) {
        return;
      }
      recentMessagesRef.current.set(cleanMsg, now);

      const id = `toast_${now}_${Math.random().toString(36).substr(2, 5)}`;
      const newToast: ToastItem = { id, type, message: cleanMsg, duration };

      setToasts((prev) => {
        // Limit max concurrent toasts to 3
        const trimmed = prev.length >= 3 ? prev.slice(prev.length - 2) : prev;
        return [...trimmed, newToast];
      });

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  const success = useCallback((msg: string, dur?: number) => showToast(msg, 'success', dur), [showToast]);
  const error = useCallback((msg: string, dur?: number) => showToast(msg, 'error', dur), [showToast]);
  const warning = useCallback((msg: string, dur?: number) => showToast(msg, 'warning', dur), [showToast]);
  const info = useCallback((msg: string, dur?: number) => showToast(msg, 'info', dur), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, dismissToast }}>
      {children}

      {/* Top Center Fixed Toast Container */}
      <div
        className="fixed z-[9999] pointer-events-none flex flex-col items-center gap-2"
        style={{
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '90vw',
          width: 'max-content',
        }}
      >
        {toasts.map((toast) => {
          let icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
          let borderColor = 'border-emerald-600/40';
          let bgColor = 'bg-[#181d24]/95';
          let textColor = 'text-gray-100';

          if (toast.type === 'error') {
            icon = <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />;
            borderColor = 'border-rose-600/40';
            bgColor = 'bg-[#221619]/95';
            textColor = 'text-rose-100';
          } else if (toast.type === 'warning') {
            icon = <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
            borderColor = 'border-amber-600/40';
            bgColor = 'bg-[#221d15]/95';
            textColor = 'text-amber-100';
          } else if (toast.type === 'info') {
            icon = <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;
            borderColor = 'border-blue-600/40';
            bgColor = 'bg-[#151c24]/95';
            textColor = 'text-blue-100';
          }

          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded shadow-2xl border backdrop-blur-md text-xs font-medium transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${borderColor} ${bgColor} ${textColor}`}
              style={{ minWidth: '240px', maxWidth: '480px' }}
            >
              {icon}
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
