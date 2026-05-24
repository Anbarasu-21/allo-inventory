// src/components/ProductCard.tsx
"use client";

import type { ProductWithStock } from "@/lib/schemas";

interface Props {
  product: ProductWithStock;
  onReserve: () => void;
}

export function ProductCard({ product, onReserve }: Props) {
  const totalAvailable = product.stockLevels.reduce(
    (sum, sl) => sum + sl.available,
    0
  );
  const hasStock = totalAvailable > 0;

  return (
    <div className="group rounded-2xl border border-surface-3 bg-surface-1 overflow-hidden flex flex-col hover:border-brand-700/50 transition-colors duration-300">
      {/* Image */}
      {product.imageUrl && (
        <div className="relative overflow-hidden h-44 bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-1/80 to-transparent" />
          {/* SKU badge */}
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-surface-0/80 backdrop-blur text-xs font-mono text-slate-400">
            {product.sku}
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display font-semibold text-white text-base mb-1 leading-snug">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-slate-500 mb-4 leading-relaxed line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Stock per warehouse */}
        <div className="space-y-1.5 mb-4 flex-1">
          {product.stockLevels.map((sl) => (
            <div
              key={sl.warehouseId}
              className="flex items-center justify-between"
            >
              <span className="text-xs text-slate-500 font-mono truncate max-w-[140px]">
                {sl.warehouseName}
              </span>
              <StockPill available={sl.available} />
            </div>
          ))}
          {product.stockLevels.length === 0 && (
            <span className="text-xs text-slate-600 font-mono">
              Not stocked
            </span>
          )}
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-surface-3">
          <div>
            <div className="text-xs text-slate-600 font-mono">Price</div>
            <div className="font-display font-bold text-brand-400 text-lg">
              ₹{product.price.toLocaleString("en-IN")}
            </div>
          </div>
          <button
            onClick={onReserve}
            disabled={!hasStock}
            className={`px-4 py-2 rounded-xl text-sm font-semibold font-display transition-all
              ${
                hasStock
                  ? "bg-brand-600 hover:bg-brand-500 text-white hover:shadow-lg hover:shadow-brand-900/50"
                  : "bg-surface-3 text-slate-600 cursor-not-allowed"
              }`}
          >
            {hasStock ? "Reserve" : "Out of stock"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StockPill({ available }: { available: number }) {
  if (available === 0)
    return (
      <span className="stock-empty text-xs px-2 py-0.5 rounded-full font-mono">
        0 left
      </span>
    );
  if (available <= 3)
    return (
      <span className="stock-low text-xs px-2 py-0.5 rounded-full font-mono">
        {available} left
      </span>
    );
  return (
    <span className="stock-high text-xs px-2 py-0.5 rounded-full font-mono">
      {available} avail.
    </span>
  );
}
