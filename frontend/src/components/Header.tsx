'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Search, Cpu, Sparkles, Menu, X, LogOut, User as UserIcon } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const router = useRouter();
  const { totalItemsCount } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const updateHeight = () => {
      const h = el.offsetHeight;
      if (h > 0) {
        document.documentElement.style.setProperty('--header-height', `${h}px`);
      }
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);

    return () => observer.disconnect();
  }, [isMobileMenuOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/products');
    }
  };

  const aiDestination = (query?: string) => {
    const target = query && query.trim() ? `/ai?product=${encodeURIComponent(query.trim())}` : '/ai';
    return isAuthenticated ? target : `/login?redirect=${encodeURIComponent(target)}`;
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
    router.refresh();
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner Notice */}
      <div className="bg-slate-900 text-slate-300 text-xs px-4 py-1.5 flex justify-between items-center border-b border-slate-800">
        <div className="container mx-auto flex justify-between items-center max-w-7xl">
          <span className="font-mono text-slate-400">DigiComp Industrial & Technical Distributor</span>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-slate-400">Same-Day Dispatch for In-Stock Items</span>
            <Link
              href={aiDestination()}
              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition-colors"
            >
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span>Ask DigiComp AI</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="container mx-auto px-4 py-3.5 max-w-7xl flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-9 h-9 bg-slate-900 text-sky-400 rounded flex items-center justify-center font-bold text-lg border border-slate-700 shadow-xs group-hover:bg-slate-800 transition-colors">
            <Cpu className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1">
              Digi<span className="text-sky-600">Comp</span>
            </div>
            <div className="text-[10px] text-slate-500 tracking-wider font-semibold uppercase -mt-1">
              Electronics & Microcontrollers
            </div>
          </div>
        </Link>

        {/* Search Bar - Desktop */}
        <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full flex items-center">
            <input
              type="text"
              placeholder="Search SKU, component name, sensor, MCU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-24 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900 placeholder-slate-400 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Link
              href={aiDestination(searchQuery)}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-2 bg-sky-600 hover:bg-sky-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-2xs"
              title="Ask DigiComp AI"
            >
              <Sparkles className="w-3 h-3 text-sky-200" />
              <span>Ask AI</span>
            </Link>
          </div>
        </form>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-700">
          <Link href="/" className="hover:text-sky-600 transition-colors">
            Home
          </Link>
          <Link href="/products" className="hover:text-sky-600 transition-colors">
            Products
          </Link>
          <Link href="/products?category=Microcontrollers" className="hover:text-sky-600 transition-colors">
            Categories
          </Link>
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Cart Icon Link */}
          <Link
            href="/cart"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:text-sky-600 hover:bg-slate-50 rounded-md border border-slate-200 transition-colors relative"
          >
            <ShoppingCart className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Cart</span>
            {totalItemsCount > 0 && (
              <span className="bg-sky-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {totalItemsCount}
              </span>
            )}
          </Link>

          {/* Ask AI Button in Header */}
          <Link
            href={aiDestination()}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded-md hover:bg-sky-100 hover:text-sky-800 transition-colors shadow-2xs"
          >
            <Sparkles className="w-4 h-4 text-sky-600" />
            <span>Ask DigiComp AI</span>
          </Link>

          {/* Auth State in Header */}
          {isAuthenticated && user ? (
            <div className="hidden sm:flex items-center gap-2 pl-1 border-l border-slate-200 ml-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-md text-xs font-semibold text-slate-800 max-w-[130px] truncate" title={user.email}>
                <UserIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="truncate">{user.name.split(' ')[0]}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden sm:flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-700 hover:text-sky-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Login</span>
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-md"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 px-4 pt-3 pb-5 space-y-3">
          <form onSubmit={handleSearchSubmit} className="w-full">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </form>
          <div className="flex flex-col space-y-2 font-medium text-slate-700 pt-1">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md hover:bg-slate-50"
            >
              Home
            </Link>
            <Link
              href="/products"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md hover:bg-slate-50"
            >
              Products Catalog
            </Link>
            <Link
              href="/products?category=Microcontrollers"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md hover:bg-slate-50"
            >
              Categories
            </Link>
            <Link
              href="/cart"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Shopping Cart</span>
              <span className="bg-sky-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {totalItemsCount}
              </span>
            </Link>
            <Link
              href={aiDestination()}
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md bg-sky-50 text-sky-700 font-semibold flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>Ask DigiComp AI</span>
            </Link>

            {isAuthenticated && user ? (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <UserIcon className="w-4 h-4 text-sky-600" />
                  <span>{user.name}</span>
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="text-xs text-red-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100 px-3">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2 text-xs font-bold text-sky-600"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>Login / Sign Up</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

