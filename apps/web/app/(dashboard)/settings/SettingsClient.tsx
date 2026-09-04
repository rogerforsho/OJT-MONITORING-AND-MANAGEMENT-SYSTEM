'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { AuthUser } from '@ojt/shared';
import { changeUserPassword } from '@/src/services/auth';
import {
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  User,
  Building2,
  Lock,
} from '@/src/components/ui/Icons';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Card, CardContent } from '@/src/components/ui/Card';

interface Props {
  user: AuthUser;
  extraDetails?: {
    course?: string;
    studentNumber?: string;
    department?: string;
    companyName?: string;
  };
}

export default function SettingsClient({ user, extraDetails }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Compute password strength
  const getStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (pwd.length >= 12) score += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  const strength = getStrength(newPassword);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (newPassword.length < 8) {
      setMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setLoading(true);
    const result = await changeUserPassword(currentPassword, newPassword);
    setLoading(false);

    if (result.error) {
      setMsg({ type: 'error', text: result.error.message });
    } else {
      setMsg({
        type: 'success',
        text: 'Your password has been successfully updated! Use your new password on your next login.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-7 max-w-5xl page-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A3D24] hover:text-[#062415] hover:underline mb-1.5 transition-colors cursor-pointer"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-serif">
            Account & Security Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your personal profile information and update your account password.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-full shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Authenticated Session
          </span>
        </div>
      </div>

      {/* Alert Notifications */}
      {msg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-3 shadow-xs ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <p className="leading-relaxed">{msg.text}</p>
        </div>
      )}

      {/* Main Grid: Profile Info & Change Password */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-start">
        {/* Left Column: User Profile Details Card */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-slate-200/80 shadow-xs overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-[#062415] via-[#0A3D24] to-[#041a0f] p-4 flex items-center justify-end">
              <div className="w-8 h-8 rounded-lg bg-white/10 p-1 border border-[#FFCC00]/40 flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="CdM Seal"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
            </div>

            <CardContent className="p-5 pt-0 relative">
              <div className="-mt-10 mb-3 flex items-end justify-between">
                <div className="w-16 h-16 rounded-2xl bg-[#0A3D24] text-[#FFCC00] border-4 border-white shadow-md flex items-center justify-center font-bold text-xl">
                  {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </div>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#0A3D24] text-[#FFCC00] uppercase tracking-wider border border-[#FFCC00]/30 shadow-2xs">
                  {user.role}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {user.full_name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">{user.email}</p>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Account Status</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase text-[10px]">
                    {user.account_status}
                  </span>
                </div>

                {extraDetails?.course && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400 font-medium shrink-0">Program</span>
                    <span className="font-bold text-slate-800 text-right truncate">
                      {extraDetails.course}
                    </span>
                  </div>
                )}

                {extraDetails?.studentNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Student ID</span>
                    <span className="font-mono font-bold text-slate-800">
                      {extraDetails.studentNumber}
                    </span>
                  </div>
                )}

                {extraDetails?.department && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Department</span>
                    <span className="font-bold text-slate-800">
                      {extraDetails.department}
                    </span>
                  </div>
                )}

                {extraDetails?.companyName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Host Company</span>
                    <span className="font-bold text-slate-800 truncate max-w-[140px]">
                      {extraDetails.companyName}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Security Information Box */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>Temporary Password Notice</span>
            </div>
            <p className="text-[11px] text-amber-800/90 leading-relaxed">
              If you are logging in with a default or temporary password provided by your institution, please create a new, private password below to secure your practicum records.
            </p>
          </div>
        </div>

        {/* Right Column: Security & Change Password Card */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-6 sm:p-7 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0 shadow-2xs">
                  <Key className="w-5 h-5 text-[#0A3D24]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Change Account Password</h2>
                  <p className="text-xs text-slate-500">
                    Update your password to keep your CdM practicum portal secure.
                  </p>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {/* Current Password Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Current Password <span className="text-slate-400 font-normal">(Leave blank if first-time setup)</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? 'text' : 'password'}
                      placeholder="Enter your current password..."
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    New Secure Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showNew ? 'text' : 'password'}
                      placeholder="At least 8 characters..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {newPassword.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-400">Password Strength:</span>
                        <span
                          className={
                            strength <= 25
                              ? 'text-rose-600'
                              : strength <= 50
                              ? 'text-amber-600'
                              : strength <= 75
                              ? 'text-blue-600'
                              : 'text-emerald-600'
                          }
                        >
                          {strength <= 25
                            ? 'Weak (Min 8 chars)'
                            : strength <= 50
                            ? 'Fair'
                            : strength <= 75
                            ? 'Good'
                            : 'Strong & Secure'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            strength <= 25
                              ? 'bg-rose-500 w-1/4'
                              : strength <= 50
                              ? 'bg-amber-500 w-2/4'
                              : strength <= 75
                              ? 'bg-blue-500 w-3/4'
                              : 'bg-emerald-500 w-full'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm New Password Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your new password..."
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-[11px] font-bold text-rose-600 pt-0.5">
                      Passwords do not match.
                    </p>
                  )}
                </div>

                <div className="pt-3">
                  <Button
                    type="submit"
                    loading={loading}
                    className="w-full bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold py-2.5 rounded-xl cursor-pointer shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    <span>Save & Update Password</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
