import Link from 'next/link';

export default function PendingPage() {
  return (
    <div className="text-center flex flex-col items-center gap-5">
      <div className="w-16 h-16 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center">
        <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">Registration Submitted</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
          Your account is pending approval by the OJT Coordinator. You&apos;ll be able to sign in once your registration is approved.
        </p>
      </div>
      <div className="w-full rounded-xl bg-teal-50 border border-teal-100 px-5 py-4 text-left">
        <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">What happens next?</p>
        <ul className="text-sm text-slate-600 space-y-1.5">
          <li className="flex gap-2"><span className="text-teal-500 mt-0.5">✓</span> Your registration details are reviewed by the Coordinator</li>
          <li className="flex gap-2"><span className="text-teal-500 mt-0.5">✓</span> You will be notified once approved</li>
          <li className="flex gap-2"><span className="text-teal-500 mt-0.5">✓</span> Sign in after approval to access your OJT dashboard</li>
        </ul>
      </div>
      <Link href="/auth/sign-in" className="text-sm text-teal-700 hover:underline font-medium">
        Back to Sign In
      </Link>
    </div>
  );
}
