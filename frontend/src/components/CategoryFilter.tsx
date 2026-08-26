'use client';

import React from 'react';
import { CATEGORIES } from '@/data/products';
import { Filter } from 'lucide-react';

interface CategoryFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export default function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
  const categoriesWithAll = ['All', ...CATEGORIES];

  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs mb-6">
      <div className="flex items-center gap-2 mb-2 px-1 text-slate-700">
        <Filter className="w-4 h-4 text-sky-600" />
        <span className="text-xs font-bold uppercase tracking-wider">Filter by Category</span>
      </div>

      {/* Pill buttons horizontal scroll */}
      <div className="flex flex-wrap gap-1.5">
        {categoriesWithAll.map((cat) => {
          const isActive = selectedCategory === cat || (cat === 'All' && !selectedCategory);
          return (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat === 'All' ? '' : cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
