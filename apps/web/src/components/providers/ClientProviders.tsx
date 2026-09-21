'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { ThemeProvider } from '@/src/components/theme/ThemeProvider';

const TopProgressBar = dynamic(() => import('@/src/components/ui/TopProgressBar'), { ssr: false });
const NetworkToast = dynamic(() => import('@/src/components/ui/NetworkToast'), { ssr: false });

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Suspense fallback={null}>
        <TopProgressBar />
      </Suspense>
      <NetworkToast />
      {children}
    </ThemeProvider>
  );
}
