'use client';

import React, { useState } from 'react';
import LandingNavbar from '@/src/components/landing/LandingNavbar';
import HeroSection from '@/src/components/landing/HeroSection';
import AudienceGateways from '@/src/components/landing/AudienceGateways';
import ComplianceFramework from '@/src/components/landing/ComplianceFramework';
import PublicResourcesDepot from '@/src/components/landing/PublicResourcesDepot';
import PreFooterCta from '@/src/components/landing/PreFooterCta';
import AccessPortalModal from '@/src/components/landing/AccessPortalModal';
import PublicFooter from '@/src/components/layout/PublicFooter';

export default function LandingPageClient() {
  const [accessModalOpen, setAccessModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans selection:bg-[#FFCC00] selection:text-slate-950">
      {/* 1. Global Navigation Bar */}
      <LandingNavbar onOpenAccessPortal={() => setAccessModalOpen(true)} />

      <main className="flex-1">
        {/* 2. Hero Section: Clean Educational Layout with Real Collegiate Student Portrait */}
        <HeroSection onOpenAccessPortal={() => setAccessModalOpen(true)} />

        {/* 3. Approved Academic Programs (ICS & IBE) */}
        <AudienceGateways />

        {/* 4. Core Practicum Capabilities & Authentic CdM Building */}
        <ComplianceFramework />

        {/* 5. Official Tools & Certificate Verification */}
        <PublicResourcesDepot />

        {/* 6. Pre-Footer Call to Action Banner */}
        <PreFooterCta onOpenAccessPortal={() => setAccessModalOpen(true)} />
      </main>

      {/* 10. Institutional Enterprise Footer & Modals */}
      <PublicFooter />

      {/* 11. Interactive Access Portal Modal */}
      <AccessPortalModal 
        isOpen={accessModalOpen} 
        onClose={() => setAccessModalOpen(false)} 
      />
    </div>
  );
}
