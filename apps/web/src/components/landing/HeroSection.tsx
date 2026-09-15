'use client';

import React from 'react';
import Image from 'next/image';
import { 
  Check, 
  ArrowRight, 
  Download, 
  MapPin, 
  Award
} from '@/src/components/ui/Icons';

interface HeroSectionProps {
  onOpenAccessPortal: () => void;
}

export default function HeroSection({ onOpenAccessPortal }: HeroSectionProps) {
  return (
    <section id="hero" className="relative bg-white text-slate-900 pt-8 pb-16 lg:pt-14 lg:pb-20 overflow-hidden border-b border-slate-200/80">
      {/* Subtle background ambient tint */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-50/70 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* LEFT COLUMN: Clean Educational Layout (Inspired by reference) */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-6">
            
            {/* Kicker bar */}
            <div className="flex items-center gap-2">
              <span className="w-8 h-1 bg-[#FFCC00] rounded-full" />
              <span className="text-xs uppercase font-extrabold tracking-widest text-[#0A3D24]">
                SHAPE YOUR PRACTICUM PATHWAY
              </span>
            </div>

            {/* Authoritative Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 font-serif leading-[1.12] tracking-tight">
              Better Training.<br />
              <span className="text-[#0A3D24]">Brighter Future.</span>
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl font-normal">
              Authentic industry practicum for 4th-year students of <strong className="font-semibold text-slate-900">Colegio de Montalban</strong>. Real-time GPS geofence verification, automated hour computation, and digital competency evaluations across <strong className="font-semibold text-slate-900">ICS</strong> and <strong className="font-semibold text-slate-900">IBE</strong>.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              <button
                onClick={onOpenAccessPortal}
                className="px-7 py-3.5 rounded-xl bg-[#062415] hover:bg-[#0A3D24] active:scale-98 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Launch Portal</span>
                <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#resources"
                className="px-6 py-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300/80 text-slate-800 font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-emerald-800" />
                <span>OJT Guidelines (PDF)</span>
              </a>
            </div>

            {/* Student Social Proof Ticker */}
            <div className="pt-6 border-t border-slate-100 flex items-center gap-4">
              <div className="flex -space-x-2 overflow-hidden">
                <div className="inline-block h-9 w-9 rounded-full ring-2 ring-white bg-emerald-800 text-amber-300 font-bold text-xs flex items-center justify-center shadow-xs">
                  JD
                </div>
                <div className="inline-block h-9 w-9 rounded-full ring-2 ring-white bg-emerald-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  MS
                </div>
                <div className="inline-block h-9 w-9 rounded-full ring-2 ring-white bg-slate-800 text-emerald-300 font-bold text-xs flex items-center justify-center shadow-xs">
                  CR
                </div>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                Join <strong className="text-emerald-900 font-bold">1,240+</strong> 4th-Year Trainees AY 2026–2027
              </p>
            </div>

          </div>

          {/* RIGHT COLUMN: Realistic Collegiate Student Portrait with Floating Badges */}
          <div className="lg:col-span-6 xl:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Main Student Portrait Container */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-100 aspect-[3/4]">
                <Image
                  src="/hero-student.jpg"
                  alt="Colegio de Montalban Student Trainee"
                  width={600}
                  height={800}
                  className="w-full h-full object-cover object-top"
                  priority
                />
                
                {/* Subtle gradient overlay at base */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#062415]/70 via-transparent to-transparent pointer-events-none" />

                {/* Bottom caption overlay */}
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-[10px] font-bold text-amber-300 mb-1">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    <span>Active Practicum Deployment</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-100">
                    Institute of Computing Studies &bull; 486 Hours Track
                  </p>
                </div>
              </div>

              {/* FLOATING TOP-RIGHT BADGE: 20+ Years / CHED Accreditations */}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 bg-white rounded-2xl p-4 shadow-xl border border-slate-200/80 flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                  <Award className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <div className="text-xl font-black text-slate-900 font-mono tracking-tight leading-none">
                    486<span className="text-amber-600">+</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mt-0.5">
                    Hours Certified
                  </span>
                </div>
              </div>

              {/* FLOATING BOTTOM-LEFT BADGE: Satellite GPS Geofence */}
              <div className="absolute -bottom-4 -left-4 sm:-bottom-5 sm:-left-6 bg-white rounded-2xl px-4 py-3 shadow-xl border border-slate-200/80 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                    GPS Geofence Verified
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    Zero Ghost Hours
                  </span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
