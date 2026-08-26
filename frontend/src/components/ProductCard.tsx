'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { Product } from '@/types/product';
import { useCart } from '@/context/CartContext';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const isOutOfStock = product.stock === 0;

  const imageSrc = product.image_url || product.image;
  const productHref = product.product_url || product.productUrl || `/products/${product.id}`;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col h-full overflow-hidden group">
      {/* Product Image Container */}
      <div className="relative w-full aspect-[4/3] bg-slate-50 border-b border-slate-100 overflow-hidden flex items-center justify-center p-3">
        <Image
          src={imageSrc}
          alt={product.name}
          width={400}
          height={300}
          className="object-contain max-h-full w-auto group-hover:scale-102 transition-transform duration-200"
          unoptimized
        />
        {/* Category & SKU badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
          <span className="bg-slate-900/90 text-white text-[10px] font-mono px-2 py-0.5 rounded font-medium">
            {product.sku}
          </span>
        </div>
      </div>

      {/* Product Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Category Tag */}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 mb-1">
            {product.category}
          </div>

          {/* Title */}
          <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-sky-600 transition-colors line-clamp-1">
            <Link href={productHref}>{product.name}</Link>
          </h3>

          {/* Short Description */}
          <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Stock & Pricing */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            {/* Price */}
            <div className="text-lg font-extrabold text-slate-900">
              ₹{product.price.toLocaleString('en-IN')}
            </div>

            {/* Stock Status Badge */}
            <div>
              {isOutOfStock ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3" /> ❌ Out of Stock
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ✅ In Stock ({product.stock})
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link
              href={productHref}
              className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> View Product
            </Link>

            <button
              onClick={() => addToCart(product, 1)}
              disabled={isOutOfStock}
              className={`flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded border transition-colors ${
                isOutOfStock
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-sky-600 hover:bg-sky-700 text-white border-sky-600 shadow-2xs'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
