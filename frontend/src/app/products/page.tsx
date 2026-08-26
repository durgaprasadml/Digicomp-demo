'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductGrid from '@/components/ProductGrid';
import CategoryFilter from '@/components/CategoryFilter';
import { PRODUCTS } from '@/data/products';
import { Search, SlidersHorizontal, Package, RefreshCw } from 'lucide-react';

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || '';
  const initialSearch = searchParams.get('search') || '';

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [sortBy, setSortBy] = useState<'id' | 'price-asc' | 'price-desc' | 'name' | 'stock'>('id');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((p) => {
      // Category filter
      if (selectedCategory && selectedCategory !== 'All') {
        if (p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesTags = p.tags.some((t) => t.toLowerCase().includes(q));

        if (!matchesName && !matchesSku && !matchesCategory && !matchesDesc && !matchesTags) {
          return false;
        }
      }

      // In-stock filter
      if (inStockOnly && p.stock <= 0) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'stock') return b.stock - a.stock;
      return a.id - b.id;
    });
  }, [selectedCategory, searchQuery, sortBy, inStockOnly]);

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSearchQuery('');
    setSortBy('id');
    setInStockOnly(false);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-7 h-7 text-sky-600" /> DigiComp Product Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse our complete inventory of 20 microcontroller dev boards, sensors, drivers, and robotics components.
          </p>
        </div>

        {/* Count Badge */}
        <div className="flex items-center gap-2 text-xs font-mono bg-white px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Showing {filteredProducts.length} of {PRODUCTS.length} Components</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <input
              type="text"
              placeholder="Search by component name, SKU (e.g. DC-ESP32-01), or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Sort By Dropdown */}
          <div className="md:col-span-3">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as 'id' | 'price-asc' | 'price-desc' | 'name' | 'stock')
                }
                className="w-full pl-8 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
              >
                <option value="id">Default (SKU Order)</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Product Name (A-Z)</option>
                <option value="stock">Stock Available</option>
              </select>
              <SlidersHorizontal className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* In Stock Checkbox & Reset */}
          <div className="md:col-span-3 flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500 h-4 w-4 border-slate-300"
              />
              <span>In-Stock Only</span>
            </label>

            {(selectedCategory || searchQuery || inStockOnly || sortBy !== 'id') && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <CategoryFilter
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => setSelectedCategory(cat)}
      />

      {/* Product Grid */}
      <ProductGrid products={filteredProducts} />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Loading product catalog...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
