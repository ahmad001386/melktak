import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  text: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl shadow-lg border backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 ${
              isSuccess
                ? "bg-emerald-50/95 border-emerald-200 text-emerald-900"
                : isError
                ? "bg-rose-50/95 border-rose-200 text-rose-900"
                : "bg-blue-50/95 border-blue-200 text-blue-900"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
              {isError && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
              {!isSuccess && !isError && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
              <span className="text-xs font-medium leading-relaxed truncate">{toast.text}</span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 transition shrink-0"
              aria-label="بستن پیام"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
