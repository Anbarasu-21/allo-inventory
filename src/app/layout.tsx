// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo — Inventory Platform",
  description: "Multi-warehouse inventory and order fulfillment platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-surface-0 text-slate-100 font-body min-h-screen">
        <header className="border-b border-surface-3 bg-surface-1/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-sm bg-brand-500 flex items-center justify-center">
                <span className="text-surface-0 font-bold text-sm font-display">A</span>
              </div>
              <span className="font-display font-bold text-lg tracking-tight text-white group-hover:text-brand-400 transition-colors">
                allo
              </span>
              <span className="text-xs text-slate-500 font-mono hidden sm:inline">/ inventory</span>
            </a>
            <nav className="flex items-center gap-4 text-sm text-slate-400">
              <a href="/" className="hover:text-brand-400 transition-colors">
                Products
              </a>
              <span className="text-surface-3">·</span>
              <a
                href="/api/warehouses"
                target="_blank"
                className="hover:text-brand-400 transition-colors font-mono text-xs"
              >
                API
              </a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-surface-3 mt-24 py-8 text-center text-xs text-slate-600 font-mono">
          allo inventory platform · take-home exercise
        </footer>
      </body>
    </html>
  );
}
