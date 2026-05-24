// src/app/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import type { ProductWithStock } from "@/lib/schemas";
import { ProductCard } from "@/components/ProductCard";
import { ReserveModal } from "@/components/ReserveModal";
import { Toast } from "@/components/Toast";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

export default function HomePage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithStock | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data);
    } catch (e) {
      setError("Could not load products. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function showToast(message: string, type: ToastState["type"]) {
    setToast({ message, type });
  }

  function handleReserveSuccess(reservationId: string) {
    setSelectedProduct(null);
    fetchProducts(); // Refresh stock counts
    window.location.href = `/checkout/${reservationId}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Page header */}
      <div className="mb-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-900/40 border border-brand-700/30 text-brand-400 text-xs font-mono mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          Live inventory
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-3">
          Product Catalogue
        </h1>
        <p className="text-slate-400 text-sm max-w-lg">
          Reserve items at checkout — your hold lasts{" "}
          <span className="text-brand-400 font-semibold">10 minutes</span>.
          After that, the units return to available stock automatically.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-72 rounded-xl bg-surface-2 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-6 text-red-400 font-mono text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Products grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, i) => (
            <div
              key={product.id}
              className="animate-slide-up"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both", opacity: 0 }}
            >
              <ProductCard
                product={product}
                onReserve={() => setSelectedProduct(product)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Reserve Modal */}
      {selectedProduct && (
        <ReserveModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSuccess={handleReserveSuccess}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      {/* Toast */}
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
