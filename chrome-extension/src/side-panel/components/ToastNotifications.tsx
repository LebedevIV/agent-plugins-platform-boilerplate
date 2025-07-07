import React, { useState, useEffect, useCallback } from 'react';
import './ToastNotifications.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  timestamp: number;
}

interface ToastNotificationsProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastNotifications: React.FC<ToastNotificationsProps> = ({ toasts, onRemove }) => {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);

  useEffect(() => {
    // Animation in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto remove
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        handleRemove();
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleRemove = useCallback(() => {
    setIsHiding(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300); // Animation duration
  }, [toast.id, onRemove]);

  return (
    <div 
      className={`toast toast-${toast.type} ${isVisible ? 'toast-visible' : ''} ${isHiding ? 'toast-hiding' : ''}`}
    >
      <div className="toast-content">
        <span className="toast-message">{toast.message}</span>
        <button 
          className="toast-close"
          onClick={handleRemove}
          aria-label="Закрыть уведомление"
        >
          ×
        </button>
      </div>
    </div>
  );
};

// Toast manager hook
export function useToastManager() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = {
      id,
      message,
      type,
      duration,
      timestamp: Date.now()
    };

    setToasts(prev => {
      const updated = [...prev, newToast];
      // Limit to 3 toasts
      return updated.slice(-3);
    });

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    clearAll
  };
}

// Convenience functions
export const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
  // This will be used with the toast manager
  console.log(`[Toast] ${type}: ${message}`);
};

export const showSuccessToast = (message: string, duration: number = 3000) => {
  return showToast(message, 'success', duration);
};

export const showErrorToast = (message: string, duration: number = 5000) => {
  return showToast(message, 'error', duration);
};

export const showWarningToast = (message: string, duration: number = 4000) => {
  return showToast(message, 'warning', duration);
};

export const showInfoToast = (message: string, duration: number = 3000) => {
  return showToast(message, 'info', duration);
}; 