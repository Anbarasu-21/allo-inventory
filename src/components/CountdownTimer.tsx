// src/components/CountdownTimer.tsx
"use client";

import { useEffect, useState } from "react";

interface Props {
  expiresAt: string; // ISO string
  onExpire?: () => void;
}

export function CountdownTimer({ expiresAt, onExpire }: Props) {
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const totalMs =
    new Date(expiresAt).getTime() -
    // compute start as expiresAt - 10 minutes, but clamp to actual
    (new Date(expiresAt).getTime() - 10 * 60 * 1000);
  const pct = Math.min(100, Math.max(0, (remaining / (10 * 60 * 1000)) * 100));

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  const isUrgent = remaining < 60_000;
  const isDanger = remaining < 30_000;

  return (
    <div
      className={`rounded-xl border p-4 ${
        isDanger
          ? "border-red-800/60 bg-red-900/15"
          : isUrgent
          ? "border-amber-800/50 bg-amber-900/10"
          : "border-surface-3 bg-surface-2"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
          Reservation expires in
        </span>
        <span
          className={`font-mono font-bold text-lg tabular-nums ${
            isDanger
              ? "text-red-400"
              : isUrgent
              ? "text-amber-400"
              : "text-brand-400"
          }`}
        >
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isDanger
              ? "bg-red-500"
              : isUrgent
              ? "bg-amber-500"
              : "bg-brand-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {isUrgent && (
        <p className="text-xs font-mono mt-2 text-amber-500/80">
          ⚠ Confirm quickly — time is running out!
        </p>
      )}
    </div>
  );
}
