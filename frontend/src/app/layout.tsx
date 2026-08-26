import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FloatingAIButton from '@/components/FloatingAIButton';

export const metadata: Metadata = {
  title: 'DigiComp | Electronics & Microcontroller Components',
  description:
    'DigiComp is a professional electronics and microcontroller distributor offering ESP32, Arduino, sensors, motor drivers, motors, and robotics prototyping hardware.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50 text-slate-900 antialiased">
      <body className="min-h-screen flex flex-col font-sans">
        <AuthProvider>
          <CartProvider>
            <Header />
            <main className="flex-1 flex flex-col min-h-0 bg-slate-50">{children}</main>
            <Footer />
            <FloatingAIButton />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

