import React from 'react';
import Link from 'next/link';
import { Cpu, ShieldCheck, Truck, Headphones, Sparkles } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 text-sm border-t border-slate-800">
      {/* Distributor Trust Badges */}
      <div className="border-b border-slate-800 bg-slate-950/50 py-6">
        <div className="container mx-auto px-4 max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-6 text-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-sky-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-white text-xs uppercase tracking-wider">Fast Dispatch</div>
              <div className="text-xs text-slate-400">Same-day shipping for verified orders</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-sky-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-white text-xs uppercase tracking-wider">Quality Tested</div>
              <div className="text-xs text-slate-400">Industrial & OEM grade components</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-sky-400 shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-white text-xs uppercase tracking-wider">Technical Support</div>
              <div className="text-xs text-slate-400">Engineering datasheet assistance</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-sky-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-white text-xs uppercase tracking-wider">AI Assistant</div>
              <div className="text-xs text-slate-400">Smart component selection helper</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-10 max-w-7xl grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Brand & About */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sky-500 text-slate-950 rounded flex items-center justify-center font-bold">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Digi<span className="text-sky-400">Comp</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
            DigiComp is a professional electronics and microcontroller distributor providing developers, engineers, and researchers with reliable prototyping hardware, sensors, motors, and robotics components.
          </p>
          <div className="pt-2 text-xs font-mono text-slate-500">
            Platform Version 1.0.0 &bull; Prototype Foundation
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="font-semibold text-white text-xs uppercase tracking-wider mb-3">Product Catalog</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/products?category=Microcontrollers" className="hover:text-sky-400 transition-colors">
                Microcontrollers
              </Link>
            </li>
            <li>
              <Link href="/products?category=Sensors" className="hover:text-sky-400 transition-colors">
                Sensors & Modules
              </Link>
            </li>
            <li>
              <Link href="/products?category=Motor Drivers" className="hover:text-sky-400 transition-colors">
                Motor Drivers & CNC
              </Link>
            </li>
            <li>
              <Link href="/products?category=Motors" className="hover:text-sky-400 transition-colors">
                DC & Stepper Motors
              </Link>
            </li>
            <li>
              <Link href="/products?category=Robotics" className="hover:text-sky-400 transition-colors">
                Robotics & Chassis
              </Link>
            </li>
          </ul>
        </div>

        {/* More Categories */}
        <div>
          <h4 className="font-semibold text-white text-xs uppercase tracking-wider mb-3">Hardware & Power</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/products?category=Power" className="hover:text-sky-400 transition-colors">
                Power Supplies & Buck
              </Link>
            </li>
            <li>
              <Link href="/products?category=Displays" className="hover:text-sky-400 transition-colors">
                OLED & LCD Displays
              </Link>
            </li>
            <li>
              <Link href="/products?category=Accessories" className="hover:text-sky-400 transition-colors">
                Wires & Accessories
              </Link>
            </li>
            <li>
              <Link href="/products" className="hover:text-sky-400 transition-colors">
                All 20 Demo Items
              </Link>
            </li>
          </ul>
        </div>

        {/* AI Navigation */}
        <div>
          <h4 className="font-semibold text-white text-xs uppercase tracking-wider mb-3">AI & Support</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/ai" className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Ask DigiComp AI
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-sky-400 transition-colors">
                Shopping Cart
              </Link>
            </li>
            <li>
              <Link href="/products" className="hover:text-sky-400 transition-colors">
                Engineering Search
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-slate-800 py-4 bg-slate-950 text-xs text-slate-500 text-center">
        <div className="container mx-auto px-4 max-w-7xl flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>&copy; {new Date().getFullYear()} DigiComp Electronics Corp. All rights reserved.</span>
          <span>Designed for Prototyping & AI Electronics Assistance</span>
        </div>
      </div>
    </footer>
  );
}
