'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SignupRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/ai';

  useEffect(() => {
    router.replace(`/login?mode=signup&redirect=${encodeURIComponent(redirect)}`);
  }, [router, redirect]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-slate-500 text-sm">
      Opening DigiComp Sign Up...
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-slate-500 text-sm">Loading...</div>}>
      <SignupRedirectContent />
    </Suspense>
  );
}
