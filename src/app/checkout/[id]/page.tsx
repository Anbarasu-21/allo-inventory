// src/app/checkout/[id]/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ReservationDetail } from "@/lib/schemas";
import { Toast } from "@/components/Toast";
import { CountdownTimer } from "@/components/CountdownTimer";
import { StatusBadge } from "@/components/StatusBadge";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [expired, setExpired] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setToast({ message: "Reservation not found.", type: "error" });
          return;
        }
        throw new Error("Failed to load reservation");
      }
      const data: ReservationDetail = await res.json();
      setReservation(data);
      // Stop polling once settled
      if (data.status !== "PENDING") {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    } catch {
      // Non-fatal: keep whatever state we have
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
    // Poll every 5 seconds to catch server-side expiry
    pollingRef.current = setInterval(fetchReservation, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchReservation]);

  async function handleConfirm() {
    if (!reservation || actionLoading) return;
    setActionLoading(true);
    try {
      const idempotencyKey = `confirm-${reservation.id}-${Date.now()}`;
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 410) {
          setExpired(true);
          setToast({ message: "This reservation expired before payment could complete.", type: "error" });
        } else {
          setToast({ message: data.error || "Failed to confirm.", type: "error" });
        }
        return;
      }
      setReservation(data);
      setToast({ message: "Purchase confirmed! 🎉", type: "success" });
    } catch {
      setToast({ message: "Network error. Please try again.", type: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!reservation || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || "Failed to cancel.", type: "error" });
        return;
      }
      setReservation(data);
      setToast({ message: "Reservation cancelled. Units released.", type: "info" });
    } catch {
      setToast({ message: "Network error. Please try again.", type: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-surface-2 rounded" />
          <div className="h-64 bg-surface-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-400 font-mono">Reservation not found.</p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm transition-colors"
        >
          Back to products
        </button>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";
  const isExpiredLocally =
    expired || (isPending && new Date(reservation.expiresAt) < new Date());

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-fade-in">
      {/* Back link */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-slate-500 hover:text-brand-400 transition-colors text-sm font-mono mb-8"
      >
        ← back to products
      </button>

      <div className="font-display text-2xl font-bold text-white mb-6">
        Checkout
      </div>

      {/* Reservation card */}
      <div className="rounded-2xl border border-surface-3 bg-surface-1 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-surface-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-slate-500 mb-1">
                Reservation · {reservation.id.slice(0, 8)}…
              </div>
              <h2 className="font-display text-xl font-semibold text-white">
                {reservation.productName}
              </h2>
              <div className="text-xs font-mono text-slate-500 mt-1">
                SKU: {reservation.productSku}
              </div>
            </div>
            <StatusBadge status={reservation.status} />
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          <Row label="Warehouse" value={reservation.warehouseName} />
          <Row label="Quantity" value={String(reservation.quantity)} />
          <Row
            label="Unit price"
            value={`₹${reservation.productPrice.toLocaleString("en-IN")}`}
          />
          <Row
            label="Total"
            value={`₹${(reservation.productPrice * reservation.quantity).toLocaleString("en-IN")}`}
            highlight
          />
          <Row
            label="Created"
            value={new Date(reservation.createdAt).toLocaleString()}
          />
        </div>

        {/* Countdown */}
        {isPending && !isExpiredLocally && (
          <div className="px-6 pb-4">
            <CountdownTimer
              expiresAt={reservation.expiresAt}
              onExpire={() => {
                setExpired(true);
                fetchReservation();
              }}
            />
          </div>
        )}

        {/* Expired warning */}
        {(isExpiredLocally || isReleased) && isPending && (
          <div className="mx-6 mb-4 rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400 font-mono">
            ⏱ This reservation has expired. Units have been returned to inventory.
          </div>
        )}

        {/* Confirmed banner */}
        {isConfirmed && (
          <div className="mx-6 mb-4 rounded-lg border border-teal-700/50 bg-teal-900/20 px-4 py-3 text-sm text-teal-300 font-mono">
            ✓ Order confirmed. Thank you for your purchase!
          </div>
        )}

        {/* Released banner */}
        {isReleased && !isPending && (
          <div className="mx-6 mb-4 rounded-lg border border-slate-700/50 bg-surface-3 px-4 py-3 text-sm text-slate-400 font-mono">
            ✗ Reservation cancelled. Units have been returned.
          </div>
        )}

        {/* Actions */}
        {isPending && !isExpiredLocally && (
          <div className="p-6 pt-2 flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={actionLoading}
              className="flex-1 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-display font-semibold text-sm transition-all animate-pulse-glow"
            >
              {actionLoading ? "Processing…" : "Confirm purchase"}
            </button>
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="px-6 py-3 rounded-xl border border-surface-4 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {(isConfirmed || isReleased || isExpiredLocally) && (
          <div className="p-6 pt-2">
            <button
              onClick={() => router.push("/")}
              className="w-full px-6 py-3 rounded-xl border border-brand-700/50 hover:bg-brand-900/30 text-brand-400 text-sm font-mono transition-colors"
            >
              ← Back to catalogue
            </button>
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
        {label}
      </span>
      <span
        className={
          highlight
            ? "font-display font-bold text-brand-400 text-lg"
            : "font-mono text-sm text-slate-200"
        }
      >
        {value}
      </span>
    </div>
  );
}
