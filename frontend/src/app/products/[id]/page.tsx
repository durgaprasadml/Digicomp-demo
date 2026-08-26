'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getProductById, getProductsByCategory } from '@/data/products';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ProductCard';
import {
  ArrowLeft,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  Sparkles,
  Plus,
  Minus,
  Tag,
} from 'lucide-react';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = Number(params?.id);

  const product = getProductById(productId);
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState<number>(1);

  if (!product) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Component Not Found</h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          The product ID `{params?.id}` was not found in the DigiComp product catalog.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white text-xs font-semibold rounded-md hover:bg-sky-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Products Catalog
        </Link>
      </div>
    );
  }

  const relatedProducts = getProductsByCategory(product.category)
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  const isOutOfStock = product.stock === 0;

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > product.stock) return product.stock;
      return next;
    });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-10">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-sky-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Catalog
        </button>

        <div className="text-xs text-slate-400 font-mono">
          Catalog &gt; {product.category} &gt; {product.sku}
        </div>
      </div>

      {/* Main Product Detail Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 p-6 md:p-8">
          {/* Product Image Column */}
          <div className="md:col-span-6 flex flex-col items-center justify-center bg-slate-50 rounded-lg p-6 border border-slate-100 relative">
            <div className="relative w-full aspect-[4/3] flex items-center justify-center">
              <Image
                src={product.image_url || product.image}
                alt={product.name}
                width={600}
                height={450}
                className="object-contain max-h-full w-auto"
                unoptimized
                priority
              />
            </div>
            <div className="absolute top-4 left-4 bg-slate-900 text-white text-xs font-mono px-2.5 py-1 rounded">
              SKU: {product.sku}
            </div>
          </div>

          {/* Product Info & Actions Column */}
          <div className="md:col-span-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Category Tag */}
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold uppercase tracking-wider rounded">
                <Layers className="w-3.5 h-3.5" />
                {product.category}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {product.name}
              </h1>

              {/* Price & Stock */}
              <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-y border-slate-100">
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase">Unit Price</div>
                  <div className="text-3xl font-extrabold text-slate-900">
                    ₹{product.price.toLocaleString('en-IN')}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase mb-1">Availability</div>
                  {isOutOfStock ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-md border border-rose-200">
                      <AlertCircle className="w-4 h-4" /> Out of Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> In Stock ({product.stock} units)
                    </span>
                  )}
                </div>
              </div>

              {/* Short Description */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  Description
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
              </div>
            </div>

            {/* Add to Cart Controls */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-slate-700 uppercase">Quantity</span>
                <div className="flex items-center border border-slate-300 rounded bg-white overflow-hidden">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1 || isOutOfStock}
                    className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Decrease Quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-4 text-sm font-bold text-slate-900 min-w-[40px] text-center font-mono">
                    {quantity}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= product.stock || isOutOfStock}
                    className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Increase Quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => addToCart(product, quantity)}
                  disabled={isOutOfStock}
                  className={`flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-md transition-colors ${
                    isOutOfStock
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" /> Add to Cart
                </button>

                <Link
                  href={`/ai?product=${encodeURIComponent(product.name)}`}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-md transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-sky-400" /> Ask DigiComp AI about this product
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Specifications Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 md:p-8 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 border-b border-slate-100 pb-3">
          <Cpu className="w-5 h-5 text-sky-600" /> Technical Specifications
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <tbody>
              {Object.entries(product.specifications).map(([key, value], idx) => (
                <tr
                  key={key}
                  className={idx % 2 === 0 ? 'bg-slate-50/70' : 'bg-white'}
                >
                  <td className="py-2.5 px-4 font-semibold text-slate-700 border-b border-slate-100 w-1/3 font-mono">
                    {key}
                  </td>
                  <td className="py-2.5 px-4 text-slate-900 border-b border-slate-100">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tags */}
        <div className="pt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" /> Tags:
          </span>
          {product.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Related Components in {product.category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
