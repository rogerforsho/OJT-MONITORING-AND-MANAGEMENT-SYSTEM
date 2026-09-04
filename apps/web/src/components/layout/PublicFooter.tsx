'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Shield,
  ShieldCheck,
  FileText,
  HelpCircle,
  Code,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MapPin,
  Clock,
  Download,
  Monitor,
  CheckCircle2,
  X,
  Building2,
  GraduationCap,
  Users,
  Award,
} from '@/src/components/ui/Icons';

type ActiveModal = 'privacy' | 'terms' | 'faqs' | 'developers' | null;
type FaqCategory = 'student' | 'coordinator' | 'supervisor' | 'technical';

export default function PublicFooter() {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [activeFaqTab, setActiveFaqTab] = useState<FaqCategory>('student');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Close modal on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setActiveModal(null);
      }
    }
    if (activeModal) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [activeModal]);

  const openModal = (modal: ActiveModal) => {
    setActiveModal(modal);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <>
      <footer className="w-full bg-[#041a0f] text-slate-300 border-t border-emerald-950/80 relative z-20 select-none">
        {/* Top Decorative Border Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-800 via-[#FFCC00] to-[#0A3D24]" />

        {/* Main Directory Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* 🏫 Column 1: Institutional Identity (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-white p-0.5 border-2 border-[#FFCC00] shadow-md shadow-black/30 flex items-center justify-center shrink-0">
                  <Image
                    src="/logo.png"
                    alt="Colegio de Montalban Seal"
                    width={44}
                    height={44}
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#FFCC00] block">
                    Institutional Practicum Portal
                  </span>
                  <h3 className="text-base font-black text-white font-serif tracking-wide uppercase">
                    Colegio de Montalban
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed pr-2">
                Unified On-the-Job Training Monitoring & Management System engineered to automate trainee attendance verification, geofenced biometric timekeeping, and academic milestone tracking.
              </p>

              {/* System Status Pill */}
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  All Systems Operational
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900/60 px-2 py-1 rounded border border-slate-800">
                  v1.2.0 • ISO/IEC 25010
                </span>
              </div>
            </div>

            {/* 📚 Column 2: Quick Navigation & Guides (3 Cols) */}
            <div className="lg:col-span-3 space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFCC00] flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#FFCC00]" />
                User Guides & Resources
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => {
                      setActiveFaqTab('student');
                      openModal('faqs');
                    }}
                    className="hover:text-[#FFCC00] transition-colors text-slate-300 flex items-center gap-1.5 text-left cursor-pointer"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Student Trainee Onboarding</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveFaqTab('coordinator');
                      openModal('faqs');
                    }}
                    className="hover:text-[#FFCC00] transition-colors text-slate-300 flex items-center gap-1.5 text-left cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Faculty Coordinator Handbook</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveFaqTab('supervisor');
                      openModal('faqs');
                    }}
                    className="hover:text-[#FFCC00] transition-colors text-slate-300 flex items-center gap-1.5 text-left cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>HTE Supervisor Validation Guide</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveFaqTab('technical');
                      openModal('faqs');
                    }}
                    className="hover:text-[#FFCC00] transition-colors text-slate-300 flex items-center gap-1.5 text-left cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Frequently Asked Questions (FAQs)</span>
                  </button>
                </li>
                <li className="pt-1">
                  <a
                    href="/downloads/CdM-OJT-Portal-Setup-1.0.0.exe"
                    download="CdM-OJT-Portal-Setup-1.0.0.exe"
                    className="inline-flex items-center gap-1.5 text-emerald-300 hover:text-[#FFCC00] transition-colors text-xs font-medium"
                  >
                    <Monitor className="w-3.5 h-3.5 text-[#FFCC00]" />
                    <span>Windows Desktop App (.exe)</span>
                    <Download className="w-3 h-3 ml-0.5 opacity-70" />
                  </a>
                </li>
              </ul>
            </div>

            {/* ⚖️ Column 3: Legal & Institutional Governance (2 Cols) */}
            <div className="lg:col-span-2 space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFCC00] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FFCC00]" />
                Governance & Legal
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => openModal('privacy')}
                    className="hover:text-[#FFCC00] transition-colors text-slate-300 text-left cursor-pointer flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Privacy Policy (RA 10173)</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openModal('terms')}
                    className="hover:text-[#FFCC00] transition-colors text-slate-300 text-left cursor-pointer flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Terms of Service</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openModal('privacy')}
                    className="hover:text-[#FFCC00] transition-colors text-slate-400 text-[11px] text-left cursor-pointer"
                  >
                    <span>Biometric & GPS Retention</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openModal('terms')}
                    className="hover:text-[#FFCC00] transition-colors text-slate-400 text-[11px] text-left cursor-pointer"
                  >
                    <span>CHED CMO 104 Standard</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* 📍 Column 4: Contact & Office Directory (3 Cols) */}
            <div className="lg:col-span-3 space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFCC00] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#FFCC00]" />
                Practicum & Support
              </h4>
              <div className="space-y-2.5 text-xs text-slate-400">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    Practicum & Placement Office<br />
                    Kasiglahan Village, San Jose, Rodriguez, Rizal 1860
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <a
                    href="mailto:ojt-support@cdm.edu.ph"
                    className="hover:text-[#FFCC00] transition-colors text-slate-300"
                  >
                    ojt-support@cdm.edu.ph
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <a
                    href="mailto:mis@cdm.edu.ph"
                    className="hover:text-[#FFCC00] transition-colors text-slate-400 text-[11px]"
                  >
                    mis@cdm.edu.ph (Technical MIS)
                  </a>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Mon – Fri: 8:00 AM – 5:00 PM PHT</span>
                </div>
              </div>
            </div>
          </div>

          {/* 🌟 Capstone Engineering Spotlight Banner */}
          <div className="mt-10 pt-6 border-t border-emerald-950/60 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900/50 to-emerald-950/40 border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FFCC00]/10 border border-[#FFCC00]/30 flex items-center justify-center text-[#FFCC00] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  Designed & Engineered by ICS Capstone Research Group
                </p>
                <p className="text-[11px] text-slate-400">
                  Ralph Roger Vicente • Jay Baui • Jovelyn Golis • Jomar Suralta
                </p>
              </div>
            </div>

            <button
              onClick={() => openModal('developers')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] border border-[#FFCC00]/40 text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Code className="w-3.5 h-3.5" />
              Meet the Developers
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
          </div>

          {/* ⚖️ Bottom Sub-Footer Bar */}
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} Colegio de Montalban. All Rights Reserved.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => openModal('privacy')}
                className="hover:text-[#FFCC00] transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
              <span>&bull;</span>
              <button
                onClick={() => openModal('terms')}
                className="hover:text-[#FFCC00] transition-colors cursor-pointer"
              >
                Terms of Service
              </button>
              <span>&bull;</span>
              <button
                onClick={() => openModal('faqs')}
                className="hover:text-[#FFCC00] transition-colors cursor-pointer"
              >
                Help & Guides
              </button>
              <span>&bull;</span>
              <button
                onClick={() => openModal('developers')}
                className="hover:text-[#FFCC00] transition-colors cursor-pointer"
              >
                Development Team
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 🛡️ MODAL 1: PRIVACY POLICY (REPUBLIC ACT 10173) */}
      {/* ========================================================================= */}
      {activeModal === 'privacy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/30 text-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/60 bg-gradient-to-r from-[#062415] to-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Institutional Privacy Policy</h3>
                  <p className="text-[11px] text-emerald-400 font-medium">
                    Compliant with Republic Act No. 10173 (Data Privacy Act of 2012)
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto px-6 py-5 space-y-4 text-xs leading-relaxed text-slate-300">
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-200 text-xs">
                <strong>Statement of Commitment:</strong> Colegio de Montalban upholds the fundamental human right to privacy and protects all personal, sensitive, and academic data processed within the On-the-Job Training Monitoring & Management Portal.
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#FFCC00] mb-1.5">1. Information We Collect</h4>
                <p>To fulfill practicum academic tracking under CHED CMO No. 104, s. 2017, the system collects:</p>
                <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-400">
                  <li><strong>Trainee Profile:</strong> Full name, student identification number, institutional email, course/program, and contact details.</li>
                  <li><strong>Biometric Attendance Data:</strong> Photographic selfie captures taken during Time-In and Time-Out for identity verification.</li>
                  <li><strong>Geolocation Coordinates:</strong> Precise GPS latitude, longitude, and geofence proximity at the time of clocking in/out.</li>
                  <li><strong>Practicum Documentation:</strong> Weekly accomplishment reports, Daily Time Records (DTR), and evaluation forms.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#FFCC00] mb-1.5">2. Lawful Purpose of Processing</h4>
                <p>Data gathered is used exclusively for:</p>
                <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-400">
                  <li>Validating mandatory required practicum duty hours (e.g., 300 to 600 hours).</li>
                  <li>Preventing fraudulent attendance logging and proxy timekeeping.</li>
                  <li>Academic reporting to the Practicum & Placement Office and College Dean.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#FFCC00] mb-1.5">3. Data Protection & Row-Level Security</h4>
                <p>
                  All database tables are governed by strict Row-Level Security (RLS). Passwords are cryptographically salted and hashed. Facial captures and location telemetry are transmitted over TLS 1.3 encrypted tunnels and stored in private cloud buckets accessible strictly to authorized coordinators.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#FFCC00] mb-1.5">4. Retention & Archival Policy</h4>
                <p>
                  In accordance with CHED and Philippine academic record retention standards, student practicum logs are archived for five (5) academic years following graduation, after which digital media files are securely purged.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#FFCC00] mb-1.5">5. Data Subject Rights & Contact</h4>
                <p>
                  As a data subject, you hold the right to be informed, right of access, right to rectification, and right to object. For inquiries or concerns, contact the CdM Data Protection Officer at <span className="text-emerald-400 font-mono">dpo@cdm.edu.ph</span> or the Practicum Office at <span className="text-emerald-400 font-mono">ojt-support@cdm.edu.ph</span>.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-emerald-950 bg-slate-950 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Document Ref: CDM-POL-DPA-2026</span>
              <button
                onClick={closeModal}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📜 MODAL 2: TERMS OF SERVICE */}
      {/* ========================================================================= */}
      {activeModal === 'terms' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/30 text-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/60 bg-gradient-to-r from-[#062415] to-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Terms of Service & Code of Conduct</h3>
                  <p className="text-[11px] text-amber-300 font-medium">
                    Practicum Management & Acceptable Use Policy
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto px-6 py-5 space-y-4 text-xs leading-relaxed text-slate-300">
              <div>
                <h4 className="text-sm font-bold text-[#FFCC00] mb-1.5">1. Acceptance of Terms</h4>
                <p>
                  By accessing or registering on the Colegio de Montalban OJT Portal, you agree to adhere to these Terms of Service, the CdM Student Handbook, and applicable national training guidelines under CHED.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#FFCC00] mb-1.5">2. Trainee Integrity & Anti-Spoofing</h4>
                <p>Student trainees are strictly prohibited from:</p>
                <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-400">
                  <li>Using mock locations, VPNs, GPS spoofing apps, or emulator bypasses.</li>
                  <li>Performing proxy check-ins for classmates or sharing login credentials.</li>
                  <li>Uploading falsified or forged supervisor signatures on Daily Time Records.</li>
                </ul>
                <p className="mt-2 text-rose-300/90 font-medium">
                  Violation of these guidelines constitutes academic dishonesty and will result in invalidation of duty hours and referral to the College Disciplinary Committee.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#FFCC00] mb-1.5">3. Coordinator & Supervisor Responsibilities</h4>
                <p>
                  Faculty Coordinators and Company Supervisors must exercise due diligence in validating attendance logs, reviewing weekly progress narratives, and evaluating trainee competencies objectively.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#FFCC00] mb-1.5">4. System Availability & Service Windows</h4>
                <p>
                  The system operates 24/7. Scheduled maintenance windows occur during off-peak weekend hours with advance bulletin announcements. In case of unexpected server disruptions, trainees may submit manual log certifications countersigned by their HTE supervisor.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-emerald-950 bg-slate-950 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Effective Academic Year 2025–2026</span>
              <button
                onClick={closeModal}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ❓ MODAL 3: USER GUIDES & FAQS */}
      {/* ========================================================================= */}
      {activeModal === 'faqs' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/30 text-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/60 bg-gradient-to-r from-[#062415] to-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Practicum Guides & FAQs</h3>
                  <p className="text-[11px] text-emerald-300 font-medium">
                    Operational procedures for Trainees, Faculty, and Supervisors
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950 px-4 gap-1 overflow-x-auto">
              <button
                onClick={() => { setActiveFaqTab('student'); setExpandedFaq(0); }}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeFaqTab === 'student'
                    ? 'border-[#FFCC00] text-[#FFCC00]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Students / Trainees
              </button>
              <button
                onClick={() => { setActiveFaqTab('coordinator'); setExpandedFaq(0); }}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeFaqTab === 'coordinator'
                    ? 'border-[#FFCC00] text-[#FFCC00]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Faculty Coordinators
              </button>
              <button
                onClick={() => { setActiveFaqTab('supervisor'); setExpandedFaq(0); }}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeFaqTab === 'supervisor'
                    ? 'border-[#FFCC00] text-[#FFCC00]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Company Supervisors
              </button>
              <button
                onClick={() => { setActiveFaqTab('technical'); setExpandedFaq(0); }}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeFaqTab === 'technical'
                    ? 'border-[#FFCC00] text-[#FFCC00]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Technical & App Support
              </button>
            </div>

            {/* FAQ Questions Accordion */}
            <div className="overflow-y-auto px-6 py-5 space-y-3">
              {activeFaqTab === 'student' && (
                <>
                  <FaqItem
                    index={0}
                    expanded={expandedFaq === 0}
                    onToggle={() => setExpandedFaq(expandedFaq === 0 ? null : 0)}
                    question="How do I record my daily Time-In and Time-Out?"
                    answer="Open the Mobile App on your smartphone at your designated workplace. Tap 'Time In', allow GPS location and Camera permissions, and capture a clear selfie. The system validates that you are within your company's geofenced perimeter and stamps the exact timestamp."
                  />
                  <FaqItem
                    index={1}
                    expanded={expandedFaq === 1}
                    onToggle={() => setExpandedFaq(expandedFaq === 1 ? null : 1)}
                    question="What if my company has poor cellular reception or GPS drift?"
                    answer="Ensure you are near an open area or window when taking attendance. If the GPS accuracy is above 50 meters, the app will request you to re-acquire your location. For WFH (Work-From-Home) authorized shifts, use the Windows Desktop Client with coordinator approval."
                  />
                  <FaqItem
                    index={2}
                    expanded={expandedFaq === 2}
                    onToggle={() => setExpandedFaq(expandedFaq === 2 ? null : 2)}
                    question="How do I submit my Weekly Accomplishment Reports?"
                    answer="Navigate to the 'Reports' tab in your dashboard, select the target week, write your narrative summary of tasks performed, attach relevant documentation or photos, and click 'Submit'. Your coordinator and supervisor will review and approve it."
                  />
                </>
              )}

              {activeFaqTab === 'coordinator' && (
                <>
                  <FaqItem
                    index={0}
                    expanded={expandedFaq === 0}
                    onToggle={() => setExpandedFaq(expandedFaq === 0 ? null : 0)}
                    question="How do I approve newly registered student trainees?"
                    answer="Sign in with your Faculty credentials on the Web Portal. Go to 'Student Management' where you will find the 'Pending Approval' tab. Review their Student ID and course section, then click 'Approve Account'."
                  />
                  <FaqItem
                    index={1}
                    expanded={expandedFaq === 1}
                    onToggle={() => setExpandedFaq(expandedFaq === 1 ? null : 1)}
                    question="How do I assign or adjust a company's geofence coordinates?"
                    answer="In the 'Companies / HTE' directory, click 'Edit' on the partner organization. You can pin their exact latitude, longitude, and geofence radius (e.g., 100 meters) on the interactive map."
                  />
                  <FaqItem
                    index={2}
                    expanded={expandedFaq === 2}
                    onToggle={() => setExpandedFaq(expandedFaq === 2 ? null : 2)}
                    question="Can I generate automated compliance summaries for CHED audits?"
                    answer="Yes. In the 'Reports' module, select your section and click 'Export Official DTR Summary' to generate an ISO-formatted PDF and Excel spreadsheet with complete time records."
                  />
                </>
              )}

              {activeFaqTab === 'supervisor' && (
                <>
                  <FaqItem
                    index={0}
                    expanded={expandedFaq === 0}
                    onToggle={() => setExpandedFaq(expandedFaq === 0 ? null : 0)}
                    question="How do I verify the attendance of my interns?"
                    answer="Log in to the Web Portal or Mobile App using your supervisor credentials. You will see a real-time list of trainees clocked in at your facility, complete with timestamp and selfie verification."
                  />
                  <FaqItem
                    index={1}
                    expanded={expandedFaq === 1}
                    onToggle={() => setExpandedFaq(expandedFaq === 1 ? null : 1)}
                    question="When and how do I conduct midterm and final evaluations?"
                    answer="Once a trainee reaches 50% and 100% of their required duty hours, an automated evaluation notification will appear in your dashboard. Fill out the standardized rubrics (Quality of Work, Punctuality, Communication) and submit."
                  />
                </>
              )}

              {activeFaqTab === 'technical' && (
                <>
                  <FaqItem
                    index={0}
                    expanded={expandedFaq === 0}
                    onToggle={() => setExpandedFaq(expandedFaq === 0 ? null : 0)}
                    question="How do I download and install the Windows Desktop Client?"
                    answer="Click the 'Windows Desktop App (.exe)' link in the footer or login screen. Run the installer, sign in with your credentials, and enjoy native features like system tray parking and the floating shift stopwatch (Ctrl+M)."
                  />
                  <FaqItem
                    index={1}
                    expanded={expandedFaq === 1}
                    onToggle={() => setExpandedFaq(expandedFaq === 1 ? null : 1)}
                    question="What should I do if I forget my account password?"
                    answer="On the Sign-In screen, click 'Forgot your password?'. Enter your registered email address to receive a secure password reset link or reach out to the MIS Helpdesk at mis@cdm.edu.ph."
                  />
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-emerald-950 bg-slate-950 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Need direct assistance? Email ojt-support@cdm.edu.ph</span>
              <button
                onClick={closeModal}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Guides
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💻 MODAL 4: MEET THE DEVELOPERS (CAPSTONE RESEARCH GROUP) */}
      {/* ========================================================================= */}
      {activeModal === 'developers' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/30 text-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/60 bg-gradient-to-r from-[#062415] via-[#0A3D24] to-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFCC00]/15 border border-[#FFCC00]/30 flex items-center justify-center text-[#FFCC00]">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Engineering & Research Team
                  </h3>
                  <p className="text-[11px] text-[#FFCC00] font-semibold">
                    Institute of Computing Studies (ICS) &bull; Colegio de Montalban
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {/* Institution Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/60 to-slate-950 border border-emerald-500/20 text-slate-300">
                <div className="flex items-center gap-2 text-xs font-bold text-[#FFCC00] mb-1">
                  <Award className="w-4 h-4 text-[#FFCC00]" />
                  <span>BS Information Technology — Capstone Project AY 2025–2026</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Developed as an institutional solution to digitize, streamline, and uphold academic integrity for the On-the-Job Training Program of Colegio de Montalban.
                </p>
              </div>

              {/* Developer Cards Grid (2x2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Ralph Roger Vicente */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-all space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white tracking-wide">
                        Ralph Roger Vicente
                      </h4>
                      <p className="text-[11px] font-bold text-[#FFCC00]">
                        Lead Full-Stack Developer & System Architect
                      </p>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      ICS / BSIT
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Spearheaded cloud architecture, RESTful API orchestration, PostgreSQL RLS schemas, cross-platform synchronization, and desktop client implementation.
                  </p>
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      Next.js
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      PostgreSQL
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      Electron
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      Cloud Arch
                    </span>
                  </div>
                </div>

                {/* 2. Jay Baui */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-all space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white tracking-wide">
                        Jay Baui
                      </h4>
                      <p className="text-[11px] font-bold text-[#FFCC00]">
                        Core Systems & Full-Stack Developer
                      </p>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      ICS / BSIT
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Designed reactive frontend interfaces, cross-platform mobile app navigation, trainee attendance check-in flows, and authentication ergonomics.
                  </p>
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      React Native
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      Expo
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      TailwindCSS
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      UX Design
                    </span>
                  </div>
                </div>

                {/* 3. Jovelyn Golis */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-all space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white tracking-wide">
                        Jovelyn Golis
                      </h4>
                      <p className="text-[11px] font-bold text-[#FFCC00]">
                        Research, Policy & Technical Documentation
                      </p>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      ICS / BSIT
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Conducted institutional research, CHED CMO No. 104 policy alignment, Data Privacy Act compliance frameworks, and academic manuscript publication.
                  </p>
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      CHED Policies
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      RA 10173
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      Manuscript
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      Ethics
                    </span>
                  </div>
                </div>

                {/* 4. Jomar Suralta */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/40 transition-all space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white tracking-wide">
                        Jomar Suralta
                      </h4>
                      <p className="text-[11px] font-bold text-[#FFCC00]">
                        Systems QA & Technical Documentation
                      </p>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      ICS / BSIT
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Formulated software quality assurance protocols, ISO/IEC 25010 testing matrices, user manual write-ups, and user acceptance verification (UAT).
                  </p>
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      ISO/IEC 25010
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      QA Testing
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      User Manuals
                    </span>
                    <span className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      UAT
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-emerald-950 bg-slate-950 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Colegio de Montalban &bull; Institute of Computing Studies</span>
              <button
                onClick={closeModal}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FaqItem({
  question,
  answer,
  expanded,
  onToggle,
}: {
  index: number;
  question: string;
  answer: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden transition-all">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-white hover:text-[#FFCC00] transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {question}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-3.5 pt-1 text-xs text-slate-300 leading-relaxed border-t border-slate-900">
          {answer}
        </div>
      )}
    </div>
  );
}
