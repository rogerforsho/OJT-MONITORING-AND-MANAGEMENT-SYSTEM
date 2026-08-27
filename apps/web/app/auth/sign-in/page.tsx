'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { signIn } from '@/src/services/auth';
import { X, Users, Trash2, ArrowRight } from '@/src/components/ui/Icons';

export interface SavedProfile {
  email: string;
  full_name: string;
  role: string;
  last_login: string;
}

const STORAGE_KEY = 'ojt_saved_profiles';

const ROLE_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  Student: { bg: 'bg-[#FFCC00]/15', text: 'text-[#0A3D24]', border: 'border-[#FFCC00]/60' },
  Coordinator: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  Supervisor: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  ProgramHead: { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-300' },
  Admin: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-300' },
};

export default function SignInPage() {
  const router = useRouter();

  // State
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<SavedProfile | null>(null);
  const [useAnotherAccount, setUseAnotherAccount] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Signing in...');
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
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

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoadingText('Authenticating credentials...');

    const targetEmail = (selectedProfile && !useAnotherAccount) ? selectedProfile.email : email;

    // Slow connection detector timer
    const slowTimer = setTimeout(() => {
      setLoadingText('Connecting to CdM servers...');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ojt-slow-connection', { detail: { slow: true } }));
      }
    }, 2500);

    const result = await signIn({ email: targetEmail, password });
    clearTimeout(slowTimer);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ojt-slow-connection', { detail: { slow: false } }));
    }

    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    // Save profile to remembered accounts on success
    if (result.data) {
      saveProfileLocally({
        email: result.data.email,
        full_name: result.data.full_name || targetEmail.split('@')[0],
        role: result.data.role || 'Student',
        last_login: new Date().toISOString(),
      });
    }

    setLoadingText('Redirecting to dashboard...');
    router.push('/dashboard');
    router.refresh();
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetMessage('');
    setResetLoading(true);
    const { requestPasswordReset } = await import('@/src/services/auth');
    const result = await requestPasswordReset(resetEmail);
    setResetLoading(false);
    if (result.error) {
      setResetMessage(result.error.message);
    } else {
      setResetMessage('If that email is registered, a secure recovery link has been dispatched to your inbox.');
    }
  }

  if (showForgot) {
    return (
      <div className="page-fade-in">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-black text-[#0A3D24] font-serif">Reset Password</h2>
          </div>
          <p className="text-xs text-slate-500">
            Enter your institutional email to receive a recovery link.
          </p>
        </div>
        <form onSubmit={handleResetRequest} className="flex flex-col gap-4">
          <Input
            label="Institutional Email"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="username@cdm.edu.ph"
            required
          />
          {resetMessage && (
            <Alert
              type={resetMessage.includes('dispatched') ? 'success' : 'error'}
              message={resetMessage}
            />
          )}
          <Button type="submit" loading={resetLoading} className="w-full mt-1 shadow-md shadow-[#0A3D24]/20">
            Send Reset Link
          </Button>
          <button
            type="button"
            onClick={() => setShowForgot(false)}
            className="text-xs font-bold text-[#0A3D24] hover:text-[#062415] hover:underline text-center mt-1 cursor-pointer"
          >
            Back to Sign In
          </button>
        </form>
      </div>
    );
  }

  // VIEW 1: Remembered Profile Quick Login Card (Like Facebook/Google)
  if (selectedProfile && !useAnotherAccount) {
    const badge = ROLE_BADGES[selectedProfile.role] ?? ROLE_BADGES.Student;
    const firstName = selectedProfile.full_name.split(' ')[0] || 'User';

    return (
      <div className="page-fade-in">
        <div className="mb-5 text-center">
          <h2 className="text-2xl font-black text-[#0A3D24] font-serif tracking-tight">
            Welcome Back!
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sign in to continue to your practicum portal.
          </p>
        </div>

        {/* Remembered Profile Card */}
        <div className="relative mb-5 p-4 rounded-2xl bg-gradient-to-b from-[#062415]/5 to-slate-50 border border-[#0A3D24]/20 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-[#0A3D24] text-[#FFCC00] border-2 border-[#FFCC00] flex items-center justify-center font-bold text-base shadow-sm shrink-0">
            {selectedProfile.full_name ? selectedProfile.full_name[0].toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {selectedProfile.full_name}
              </h3>
              <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badge.bg} ${badge.text} ${badge.border}`}>
                {selectedProfile.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono truncate mt-0.5">
              {selectedProfile.email}
            </p>
          </div>

          {/* Remove Profile Button */}
          <button
            type="button"
            onClick={(e) => removeProfile(selectedProfile.email, e)}
            title="Remove this profile from this device"
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Single Password Prompt */}
        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Enter Password</label>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(selectedProfile.email);
                  setShowForgot(true);
                }}
                className="text-xs text-slate-400 hover:text-[#0A3D24] hover:underline cursor-pointer"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoFocus
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:ring-2 focus:ring-[#0A3D24] focus:border-[#0A3D24] hover:border-slate-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0A3D24] text-sm p-1 transition-colors cursor-pointer"
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <Alert type="error" message={error} />}

          <Button
            type="submit"
            loading={loading}
            className="w-full mt-1 py-3 shadow-md shadow-[#0A3D24]/30 hover:shadow-lg transition-all text-sm font-extrabold"
          >
            {loading ? loadingText : `Continue as ${firstName}`}
          </Button>

          {/* List Other Saved Profiles if multiple exist */}
          {savedProfiles.length > 1 && (
            <div className="pt-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Other saved accounts:
              </p>
              <div className="space-y-1.5">
                {savedProfiles
                  .filter(p => p.email.toLowerCase() !== selectedProfile.email.toLowerCase())
                  .map(p => (
                    <button
                      key={p.email}
                      type="button"
                      onClick={() => {
                        setSelectedProfile(p);
                        setPassword('');
                        setError('');
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-between transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-[#0A3D24] text-[#FFCC00] flex items-center justify-center text-[10px] font-bold shrink-0">
                          {p.full_name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{p.full_name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{p.email}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-white text-slate-600 border uppercase">
                        {p.role}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Use Another Account Button */}
          <button
            type="button"
            onClick={() => {
              setUseAnotherAccount(true);
              setEmail('');
              setPassword('');
              setError('');
            }}
            className="w-full py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs mt-1"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            Log in with another account
          </button>

          {/* Footer Registration Link */}
          <div className="flex items-center justify-center text-xs pt-1 border-t border-slate-100">
            <Link
              href="/auth/register"
              className="text-[#0A3D24] hover:text-[#062415] font-bold hover:underline transition-colors"
            >
              New Student Trainee? Register here
            </Link>
          </div>
        </form>
      </div>
    );
  }

  // VIEW 2: Standard Sign In Form (Clean email + password)
  return (
    <div className="page-fade-in">
      <div className="mb-6">
        {savedProfiles.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setUseAnotherAccount(false);
              if (!selectedProfile && savedProfiles.length > 0) {
                setSelectedProfile(savedProfiles[0]);
              }
            }}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#0A3D24] hover:text-[#062415] bg-[#0A3D24]/10 hover:bg-[#0A3D24]/15 px-3 py-1 rounded-full border border-[#0A3D24]/20 transition-all cursor-pointer"
          >
            ← Back to saved profile ({savedProfiles[0]?.full_name.split(' ')[0]})
          </button>
        )}
        <h2 className="text-2xl font-black text-[#0A3D24] font-serif tracking-tight">Sign In</h2>
        <p className="text-xs text-slate-500 mt-1">
          Enter your institutional credentials to continue.
        </p>
      </div>

      <form onSubmit={handleSignIn} className="flex flex-col gap-4">
        {/* Dynamic Placeholder */}
        <Input
          label="Institutional Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="username@cdm.edu.ph"
          required
        />

        {/* Password field with Visibility Toggle */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs font-bold text-slate-700">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:ring-2 focus:ring-[#0A3D24] focus:border-[#0A3D24] hover:border-slate-300"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0A3D24] text-sm p-1 transition-colors cursor-pointer"
              title={showPassword ? 'Hide Password' : 'Show Password'}
              aria-label={showPassword ? 'Hide Password' : 'Show Password'}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && <Alert type="error" message={error} />}

        {/* Enhanced Visual Hierarchy Button */}
        <Button
          type="submit"
          loading={loading}
          className="w-full mt-1.5 py-3 shadow-md shadow-[#0A3D24]/30 hover:shadow-lg transition-all text-sm font-extrabold"
        >
          {loading ? loadingText : 'Sign In'}
        </Button>

        {/* Action Links with Clear Hover Underlines */}
        <div className="flex items-center justify-between text-xs pt-2">
          <Link
            href="/auth/register"
            className="text-[#0A3D24] hover:text-[#062415] font-bold hover:underline transition-colors"
          >
            Student Registration
          </Link>
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="text-slate-500 hover:text-[#0A3D24] font-medium hover:underline transition-colors cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
      </form>
    </div>
  );
}
