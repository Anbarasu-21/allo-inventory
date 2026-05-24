// src/components/Toast.tsx
"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  type: "success" | "error" | "info";
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, type, onDismiss, duration = 4000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  const styles = {
    success:
      "border-teal-700/50 bg-teal-900/80 text-teal-200",
    error:
      "border-red-700/50 bg-red-900/80 text-red-200",
    info:
      "border-slate-600/50 bg-slate-800/80 text-slate-200",
  };

  const icons = {
    success: "✓",
    error: "⚠",
    info: "ℹ",
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-xl text-sm font-mono max-w-sm animate-slide-up ${styles[type]}`}
      role="alert"
    >
      <span className="text-base">{icons[type]}</span>
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </div>
  );
}
