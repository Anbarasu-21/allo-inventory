// src/components/StatusBadge.tsx
import type { ReservationStatus } from "@/lib/schemas";

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const config = {
    PENDING: {
      label: "Pending",
      className: "bg-amber-900/40 text-amber-300 border-amber-700/50",
      dot: "bg-amber-400 animate-pulse",
    },
    CONFIRMED: {
      label: "Confirmed",
      className: "bg-teal-900/40 text-teal-300 border-teal-700/50",
      dot: "bg-teal-400",
    },
    RELEASED: {
      label: "Released",
      className: "bg-slate-800/50 text-slate-400 border-slate-700/50",
      dot: "bg-slate-500",
    },
  } as const;

  const c = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono ${c.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
