import Image from 'next/image';
import PublicFooter from '@/src/components/layout/PublicFooter';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col w-full bg-slate-900">
      {/* 🟢 TOP SECTION: 60/40 Split Screen Experience */}
      <div className="flex-1 flex flex-col lg:flex-row w-full">
        {/* 🟢 LEFT SIDE (60% Width): The Identity & Culture Zone */}
        <div className="lg:w-[58%] xl:w-[60%] relative flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-gradient-to-br from-[#062415] via-[#0A3D24] to-[#041a0f] text-white min-h-[360px] lg:min-h-[calc(100vh-100px)] overflow-hidden select-none">
          {/* Ambient Glows */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#FFCC00]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#0A3D24]/80 rounded-full blur-3xl pointer-events-none" />

          {/* Top Left: Single Prominent Brand Heading */}
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white p-1 border-2 border-[#FFCC00] shadow-xl shadow-black/40 flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="Colegio de Montalban Seal"
                width={72}
                height={72}
                className="w-full h-full object-contain rounded-full"
                priority
              />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#FFCC00] block mb-0.5">
                Official Practicum Portal
              </span>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#FFCC00] font-serif uppercase tracking-wider">
                Colegio de Montalban
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-200 tracking-wide mt-0.5">
                Institute of Computer Studies &bull; Institute of Business and Education
              </p>
            </div>
          </div>

          {/* Center: Inspiring Academic Statement */}
          <div className="relative z-10 my-8 lg:my-auto max-w-lg space-y-3">
            <div className="w-12 h-1 bg-[#FFCC00] rounded-full" />
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight font-serif">
              Empowering the Next Generation of Industry Leaders
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              A unified OJT management platform designed to monitor, verify, and evaluate student internship milestones with institutional integrity.
            </p>
          </div>

          {/* Bottom Left: Legal & Campus Compliance Footer */}
          <div className="relative z-10 pt-4 border-t border-white/10 text-[11px] text-slate-300 font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span>Rodriguez, Rizal</span>
              <span className="mx-2 text-slate-500">&bull;</span>
              <span className="text-slate-300">Kasiglahan Village</span>
            </div>
            <div className="text-[#FFCC00] font-bold">
              Republic Act 10173 (Data Privacy Act) Compliant
            </div>
          </div>
        </div>

        {/* ⚪ RIGHT SIDE (40% Width): The Action Zone */}
        <div className="lg:w-[42%] xl:w-[40%] bg-white flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-[500px] lg:min-h-[calc(100vh-100px)] relative z-10 shadow-2xl">
          {/* Top Right Access Badge */}
          <div className="hidden lg:flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400">
              CdM OJT System v1.2.0
            </span>
            <span className="text-[10px] font-bold text-[#0A3D24] uppercase tracking-wider bg-[#0A3D24]/10 px-3 py-1 rounded-full border border-[#0A3D24]/20">
              Secure Institutional Access
            </span>
          </div>

          {/* Centered Form Component */}
          <div className="w-full max-w-sm mx-auto my-auto py-4">
            {children}
          </div>

          {/* System Footnote at Bottom Right */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400 font-medium">
            <span>&copy; {new Date().getFullYear()} Colegio de Montalban</span>
            <span>ISO/IEC 25010:2023 &bull; MIS: mis@cdm.edu.ph</span>
          </div>
        </div>
      </div>

      {/* 🟢 BOTTOM SECTION: Interactive Multi-Column Directory Footer with Modals */}
      <PublicFooter />
    </div>
  );
}
