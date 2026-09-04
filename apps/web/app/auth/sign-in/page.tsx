'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { Eye, EyeOff, ShieldCheck, UserCheck, Trash2, ArrowRight, Clock, Monitor, Download } from '@/src/components/ui/Icons';
import { signIn } from '@/src/services/auth';

const STORAGE_KEY = 'ojt_remembered_profiles';

interface SavedProfile {
  full_name: string;
  email: string;
  role: string;
  last_login?: string;
}

const ROLE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  Coordinator: { label: 'OJT Coordinator', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  ProgramHead: { label: 'Program Head', bg: 'bg-blue-100', text: 'text-blue-800' },
  Supervisor: { label: 'Company Supervisor', bg: 'bg-purple-100', text: 'text-purple-800' },
  Admin: { label: 'System Admin', bg: 'bg-red-100', text: 'text-red-800' },
  Student: { label: 'Student Intern', bg: 'bg-amber-100', text: 'text-amber-800' },
};

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInactiveLogout = searchParams.get('reason') === 'inactivity';

  // Saved Profiles State (Facebook/Google style)
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<SavedProfile | null>(null);
  const [useAnotherAccount, setUseAnotherAccount] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Signing in...');
  const [error, setError] = useState('');

  // Staff Forgot Password State
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmployeeNumber, setResetEmployeeNumber] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // Load saved profiles from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: SavedProfile[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedProfiles(parsed);
          setSelectedProfile(parsed[0]); // Default to most recent profile
        }
      }
    } catch {}
  }, []);

  // Save or update profile in localStorage
  function saveProfileLocally(profile: SavedProfile) {
    try {
      const filtered = savedProfiles.filter(p => p.email.toLowerCase() !== profile.email.toLowerCase());
      const updated = [profile, ...filtered].slice(0, 4); // Keep top 4
      setSavedProfiles(updated);
      setSelectedProfile(profile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  // Remove a profile from localStorage
  function removeProfile(emailToRemove: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    try {
      const updated = savedProfiles.filter(p => p.email.toLowerCase() !== emailToRemove.toLowerCase());
      setSavedProfiles(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (selectedProfile?.email.toLowerCase() === emailToRemove.toLowerCase()) {
        if (updated.length > 0) {
          setSelectedProfile(updated[0]);
        } else {
          setSelectedProfile(null);
          setUseAnotherAccount(true);
        }
      }
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoadingText('Signing in...');

    const slowTimer = setTimeout(() => {
      setLoadingText('Connecting to CdM servers...');
    }, 2000);

    const loginEmail = selectedProfile && !useAnotherAccount ? selectedProfile.email : email;
    const result = await signIn({ email: loginEmail, password });
    clearTimeout(slowTimer);

    if (result.error) {
      setLoading(false);
      setError(result.error.message);
      return;
    }

    setLoadingText('Preparing your dashboard...');

    // Save profile locally for 1-click remembered sign-in next time
    if (result.data) {
      saveProfileLocally({
        full_name: result.data.full_name,
        email: result.data.email,
        role: result.data.role,
        last_login: new Date().toISOString(),
      });
    }

    router.push('/dashboard');
    router.refresh();
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetMessage('');
    setResetLoading(true);
    const { requestPasswordReset } = await import('@/src/services/auth');
    const result = await requestPasswordReset(resetEmail, resetEmployeeNumber, 'Staff');
    setResetLoading(false);
    if (result.error) {
      setResetMessage(result.error.message);
    } else {
      setResetMessage('Identity verified! A secure recovery link has been dispatched to your institutional inbox.');
    }
  }

  // VIEW 1: Clean Single-Form Faculty & Staff Account Recovery (Zero Tabs)
  if (showForgot) {
    return (
      <div className="page-fade-in space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-black text-[#0A3D24] font-serif">Staff Account Recovery</h2>
          </div>
          <p className="text-xs text-slate-500">
            Verify your institutional identity to securely receive a password recovery link.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-start gap-2.5">
          <div className="w-5 h-5 rounded-full bg-amber-200/80 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px] text-amber-800">
            i
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800">
            <strong>Faculty & Staff Verification:</strong> Please provide your official CdM Employee ID (e.g. 2024-001) and registered institutional email.
          </p>
        </div>

        <form onSubmit={handleResetRequest} className="flex flex-col gap-3.5">
          <Input
            label="Registered Institutional Email"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="msantos@cdm.edu.ph"
            required
          />

          <Input
            label="CdM Employee ID Number"
            type="text"
            value={resetEmployeeNumber}
            onChange={(e) => setResetEmployeeNumber(e.target.value)}
            placeholder="e.g. 2024-001"
            required
          />

          {resetMessage && (
            <Alert
              type={resetMessage.includes('dispatched') || resetMessage.includes('verified') || resetMessage.includes('Identity verified') ? 'success' : 'error'}
              message={resetMessage}
            />
          )}

          <Button type="submit" loading={resetLoading} className="w-full mt-1 bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold shadow-md shadow-[#0A3D24]/20 cursor-pointer">
            Verify Employee ID & Send Recovery Link
          </Button>

          {/* Student Trainee Guidance Box */}
          <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-[11px] text-slate-600">
              🎓 <strong>Student Trainee?</strong> Please reset your password directly in the official <strong>CdM Mobile App</strong> using your Student ID.
            </p>
          </div>

          <button
            type="button"
            onClick={() => { setShowForgot(false); setResetMessage(''); }}
            className="text-xs font-bold text-[#0A3D24] hover:text-[#062415] hover:underline text-center mt-1 cursor-pointer"
          >
            ← Back to Sign In
          </button>
        </form>
      </div>
    );
  }

  // VIEW 2: Remembered Profile Quick Login Card (Like Facebook/Google)
  if (selectedProfile && !useAnotherAccount) {
    const badge = ROLE_BADGES[selectedProfile.role] ?? ROLE_BADGES.Student;
    const firstName = selectedProfile.full_name.split(' ')[0] || 'User';

    return (
      <div className="page-fade-in">
        {isInactiveLogout && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-amber-800">
              <strong>Session Locked (ISO/IEC 25010:2023):</strong> You were automatically signed out after 15 minutes of inactivity to protect your account on shared campus computers.
            </p>
          </div>
        )}

        <div className="mb-4 text-center">
          <h2 className="text-xl font-black text-[#0A3D24] font-serif">Welcome Back</h2>
          <p className="text-xs text-slate-500 mt-0.5">Quick sign-in with your saved profile.</p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200/80 shadow-xs mb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#0A3D24] border-2 border-[#FFCC00] flex items-center justify-center shrink-0 shadow-xs">
              <span className="font-bold text-[#FFCC00] text-base">
                {firstName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-900 text-sm truncate">{selectedProfile.full_name}</p>
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              </div>
              <p className="text-xs text-slate-500 truncate">{selectedProfile.email}</p>
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => removeProfile(selectedProfile.email, e)}
              title="Remove profile"
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Password for {firstName}</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoFocus
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <Alert type="error" message={error} />}

          <Button type="submit" loading={loading} className="w-full mt-1 shadow-md shadow-[#0A3D24]/20 cursor-pointer">
            {loading ? loadingText : `Continue as ${firstName}`}
          </Button>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => { setUseAnotherAccount(true); setEmail(''); setPassword(''); }}
              className="font-bold text-[#0A3D24] hover:text-[#062415] hover:underline cursor-pointer"
            >
              Use Another Account
            </button>
            <button
              type="button"
              onClick={() => { setShowForgot(true); setError(''); }}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
        </form>

        {savedProfiles.length > 1 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Other Saved Profiles</p>
            <div className="space-y-1.5">
              {savedProfiles
                .filter(p => p.email.toLowerCase() !== selectedProfile.email.toLowerCase())
                .map(p => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => { setSelectedProfile(p); setPassword(''); }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-left transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                        {p.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{p.full_name}</p>
                        <p className="text-[10px] text-slate-400">{p.email}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW 3: Standard Clean Sign-In Form
  return (
    <div className="page-fade-in">
      {isInactiveLogout && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-amber-800">
            <strong>Session Locked (ISO/IEC 25010:2023):</strong> You were automatically signed out after 15 minutes of inactivity to protect your account on shared campus computers.
          </p>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-black text-[#0A3D24] font-serif">Sign In</h2>
        </div>
        <p className="text-xs text-slate-500">
          Enter your institutional credentials to access your portal.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Institutional Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="username@cdm.edu.ph"
          required
        />

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Password</label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && <Alert type="error" message={error} />}

        <Button type="submit" loading={loading} className="w-full mt-1 shadow-md shadow-[#0A3D24]/20 cursor-pointer">
          {loading ? loadingText : 'Sign In'}
        </Button>

        <div className="flex items-center justify-between text-xs pt-1">
          <Link href="/auth/register" className="font-bold text-[#0A3D24] hover:text-[#062415] hover:underline">
            Student Registration
          </Link>
          <button
            type="button"
            onClick={() => { setShowForgot(true); setError(''); }}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            Forgot password?
          </button>
        </div>

        {savedProfiles.length > 0 && useAnotherAccount && (
          <button
            type="button"
            onClick={() => setUseAnotherAccount(false)}
            className="text-xs font-bold text-[#0A3D24] hover:underline text-center mt-2 cursor-pointer"
          >
            ← Back to Saved Profiles
          </button>
        )}

        {/* Windows Desktop Client Download Option */}
        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <a
            href="/downloads/CdM-OJT-Portal-Setup-1.0.0.exe"
            download="CdM-OJT-Portal-Setup-1.0.0.exe"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#0A3D24] font-medium transition-colors"
          >
            <Monitor className="w-3.5 h-3.5 text-slate-400" />
            <span>Download Desktop Client for Windows</span>
          </a>
        </div>
      </form>
    </div>
  );
}
