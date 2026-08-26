'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export default function CartPage() {
  const { cartItems, updateQuantity, removeFromCart, clearCart, subtotal, totalItemsCount } =
    useCart();
  const [isCheckedOut, setIsCheckedOut] = useState(false);

  const shipping = subtotal > 1000 || subtotal === 0 ? 0 : 70;
  const taxEstimate = Math.round(subtotal * 0.18); // 18% GST demo calculation
  const grandTotal = subtotal + shipping + taxEstimate;

  const handleCheckoutDemo = () => {
    setIsCheckedOut(true);
  };

  if (isCheckedOut) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Demo Order Submitted!</h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Thank you for testing the DigiComp prototype cart. This is a client-side demo application for the upcoming DigiComp AI Assistant platform.
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <button
            onClick={() => {
              clearCart();
              setIsCheckedOut(false);
            }}
            className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800"
          >
            Start New Shopping Order
          </button>
          <Link
            href="/ai"
            className="px-5 py-2.5 bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold rounded-md hover:bg-sky-100 flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-sky-600" /> Ask DigiComp AI
          </Link>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Your Cart is Empty</h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          You have not added any microcontroller boards or sensors to your cart yet. Browse our 20 demo products to add hardware items.
        </p>
        <div className="pt-2">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white text-xs font-semibold rounded-md hover:bg-sky-700 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" /> Explore 20 Demo Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShoppingCart className="w-7 h-7 text-sky-600" /> Shopping Cart
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review your selected electronics hardware components ({totalItemsCount} total items)
          </p>
        </div>

        <button
          onClick={clearCart}
          className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 hover:underline"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear Cart
        </button>
      </div>

      {/* Cart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Items Table / Cards */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {cartItems.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  {/* Thumbnail & Product Title */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded p-1 shrink-0 flex items-center justify-center overflow-hidden">
                      <Image
                        src={product.image_url || product.image}
                        alt={product.name}
                        width={64}
                        height={64}
                        className="object-contain max-h-full"
                        unoptimized
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-sky-600 font-semibold uppercase">
                        {product.sku}
                      </div>
                      <Link
                        href={`/products/${product.id}`}
                        className="font-bold text-slate-900 text-sm hover:text-sky-600 transition-colors"
                      >
                        {product.name}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">
                        ₹{product.price.toLocaleString('en-IN')} each
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Line Total */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                    {/* Quantity Controls */}
                    <div className="flex items-center border border-slate-300 rounded bg-white overflow-hidden">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-bold text-slate-900 font-mono">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        disabled={quantity >= product.stock}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Subtotal for line */}
                    <div className="text-right min-w-[80px]">
                      <div className="text-xs text-slate-400">Total</div>
                      <div className="text-sm font-extrabold text-slate-900 font-mono">
                        ₹{(product.price * quantity).toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Remove Item */}
                    <button
                      onClick={() => removeFromCart(product.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Link
              href="/products"
              className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Continue Shopping
            </Link>
          </div>
        </div>

        {/* Order Summary Column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Order Summary
            </h2>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal ({totalItemsCount} items)</span>
                <span className="font-semibold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between">
                <span>Estimated Shipping</span>
                <span className="font-semibold text-slate-900">
                  {shipping === 0 ? <span className="text-emerald-600">FREE</span> : `₹${shipping}`}
                </span>
              </div>

              <div className="flex justify-between">
                <span>GST (18% Estimated)</span>
                <span className="font-semibold text-slate-900">₹{taxEstimate.toLocaleString('en-IN')}</span>
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-900">Estimated Total</span>
                <span className="text-xl font-extrabold text-slate-900 font-mono">
                  ₹{grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckoutDemo}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider rounded-md shadow-2xs transition-colors flex items-center justify-center gap-2"
            >
              <span>Proceed to Checkout (Demo)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-1.5 justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>DigiComp Demo Prototype Cart</span>
            </div>
          </div>

          {/* AI Helper Banner */}
          <div className="bg-slate-900 p-4 rounded-lg text-white space-y-2 border border-slate-800">
            <div className="flex items-center gap-1.5 text-sky-400 text-xs font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>Need complementary parts?</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ask DigiComp AI if you need additional jumper wires, resistors, or power modules for your order!
            </p>
            <Link
              href="/ai"
              className="inline-block text-xs font-semibold text-sky-400 hover:text-sky-300 pt-1"
            >
              Open DigiComp AI Assistant &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
