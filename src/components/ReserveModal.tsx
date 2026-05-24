// src/components/ReserveModal.tsx
"use client";

import { useState } from "react";
import type { ProductWithStock } from "@/lib/schemas";

interface Props {
  product: ProductWithStock;
  onClose: () => void;
  onSuccess: (reservationId: string) => void;
  onError: (message: string) => void;
}

export function ReserveModal({ product, onClose, onSuccess, onError }: Props) {
  const availableWarehouses = product.stockLevels.filter(
    (sl) => sl.available > 0
  );

  const [warehouseId, setWarehouseId] = useState(
    availableWarehouses[0]?.warehouseId ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const selectedWarehouse = availableWarehouses.find(
    (w) => w.warehouseId === warehouseId
  );
  const maxQty = selectedWarehouse?.available ?? 0;

  async function handleSubmit() {
    if (!warehouseId || quantity < 1 || quantity > maxQty) return;
    setLoading(true);

    try {
      // Idempotency key: product + warehouse + timestamp (new key per attempt)
      const idempotencyKey = `reserve-${product.id}-${warehouseId}-${Date.now()}`;
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ productId: product.id, warehouseId, quantity }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          onError(
            `Not enough stock available. ${data.error}`
          );
        } else if (res.status === 429) {
          onError("Too many requests. Please try again in a moment.");
        } else {
          onError(data.error || "Failed to create reservation.");
        }
        return;
      }

      onSuccess(data.id);
    } catch {
      onError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-surface-3 bg-surface-1 p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Reserve Units
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Warehouse select */}
        <div className="mb-4">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
            Warehouse
          </label>
          <div className="space-y-2">
            {availableWarehouses.map((wh) => (
              <label
                key={wh.warehouseId}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors
                  ${
                    warehouseId === wh.warehouseId
                      ? "border-brand-600 bg-brand-900/20"
                      : "border-surface-3 hover:border-surface-4"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="warehouse"
                    value={wh.warehouseId}
                    checked={warehouseId === wh.warehouseId}
                    onChange={() => {
                      setWarehouseId(wh.warehouseId);
                      setQuantity(1);
                    }}
                    className="accent-brand-500"
                  />
                  <div>
                    <div className="text-sm text-slate-200">{wh.warehouseName}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {wh.warehouseLocation}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    wh.available <= 3
                      ? "stock-low"
                      : "stock-high"
                  }`}
                >
                  {wh.available} avail.
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="mb-6">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
            Quantity
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-9 h-9 rounded-lg border border-surface-3 bg-surface-2 hover:bg-surface-3 text-slate-300 flex items-center justify-center transition-colors text-lg"
            >
              −
            </button>
            <span className="w-12 text-center font-mono text-white font-bold">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty}
              className="w-9 h-9 rounded-lg border border-surface-3 bg-surface-2 hover:bg-surface-3 disabled:opacity-40 text-slate-300 flex items-center justify-center transition-colors text-lg"
            >
              +
            </button>
            <span className="text-xs text-slate-600 font-mono">
              of {maxQty} available
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-xl bg-surface-2 border border-surface-3 p-4 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 font-mono">Total</span>
            <span className="font-display font-bold text-brand-400 text-lg">
              ₹
              {(product.price * quantity).toLocaleString("en-IN")}
            </span>
          </div>
          <p className="text-xs text-slate-600 font-mono mt-2">
            Held for 10 minutes · Released automatically if not confirmed
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !warehouseId || quantity < 1}
            className="flex-1 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-display font-semibold text-sm transition-all"
          >
            {loading ? "Reserving…" : "Reserve now →"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl border border-surface-3 bg-surface-2 hover:bg-surface-3 text-slate-400 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
