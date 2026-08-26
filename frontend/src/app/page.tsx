import React from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { PRODUCTS, CATEGORIES } from '@/data/products';
import { ArrowRight, Sparkles, Zap, Layers, Compass } from 'lucide-react';

export default function HomePage() {
  const featuredProducts = PRODUCTS.slice(0, 8);

  const categoryIcons: Record<string, string> = {
    Microcontrollers: '⚡',
    Sensors: '📡',
    'Motor Drivers': '⚙️',
    Motors: '🛞',
    Robotics: '🤖',
    Power: '🔋',
    Displays: '🖥️',
    Accessories: '🧵',
  };

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section */}
      <section className="bg-slate-900 text-white border-b border-slate-800 py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 text-sky-400 text-xs font-semibold rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Prototyping Platform & AI Shopping Assistant</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Precision Electronics & Microcontroller Components
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              DigiComp supplies high-grade development boards, sensors, motor drivers, displays, and robotics hardware for engineers, developers, and makers.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/products"
                className="flex items-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-md shadow-sm transition-colors"
              >
                <span>Browse 20 Demo Products</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/ai"
                className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold rounded-md border border-slate-700 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>Ask DigiComp AI</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-7xl px-4 space-y-12">
        {/* Category Grid Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-600" /> Component Categories
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Explore standardized microcontroller hardware and peripheral modules
              </p>
            </div>
            <Link
              href="/products"
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              View All Categories <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/products?category=${encodeURIComponent(category)}`}
                className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs hover:border-sky-500 hover:shadow-xs transition-all group flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded bg-slate-50 border border-slate-200 text-xl flex items-center justify-center shrink-0 group-hover:bg-sky-50 group-hover:border-sky-200 transition-colors">
                  {categoryIcons[category] || '📦'}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                    {category}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">Industrial Grade</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Products */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Zap className="w-5 h-5 text-sky-600" /> Featured Microcontroller Hardware
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Top requested development boards and essential sensor breakdown
              </p>
            </div>
            <Link
              href="/products"
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              See All 20 Catalog Items <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        {/* AI Assistant Callout Banner */}
        <section className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-8 text-white border border-slate-800 shadow-md">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 uppercase tracking-wider">
                <Compass className="w-4 h-4" /> AI Electronics Shopping Assistant
              </div>
              <h3 className="text-2xl font-bold text-white">Need help choosing components for your project?</h3>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                Tell DigiComp AI what you want to build—such as an automated plant watering system, obstacle avoiding robot, or IoT weather station—and it will recommend matching parts from our catalog!
              </p>
            </div>
            <Link
              href="/ai"
              className="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-lg shrink-0 flex items-center gap-2 transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch DigiComp AI</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
