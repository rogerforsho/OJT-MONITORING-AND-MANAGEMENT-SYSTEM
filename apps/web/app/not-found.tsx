import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F6F9] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#0A3D24]/10 text-[#0A3D24] flex items-center justify-center text-2xl font-bold mb-4 shadow-sm">
        404
      </div>
      <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
        Page Not Found
      </h1>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/auth/sign-in"
        className="mt-6 inline-flex items-center px-5 py-2.5 rounded-xl bg-[#0A3D24] hover:bg-[#072a19] text-[#FFCC00] font-semibold text-sm shadow-md transition-all active:scale-[0.98]"
      >
        Return to Portal
      </Link>
    </div>
  );
}
