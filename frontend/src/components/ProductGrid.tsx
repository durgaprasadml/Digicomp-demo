'use client';

import React from 'react';
import { Product } from '@/types/product';
import ProductCard from './ProductCard';
import { PackageX } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
}

export default function ProductGrid({ products, emptyMessage = 'No products found matching criteria.' }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center my-6 space-y-3">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <PackageX className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">{emptyMessage}</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Try clearing search filters or choosing another component category.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 my-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
